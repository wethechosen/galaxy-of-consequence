import { afterEach, describe, expect, it, vi } from "vitest";
import {
  withNvidiaTurnTelemetry, markNvidiaRequest, extractNvidiaUsage,
  extractNvidiaRateLimits, recordNvidiaUsage,
} from "./nvidia-usage-telemetry";

afterEach(() => vi.restoreAllMocks());

describe("privacy-safe NVIDIA telemetry", () => {
  it("records exact usage when supplied, never estimates missing token counts", () => {
    expect(extractNvidiaUsage({ prompt_tokens: 354, completion_tokens: 128, total_tokens: 482 }))
      .toEqual({ inputTokens: 354, outputTokens: 128, totalTokens: 482 });
    expect(extractNvidiaUsage(undefined))
      .toEqual({ inputTokens: null, outputTokens: null, totalTokens: null });
    expect(extractNvidiaUsage({ prompt_tokens: "354", completion_tokens: -1, total_tokens: Infinity }))
      .toEqual({ inputTokens: null, outputTokens: null, totalTokens: null });
  });

  it("uses anonymous, independent per-turn request counters without leaking turn IDs", async () => {
    const first = await withNvidiaTurnTelemetry(async () => [markNvidiaRequest(), markNvidiaRequest()]);
    const second = await withNvidiaTurnTelemetry(async () => markNvidiaRequest());
    expect(first[0]).toMatchObject({ requestNumber: 1 });
    expect(first[1]).toMatchObject({ requestNumber: 2 });
    expect(second).toMatchObject({ requestNumber: 1 });
    expect(first[0]?.traceId).toMatch(/^[0-9a-f-]{36}$/);
    expect(first[0]?.traceId).not.toBe(second?.traceId);
    expect(markNvidiaRequest()).toBeNull();
  });

  it("whitelists and normalizes rate-limit metadata, dropping arbitrary strings", () => {
    const headers = new Headers({
      "x-ratelimit-limit-tokens": "50000",
      "x-ratelimit-remaining-requests": "12",
      "x-ratelimit-reset": "60s",
      "x-ratelimit-reset-tokens": "Mon, 19 Oct 2026 07:00:00 GMT",
      "authorization": "Bearer test-only-secret",
      "set-cookie": "private=secret",
      "x-ratelimit-limit": "secret-value",
      "x-nvidia-api-key": "sk-secret",
    });
    expect(extractNvidiaRateLimits(headers)).toEqual({
      "x-ratelimit-remaining-requests": "12",
      "x-ratelimit-reset": "60s",
      "x-ratelimit-limit-tokens": "50000",
      "x-ratelimit-reset-tokens": "2026-10-19T07:00:00.000Z",
    });
  });

  it("emits exactly one bounded, allowlisted JSON log without prompts, keys or user identifiers", () => {
    const logger = vi.spyOn(console, "info").mockImplementation(() => {});
    recordNvidiaUsage({
      purpose: "ledger", model: "nvidia/test", origin: "provider", status: 429, elapsedMs: 17,
      headers: new Headers({ "retry-after": "65", authorization: "Bearer test-only-secret", "x-api-key": "private" }),
      usage: { prompt_tokens: 200, completion_tokens: 30, total_tokens: 230, raw: "I buy a suit" },
      trace: { traceId: "safe-anonymous-id", requestNumber: 3 },
      retryAfterSeconds: 65, retryAfterEstimated: false,
    });
    expect(logger).toHaveBeenCalledTimes(1);
    const result = JSON.parse(String(logger.mock.calls[0][1]));
    expect(result).toMatchObject({
      event: "goc.nvidia.request", purpose: "ledger", origin: "provider", status: 429,
      inputTokens: 200, outputTokens: 30, totalTokens: 230,
      retryAfterSeconds: 65, retryAfterEstimated: false, turnRequestNumber: 3,
      rateLimits: {},
    });
    expect(JSON.stringify(logger.mock.calls)).not.toMatch(/test-only-secret|I buy a suit|private/);
  });
});
