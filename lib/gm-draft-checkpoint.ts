import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { hostedRuntimeRequired, neonQuery } from "./neon-db";

/** A raw or validated but NOT committed GM draft. The existing CAS save remains authoritative. */
export type GmValidatedDraft = {
  version: 1;
  stage: "raw" | "validated";
  interpretation: unknown;
  roll: Record<string, unknown> | null;
  content: string;
  provider: string;
  model: string;
};

export class GmDraftIdentityError extends Error {
  readonly status = 409;
  constructor() { super("This pending turn ID belongs to another action or revision. No gameplay was committed."); }
}

const VERSION = 1;

export function draftActionDigest(accountId: string, turnId: string, revision: number, action: string) {
  return createHash("sha256").update(JSON.stringify([VERSION, accountId, turnId, revision, action])).digest("hex");
}

function validDraft(value: unknown): value is GmValidatedDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const draft = value as Partial<GmValidatedDraft>;
  return draft.version === VERSION
    && (draft.stage === "raw" || draft.stage === "validated")
    && typeof draft.content === "string" && draft.content.length > 0 && draft.content.length <= 100_000
    && typeof draft.provider === "string" && draft.provider.length > 0 && draft.provider.length <= 100
    && typeof draft.model === "string" && draft.model.length > 0 && draft.model.length <= 200
    && (draft.roll === null || Boolean(draft.roll) && typeof draft.roll === "object" && !Array.isArray(draft.roll))
    && Boolean(draft.interpretation) && typeof draft.interpretation === "object" && !Array.isArray(draft.interpretation);
}

function assertIdentity(row: { base_revision: number | string; action_digest: string } | undefined, revision: number, digest: string) {
  if (row && (Number(row.base_revision) !== revision || row.action_digest !== digest)) {
    throw new GmDraftIdentityError();
  }
}

export function ensureLocalDraftTable(db: DatabaseSync) {
  db.exec("CREATE TABLE IF NOT EXISTS gm_validated_drafts (account_id TEXT NOT NULL, turn_id TEXT NOT NULL, base_revision INTEGER NOT NULL, action_digest TEXT NOT NULL, draft TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (account_id, turn_id))");
}

export function loadLocalValidatedDraft(db: DatabaseSync, accountId: string, turnId: string, revision: number, action: string): GmValidatedDraft | null {
  ensureLocalDraftTable(db);
  const row = db.prepare("SELECT base_revision,action_digest,draft FROM gm_validated_drafts WHERE account_id=? AND turn_id=?")
    .get(accountId, turnId) as { base_revision: number; action_digest: string; draft: string } | undefined;
  assertIdentity(row, revision, draftActionDigest(accountId, turnId, revision, action));
  if (!row) return null;
  try {
    const draft: unknown = JSON.parse(row.draft);
    return validDraft(draft) ? draft : null;
  } catch { return null; }
}

export function storeLocalValidatedDraft(db: DatabaseSync, accountId: string, turnId: string, revision: number, action: string, draft: GmValidatedDraft) {
  if (!validDraft(draft)) throw new TypeError("Invalid validated-draft checkpoint.");
  ensureLocalDraftTable(db);
  const digest = draftActionDigest(accountId, turnId, revision, action);
  const result = db.prepare("INSERT INTO gm_validated_drafts (account_id,turn_id,base_revision,action_digest,draft,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(account_id,turn_id) DO UPDATE SET draft=excluded.draft WHERE base_revision=excluded.base_revision AND action_digest=excluded.action_digest")
    .run(accountId, turnId, revision, digest, JSON.stringify(draft), new Date().toISOString());
  if (!result.changes) throw new GmDraftIdentityError();
}

function tableNotInstalled(error: unknown) {
  return (error as { code?: unknown } | null)?.code === "42P01";
}

export async function loadValidatedDraft(db: DatabaseSync, accountId: string, turnId: string, revision: number, action: string): Promise<GmValidatedDraft | null> {
  if (!hostedRuntimeRequired()) return loadLocalValidatedDraft(db, accountId, turnId, revision, action);
  let rows: Array<{ base_revision: string | number; action_digest: string; draft: unknown }>;
  try {
    rows = await neonQuery("SELECT base_revision,action_digest,draft FROM private.goc_gm_validated_drafts WHERE account_id=$1 AND turn_id=$2", [accountId, turnId]);
  } catch (error) {
    if (tableNotInstalled(error)) return null; // Migration is staged before production cutover.
    throw error;
  }
  const row = rows[0];
  const digest = draftActionDigest(accountId, turnId, revision, action);
  assertIdentity(row, revision, digest);
  return row && validDraft(row.draft) ? row.draft : null;
}

export async function storeValidatedDraft(db: DatabaseSync, accountId: string, turnId: string, revision: number, action: string, draft: GmValidatedDraft): Promise<void> {
  if (!validDraft(draft)) throw new TypeError("Invalid validated-draft checkpoint.");
  if (!hostedRuntimeRequired()) {
    storeLocalValidatedDraft(db, accountId, turnId, revision, action, draft);
    return;
  }
  const digest = draftActionDigest(accountId, turnId, revision, action);
  let rows: Array<{ turn_id: string }>;
  try {
    rows = await neonQuery("INSERT INTO private.goc_gm_validated_drafts (account_id,turn_id,base_revision,action_digest,draft) VALUES ($1,$2,$3,$4,$5::jsonb) ON CONFLICT(account_id,turn_id) DO UPDATE SET draft=excluded.draft WHERE private.goc_gm_validated_drafts.base_revision=excluded.base_revision AND private.goc_gm_validated_drafts.action_digest=excluded.action_digest RETURNING turn_id",
      [accountId, turnId, revision, digest, JSON.stringify(draft)]);
  } catch (error) {
    if (tableNotInstalled(error)) return; // Never block a safe existing turn during staged migration.
    throw error;
  }
  if (!rows.length) throw new GmDraftIdentityError();
}
