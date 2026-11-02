import { getRequiredAIProvider } from "../index.js";
import { DocumentSectionSchema, type GeneratedSection } from "../schemas.js";
import { logger } from "../../../lib/logger.js";

export interface StageDInput {
  sectionId: string;
  sectionHeading: string;
  projectKnowledge: Record<string, unknown>;
  templateRequirements: Record<string, unknown>;
  relevantResources: Array<{
    name: string;
    content: string;
  }>;
  existingApprovedSections: Record<string, string>; // sectionId -> content
  documentType: string;
}

/**
 * Stage D: Generate a single document section using relevant project
 * knowledge, resources, template requirements, and existing approved
 * sections. One section at a time — never full document regeneration.
 */
export async function generateSection(
  input: StageDInput,
): Promise<GeneratedSection> {
  const provider = getRequiredAIProvider();

  // Build context from relevant resources (truncated to keep prompt bounded)
  const resourceContext = input.relevantResources
    .map((r) => `[${r.name}]\n${r.content.slice(0, 2000)}`)
    .join("\n\n---\n\n") || "(no specific resources for this section)";

  const existingContext = Object.entries(input.existingApprovedSections)
    .map(([id, content]) => `[${id}]\n${content.slice(0, 1000)}`)
    .join("\n\n---\n\n") || "(no prior sections)";

  const systemPrompt = `You are an academic document assistant writing a single section of a student project document in India.

Rules:
- Write only the section requested. Do not invent experiments, test results, references, or metrics.
- Use only information from the supplied project knowledge and resources.
- If information is missing, use a visible placeholder like [INFORMATION NOT AVAILABLE] rather than fabricating.
- Cite source names when using facts from specific resources.
- Output valid JSON matching the schema. No markdown fences, no extra text.`;

  const userPrompt = `Document type: ${input.documentType}
Section to write: ${input.sectionHeading} (id: ${input.sectionId})

Template requirements:
${JSON.stringify(input.templateRequirements, null, 2)}

Relevant project knowledge:
${JSON.stringify(input.projectKnowledge, null, 2)}

Relevant resources:
${resourceContext}

Existing approved sections (for context only, do not repeat):
${existingContext}

Write the section content.`;

  let result;
  try {
    result = await provider.generateStructuredOutput<GeneratedSection>({
      systemPrompt,
      userPrompt,
      schema: DocumentSectionSchema,
      maxOutputTokens: 1500,
      temperature: 0.4,
    });
  } catch (err: any) {
    logger.warn({ sectionId: input.sectionId, err: err?.message }, "Stage D AI call failed; using fallback");
    return {
      id: input.sectionId,
      heading: input.sectionHeading,
      content: "[SECTION GENERATION FAILED - AI provider error. Please regenerate or write manually.]",
      warnings: ["AI provider error"],
      source_references: [],
    };
  }

  const parsed = DocumentSectionSchema.safeParse(result.data);
  if (!parsed.success) {
    logger.warn({ sectionId: input.sectionId, issues: parsed.error.flatten().fieldErrors }, "Stage D output did not match schema");
    return {
      id: input.sectionId,
      heading: input.sectionHeading,
      content: "[SECTION GENERATION FAILED - output did not match expected schema. Please regenerate or write manually.]",
      warnings: ["AI output validation failed"],
      source_references: [],
    };
  }

  return parsed.data;
}
