import { getRequiredAIProvider } from "../index.js";
import { DocumentOutlineSchema, type DocumentOutline } from "../schemas.js";
import { logger } from "../../../lib/logger.js";

export interface StageCInput {
  projectKnowledge: Record<string, unknown>;
  templateInterpretation: {
    requiredSections: string[];
    requiredMetadata: string[];
    formattingRules: Record<string, unknown>;
    outputFormats: ("docx" | "pdf")[];
  };
  documentType: string;
}

/**
 * Stage C: Ask the AI to create a document outline that satisfies the
 * template. The outline is validated before the expensive generation step.
 */
export async function generateOutline(
  input: StageCInput,
): Promise<DocumentOutline> {
  const provider = getRequiredAIProvider();

  const systemPrompt = `You are an academic document assistant. Create a structured document outline that satisfies the given template requirements.

Rules:
- Include ALL mandatory sections from the template, in the correct order.
- Each section needs a unique id, heading, order number, and whether it's required.
- Identify dependencies between sections (e.g., Methodology depends on Proposed System).
- Output valid JSON matching the schema. No markdown fences, no extra text.`;

  const userPrompt = `Document type: ${input.documentType}
Required sections: ${input.templateInterpretation.requiredSections.join(", ")}
Required metadata: ${input.templateInterpretation.requiredMetadata.join(", ")}
Output formats: ${input.templateInterpretation.outputFormats.join(", ")}

Project knowledge:
${JSON.stringify(input.projectKnowledge, null, 2)}

Generate a document outline.`;

  let result;
  try {
    result = await provider.generateStructuredOutput<DocumentOutline>({
      systemPrompt,
      userPrompt,
      schema: DocumentOutlineSchema,
      maxOutputTokens: 1500,
      temperature: 0.4,
    });
  } catch (err: any) {
    logger.warn({ err: err?.message }, "Stage C AI call failed; using fallback");
    const sections = input.templateInterpretation.requiredSections.map(
      (heading, idx) => ({
        id: heading.toLowerCase().replace(/\s+/g, "_"),
        heading,
        order: idx + 1,
        required: true,
        depends_on: idx > 0 ? [input.templateInterpretation.requiredSections[idx - 1]] : [],
      }),
    );
    return {
      title: `${input.documentType} Document`,
      sections,
      metadata_fields: input.templateInterpretation.requiredMetadata,
    };
  }

  const parsed = DocumentOutlineSchema.safeParse(result.data);
  if (!parsed.success) {
    logger.warn({ issues: parsed.error.flatten().fieldErrors }, "Stage C output did not match schema");
    const sections = input.templateInterpretation.requiredSections.map(
      (heading, idx) => ({
        id: heading.toLowerCase().replace(/\s+/g, "_"),
        heading,
        order: idx + 1,
        required: true,
        depends_on: idx > 0 ? [input.templateInterpretation.requiredSections[idx - 1]] : [],
      }),
    );
    return {
      title: `${input.documentType} Document`,
      sections,
      metadata_fields: input.templateInterpretation.requiredMetadata,
    };
  }

  // Validate that all mandatory template sections are present
  const outlineHeadings = new Set(parsed.data.sections.map((s) => s.heading.toLowerCase()));
  const missing = input.templateInterpretation.requiredSections.filter(
    (s) => !outlineHeadings.has(s.toLowerCase()),
  );

  if (missing.length) {
    logger.warn({ missing }, "Outline missing mandatory template sections");
    // Append missing sections
    missing.forEach((heading, idx) => {
      parsed.data.sections.push({
        id: heading.toLowerCase().replace(/\s+/g, "_"),
        heading,
        order: parsed.data.sections.length + idx + 1,
        required: true,
        depends_on: [],
      });
    });
  }

  return parsed.data;
}
