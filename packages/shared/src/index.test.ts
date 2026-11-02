import { describe, it, expect } from "vitest";
import {
  AdminReviewTemplateSchema,
  CreateProjectSchema,
  DOCUMENT_TYPES,
  PLANS,
} from "./index";

describe("shared schemas", () => {
  it("validates a create project input", () => {
    const result = CreateProjectSchema.safeParse({
      body: { title: "My Project", description: "A test project" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty project title", () => {
    const result = CreateProjectSchema.safeParse({
      body: { title: "" },
    });
    expect(result.success).toBe(false);
  });
});

describe("admin review schema", () => {
  const params = { id: "00000000-0000-0000-0000-000000000001" };

  it("requires a non-empty reason when rejecting", () => {
    const result = AdminReviewTemplateSchema.safeParse({
      params,
      body: { status: "rejected", rejection_reason: "  " },
    });
    expect(result.success).toBe(false);
  });

  it("does not require a reason when approving", () => {
    const result = AdminReviewTemplateSchema.safeParse({
      params,
      body: { status: "verified" },
    });
    expect(result.success).toBe(true);
  });
});

describe("plans", () => {
  it("defines free and pro plans", () => {
    expect(PLANS.free.id).toBe("free");
    expect(PLANS.pro.id).toBe("pro");
    expect(PLANS.free.price).toBe(0);
    expect(PLANS.pro.price).toBe(149);
  });
});

describe("document types", () => {
  it("includes required document types", () => {
    const ids = DOCUMENT_TYPES.map((d) => d.id);
    expect(ids).toContain("project_synopsis");
    expect(ids).toContain("srs");
    expect(ids).toContain("final_year_report");
  });
});
