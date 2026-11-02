import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";

let app: any;

beforeAll(async () => {
  // Set required env vars before loading the app module
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

  const { createApp } = await import("./app.js");
  app = createApp();
});

describe("API health", () => {
  it("GET /api/v1/healthz returns ok", async () => {
    const res = await request(app).get("/api/v1/healthz");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("GET /healthz returns ok", async () => {
    const res = await request(app).get("/healthz");
    expect(res.status).toBe(200);
  });

  it("GET unknown route returns 404", async () => {
    const res = await request(app).get("/api/v1/nope");
    expect(res.status).toBe(404);
  });
});
