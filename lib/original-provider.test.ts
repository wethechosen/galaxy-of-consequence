import { afterEach, describe, expect, it, vi } from "vitest";
import { invokeNvidia } from "./original-provider";
vi.mock("./nvidia-rate-budget", () => ({ reserveNvidiaSlot: vi.fn(async () => 0), checkNvidiaCooldown: vi.fn(async () => {}), recordNvidiaCooldown: vi.fn(async () => {}), parseRetryAfter: () => 17 }));

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("bounded model requests", () => {
  it("preserves rate limits and does not retry the provider", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "test-only-secret");
    const fetchMock = vi.fn(async () => new Response(null, { status: 429, headers: { "Retry-After": "17" } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(invokeNvidia({ messages: [{ role: "user", content: "Talk" }] })).rejects.toMatchObject({ status: 429, retryAfterSeconds: 17 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("bounds stalled response bodies and does not expose the key", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "test-only-secret");
    const abort = new AbortController();
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(abort.signal);
    vi.stubGlobal("fetch", vi.fn(async (_target, init) => {
      expect(init.signal).toBe(abort.signal);
      return { ok: true, json: async () => { abort.abort(); throw new DOMException("Body stalled", "TimeoutError"); } };
    }));
    await expect(invokeNvidia({ messages: [{ role: "user", content: "Look around" }], timeout_ms: 15000 })).rejects.toMatchObject({ status: 504, message: "NVIDIA took too long to respond. No outcome was applied; retry the turn." });
    expect(timeout).toHaveBeenCalledWith(15000);
  });
  it("rejects truncated output rather than accepting an incomplete state ledger", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "test-only-secret");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ choices: [{ finish_reason: "length", message: { content: "Partial scene" } }] })));
    await expect(invokeNvidia({ messages: [{ role: "user", content: "Look around" }] })).rejects.toThrow(/cut off/);
  });
});
