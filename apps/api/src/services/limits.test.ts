import { describe, it, expect, beforeEach, vi } from "vitest";

const state = vi.hoisted(() => ({
  count: 0,
  subscription: null as any,
}));

vi.mock("../lib/supabase.js", () => {
  return {
    supabaseAdmin: {
      from: vi.fn(() => {
        const chain: any = {
          select: () => chain,
          eq: () => chain,
          is: () => chain,
          order: () => chain,
          limit: () => chain,
          gte: () => chain,
          maybeSingle: async () => ({ data: state.subscription, error: null }),
          single: async () => ({ data: null, error: null }),
          then: async (resolve: any) =>
            resolve({ data: null, error: null, count: state.count }),
        };
        return chain;
      }),
    },
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

import {
  getUserPlan,
  checkProjectLimit,
  checkTemplateLimit,
  checkGenerationLimit,
  checkSectionRegenerationLimit,
  PLAN_LIMITS,
} from "./limits.js";

const USER_ID = "00000000-0000-0000-0000-000000000000";

beforeEach(() => {
  state.count = 0;
  state.subscription = null;
});

describe("Limits service", () => {
  describe("PLAN_LIMITS", () => {
    it("defines free and pro plans", () => {
      expect(PLAN_LIMITS.free.maxProjects).toBe(1);
      expect(PLAN_LIMITS.free.maxGenerationsPerMonth).toBe(3);
      expect(PLAN_LIMITS.free.pdfExport).toBe(false);
      expect(PLAN_LIMITS.pro.maxProjects).toBe(10);
      expect(PLAN_LIMITS.pro.maxGenerationsPerMonth).toBe(50);
      expect(PLAN_LIMITS.pro.pdfExport).toBe(true);
    });
  });

  describe("getUserPlan", () => {
    it("defaults to free when no subscription", async () => {
      const plan = await getUserPlan(USER_ID);
      expect(plan).toBe("free");
    });

    it("uses the active subscription plan", async () => {
      state.subscription = {
        plan_code: "pro",
        status: "active",
        current_period_end: new Date(Date.now() + 86_400_000).toISOString(),
      };
      const plan = await getUserPlan(USER_ID);
      expect(plan).toBe("pro");
    });

    it("falls back to free when the subscription has expired", async () => {
      state.subscription = {
        plan_code: "pro",
        status: "active",
        current_period_end: new Date(Date.now() - 86_400_000).toISOString(),
      };
      const plan = await getUserPlan(USER_ID);
      expect(plan).toBe("free");
    });
  });

  describe("checkProjectLimit", () => {
    it("allows project creation when under limit", async () => {
      const result = await checkProjectLimit(USER_ID);
      expect(result.allowed).toBe(true);
      expect(result.plan).toBe("free");
      expect(result.limit).toBe(1);
    });

    it("denies project creation at the limit", async () => {
      state.count = 1;
      const result = await checkProjectLimit(USER_ID);
      expect(result.allowed).toBe(false);
      expect(result.current).toBe(1);
    });
  });

  describe("checkTemplateLimit", () => {
    it("allows template creation when under limit", async () => {
      const result = await checkTemplateLimit(USER_ID);
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(1);
    });

    it("denies template creation at the limit", async () => {
      state.count = 1;
      const result = await checkTemplateLimit(USER_ID);
      expect(result.allowed).toBe(false);
    });
  });

  describe("checkGenerationLimit", () => {
    it("allows generation when under limit", async () => {
      const result = await checkGenerationLimit(USER_ID);
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(3);
    });

    it("denies generation at the monthly limit", async () => {
      state.count = 3;
      const result = await checkGenerationLimit(USER_ID);
      expect(result.allowed).toBe(false);
      expect(result.current).toBe(3);
      expect(result.message).toMatch(/limit/i);
    });

    it("allows more generations on the pro plan", async () => {
      state.count = 3;
      state.subscription = {
        plan_code: "pro",
        status: "active",
        current_period_end: new Date(Date.now() + 86_400_000).toISOString(),
      };
      const result = await checkGenerationLimit(USER_ID);
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(50);
    });
  });

  describe("checkSectionRegenerationLimit", () => {
    it("allows section regeneration when under limit", async () => {
      const result = await checkSectionRegenerationLimit(USER_ID);
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(1);
    });

    it("denies section regeneration at the limit", async () => {
      state.count = 1;
      const result = await checkSectionRegenerationLimit(USER_ID);
      expect(result.allowed).toBe(false);
      expect(result.message).toMatch(/section regeneration limit/i);
    });
  });
});
