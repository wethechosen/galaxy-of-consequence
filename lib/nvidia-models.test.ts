import { afterEach, describe, expect, it, vi } from "vitest";
import { nvidiaModel, nvidiaApiKey } from "./nvidia-models";
import { parseRetryAfter, planNvidiaSlot, retryAfterIsEstimated } from "./nvidia-rate-budget";
afterEach(() => vi.unstubAllEnvs());
describe("purpose routing and shared request budgeting", () => {
  it("keeps the existing key for mechanical roles and uses a narration-only override", () => {
    vi.stubEnv("NVIDIA_API_KEY", "existing-test-key");
    vi.stubEnv("NVIDIA_API_KEY_GM", "narration-test-key");
    expect(nvidiaApiKey("gm")).toBe("narration-test-key");
    expect(nvidiaApiKey("npc")).toBe("narration-test-key");
    expect(nvidiaApiKey("ledger")).toBe("existing-test-key");
    expect(nvidiaApiKey("interpretation")).toBe("existing-test-key");
  });
  it("routes NPC dialogue to the selected GM while preserving mechanical roles", () => {
    vi.stubEnv("NVIDIA_MODEL", "existing-model");
    vi.stubEnv("NVIDIA_MODEL_GM", "nvidia/nemotron-3.5-super-vl-120b-a12b");
    vi.stubEnv("NVIDIA_MODEL_NPC", "");
    expect(nvidiaModel("npc")).toBe("nvidia/nemotron-3.5-super-vl-120b-a12b");
    expect(nvidiaModel("interpretation")).toBe("existing-model");
    expect(nvidiaModel("ledger")).toBe("existing-model");
  });
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
    expect(parseRetryAfter("invalid")).toBe(3900);
    expect(parseRetryAfter(null)).toBe(3900);
    expect(parseRetryAfter("0")).toBe(3900);
    expect(parseRetryAfter("-2")).toBe(3900);
    expect(retryAfterIsEstimated("-2")).toBe(true);
    expect(retryAfterIsEstimated("0")).toBe(true);
    expect(retryAfterIsEstimated("12")).toBe(false);
    expect(parseRetryAfter(new Date(20000).toUTCString(),10000)).toBe(10);
  });
});
