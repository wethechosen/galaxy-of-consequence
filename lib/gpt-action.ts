import { createHash, timingSafeEqual } from "node:crypto";
import { accountStore, listAccounts, type Account } from "./accounts";
import { hostedPersistenceEnabled } from "./hosted-bridge";

export class GptActionError extends Error {
  constructor(message: string, public status = 401) { super(message); }
}

function configuredKey() {
  const key = process.env.GOC_GPT_ACTION_KEY?.trim();
  if (!key || key.length < 32) throw new GptActionError("The Custom GPT action is not configured on this server.", 503);
  return key;
}

export function authenticateGptAction(request: Request) {
  const header = request.headers.get("authorization") || "";
  const supplied = header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || "";
  const expected = configuredKey();
  const left = createHash("sha256").update(supplied).digest();
  const right = createHash("sha256").update(expected).digest();
  if (!supplied || !timingSafeEqual(left, right)) throw new GptActionError("Custom GPT action authentication failed.", 401);
  const username = process.env.GOC_GPT_ACCOUNT_USERNAME?.trim().toLowerCase();
  if (!username) throw new GptActionError("The Custom GPT action account is not configured on this server.", 503);
  const actor = listAccounts(accountStore()).find((account) => account.username === username);
  if (!actor && hostedPersistenceEnabled()) {
    const role: Account["role"] = username.startsWith("gm") ? "admin" : "player";
    return { id: process.env.GOC_GPT_ACCOUNT_ID || "bc822f06-3f84-48dd-9468-3151cf3485f9", username, displayName: username.startsWith("dmir") ? "D'mir Holloran" : "GM Operator", role };
  }
  if (!actor) throw new GptActionError("The configured Custom GPT action account does not exist.", 503);
  return actor;
}

export async function readGptActionBody(request: Request) {
  const text = await request.text();
  if (text.length > 24000) throw new GptActionError("Action payload is too large.", 413);
  let body: unknown;
  try { body = JSON.parse(text); } catch { throw new GptActionError("Action payload must be valid JSON.", 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new GptActionError("Action payload must be an object.", 400);
  return body as Record<string, unknown>;
}

export function actorSummary(actor: Account) {
  return { id: actor.id, username: actor.username, displayName: actor.displayName };
}
