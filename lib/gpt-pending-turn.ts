import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export class PendingTurnTicketError extends Error {
  readonly status = 400;
  constructor() { super("Invalid, expired, or unrelated pending-turn ticket. No gameplay action was submitted."); }
}

export type PendingTurn = {
  username: string;
  revision: number;
  action: string;
  turnId: string;
  retryAtMs: number;
  estimated: boolean;
};

const VERSION = 1;
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const validId = (id: unknown) => typeof id === "string" && /^[a-zA-Z0-9_-]{8,100}$/.test(id);
function key() {
  const secret = process.env.GOC_GPT_ACTION_KEY;
  if (!secret || secret.trim().length < 32) throw new PendingTurnTicketError();
  return createHash("sha256").update("goc-pending-turn-v1").update(secret).digest();
}
function validate(value: unknown): value is PendingTurn {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Partial<PendingTurn>;
  return typeof item.username === "string" && item.username.length > 0
    && Number.isSafeInteger(item.revision) && Number(item.revision) >= 0
    && typeof item.action === "string" && item.action.trim().length > 0 && item.action.length <= 2000
    && validId(item.turnId)
    && typeof item.retryAtMs === "number" && Number.isSafeInteger(item.retryAtMs)
    && typeof item.estimated === "boolean";
}

/** Authenticated and encrypted; GPT can retain the declaration without retyping it. */
export function issuePendingTurnTicket(data: PendingTurn, now = Date.now()) {
  if (!validate(data)) throw new PendingTurnTicketError();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const plaintext = Buffer.from(JSON.stringify({ v: VERSION, ...data, expiresAt: now + TTL_MS }));
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([Buffer.from([VERSION]), iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}
export function readPendingTurnTicket(token: unknown, username: string, now = Date.now()): PendingTurn {
  if (typeof token !== "string" || token.length < 48 || token.length > 5000 || !/^[a-zA-Z0-9_-]+$/.test(token)) throw new PendingTurnTicketError();
  try {
    const encoded = Buffer.from(token, "base64url");
    if (encoded.toString("base64url") !== token || encoded[0] !== VERSION || encoded.length < 30) throw new PendingTurnTicketError();
    const iv = encoded.subarray(1, 13), tag = encoded.subarray(13, 29), bytes = encoded.subarray(29);
    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    const raw: unknown = JSON.parse(Buffer.concat([decipher.update(bytes), decipher.final()]).toString("utf8"));
    if (!validate(raw)) throw new PendingTurnTicketError();
    const payload = raw as PendingTurn & { v?: number; expiresAt?: number };
    if (payload.v !== VERSION || payload.username !== username
        || !Number.isSafeInteger(payload.expiresAt) || now >= Number(payload.expiresAt)
        || Number(payload.expiresAt) > now + TTL_MS || payload.retryAtMs > Number(payload.expiresAt)) throw new PendingTurnTicketError();
    return { username: payload.username, revision: payload.revision, action: payload.action, turnId: payload.turnId, retryAtMs: payload.retryAtMs, estimated: payload.estimated };
  } catch { throw new PendingTurnTicketError(); }
}

export function pendingTurnStatus(ticket: PendingTurn, now = Date.now()) {
  const secondsRemaining = Math.max(0, Math.ceil((ticket.retryAtMs - now) / 1000));
  return {
    status: secondsRemaining > 0 ? "cooldown" as const : "ready" as const,
    turnId: ticket.turnId,
    baseRevision: ticket.revision,
    retryAt: new Date(ticket.retryAtMs).toISOString(),
    secondsRemaining,
    estimated: ticket.estimated,
    gameplayAdvanced: false as const,
    canSubmit: secondsRemaining === 0,
  };
}
