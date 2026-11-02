import { describe, it, expect, beforeAll, vi } from "vitest";
import request from "supertest";

vi.mock("@supabase/supabase-js", () => {
  const makeChain = () => {
    const self: any = {
      select: () => self,
      insert: () => self,
      update: () => self,
      delete: () => self,
      eq: () => self,
      neq: () => self,
      gte: () => self,
      lte: () => self,
      in: () => self,
      not: () => self,
      is: () => self,
      or: () => self,
      order: () => self,
      range: () => self,
      limit: () => self,
      single: async () => ({ data: null, error: null }),
      maybeSingle: async () => ({ data: null, error: null }),
      then: async (resolve: any) => resolve({ data: [], error: null }),
    };
    return self;
  };
  return {
    createClient: vi.fn(() => ({
      from: vi.fn(() => makeChain()),
      rpc: vi.fn(async () => ({ data: null, error: null })),
      auth: {
        getUser: vi.fn(async () => ({
          data: {
            user: {
              id: "00000000-0000-0000-0000-000000000000",
              email: "test@example.com",
            },
          },
          error: null,
        })),
      },
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn(async () => ({ data: { path: "mock/path" }, error: null })),
          createSignedUrl: vi.fn(async () => ({
            data: { signedUrl: "https://mock.supabase.co/signed" },
            error: null,
          })),
          remove: vi.fn(async () => ({ error: null })),
        })),
        listBuckets: vi.fn(async () => ({ data: [], error: null })),
        createBucket: vi.fn(async () => ({ error: null })),
      },
    })),
  };
});

process.env.NODE_ENV = "test";
process.env.PORT = "4000";
process.env.API_URL = "http://localhost:4000";
process.env.FRONTEND_URL = "http://localhost:5173";
process.env.SUPABASE_URL = "http://localhost:54321";
process.env.SUPABASE_ANON_KEY = "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
process.env.API_PREFIX = "/api/v1";
process.env.CORS_ORIGINS = "http://localhost:5173";
process.env.LOG_LEVEL = "error";
delete process.env.GEMINI_API_KEY;

let app: any;
let outlineMatchesRequest: typeof import("./generations.js").outlineMatchesRequest;

beforeAll(async () => {
  const { createApp } = await import("../app.js");
  app = createApp();
  ({ outlineMatchesRequest } = await import("./generations.js"));
});

describe("Generation routes", () => {
  const token = "fake-valid-token";

  it("POST /api/v1/generations/outline returns 503 when no AI provider is configured", async () => {
    const res = await request(app)
      .post("/api/v1/generations/outline")
      .set("Authorization", `Bearer ${token}`)
      .send({
        project_id: "00000000-0000-0000-0000-000000000001",
        document_type: "project_synopsis",
      });

    expect(res.status).toBe(503);
    expect(res.body.error).toBe("provider_unavailable");
  });

  it("POST /api/v1/generations/outline validates the request body", async () => {
    const res = await request(app)
      .post("/api/v1/generations/outline")
      .set("Authorization", `Bearer ${token}`)
      .send({ project_id: "not-a-uuid" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("validation_failed");
  });

  it("GET /api/v1/generations/:id/outline returns 404 for missing jobs", async () => {
    const res = await request(app)
      .get("/api/v1/generations/00000000-0000-0000-0000-000000000000/outline")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it("POST /api/v1/generations requires authentication", async () => {
    const res = await request(app)
      .post("/api/v1/generations")
      .send({
        project_id: "00000000-0000-0000-0000-000000000001",
        document_type: "project_synopsis",
      });

    expect(res.status).toBe(401);
  });
});

describe("Reviewed outline compatibility", () => {
  it("accepts an outline generated for the same template and document type", () => {
    expect(
      outlineMatchesRequest(
        { template_version_id: "version-1", document_type: "project_report" },
        { templateVersionId: "version-1", documentType: "project_report" },
      ),
    ).toBe(true);
  });

  it("accepts an outline that used no template when no template is requested", () => {
    expect(
      outlineMatchesRequest(
        { template_version_id: null, document_type: "project_synopsis" },
        { templateVersionId: null, documentType: "project_synopsis" },
      ),
    ).toBe(true);
  });

  it("rejects an outline generated for a different template version", () => {
    expect(
      outlineMatchesRequest(
        { template_version_id: "version-1", document_type: "project_report" },
        { templateVersionId: "version-2", documentType: "project_report" },
      ),
    ).toBe(false);
  });

  it("rejects an outline when a template is added after review", () => {
    expect(
      outlineMatchesRequest(
        { template_version_id: null, document_type: "project_report" },
        { templateVersionId: "version-1", documentType: "project_report" },
      ),
    ).toBe(false);
  });

  it("rejects an outline generated for a different document type", () => {
    expect(
      outlineMatchesRequest(
        { template_version_id: "version-1", document_type: "project_report" },
        { templateVersionId: "version-1", documentType: "research_paper" },
      ),
    ).toBe(false);
  });
});
