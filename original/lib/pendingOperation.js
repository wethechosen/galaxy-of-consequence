// Keep the same ID across an uncertain response, including a page reload.
// The server matches both the ID and choices before replaying a committed result.
export function pendingOperation(storage, accountId, revision, kind, choices, uuid = () => crypto.randomUUID()) {
  const key = `gc_pending_operation:${accountId}:${kind}`;
  const signature = JSON.stringify(choices);
  let prior;
  try { prior = JSON.parse(storage.getItem(key) || "null"); } catch { storage.removeItem(key); }
  if (prior?.revision === revision) {
    if (prior.signature !== signature) throw new Error("The previous request still needs confirmation. Retry it or reload your saved record before changing choices.");
    return prior.id;
  }
  const id = uuid();
  storage.setItem(key, JSON.stringify({ id, revision, signature }));
  return id;
}

export function clearPendingOperation(storage, accountId, kind) { storage.removeItem(`gc_pending_operation:${accountId}:${kind}`); }
