import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("../lib/supabase.js", () => ({
  supabaseAdmin: { rpc: mocks.rpc },
}));

vi.mock("../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { reserveCredits } from "./generation.js";

describe("reserveCredits", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.rpc.mockResolvedValue({ data: null, error: null });
  });

  it("records integer credit usage units", async () => {
    await reserveCredits("user-1", "generation_start", -1, "gen_job-1", "job-1", {});

    expect(mocks.rpc).toHaveBeenCalledWith(
      "adjust_credits",
      expect.objectContaining({
        p_user_id: "user-1",
        p_event_type: "generation_start",
        p_credits_delta: -1,
      }),
    );
  });

  it("rejects fractional credit deltas before writing the ledger", async () => {
    await expect(
      reserveCredits("user-1", "generation_start", -0.06, "gen_job-1", "job-1", {}),
    ).rejects.toThrow("Credit delta must be an integer usage unit");

    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
