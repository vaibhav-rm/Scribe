import { z } from "zod";

/**
 * Stage A: Project knowledge extraction output schema.
 * All fields optional except title/abstract; missing facts are marked as
 * unknown rather than invented.
 */
export const ProjectKnowledgeSchema = z.object({
  title: z.string(),
  abstract: z.string(),
  problem_statement: z.string().optional(),
  motivation: z.string().optional(),
  objectives: z.array(z.string()).optional().default([]),
  existing_system: z.string().optional(),
  proposed_system: z.string().optional(),
  methodology: z.string().optional(),
  architecture: z.string().optional(),
  technology_stack: z.array(z.string()).optional().default([]),
  implementation_details: z.string().optional(),
  testing_approach: z.string().optional(),
  actual_results: z.string().optional(),
  limitations: z.array(z.string()).optional().default([]),
  future_work: z.array(z.string()).optional().default([]),
  references: z.array(
    z.object({
      title: z.string(),
      source: z.string().optional(),
      url: z.string().url().optional(),
    }),
  ).optional().default([]),
  missing_facts: z.array(z.string()).optional().default([]),
  source_references: z.record(z.array(z.string())).optional().default({}),
});

export type ProjectKnowledge = z.infer<typeof ProjectKnowledgeSchema>;

/**
 * Stage C: Document outline output schema.
 */
export const DocumentOutlineSchema = z.object({
  title: z.string(),
  sections: z.array(
    z.object({
      id: z.string(),
      heading: z.string(),
      order: z.number().int().positive(),
      required: z.boolean().default(true),
      depends_on: z.array(z.string()).optional().default([]),
      description: z.string().optional(),
    }),
  ),
  metadata_fields: z.array(z.string()).optional().default([]),
  estimated_page_count: z.number().int().positive().optional(),
});

export type DocumentOutline = z.infer<typeof DocumentOutlineSchema>;

/**
 * Stage D: Individual section generation output schema.
 */
export const DocumentSectionSchema = z.object({
  id: z.string(),
  heading: z.string(),
  content: z.string(),
  source_references: z.array(z.string()).optional().default([]),
  warnings: z.array(z.string()).optional().default([]),
  word_count: z.number().int().nonnegative().optional(),
});

export type GeneratedSection = z.infer<typeof DocumentSectionSchema>;

/**
 * Stage E: Validation output schema.
 */
export const DocumentValidationSchema = z.object({
  all_mandatory_sections_present: z.boolean(),
  missing_sections: z.array(z.string()).optional().default([]),
  ordering_correct: z.boolean(),
  unsupported_claims: z.array(z.string()).optional().default([]),
  missing_information: z.array(z.string()).optional().default([]),
  warnings: z.array(z.string()).optional().default([]),
  passed: z.boolean(),
});

export type DocumentValidation = z.infer<typeof DocumentValidationSchema>;
