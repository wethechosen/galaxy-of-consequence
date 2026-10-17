import { NvidiaProviderError } from "./nvidia-errors";

type RetryReceipt = { gameplayAdvanced?: boolean; retriable?: boolean } | null;

/** Describes a safe future re-submission; does NOT schedule background GPT execution. */
export function gptTurnRetryPlan(
  error: unknown,
  status: number,
  turnId: string | undefined,
  revision: number | undefined,
  receipt: RetryReceipt,
  now = Date.now(),
) {
  const safe = status === 429 && error instanceof NvidiaProviderError
    || [502, 503, 504].includes(status) && receipt?.retriable === true && receipt.gameplayAdvanced === false;
  if (!safe || !turnId || typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 0) return null;
  const upstream = error instanceof NvidiaProviderError ? Number(error.retryAfterSeconds) : NaN;
  const seconds = Number.isFinite(upstream) && upstream > 0
    ? Math.min(86400, Math.max(1, Math.ceil(upstream)))
    : status === 429 ? 60 : 15;
  const estimated = !(error instanceof NvidiaProviderError)
    || error.retryAfterEstimated === true
    || !(upstream > 0);
  return {
    status: "awaiting_retry" as const,
    turnId,
    baseRevision: revision,
    retryAfterSeconds: seconds,
    retryAt: new Date(now + seconds * 1000).toISOString(),
    estimated,
    gameplayAdvanced: false,
  };
}
