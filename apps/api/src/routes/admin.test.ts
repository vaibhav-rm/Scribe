import { describe, it, expect, beforeAll, vi } from "vitest";
import request from "supertest";

vi.mock("@supabase/supabase-js", () => {
  const makeChain = (overrideData: any = null) => {
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
      limit: () => self,
      ilike: () => self,
      maybeSingle: async () => ({ data: overrideData, error: null }),
      single: async () => ({ data: overrideData, error: null }),
    };
    return self;
  };
  return {
    createClient: vi.fn(() => ({
      from: vi.fn((table: string) => {
        if (table === "profiles") {
          return makeChain({ id: "00000000-0000-0000-0000-000000000000", role: "admin" });
        }
        if (table === "templates") {
          return makeChain({
            id: "00000000-0000-0000-0000-000000000001",
            title: "Test Template",
            verification_status: "pending",
          });
        }
        return makeChain(null);
      }),
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: "00000000-0000-0000-0000-000000000000", email: "admin@example.com" } }, error: null })),
      },
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn(async () => ({ data: { path: "mock/path" }, error: null })),
          createSignedUrl: vi.fn(async () => ({ data: { signedUrl: "https://mock.supabase.co/signed" }, error: null })),
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

let app: any;

beforeAll(async () => {
  const { createApp } = await import("../app.js");
  app = createApp();
});

describe("Admin routes", () => {
  const token = "fake-admin-token";

  it("GET /api/v1/admin/overview returns admin stats", async () => {
    const res = await request(app)
      .get("/api/v1/admin/overview")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.users).toBeDefined();
    expect(res.body.projects).toBeDefined();
    expect(res.body.generations).toBeDefined();
  });

  it("GET /api/v1/admin/templates/pending returns pending templates", async () => {
    const res = await request(app)
      .get("/api/v1/admin/templates/pending")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.templates)).toBe(true);
  });

  it("POST /api/v1/admin/templates/:id/review approves a template", async () => {
    const res = await request(app)
      .post("/api/v1/admin/templates/00000000-0000-0000-0000-000000000001/review")
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "verified" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("verified");
  });

  it("POST /api/v1/admin/templates/:id/review rejects a template with reason", async () => {
    const res = await request(app)
      .post("/api/v1/admin/templates/00000000-0000-0000-0000-000000000002/review")
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "rejected", rejection_reason: "Unauthorized content" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("rejected");
  });

  it("POST /api/v1/admin/templates/:id/review requires a rejection reason", async () => {
    const res = await request(app)
      .post("/api/v1/admin/templates/00000000-0000-0000-0000-000000000004/review")
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "rejected", rejection_reason: "   " });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("validation_failed");
  });

  it("POST /api/v1/admin/templates/:id/review rejects invalid status", async () => {
    const res = await request(app)
      .post("/api/v1/admin/templates/00000000-0000-0000-0000-000000000003/review")
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "invalid" });
    expect(res.status).toBe(400);
  });
});
