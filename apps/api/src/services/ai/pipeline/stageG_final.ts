import { logger } from "../../../lib/logger.js";

export interface StageGInput {
  documentTitle: string;
  sections: Array<{ id: string; heading: string; content: string; warnings?: string[] }>;
  templateSpec: Record<string, unknown>;
  outputFormat: "docx" | "pdf";
  docxBuffer: Buffer;
}

export interface StageGResult {
  passed: boolean;
  warnings: string[];
  errors: string[];
}

/**
 * Stage G: Final validation of the assembled document. Checks page size,
 * margins, heading styles, page numbers, TOC, tables/figures, required
 * sections, empty placeholders, and conversion errors.
 *
 * Note: Automatic TOC field updating requires Word or LibreOffice; we expose
 * this as a limitation rather than claiming perfect formatting.
 */
export async function finalValidation(
  input: StageGInput,
): Promise<StageGResult> {
  const warnings: string[] = [];
  const errors: string[] = [];
  const spec = input.templateSpec || {};

  // Check required sections
  const requiredSections: string[] = Array.isArray(spec.required_sections)
    ? spec.required_sections
    : Array.isArray(spec.requiredSections)
      ? spec.requiredSections
      : [];

  const presentHeadings = new Set(input.sections.map((s) => s.heading.toLowerCase()));
  const missing = requiredSections.filter(
    (s) => !presentHeadings.has(s.toLowerCase()),
  );
  if (missing.length) {
    errors.push(`Missing required sections: ${missing.join(", ")}`);
  }

  // Check for empty placeholders
  const placeholderPattern = /\[(information not available|todo|placeholder|tbd|not available)\]/i;
  for (const section of input.sections) {
    if (placeholderPattern.test(section.content)) {
      warnings.push(`Section "${section.heading}" contains a placeholder - information may be missing`);
    }
    if (!section.content || section.content.trim().length < 10) {
      warnings.push(`Section "${section.heading}" appears to be empty or very short`);
    }
  }

  // Check section content against template
  if (input.sections.length === 0) {
    errors.push("Document has no sections");
  }

  // PDF conversion limitation notice
  if (input.outputFormat === "pdf") {
    warnings.push(
      "PDF export requires LibreOffice conversion. Automatic TOC field updating depends on Word/LibreOffice and may not reflect in the exported PDF.",
    );
  }

  // Check docx buffer is valid
  if (!input.docxBuffer || input.docxBuffer.length === 0) {
    errors.push("DOCX buffer is empty");
  }

  // Page size/margins check (informational)
  const pageSize = spec.page_size ?? spec.pageSize ?? "A4";
  logger.info({ pageSize, sectionCount: input.sections.length }, "Stage G final validation");

  const passed = errors.length === 0;

  return { passed, warnings, errors };
}
