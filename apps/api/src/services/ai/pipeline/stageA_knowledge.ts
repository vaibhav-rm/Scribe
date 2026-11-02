import { getRequiredAIProvider } from "../index.js";
import { ProjectKnowledgeSchema, type ProjectKnowledge } from "../schemas.js";
import { logger } from "../../../lib/logger.js";

export interface StageAInput {
  projectTitle: string;
  projectDescription: string | null;
  resources: Array<{
    id: string;
    type: "text" | "file" | "github";
    name: string;
    content?: string; // extracted text (server-side only)
    metadata?: Record<string, unknown>;
  }>;
}

/**
 * Stage A: Extract structured project knowledge from supplied resources.
 *
 * Does NOT send all resources in one prompt. Instead, it builds a focused
 * prompt that summarizes what resources are available and asks the model to
 * extract a structured knowledge record, attaching source references where
 * possible. Missing facts are explicitly marked rather than invented.
 */
export async function extractProjectKnowledge(
  input: StageAInput,
): Promise<ProjectKnowledge> {
  const provider = getRequiredAIProvider();

  // Build a bounded set of resource excerpts. Stage A must see actual content
  // (not only file names) or it cannot extract facts from the student's work.
  const MAX_TOTAL_CHARS = 24_000;
  const MAX_PER_RESOURCE_CHARS = 4_000;
  let remaining = MAX_TOTAL_CHARS;

  const resourceSummary =
    input.resources
      .map((r) => {
        const header = `- [${r.type}] ${r.name}`;
        if (!r.content || remaining <= 0) return header;
        const take = Math.min(MAX_PER_RESOURCE_CHARS, remaining);
        const excerpt = r.content.slice(0, take);
        remaining -= excerpt.length;
        const truncated = r.content.length > excerpt.length;
        return `${header}\n"""\n${excerpt}${truncated ? "\n[... truncated ...]" : ""}\n"""`;
      })
      .join("\n\n") || "(no resources provided)";

  const systemPrompt = `You are an academic document assistant for college students in India. Your job is to extract structured project knowledge from the student's supplied resources.

Rules:
- Extract facts only from the supplied resources. Do NOT invent experiments, test results, references, or metrics.
- If a fact is not present in the supplied resources, leave the field empty or list it under "missing_facts".
- Attach source references (resource names) to facts when possible.
- Be concise but complete.
- Output valid JSON matching the schema. No markdown fences, no explanatory text.`;

  const userPrompt = `Project title: ${input.projectTitle}
Project description: ${input.projectDescription ?? "(none provided)"}

Supplied resources:
${resourceSummary}

Extract a structured project knowledge record. For each field, use information from the resources. Mark missing facts explicitly.`;

  let result;
  try {
    result = await provider.generateStructuredOutput<ProjectKnowledge>({
      systemPrompt,
      userPrompt,
      schema: ProjectKnowledgeSchema,
      maxOutputTokens: 2000,
      temperature: 0.3,
    });
  } catch (err: any) {
    logger.warn({ err: err?.message }, "Stage A AI call failed; using fallback");
    return {
      title: input.projectTitle,
      abstract: input.projectDescription ?? "",
      objectives: [],
      references: [],
      technology_stack: [],
      limitations: [],
      future_work: [],
      missing_facts: ["AI generation failed; manual input required"],
      source_references: {},
    };
  }

  // Validate with Zod
  const parsed = ProjectKnowledgeSchema.safeParse(result.data);
  if (!parsed.success) {
    logger.warn({ issues: parsed.error.flatten().fieldErrors }, "Stage A output did not match schema; using fallback");
    return {
      title: input.projectTitle,
      abstract: input.projectDescription ?? "",
      objectives: [],
      references: [],
      technology_stack: [],
      limitations: [],
      future_work: [],
      missing_facts: ["AI output did not match expected schema; manual review recommended"],
      source_references: {},
    };
  }

  return parsed.data;
}
