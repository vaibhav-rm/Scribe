import { describe, it, expect } from "vitest";
import {
  extractHeadingsFromHtml,
  detectPlaceholders,
  inferDocumentType,
  detectTitlePage,
} from "../services/templates.js";

describe("template parsing", () => {
  describe("extractHeadingsFromHtml", () => {
    it("extracts h1-h6 headings in order", () => {
      const html = "<h1>Main Title</h1><p>Some text</p><h2>Section 1</h2><h3>Subsection</h3><h2>Section 2</h2>";
      const headings = extractHeadingsFromHtml(html);
      expect(headings).toEqual([
        "H1: Main Title",
        "H2: Section 1",
        "H3: Subsection",
        "H2: Section 2",
      ]);
    });

    it("returns empty array for no headings", () => {
      expect(extractHeadingsFromHtml("<p>No headings here</p>")).toEqual([]);
    });
  });

  describe("detectPlaceholders", () => {
    it("finds {{variable}} placeholders", () => {
      const placeholders = detectPlaceholders("Hello {{student_name}}, your {{project_title}} is ready.");
      expect(placeholders).toContain("{{student_name}}");
      expect(placeholders).toContain("{{project_title}}");
    });

    it("finds [PLACEHOLDER] patterns", () => {
      const placeholders = detectPlaceholders("The [College Name] requires [Project Title].");
      expect(placeholders).toContain("[College Name]");
      expect(placeholders).toContain("[Project Title]");
    });

    it("returns empty array for no placeholders", () => {
      expect(detectPlaceholders("No placeholders here.")).toEqual([]);
    });
  });

  describe("inferDocumentType", () => {
    it("infers SRS from requirements keywords", () => {
      expect(inferDocumentType("Software Requirements Specification", [])).toBe("srs");
    });

    it("infers proposal from proposal keywords", () => {
      expect(inferDocumentType("Project Proposal and budget", [])).toBe("project_proposal");
    });

    it("infers synopsis by default", () => {
      expect(inferDocumentType("Some random text", [])).toBe("project_synopsis");
    });
  });

  describe("detectTitlePage", () => {
    it("detects title page with project keywords", () => {
      expect(detectTitlePage("Project Synopsis\n\nThis is a synopsis document.")).toBe(true);
    });

    it("returns false for short text without keywords", () => {
      expect(detectTitlePage("Hello")).toBe(false);
    });
  });
});
