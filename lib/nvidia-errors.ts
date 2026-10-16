export class NvidiaProviderError extends Error {
  constructor(message: string, public status = 502, public retryAfterSeconds?: number, public upstreamStatus?: number) { super(message); }
}
export function nvidiaRetryHeaders(error: unknown): Record<string,string> {
  return error instanceof NvidiaProviderError && error.status === 429
    ? {"Retry-After":String(error.retryAfterSeconds || 60),"Cache-Control":"no-store"} : {};
}
