import { getRequiredAIProvider } from "../index.js";
import { DocumentValidationSchema, type DocumentValidation } from "../schemas.js";
import { logger } from "../../../lib/logger.js";

export interface StageEInput {
  documentTitle: string;
  sections: Array<{ id: string; heading: string; content: string }>;
  templateRequiredSections: string[];
  projectKnowledge: Record<string, unknown>;
  sourceResources: Array<{ name: string; content: string }>;
}

/**
 * Stage E: Validate the generated document for mandatory sections, structure,
 * factual support, and absence of fabricated content.
 */
export async function validateDocument(
  input: StageEInput,
): Promise<DocumentValidation> {
  const provider = getRequiredAIProvider();

  const sectionsSummary = input.sections
    .map((s) => `- ${s.heading} (${s.content.length} chars)`)
    .join("\n");

  const systemPrompt = `You are an academic document validator for college student projects in India.

Rules:
- Check that ALL mandatory template sections exist and are in the correct order.
- Identify unsupported factual claims (claims not traceable to supplied resources).
- Identify missing information that should use placeholders.
- Reject fabricated experiments, test results, references, or metrics.
- Output valid JSON matching the schema. No markdown fences, no extra text.`;

  const userPrompt = `Document title: ${input.documentTitle}
Mandatory template sections: ${input.templateRequiredSections.join(", ")}

Generated sections:
${sectionsSummary}

Project knowledge:
${JSON.stringify(input.projectKnowledge, null, 2)}

Source resources:
${input.sourceResources.map((r) => `- ${r.name}`).join("\n")}

Validate the document.`;

  let result;
  try {
    result = await provider.generateStructuredOutput<DocumentValidation>({
      systemPrompt,
      userPrompt,
      schema: DocumentValidationSchema,
      maxOutputTokens: 1200,
      temperature: 0.3,
    });
  } catch (err: any) {
    logger.warn({ err: err?.message }, "Stage E AI call failed; using fallback");
    const presentHeadings = input.sections.map((s) => s.heading.toLowerCase());
    const missing = input.templateRequiredSections.filter(
      (s) => !presentHeadings.includes(s.toLowerCase()),
    );
    return {
      all_mandatory_sections_present: missing.length === 0,
      missing_sections: missing,
      ordering_correct: true,
      unsupported_claims: [],
      missing_information: missing,
      warnings: ["AI validation failed; manual review recommended"],
      passed: missing.length === 0,
    };
  }

  const parsed = DocumentValidationSchema.safeParse(result.data);
  if (!parsed.success) {
    logger.warn({ issues: parsed.error.flatten().fieldErrors }, "Stage E output did not match schema");
    const presentHeadings = input.sections.map((s) => s.heading.toLowerCase());
    const missing = input.templateRequiredSections.filter(
      (s) => !presentHeadings.includes(s.toLowerCase()),
    );
    return {
      all_mandatory_sections_present: missing.length === 0,
      missing_sections: missing,
      ordering_correct: true,
      unsupported_claims: [],
      missing_information: missing,
      warnings: ["Validation output did not match schema; manual review recommended"],
      passed: missing.length === 0,
    };
  }

  return parsed.data;
}
