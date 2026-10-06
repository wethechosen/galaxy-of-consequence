import { createHash } from "node:crypto";
import { listAccounts, type Account } from "./accounts";
import type { DatapadSnapshot } from "./datapad-save";

export function operationError(message: string, status: number) { return Object.assign(new Error(message), { status }); }

export function campaignTarget(actor: Account, requested: unknown) {
  const accountId = typeof requested === "string" ? requested : actor.id;
  if (accountId !== actor.id && actor.role !== "admin") throw operationError("You can only open your own campaign save.", 403);
  const target = accountId === actor.id ? actor : listAccounts().find(account => account.id === accountId);
  if (!target) throw operationError("Account no longer exists.", 404);
  return target;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  return value;
}

export function operationIdentity(id: unknown, kind: "advancement" | "foundation" | "market", choices: Record<string, unknown>) {
  if (typeof id !== "string" || !/^[\w-]{8,100}$/.test(id)) throw operationError("A valid request identifier is required.", 400);
  return { id, fingerprint: createHash("sha256").update(JSON.stringify(canonical({ kind, ...choices }))).digest("hex") };
}

export function committedOperation(snapshot: DatapadSnapshot | null, field: "advancementHistory" | "marketTransactions", identity: ReturnType<typeof operationIdentity>) {
  const entries = snapshot?.gameState[field];
  if (!Array.isArray(entries)) return false;
  const prior = entries.find(item => item && typeof item === "object" && (item.advancementId || item.transactionId) === identity.id);
  if (!prior) return false;
  if (prior.requestFingerprint !== identity.fingerprint) throw operationError("This request identifier was already used for different choices. Reload the saved record.", 409);
  return true;
}
