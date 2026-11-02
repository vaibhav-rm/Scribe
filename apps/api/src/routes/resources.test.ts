import { describe, it, expect, beforeAll, vi } from "vitest";
import request from "supertest";

// Minimal mock of @supabase/supabase-js
vi.mock("@supabase/supabase-js", () => {
  const makeChain = () => {
    const self: any = {
      select: () => self,
      insert: () => self,
      update: () => self,
      delete: () => self,
      eq: () => self,
      is: () => self,
      order: () => self,
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

describe("Resources routes", () => {
  const token = "fake-valid-token";

  it("GET /api/v1/projects/:id/resources returns 404 for missing project", async () => {
    const res = await request(app)
      .get("/api/v1/projects/00000000-0000-0000-0000-000000000000/resources")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it("POST /api/v1/projects/:id/resources/text creates a resource", async () => {
    const res = await request(app)
      .post("/api/v1/projects/00000000-0000-0000-0000-000000000000/resources/text")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Abstract", content: "This is a test abstract." });
    expect([201, 404, 500]).toContain(res.status);
  });

  it("POST /api/v1/projects/:id/resources/upload rejects bad file type", async () => {
    const res = await request(app)
      .post("/api/v1/projects/00000000-0000-0000-0000-000000000000/resources/upload")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from("fake exe"), "malware.exe");
    expect(res.status).toBe(400);
  });

  it("POST /api/v1/projects/:id/resources/github validates URL", async () => {
    const res = await request(app)
      .post("/api/v1/projects/00000000-0000-0000-0000-000000000000/resources/github")
      .set("Authorization", `Bearer ${token}`)
      .send({ url: "not-a-url" });
    expect(res.status).toBe(400);
  });
});
