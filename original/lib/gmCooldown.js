// Browser-only pending-turn metadata; never persist provider credentials here.
export const turnStorageKey = (accountId) => `gc_pending_turn:${accountId}`;
export function nextTurnRetry(status, response, headers, attempts = 0, now = Date.now()) {
  if (![429, 502, 503, 504].includes(status)) return null;
  const header = headers?.get?.("Retry-After");
  const value = header || response?.retryAfterSeconds;
  let seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    const parsed = header ? Date.parse(header) : NaN;
    seconds = Number.isFinite(parsed) ? Math.ceil((parsed - now) / 1000) : NaN;
  }
  if (!Number.isFinite(seconds) || seconds <= 0) {
    seconds = status === 429 ? 60 : Math.min(120, 5 * 2 ** Math.min(5, attempts));
  }
  // A bounded per-attempt delay keeps the action pending during prolonged provider outages.
  seconds = Math.max(1, Math.min(86400, Math.ceil(seconds)));
  return { retryAt: now + seconds * 1000, seconds, estimated: !header && !(Number(response?.retryAfterSeconds) > 0) };
}
export function parsePendingTurn(raw, revision, messages) {
  let item;
  try { item = JSON.parse(raw || "null"); } catch { return null; }
  if (!item || typeof item.turnId !== "string" || !/^[a-z0-9_-]{8,100}$/i.test(item.turnId)
      || typeof item.action !== "string" || item.action.length > 2000
      || !Number.isSafeInteger(item.revision) || !Number.isFinite(item.retryAt)) return null;
  if (messages?.some(message => message.role === "assistant" && message.turnId === item.turnId)) return { committed: true };
  return { ...item, changed: item.revision !== revision };
}
