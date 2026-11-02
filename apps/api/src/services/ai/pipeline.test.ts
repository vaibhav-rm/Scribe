import { describe, it, expect, vi, beforeEach } from "vitest";

// Set env var so the AI provider factory can create a Gemini provider
process.env.GEMINI_API_KEY = "test-key";
process.env.SUPABASE_URL = "http://localhost:54321";
process.env.SUPABASE_ANON_KEY = "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

// Mock @google/generative-ai before importing pipeline modules
const mockGenerateContent = vi.fn();
vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: vi.fn(() => ({
    getGenerativeModel: vi.fn(() => ({
      generateContent: mockGenerateContent,
    })),
  })),
  SchemaType: { OBJECT: "object", STRING: "string", NUMBER: "number", BOOLEAN: "boolean", ARRAY: "array" },
}));

import {
  extractProjectKnowledge,
} from "./pipeline/stageA_knowledge.js";
import {
  interpretTemplate,
} from "./pipeline/stageB_template.js";
import {
  generateOutline,
} from "./pipeline/stageC_outline.js";
import {
  generateSection,
} from "./pipeline/stageD_sections.js";
import {
  validateDocument,
} from "./pipeline/stageE_validation.js";

describe("AI pipeline stages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Stage A - Project knowledge extraction", () => {
    it("extracts structured knowledge from resources", async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () =>
            JSON.stringify({
              title: "Smart Irrigation System",
              abstract: "A water-saving irrigation project.",
              objectives: ["Save water", "Automate irrigation"],
              references: [],
              technology_stack: ["Arduino", "Sensors"],
              limitations: [],
              future_work: [],
              missing_facts: [],
              source_references: {},
            }),
          usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 300 },
        },
      });

      const result = await extractProjectKnowledge({
        projectTitle: "Smart Irrigation System",
        projectDescription: "A water-saving project.",
        resources: [
          {
            id: "r1",
            type: "text",
            name: "Abstract",
            content: "This project saves water using sensors.",
          },
        ],
      });

      expect(result.title).toBe("Smart Irrigation System");
      expect(result.objectives).toContain("Save water");
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });

    it("returns fallback when AI output is invalid", async () => {
      mockGenerateContent.mockResolvedValue({
        response: { text: () => "not json at all", usageMetadata: {} },
      });

      const result = await extractProjectKnowledge({
        projectTitle: "Test Project",
        projectDescription: null,
        resources: [],
      });

      expect(result.title).toBe("Test Project");
      expect(result.missing_facts).toContain(
        "AI generation failed; manual input required",
      );
    });
  });

  describe("Stage B - Template interpretation", () => {
    it("interprets template specification", async () => {
      const result = await interpretTemplate({
        parsed_specification: {
          required_sections: ["Abstract", "Methodology", "Conclusion"],
          page_size: "A4",
          output_formats: ["docx", "pdf"],
        },
        parsing_status: "completed",
        validation_warnings: null,
      });

      expect(result.requiredSections).toEqual([
        "Abstract",
        "Methodology",
        "Conclusion",
      ]);
      expect(result.outputFormats).toContain("docx");
      expect(result.formattingRules.page_size).toBe("A4");
    });

    it("handles missing specification gracefully", async () => {
      const result = await interpretTemplate({
        parsed_specification: null,
        parsing_status: "pending",
        validation_warnings: ["Parsing failed"],
      });

      expect(result.requiredSections.length).toBeGreaterThan(0);
    });
  });

  describe("Stage C - Outline generation", () => {
    it("generates outline with required sections", async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () =>
            JSON.stringify({
              title: "Project Synopsis",
              sections: [
                { id: "abstract", heading: "Abstract", order: 1, required: true },
                { id: "methodology", heading: "Methodology", order: 2, required: true },
              ],
              metadata_fields: ["title", "author"],
            }),
          usageMetadata: {},
        },
      });

      const result = await generateOutline({
        projectKnowledge: { title: "Test Project" },
        templateInterpretation: {
          requiredSections: ["Abstract", "Methodology"],
          requiredMetadata: ["title"],
          formattingRules: {},
          outputFormats: ["docx", "pdf"],
        },
        documentType: "project_synopsis",
      });

      expect(result.sections.length).toBeGreaterThanOrEqual(2);
      expect(result.title).toBe("Project Synopsis");
    });

    it("appends missing mandatory sections", async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () =>
            JSON.stringify({
              title: "Doc",
              sections: [{ id: "intro", heading: "Introduction", order: 1, required: true }],
            }),
          usageMetadata: {},
        },
      });

      const result = await generateOutline({
        projectKnowledge: {},
        templateInterpretation: {
          requiredSections: ["Introduction", "Methodology", "Conclusion"],
          requiredMetadata: [],
          formattingRules: {},
          outputFormats: ["docx"],
        },
        documentType: "project_synopsis",
      });

      const headings = result.sections.map((s) => s.heading);
      expect(headings).toContain("Methodology");
      expect(headings).toContain("Conclusion");
    });
  });

  describe("Stage D - Section generation", () => {
    it("generates a single section", async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () =>
            JSON.stringify({
              id: "abstract",
              heading: "Abstract",
              content: "This project addresses water scarcity.",
              source_references: ["Resource 1"],
              warnings: [],
              word_count: 45,
            }),
          usageMetadata: {},
        },
      });

      const result = await generateSection({
        sectionId: "abstract",
        sectionHeading: "Abstract",
        projectKnowledge: { title: "Test" },
        templateRequirements: {},
        relevantResources: [{ name: "Resource 1", content: "Water scarcity content" }],
        existingApprovedSections: {},
        documentType: "project_synopsis",
      });

      expect(result.heading).toBe("Abstract");
      expect(result.content).toContain("water scarcity");
      expect(result.source_references).toContain("Resource 1");
    });

    it("returns fallback on schema mismatch", async () => {
      mockGenerateContent.mockResolvedValue({
        response: { text: () => "not json", usageMetadata: {} },
      });

      const result = await generateSection({
        sectionId: "test",
        sectionHeading: "Test",
        projectKnowledge: {},
        templateRequirements: {},
        relevantResources: [],
        existingApprovedSections: {},
        documentType: "project_synopsis",
      });

      expect(result.id).toBe("test");
      expect(result.warnings).toContain("AI provider error");
    });
  });

  describe("Stage E - Validation", () => {
    it("validates document with all sections present", async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () =>
            JSON.stringify({
              all_mandatory_sections_present: true,
              missing_sections: [],
              ordering_correct: true,
              unsupported_claims: [],
              missing_information: [],
              warnings: [],
              passed: true,
            }),
          usageMetadata: {},
        },
      });

      const result = await validateDocument({
        documentTitle: "Test Doc",
        sections: [{ id: "a", heading: "Introduction", content: "Some content" }],
        templateRequiredSections: ["Introduction"],
        projectKnowledge: {},
        sourceResources: [],
      });

      expect(result.passed).toBe(true);
      expect(result.all_mandatory_sections_present).toBe(true);
    });
  });
});
