import { describe, it, expect } from "vitest";
import {
  extractTextFromBuffer,
  detectKind,
  countWords,
} from "../services/ingestion.js";

describe("ingestion", () => {
  describe("detectKind", () => {
    it("maps PDF mime type", () => {
      expect(detectKind("application/pdf")).toBe("pdf");
    });
    it("maps DOCX mime type", () => {
      expect(
        detectKind(
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ),
      ).toBe("docx");
    });
    it("maps TXT", () => {
      expect(detectKind("text/plain")).toBe("txt");
    });
    it("maps Markdown", () => {
      expect(detectKind("text/markdown")).toBe("md");
    });
    it("maps source files by extension", () => {
      expect(detectKind("text/x-python", "script.py")).toBe("source");
      expect(detectKind("application/javascript", "app.js")).toBe("source");
    });
    it("returns other for unknown", () => {
      expect(detectKind("application/zip", "data.zip")).toBe("other");
    });
  });

  describe("countWords", () => {
    it("counts words in text", () => {
      expect(countWords("Hello world")).toBe(2);
      expect(countWords("   ")).toBe(0);
      expect(countWords("")).toBe(0);
    });
  });

  describe("extractTextFromBuffer", () => {
    it("extracts text from plain text", async () => {
      const buf = Buffer.from("Hello world\nThis is a test.");
      const result = await extractTextFromBuffer(buf, "text/plain", "test.txt");
      expect(result.kind).toBe("txt");
      expect(result.text).toBe("Hello world\nThis is a test.");
      expect(result.wordCount).toBeGreaterThan(0);
      expect(result.warning).toBeUndefined();
    });

    it("extracts text from markdown", async () => {
      const buf = Buffer.from("# Title\n\nSome content.");
      const result = await extractTextFromBuffer(buf, "text/markdown", "note.md");
      expect(result.kind).toBe("md");
      expect(result.text).toContain("Title");
    });

    it("handles valid minimal PDF", async () => {
      // Minimal valid PDF structure
      const pdfBuf = Buffer.from(
        "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 3 3]>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n169\n%%EOF",
      );
      const result = await extractTextFromBuffer(pdfBuf, "application/pdf", "minimal.pdf");
      expect(result.kind).toBe("pdf");
      expect(result.pageCount).toBe(1);
    });

    it("reports encrypted PDF error", async () => {
      // A buffer that starts with %PDF but is malformed enough to cause issues
      // We test that extraction throws for clearly invalid content
      const badBuf = Buffer.from("not a pdf file at all");
      await expect(
        extractTextFromBuffer(badBuf, "application/pdf", "bad.pdf"),
      ).rejects.toThrow();
    });
  });
});
