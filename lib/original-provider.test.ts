import { afterEach, describe, expect, it, vi } from "vitest";
import { invokeNvidia } from "./original-provider";
import { withNvidiaTurnTelemetry } from "./nvidia-usage-telemetry";
vi.mock("./nvidia-rate-budget", () => ({ reserveNvidiaSlot: vi.fn(async () => 0), checkNvidiaCooldown: vi.fn(async () => {}), recordNvidiaCooldown: vi.fn(async () => {}), parseRetryAfter: () => 17, retryAfterIsEstimated: (value: string | null) => !value || value === "0" || value === "invalid" }));

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("bounded model requests", () => {
  it("preserves rate limits and does not retry the provider", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "test-only-secret");
    const fetchMock = vi.fn(async () => new Response(null, { status: 429, headers: { "Retry-After": "17" } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(invokeNvidia({ messages: [{ role: "user", content: "Talk" }] })).rejects.toMatchObject({ status: 429, retryAfterSeconds: 17, retryAfterEstimated: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("marks provider cooldowns without Retry-After as estimated", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "test-only-secret");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 429 })));
    await expect(invokeNvidia({messages:[{role:"user",content:"Talk"}]}))
      .rejects.toMatchObject({status:429,retryAfterSeconds:17,retryAfterEstimated:true});
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

describe("real response metadata capture (simulated HTTP)", () => {
  it("records token usage and server limits across multiple requests in the same anonymous GM turn", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "test-only-secret");
    const logger = vi.spyOn(console, "info").mockImplementation(() => {});
    const fetchMock = vi.fn(async () => Response.json({
      choices: [{ finish_reason: "stop", message: { content: "The clerk answers." } }],
      usage: { prompt_tokens: 123, completion_tokens: 45, total_tokens: 168 },
    }, { headers: { "x-ratelimit-remaining-requests": "9", "x-ratelimit-reset": "60s" } }));
    vi.stubGlobal("fetch", fetchMock);
    await withNvidiaTurnTelemetry(async () => {
      expect((await invokeNvidia({ purpose: "interpretation", messages: [{ role: "user", content: "Secret player action" }] })).content).toBe("The clerk answers.");
      await invokeNvidia({ purpose: "gm", messages: [{ role: "user", content: "Secret player action" }] });
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const records = logger.mock.calls.map(entry => JSON.parse(String(entry[1])));
    expect(records).toHaveLength(2);
    expect(records.map(r => r.turnRequestNumber)).toEqual([1, 2]);
    expect(records[0].traceId).toBe(records[1].traceId);
    expect(records[0]).toMatchObject({
      purpose: "interpretation", origin: "provider", status: 200,
      inputTokens: 123, outputTokens: 45, totalTokens: 168,
      rateLimits: { "x-ratelimit-remaining-requests": "9", "x-ratelimit-reset": "60s" },
    });
    expect(JSON.stringify(logger.mock.calls)).not.toMatch(/test-only-secret|Secret player action/);
  });

  it("records explicit provider cooldown as observed and unknown tokens as null", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "test-only-secret");
    const logger = vi.spyOn(console, "info").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 429, headers: { "retry-after": "17", "x-ratelimit-remaining-tokens": "0" } })));
    await expect(invokeNvidia({ purpose: "ledger", messages: [{ role: "user", content: "Ledger repair" }] }))
      .rejects.toMatchObject({ status: 429, retryAfterSeconds: 17, retryAfterEstimated: false });
    expect(JSON.parse(String(logger.mock.calls[0][1]))).toMatchObject({
      origin: "provider", status: 429, purpose: "ledger", retryAfterSeconds: 17, retryAfterEstimated: false,
      inputTokens: null, outputTokens: null, totalTokens: null,
      rateLimits: { "x-ratelimit-remaining-tokens": "0" },
    });
  });

  it("distinguishes a local pacing rejection from a request sent to NVIDIA", async () => {
    const pacing = await import("./nvidia-rate-budget");
    vi.spyOn(pacing, "reserveNvidiaSlot").mockRejectedValueOnce(new (await import("./nvidia-errors")).NvidiaProviderError("cooldown", 429, 65, 429, true));
    vi.stubEnv("NVIDIA_API_KEY", "test-only-secret");
    const logger = vi.spyOn(console, "info").mockImplementation(() => {});
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(invokeNvidia({ messages: [{ role: "user", content: "Continue" }] }))
      .rejects.toMatchObject({ status: 429, retryAfterSeconds: 65, retryAfterEstimated: true });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(JSON.parse(String(logger.mock.calls[0][1]))).toMatchObject({
      origin: "local-pacer", status: 429, turnRequestNumber: null,
      retryAfterSeconds: 65, retryAfterEstimated: true,
    });
  });
});

describe("malformed provider reset headers", () => {
  it("marks invalid provider Retry-After as estimated rather than observed", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "test-only-secret");
    const logger = vi.spyOn(console, "info").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 429, headers: { "retry-after": "0" } })));
    await expect(invokeNvidia({ messages: [{ role: "user", content: "Continue" }] }))
      .rejects.toMatchObject({ status: 429, retryAfterEstimated: true });
    expect(JSON.parse(String(logger.mock.calls[0][1])).retryAfterEstimated).toBe(true);
  });
});
