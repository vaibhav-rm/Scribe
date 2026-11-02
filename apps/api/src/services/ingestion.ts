import fs from "node:fs/promises";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { logger } from "../lib/logger.js";

export type FileKind = "pdf" | "docx" | "txt" | "md" | "source" | "other";

export interface ExtractedResource {
  kind: FileKind;
  text: string;
  mimeType: string;
  sizeBytes: number;
  pageCount?: number;
  wordCount?: number;
  metadata?: Record<string, unknown>;
  warning?: string; // e.g. scanned PDF may need OCR
}

const MIME_TO_KIND: Record<string, FileKind> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
  "text/markdown": "md",
  "text/x-markdown": "md",
};

export function detectKind(
  mimeType: string,
  filename?: string,
): FileKind {
  if (MIME_TO_KIND[mimeType]) return MIME_TO_KIND[mimeType];
  if (filename) {
    const lower = filename.toLowerCase();
    if (lower.endsWith(".pdf")) return "pdf";
    if (lower.endsWith(".docx")) return "docx";
    if (lower.endsWith(".txt")) return "txt";
    if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "md";
    if (
      lower.endsWith(".js") ||
      lower.endsWith(".ts") ||
      lower.endsWith(".py") ||
      lower.endsWith(".java") ||
      lower.endsWith(".cpp") ||
      lower.endsWith(".c") ||
      lower.endsWith(".html") ||
      lower.endsWith(".css") ||
      lower.endsWith(".json") ||
      lower.endsWith(".xml") ||
      lower.endsWith(".yaml") ||
      lower.endsWith(".yml") ||
      lower.endsWith(".toml") ||
      lower.endsWith(".cfg") ||
      lower.endsWith(".ini")
    ) {
      return "source";
    }
  }
  return "other";
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Extract text from an uploaded file buffer.
 * Handles empty, encrypted, malformed, and scanned PDFs honestly:
 * - scanned/image-only PDFs produce empty text with a warning about OCR
 * - encrypted/malformed PDFs throw a descriptive error
 */
export async function extractTextFromBuffer(
  buffer: Buffer,
  mimeType: string,
  filename?: string,
): Promise<ExtractedResource> {
  const kind = detectKind(mimeType, filename);
  const sizeBytes = buffer.length;

  switch (kind) {
    case "docx": {
      try {
        const result = await mammoth.extractRawText({ buffer });
        const text = result.value || "";
        const messages = result.messages || [];
        const warning = messages.length
          ? `DOCX parse notes: ${messages.map((m) => m.message).join("; ")}`
          : undefined;
        return {
          kind,
          text,
          mimeType,
          sizeBytes,
          wordCount: countWords(text),
          warning,
        };
      } catch (err) {
        logger.error({ err, filename }, "DOCX extraction failed");
        throw new Error("Failed to extract text from DOCX file");
      }
    }

    case "pdf": {
      try {
        const parser = new PDFParse({ data: buffer });
        const result = await parser.getText();
        const text = result.text || "";
        // PDFs with no extractable text (scanned/image-only) produce empty text
        const warning =
          text.trim().length === 0
            ? "No extractable text found. This may be a scanned or image-based PDF; OCR is not enabled in this deployment."
            : undefined;
        return {
          kind,
          text,
          mimeType,
          sizeBytes,
          pageCount: result.total,
          wordCount: countWords(text),
          warning,
        };
      } catch (err: any) {
        const msg = err?.message || String(err);
        if (/password|encrypted|permission/i.test(msg)) {
          throw new Error(
            "This PDF is encrypted/password-protected and cannot be parsed.",
          );
        }
        logger.error({ err, filename }, "PDF extraction failed");
        throw new Error("Failed to extract text from PDF file");
      }
    }

    case "txt":
    case "md":
    case "source":
    case "other": {
      try {
        const text = buffer.toString("utf8");
        return {
          kind,
          text,
          mimeType,
          sizeBytes,
          wordCount: countWords(text),
        };
      } catch (err) {
        logger.error({ err, filename }, "text extraction failed");
        throw new Error("Failed to read file as text");
      }
    }
  }
}

/**
 * Extract text from a file stored on disk (used for local path processing).
 */
export async function extractTextFromFile(
  filePath: string,
  mimeType: string,
  filename?: string,
): Promise<ExtractedResource> {
  const buffer = await fs.readFile(filePath);
  return extractTextFromBuffer(buffer, mimeType, filename);
}
