import fs from "node:fs/promises";
import mammoth from "mammoth";
import {
  extractTemplateLayout,
  isContentTableLayout,
} from "./docx-template.js";

export interface TemplateSpecification {
  documentType?: string;
  pageSize?: string;
  margins?: { top?: number; bottom?: number; left?: number; right?: number };
  fonts?: { body?: string; heading?: string };
  fontSizes?: { body?: number; heading1?: number; heading2?: number };
  headingHierarchy: string[];
  paragraphSpacing?: number;
  lineSpacing?: number;
  pageNumbering?: boolean;
  headerFooter?: { header: boolean; footer: boolean };
  titlePage?: boolean;
  certificateDeclaration?: boolean;
  tableOfContents?: boolean;
  requiredSections: string[];
  requiredTables?: number;
  /** Table shells preserved from the uploaded DOCX and filled by the AI. */
  tables?: Array<{
    heading: string | null;
    headers: string[];
    rowLabels: string[];
  }>;
  figureCaptions?: boolean;
  referenceStyle?: string;
  appendices?: boolean;
  outputFormats: ("docx" | "pdf")[];
  notes?: string;
}

export interface ParseResult {
  specification: TemplateSpecification;
  rawText: string;
  warnings: string[];
}

/**
 * Parse a DOCX template buffer into a normalized template specification.
 * Uses mammoth to extract text and HTML structure, then heuristics to
 * identify headings, sections, and formatting hints.
 */
export async function parseDocxTemplate(
  buffer: Buffer,
): Promise<ParseResult> {
  const warnings: string[] = [];

  // Extract raw text
  const textResult = await mammoth.extractRawText({ buffer });
  const rawText = textResult.value || "";
  textResult.messages.forEach((m) => warnings.push(m.message));

  // Convert to HTML to identify heading structure
  const htmlResult = await mammoth.convertToHtml({ buffer });
  const html = htmlResult.value || "";
  htmlResult.messages.forEach((m) => warnings.push(m.message));

  // Identify headings from HTML h1-h6 tags
  const headingHierarchy = extractHeadingsFromHtml(html);

  // Identify required section titles from headings. Strip the H1/H2 markers so
  // prompts and specification review show readable section names, and drop
  // duplicates (templates often repeat headings in a table of contents).
  const requiredSections = Array.from(
    new Set(
      headingHierarchy.map((h) => h.replace(/^H[1-6]:\s*/, "").trim()).filter(Boolean),
    ),
  );

  // Detect placeholders like {{variable}} or [PLACEHOLDER]
  const placeholders = detectPlaceholders(rawText);

  // Heuristic: detect if document has tables (from HTML table tags)
  const tableCount = (html.match(/<table[^>]*>/gi) || []).length;

  // Heuristic: detect title page (first page has centered large text)
  const hasTitlePage = detectTitlePage(rawText);

  // Heuristic: detect table of contents
  const hasTableOfContents = /table of contents|contents/i.test(rawText);

  // Heuristic: detect headers/footers (page numbers, running text)
  const hasHeaderFooter = /page\s*\d+|header|footer/i.test(rawText);

  // Read the actual Word layout (page size, margins, table shells) so the
  // specification describes the file that will be used for export.
  let layout: Awaited<ReturnType<typeof extractTemplateLayout>> | null = null;
  try {
    layout = await extractTemplateLayout(buffer);
  } catch (error: any) {
    warnings.push(
      `Could not read Word layout: ${error?.message ?? "unknown error"}`,
    );
  }

  const specification: TemplateSpecification = {
    documentType: inferDocumentType(rawText, requiredSections),
    pageSize: layout?.pageSize ?? "A4",
    margins: layout?.margins ?? { top: 1, bottom: 1, left: 1, right: 1 },
    headingHierarchy,
    paragraphSpacing: 6, // pt, default
    lineSpacing: 1.5, // default academic line spacing
    pageNumbering: hasHeaderFooter,
    headerFooter: {
      header: hasHeaderFooter,
      footer: hasHeaderFooter,
    },
    titlePage: hasTitlePage,
    tableOfContents: hasTableOfContents,
    requiredSections,
    requiredTables: tableCount > 0 ? tableCount : undefined,
    tables: layout?.tables
      .filter(isContentTableLayout)
      .map((table) => ({
        heading: table.heading,
        headers: table.headers,
        rowLabels: table.rowLabels,
      })),
    outputFormats: ["docx", "pdf"],
    notes: placeholders.length
      ? `Detected ${placeholders.length} placeholder(s): ${placeholders.slice(0, 5).join(", ")}${placeholders.length > 5 ? "..." : ""}`
      : undefined,
  };

  return { specification, rawText, warnings };
}

/**
 * Extract heading text from HTML h1-h6 tags, preserving order.
 */
function extractHeadingsFromHtml(html: string): string[] {
  const headings: string[] = [];
  const headingRegex = /<h([1-6])[^>]*>(.*?)<\/h[1-6]>/gi;
  let match;
  while ((match = headingRegex.exec(html)) !== null) {
    const level = match[1];
    const text = match[2]
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim();
    if (text) {
      headings.push(`H${level}: ${text}`);
    }
  }
  return headings;
}

/**
 * Detect placeholder patterns in template text.
 */
function detectPlaceholders(text: string): string[] {
  const placeholders: string[] = [];
  // {{variable}} pattern
  const doubleBrace = text.match(/\{\{[^}]+\}\}/g) || [];
  placeholders.push(...doubleBrace);
  // [PLACEHOLDER] or [Field Name] pattern
  const bracketPlaceholder = text.match(/\[[A-Z][A-Za-z\s]+\]/g) || [];
  placeholders.push(...bracketPlaceholder);
  return placeholders;
}

/**
 * Detect if the document likely has a title page (first ~200 chars
 * contain title-like centered content).
 */
function detectTitlePage(text: string): boolean {
  const firstPage = text.slice(0, 500);
  const titleKeywords = ["project", "synopsis", "report", "declaration", "certificate"];
  const hasTitleKeyword = titleKeywords.some((k) =>
    firstPage.toLowerCase().includes(k),
  );
  return hasTitleKeyword;
}

/**
 * Infer document type from heading keywords.
 */
function inferDocumentType(
  rawText: string,
  headings: string[],
): string {
  const allText = (rawText + " " + headings.join(" ")).toLowerCase();

  const typeKeywords: Record<string, string[]> = {
    srs: ["software requirements", "requirement specification", "functional requirement", "non-functional"],
    project_proposal: ["proposal", "objectives", "budget", "timeline"],
    system_design: ["system design", "architecture", "component design", "diagram"],
    final_year_report: ["final year", "conclusion", "future work", "references"],
    literature_review: ["literature review", "existing work", "related work"],
    abstract: ["abstract", "summary"],
    progress_report: ["progress", "milestone", "status"],
    project_synopsis: ["synopsis", "problem statement", "methodology"],
  };

  for (const [type, keywords] of Object.entries(typeKeywords)) {
    if (keywords.some((k) => allText.includes(k))) {
      return type;
    }
  }

  return "project_synopsis"; // Default
}

export {
  extractHeadingsFromHtml,
  detectPlaceholders,
  inferDocumentType,
  detectTitlePage,
};

/**
 * Parse a template file from disk.
 */
export async function parseDocxTemplateFromFile(
  filePath: string,
): Promise<ParseResult> {
  const buffer = await fs.readFile(filePath);
  return parseDocxTemplate(buffer);
}
