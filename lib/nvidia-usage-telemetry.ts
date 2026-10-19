import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { NvidiaPurpose } from "./nvidia-models";

// Ephemeral, request-scoped counters. A random correlation ID cannot reveal the
// character, account, player action, turn identifier, or sourcebook text.
type Trace = { traceId: string; providerRequests: number };
const traceStore = new AsyncLocalStorage<Trace>();
export function withNvidiaTurnTelemetry<T>(run: () => Promise<T>): Promise<T> {
  return traceStore.run({ traceId: randomUUID(), providerRequests: 0 }, run);
}
export function markNvidiaRequest(): { traceId: string; requestNumber: number } | null {
  const trace = traceStore.getStore();
  return trace ? { traceId: trace.traceId, requestNumber: ++trace.providerRequests } : null;
}

function nonnegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}
export function extractNvidiaUsage(value: unknown) {
  const usage = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    inputTokens: nonnegativeInteger(usage.prompt_tokens),
    outputTokens: nonnegativeInteger(usage.completion_tokens),
    totalTokens: nonnegativeInteger(usage.total_tokens),
  };
}

const LIMIT_KEYS = [
  "x-ratelimit-limit", "x-ratelimit-remaining", "x-ratelimit-reset",
  "x-ratelimit-limit-requests", "x-ratelimit-remaining-requests", "x-ratelimit-reset-requests",
  "x-ratelimit-limit-tokens", "x-ratelimit-remaining-tokens", "x-ratelimit-reset-tokens",
] as const;
// Deliberately ignore every other header (including request IDs, cookies and auth).
// Accept only structured quantities, durations or dates; never log arbitrary strings.
function sanitizedLimit(value: string | null): string | null {
  if (!value || value.length > 80) return null;
  const trimmed = value.trim();
  if (/^(?:\d+(?:\.\d+)?(?:ms|s|m|h|d)?)+$/i.test(trimmed)) return trimmed;
  const parsed = Date.parse(trimmed);
  if (!Number.isNaN(parsed) && /^(?:[A-Za-z]{3},\s\d{1,2}\s[A-Za-z]{3}\s\d{4}\s\d{2}:\d{2}:\d{2}\sGMT|\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)$/.test(trimmed)) {
    return new Date(parsed).toISOString();
  }
  return null;
}
export function extractNvidiaRateLimits(headers?: Headers) {
  const limits: Record<string, string> = {};
  if (!headers) return limits;
  for (const key of LIMIT_KEYS) {
    const safe = sanitizedLimit(headers.get(key));
    if (safe !== null) limits[key] = safe;
  }
  return limits;
}

export type NvidiaUsageEvent = {
  purpose: NvidiaPurpose;
  model: string;
  origin: "provider" | "transport" | "local-pacer";
  status: number | null;
  elapsedMs: number;
  usage?: unknown;
  headers?: Headers;
  trace?: { traceId: string; requestNumber: number } | null;
  retryAfterSeconds?: number | null;
  retryAfterEstimated?: boolean | null;
};
export function recordNvidiaUsage(event: NvidiaUsageEvent): void {
  // Whitelist every emitted field. Avoid error strings, prompt data and raw headers.
  const model = /^[a-z0-9._/-]{1,120}$/i.test(event.model) ? event.model : "redacted-model";
  const record = {
    event: "goc.nvidia.request",
    timestamp: new Date().toISOString(),
    model,
    purpose: event.purpose,
    origin: event.origin,
    status: event.status,
    durationMs: Math.max(0, Math.round(event.elapsedMs)),
    traceId: event.trace?.traceId ?? null,
    turnRequestNumber: event.trace?.requestNumber ?? null,
    ...extractNvidiaUsage(event.usage),
    retryAfterSeconds: nonnegativeInteger(event.retryAfterSeconds),
    retryAfterEstimated: event.retryAfterEstimated ?? null,
    rateLimits: extractNvidiaRateLimits(event.headers),
  };
  console.info("[goc/nvidia-usage]", JSON.stringify(record));
}
