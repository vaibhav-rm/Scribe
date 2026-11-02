import { describe, it, expect, vi, beforeEach } from "vitest";

const rows: any[] = [];

vi.mock("../lib/supabase.js", () => {
  const makeChain = () => {
    const self: any = {
      select: () => self,
      insert: () => self,
      update: () => self,
      delete: () => self,
      eq: () => self,
      is: () => self,
      or: () => self,
      order: async () => ({ data: rows, error: null }),
      range: () => self,
      limit: () => self,
      single: async () => ({ data: rows[0] ?? null, error: null }),
      maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
      then: async (resolve: any) => resolve({ data: rows, error: null }),
    };
    return self;
  };
  return {
    supabaseAdmin: { from: vi.fn(() => makeChain()) },
  };
});

vi.mock("../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { loadProjectResources, loadProjectContext } from "./resources.js";

describe("loadProjectResources", () => {
  beforeEach(() => {
    rows.length = 0;
  });

  it("returns resources that have extracted text", async () => {
    rows.push(
      {
        id: "r1",
        resource_type: "text",
        original_filename: null,
        external_url: null,
        processing_status: "completed",
        extracted_text: "We built a soil moisture sensor system.",
        metadata: { name: "Abstract", source_type: "abstract" },
      },
      {
        id: "r2",
        resource_type: "file",
        original_filename: "report.pdf",
        external_url: null,
        processing_status: "completed",
        extracted_text: "Chapter 1...",
        metadata: {},
      },
    );

    const resources = await loadProjectResources("project-1", "user-1");
    expect(resources).toHaveLength(2);
    expect(resources[0]).toMatchObject({
      id: "r1",
      name: "Abstract",
      content: "We built a soil moisture sensor system.",
      sourceType: "abstract",
    });
    expect(resources[1].name).toBe("report.pdf");
  });

  it("omits resources with no usable text", async () => {
    rows.push(
      {
        id: "r3",
        resource_type: "github",
        original_filename: null,
        external_url: "https://github.com/a/b",
        processing_status: "pending",
        extracted_text: null,
        metadata: { name: "a/b" },
      },
      {
        id: "r4",
        resource_type: "text",
        original_filename: null,
        external_url: null,
        processing_status: "completed",
        extracted_text: "   ",
        metadata: { name: "Empty" },
      },
    );

    const resources = await loadProjectResources("project-1", "user-1");
    expect(resources).toHaveLength(0);
  });
});

describe("loadProjectContext", () => {
  beforeEach(() => {
    rows.length = 0;
  });

  it("maps the project row", async () => {
    rows.push({
      id: "p1",
      title: "Smart Irrigation",
      description: "IoT project",
      academic_year: "2025-26",
    });

    const project = await loadProjectContext("p1", "user-1");
    expect(project).toEqual({
      id: "p1",
      title: "Smart Irrigation",
      description: "IoT project",
      academicYear: "2025-26",
    });
  });

  it("returns null when the project is missing", async () => {
    const project = await loadProjectContext("p1", "user-1");
    expect(project).toBeNull();
  });
});
