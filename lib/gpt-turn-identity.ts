import { createHash } from "node:crypto";

/**
 * Fallback for existing Custom GPT action clients which omit turnId.
 * Deterministic for precisely the same account, base revision and declaration;
 * never uses an identifier belonging to a different character or revision.
 */
export function stableGptTurnId(accountId: string, revision: number, action: string): string {
  const fingerprint = createHash("sha256")
    .update(JSON.stringify([accountId, revision, action.trim()]))
    .digest("hex").slice(0, 40);
  return `gpt-${fingerprint}`;
}
