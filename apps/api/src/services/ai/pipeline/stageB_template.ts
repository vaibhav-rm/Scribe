import { logger } from "../../../lib/logger.js";

export interface TemplateInterpretation {
  requiredSections: string[];
  requiredMetadata: string[];
  formattingRules: Record<string, unknown>;
  sectionDependencies: Record<string, string[]>;
  requiredTablesOrAppendices: string[];
  outputFormats: ("docx" | "pdf")[];
}

/**
 * Stage B: Interpret the selected template version and identify required
 * sections, metadata, formatting rules, and dependencies.
 */
export async function interpretTemplate(
  templateVersion: {
    parsed_specification: Record<string, unknown> | null;
    parsing_status: string;
    validation_warnings: string[] | null;
  },
): Promise<TemplateInterpretation> {
  const spec = templateVersion.parsed_specification || {};

  // Use the parsed specification directly where possible, falling back to
  // sensible defaults. The specification was already validated when the
  // template version was created.
  const requiredSections: string[] = Array.isArray(spec.required_sections)
    ? spec.required_sections
    : Array.isArray(spec.requiredSections)
      ? spec.requiredSections
      : ["Introduction", "Methodology", "Conclusion"];

  const requiredMetadata: string[] = Array.isArray(spec.required_metadata)
    ? spec.required_metadata
    : ["title", "author", "date"];

  const outputFormats: ("docx" | "pdf")[] = Array.isArray(spec.output_formats)
    ? spec.output_formats
    : Array.isArray(spec.outputFormats)
      ? spec.outputFormats
      : ["docx", "pdf"];

  const formattingRules: Record<string, unknown> = {
    page_size: spec.page_size ?? spec.pageSize ?? "A4",
    margins: spec.margins ?? { top: 1, bottom: 1, left: 1, right: 1 },
    fonts: spec.fonts ?? { body: "Times New Roman", heading: "Arial" },
    line_spacing: spec.line_spacing ?? spec.lineSpacing ?? 1.5,
    paragraph_spacing: spec.paragraph_spacing ?? spec.paragraphSpacing ?? 6,
    page_numbering: spec.page_numbering ?? spec.pageNumbering ?? true,
  };

  const sectionDependencies: Record<string, string[]> = {};
  requiredSections.forEach((section, idx) => {
    const deps: string[] = [];
    if (idx > 0) deps.push(requiredSections[idx - 1]);
    sectionDependencies[section] = deps;
  });

  const warnings: string[] = [];
  if (templateVersion.parsing_status !== "completed") {
    warnings.push("Template specification parsing is incomplete; review manually");
  }
  if (templateVersion.validation_warnings?.length) {
    warnings.push(...templateVersion.validation_warnings);
  }

  if (warnings.length) {
    logger.warn({ templateVersionId: spec.id, warnings }, "Template interpretation warnings");
  }

  return {
    requiredSections,
    requiredMetadata,
    formattingRules,
    sectionDependencies,
    requiredTablesOrAppendices: Array.isArray(spec.required_tables)
      ? spec.required_tables
      : spec.requiredTables
        ? [String(spec.requiredTables)]
        : [],
    outputFormats,
  };
}
