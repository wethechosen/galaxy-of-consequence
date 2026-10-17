export class NvidiaProviderError extends Error {
  constructor(message: string, public status = 502, public retryAfterSeconds?: number, public upstreamStatus?: number, public retryAfterEstimated = false) { super(message); }
}
export function nvidiaRetryHeaders(error: unknown): Record<string,string> {
  return error instanceof NvidiaProviderError && error.status === 429
    ? {"Retry-After":String(error.retryAfterSeconds || 60),"X-GOC-Retry-Estimated":String(error.retryAfterEstimated),"Cache-Control":"no-store"} : {};
}
