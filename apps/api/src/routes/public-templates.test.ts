import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import request from "supertest";

const state = vi.hoisted(() => ({
  eqCalls: [] as Array<[string, unknown]>,
  rows: [] as any[],
}));

vi.mock("@supabase/supabase-js", () => {
  const makeChain = () => {
    const self: any = {
      select: () => self,
      eq: (column: string, value: unknown) => {
        state.eqCalls.push([column, value]);
        return self;
      },
      order: () => self,
      range: () => self,
      ilike: () => self,
      then: async (resolve: any) =>
        resolve({ data: state.rows, error: null, count: state.rows.length }),
    };
    return self;
  };
  return {
    createClient: vi.fn(() => ({
      from: vi.fn(() => makeChain()),
      rpc: vi.fn(async () => ({ data: null, error: null })),
      auth: {
        getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
      },
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn(async () => ({ data: { path: "mock/path" }, error: null })),
          createSignedUrl: vi.fn(async () => ({
            data: { signedUrl: "https://mock.supabase.co/signed" },
            error: null,
          })),
          remove: vi.fn(async () => ({ error: null })),
          download: vi.fn(async () => ({
            data: new ArrayBuffer(0),
            error: null,
          })),
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

beforeEach(() => {
  state.eqCalls = [];
  state.rows = [];
});

describe("Public template library", () => {
  it("only lists public, verified templates", async () => {
    state.rows = [
      {
        id: "00000000-0000-0000-0000-000000000001",
        title: "Reviewed template",
        visibility: "public",
        verification_status: "verified",
      },
    ];

    const res = await request(app).get("/api/v1/public/templates");

    expect(res.status).toBe(200);
    expect(res.body.templates).toHaveLength(1);
    expect(state.eqCalls).toContainEqual(["visibility", "public"]);
    expect(state.eqCalls).toContainEqual([
      "verification_status",
      "verified",
    ]);
    // Pending/rejected rows must never reach the unauthenticated library.
    expect(state.eqCalls).not.toContainEqual([
      "verification_status",
      "pending",
    ]);
    expect(state.eqCalls).not.toContainEqual([
      "verification_status",
      "rejected",
    ]);
  });

  it("is available without authentication", async () => {
    const res = await request(app).get("/api/v1/public/templates");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, page_size: 24, total: 0 });
  });
});
