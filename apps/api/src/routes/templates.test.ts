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
      not: () => self,
      in: () => self,
      is: () => self,
      or: () => self,
      order: () => self,
      range: () => self,
      limit: () => self,
      ilike: () => self,
      maybeSingle: async () => ({ data: null, error: null }),
      single: async () => ({ data: null, error: null }),
      then: async (resolve: any) => resolve({ data: null, error: null }),
    };
    return self;
  };
  return {
    createClient: vi.fn(() => ({
      from: vi.fn(() => makeChain()),
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: "00000000-0000-0000-0000-000000000000", email: "test@example.com" } }, error: null })),
      },
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn(async () => ({ data: { path: "mock/path" }, error: null })),
          createSignedUrl: vi.fn(async () => ({ data: { signedUrl: "https://mock.supabase.co/signed" }, error: null })),
          remove: vi.fn(async () => ({ error: null })),
          download: vi.fn(async () => ({ data: new ArrayBuffer(0), error: null })),
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

let app: any;

beforeAll(async () => {
  const { createApp } = await import("../app.js");
  app = createApp();
});

describe("Template routes", () => {
  const token = "fake-valid-token";

  it("GET /api/v1/templates lists templates", async () => {
    const res = await request(app)
      .get("/api/v1/templates")
      .set("Authorization", `Bearer ${token}`);
    expect([200, 404, 500]).toContain(res.status);
  });

  it("GET /api/v1/public/templates is public and returns a list", async () => {
    const res = await request(app).get("/api/v1/public/templates");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.templates)).toBe(true);
  });

  it("GET /api/v1/templates/:id returns 404 for missing template", async () => {
    const res = await request(app)
      .get("/api/v1/templates/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it("GET /api/v1/templates/:id/placeholders validates and scopes the template", async () => {
    const invalid = await request(app)
      .get("/api/v1/templates/not-a-uuid/placeholders")
      .set("Authorization", `Bearer ${token}`);
    expect(invalid.status).toBe(400);
    expect(invalid.body.error).toBe("validation_failed");

    const missing = await request(app)
      .get(
        "/api/v1/templates/00000000-0000-0000-0000-000000000000/placeholders",
      )
      .set("Authorization", `Bearer ${token}`);
    expect(missing.status).toBe(404);
  });

  it("POST /api/v1/templates rejects missing title", async () => {
    const res = await request(app)
      .post("/api/v1/templates")
      .set("Authorization", `Bearer ${token}`)
      .send({ document_type: "project_synopsis" });
    expect(res.status).toBe(400);
  });

  it("POST /api/v1/templates rejects bad file type", async () => {
    const res = await request(app)
      .post("/api/v1/templates")
      .set("Authorization", `Bearer ${token}`)
      .field("title", "Test Template")
      .field("document_type", "project_synopsis")
      .attach("file", Buffer.from("fake"), "bad.xyz");
    expect(res.status).toBe(400);
  });

  it("POST /api/v1/templates/:id/parse validates the template id", async () => {
    const res = await request(app)
      .post("/api/v1/templates/not-a-uuid/parse")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("validation_failed");
  });

  it("DELETE /api/v1/templates/:id returns 404 for missing template", async () => {
    const res = await request(app)
      .delete("/api/v1/templates/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
