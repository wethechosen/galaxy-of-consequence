import { afterEach, describe, expect, it, vi } from "vitest";
import { nvidiaModel } from "./nvidia-models";
import { parseRetryAfter, planNvidiaSlot } from "./nvidia-rate-budget";
afterEach(() => vi.unstubAllEnvs());
describe("purpose routing and shared request budgeting", () => {
  it("uses explicit role overrides without replacing other roles", () => {
    vi.stubEnv("NVIDIA_MODEL", "baseline");
    vi.stubEnv("NVIDIA_MODEL_INTERPRETATION", "fast-model");
    expect(nvidiaModel("interpretation")).toBe("fast-model");
    expect(nvidiaModel("ledger")).toBe("baseline");
  });
  it("spaces requests and rejects excessive queues or cooldowns", () => {
    expect(planNvidiaSlot(1000, 0, 0)).toEqual({waitMs:0,nextSlot:3000});
    expect(planNvidiaSlot(1000, 3000, 0)).toEqual({waitMs:2000,nextSlot:5000});
    expect(planNvidiaSlot(1000, 5000, 0).retryAfterSeconds).toBe(4);
    expect(planNvidiaSlot(1000, 0, 2000).retryAfterSeconds).toBe(1);
  });
  it("parses numeric and date retry headers conservatively", () => {
    expect(parseRetryAfter("12")).toBe(12);
    expect(parseRetryAfter("invalid")).toBe(60);
    expect(parseRetryAfter(new Date(20000).toUTCString(),10000)).toBe(10);
  });
});
