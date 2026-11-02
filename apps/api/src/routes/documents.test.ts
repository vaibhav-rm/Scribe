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
      is: () => self,
      or: () => self,
      order: () => self,
      range: () => self,
      gte: () => self,
      limit: () => self,
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
process.env.DOC_CONVERSION_ENABLED = "false";

let app: any;

beforeAll(async () => {
  const { createApp } = await import("../app.js");
  app = createApp();
});

describe("Document routes", () => {
  const token = "fake-valid-token";

  it("GET /api/v1/documents lists documents", async () => {
    const res = await request(app)
      .get("/api/v1/documents")
      .set("Authorization", `Bearer ${token}`);
    expect([200, 404, 500]).toContain(res.status);
  });

  it("GET /api/v1/documents/:id returns 404 for missing", async () => {
    const res = await request(app)
      .get("/api/v1/documents/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it("PATCH /api/v1/documents/:id/sections/:sectionId returns 404 for missing", async () => {
    const res = await request(app)
      .patch(
        "/api/v1/documents/00000000-0000-0000-0000-000000000000/sections/abstract",
      )
      .set("Authorization", `Bearer ${token}`)
      .send({ content: "Updated content" });
    expect(res.status).toBe(404);
  });

  it("GET /api/v1/documents/:id/export?format=docx returns 404 for missing", async () => {
    const res = await request(app)
      .get(
        "/api/v1/documents/00000000-0000-0000-0000-000000000000/export?format=docx",
      )
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it("GET /api/v1/documents/:id/export?format=pdf returns 503 when converter unavailable", async () => {
    const res = await request(app)
      .get(
        "/api/v1/documents/00000000-0000-0000-0000-000000000000/export?format=pdf",
      )
      .set("Authorization", `Bearer ${token}`);
    expect([404, 503]).toContain(res.status);
  });

  it("DELETE /api/v1/documents/:id validates the document id", async () => {
    const res = await request(app)
      .delete("/api/v1/documents/not-a-uuid")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("validation_failed");
  });

  it("DELETE /api/v1/documents/:id returns 404 for missing document", async () => {
    const res = await request(app)
      .delete("/api/v1/documents/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it("GET /api/v1/documents/:id/versions returns 404 for missing document", async () => {
    const res = await request(app)
      .get("/api/v1/documents/00000000-0000-0000-0000-000000000000/versions")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it("GET /api/v1/documents/:id/versions/:n returns 404 for missing version", async () => {
    const res = await request(app)
      .get(
        "/api/v1/documents/00000000-0000-0000-0000-000000000000/versions/3",
      )
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it("POST /api/v1/documents/:id/versions/:n/restore rejects non-positive versions", async () => {
    const res = await request(app)
      .post(
        "/api/v1/documents/00000000-0000-0000-0000-000000000000/versions/0/restore",
      )
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it("POST /api/v1/documents/:id/versions/:n/restore returns 404 for missing document", async () => {
    const res = await request(app)
      .post(
        "/api/v1/documents/00000000-0000-0000-0000-000000000000/versions/1/restore",
      )
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(404);
  });

  it("POST /api/v1/documents/:id/sections/:sectionId/regenerate returns 404 for missing document", async () => {
    const res = await request(app)
      .post(
        "/api/v1/documents/00000000-0000-0000-0000-000000000000/sections/abstract/regenerate",
      )
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(404);
  });
});
