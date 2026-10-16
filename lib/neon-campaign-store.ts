import type { PoolClient } from "pg";
import { neonQuery, withNeonTransaction } from "./neon-db";

export type NeonCampaignSave = {
  account_username: string;
  account_id: string;
  revision: number;
  snapshot: Record<string, any>;
  updated_at: string;
};

type SaveRow = NeonCampaignSave & { created_at: Date | string };
type CheckpointRow = {
  checkpoint_id: string;
  label: string;
  source_revision: string | number;
  snapshot: Record<string, any>;
  created_at: Date | string;
};

function iso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function record(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function storedSave(row: SaveRow): NeonCampaignSave {
  return {
    account_username: row.account_username,
    account_id: row.account_id,
    revision: Number(row.revision),
    snapshot: row.snapshot,
    updated_at: iso(row.updated_at),
  };
}

function campaignError(message: string, status: number, data?: Record<string, unknown>) {
  return Object.assign(new Error(message), { status, currentRevision: data?.revision, data });
}

function conflict(revision: number) {
  return campaignError("revision_conflict", 409, { ok: false, error: "revision_conflict", revision });
}

function assertRevision(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) throw campaignError("A valid expectedRevision is required.", 400);
}

function assertAccount(value: string) {
  if (!value?.trim()) throw campaignError("accountId is required.", 400);
}

async function lockedSave(client: PoolClient, accountId: string) {
  const result = await client.query<SaveRow>(
    "SELECT * FROM private.goc_datapad_saves WHERE account_id = $1 FOR UPDATE", [accountId],
  );
  if (!result.rows.length) throw campaignError("Save not found for accountId.", 404);
  return result.rows[0];
}

async function backup(client: PoolClient, row: SaveRow, reason: string) {
  await client.query(
    `INSERT INTO private.goc_datapad_save_backups
      (account_username, account_id, revision, snapshot, source_updated_at, source_created_at, reason)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)`,
    [row.account_username, row.account_id, row.revision, JSON.stringify(row.snapshot),
      row.updated_at, row.created_at, reason],
  );
}

export async function neonGetSaveByUsername(username: string): Promise<NeonCampaignSave | null> {
  const rows = await neonQuery<SaveRow>(
    `SELECT account_username, account_id, revision, snapshot, updated_at, created_at
     FROM private.goc_datapad_saves WHERE lower(account_username) = lower(trim($1)) LIMIT 1`,
    [username],
  );
  return rows[0] ? storedSave(rows[0]) : null;
}

export async function neonGetSaveByAccountId(accountId: string): Promise<NeonCampaignSave | null> {
  assertAccount(accountId);
  const rows = await neonQuery<SaveRow>(
    `SELECT account_username, account_id, revision, snapshot, updated_at, created_at
     FROM private.goc_datapad_saves WHERE account_id = $1 LIMIT 1`,
    [accountId],
  );
  return rows[0] ? storedSave(rows[0]) : null;
}

export async function neonPutSave(username: string, accountId: string, expectedRevision: number, snapshot: unknown) {
  if (!username?.trim() || !accountId?.trim() || !record(snapshot))
    throw campaignError("username, accountId, and snapshot are required.", 400);
  assertRevision(expectedRevision);
  return withNeonTransaction(async (client) => {
    const current = await client.query<SaveRow>(
      "SELECT * FROM private.goc_datapad_saves WHERE lower(account_username) = lower(trim($1)) FOR UPDATE",
      [username],
    );
    let row: SaveRow;
    if (current.rows.length) {
      const prior = current.rows[0];
      if (Number(prior.revision) !== expectedRevision) throw conflict(Number(prior.revision));
      if (prior.account_id !== accountId) throw campaignError("Campaign account does not match the existing save.", 409);
      const updated = await client.query<SaveRow>(
        `UPDATE private.goc_datapad_saves
         SET revision = revision + 1, snapshot = $2::jsonb, updated_at = now()
         WHERE account_username = $1
         RETURNING *`,
        [prior.account_username, JSON.stringify(snapshot)],
      );
      row = updated.rows[0];
    } else {
      if (expectedRevision !== 0) throw conflict(0);
      const inserted = await client.query<SaveRow>(
        `INSERT INTO private.goc_datapad_saves
          (account_username, account_id, revision, snapshot, updated_at)
         VALUES ($1, $2, 1, $3::jsonb, now())
         ON CONFLICT DO NOTHING RETURNING *`,
        [username, accountId, JSON.stringify(snapshot)],
      );
      if (!inserted.rows.length) {
        const competing = await client.query<{ revision: number }>(
          `SELECT revision FROM private.goc_datapad_saves
           WHERE lower(account_username) = lower(trim($1)) OR account_id = $2 LIMIT 1`,
          [username, accountId],
        );
        throw conflict(Number(competing.rows[0]?.revision || 1));
      }
      row = inserted.rows[0];
    }
    return { ok: true, ...storedSave(row) };
  });
}

export async function neonGetConfig(accountId: string) {
  const rows = await neonQuery<{ revision: number; config: Record<string, unknown>; updated_at: Date | string }>(
    "SELECT revision, config, updated_at FROM private.goc_datapad_configs WHERE account_id = $1", [accountId],
  );
  return rows[0] ? { revision: Number(rows[0].revision), config: rows[0].config, updatedAt: iso(rows[0].updated_at) } : null;
}

export async function neonSaveConfig(accountId: string, expectedRevision: number, config: unknown) {
  assertAccount(accountId);
  assertRevision(expectedRevision);
  if (!record(config) || typeof config.directive !== "string" || !Array.isArray(config.sourcebooks)
    || JSON.stringify(config).length > 8_000_000)
    throw campaignError("Invalid campaign configuration.", 400);
  return withNeonTransaction(async (client) => {
    const current = await client.query<{ revision: number }>(
      "SELECT revision FROM private.goc_datapad_configs WHERE account_id = $1 FOR UPDATE", [accountId],
    );
    const revision = Number(current.rows[0]?.revision || 0);
    if (revision !== expectedRevision) throw conflict(revision);
    const saved = await client.query<{ revision: number; updated_at: Date | string }>(
      `INSERT INTO private.goc_datapad_configs (account_id, revision, config, updated_at)
       VALUES ($1, $2, $3::jsonb, now())
       ON CONFLICT (account_id) DO UPDATE SET
         revision = EXCLUDED.revision, config = EXCLUDED.config, updated_at = now()
       WHERE private.goc_datapad_configs.revision = $4
       RETURNING revision, updated_at`,
      [accountId, revision + 1, JSON.stringify({ directive: config.directive, sourcebooks: config.sourcebooks }), expectedRevision],
    );
    if (!saved.rows.length) {
      const latest = await client.query<{ revision: number }>(
        "SELECT revision FROM private.goc_datapad_configs WHERE account_id = $1", [accountId],
      );
      throw conflict(Number(latest.rows[0]?.revision || 0));
    }
    return { ok: true, configRevision: Number(saved.rows[0].revision), updatedAt: iso(saved.rows[0].updated_at) };
  });
}

export async function neonListCheckpoints(accountId: string) {
  assertAccount(accountId);
  const rows = await neonQuery<CheckpointRow>(
    `SELECT checkpoint_id, label, source_revision, created_at
     FROM private.goc_checkpoints WHERE account_id = $1
     ORDER BY created_at DESC, checkpoint_id DESC LIMIT 25`, [accountId],
  );
  return { ok: true, checkpoints: rows.map((row) => ({
    checkpointId: row.checkpoint_id, label: row.label,
    sourceRevision: Number(row.source_revision), createdAt: iso(row.created_at),
  })) };
}

export async function neonSaveCheckpoint(accountId: string, label: string) {
  assertAccount(accountId);
  return withNeonTransaction(async (client) => {
    const save = await lockedSave(client, accountId);
    const checkpoint = await client.query<CheckpointRow>(
      `INSERT INTO private.goc_checkpoints
       (account_id, account_username, label, source_revision, snapshot)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       RETURNING checkpoint_id, label, source_revision, created_at`,
      [save.account_id, save.account_username, label?.trim() || "Manual checkpoint",
        save.revision, JSON.stringify(save.snapshot)],
    );
    const row = checkpoint.rows[0];
    return { ok: true, checkpointId: row.checkpoint_id, label: row.label,
      sourceRevision: Number(row.source_revision), createdAt: iso(row.created_at) };
  });
}

export async function neonLoadCheckpoint(accountId: string, checkpointId: string, expectedRevision: number) {
  assertAccount(accountId);
  assertRevision(expectedRevision);
  if (!checkpointId?.trim()) throw campaignError("checkpointId is required.", 400);
  return withNeonTransaction(async (client) => {
    const save = await lockedSave(client, accountId);
    if (Number(save.revision) !== expectedRevision) throw conflict(Number(save.revision));
    const checkpoints = await client.query<CheckpointRow>(
      `SELECT checkpoint_id, label, snapshot FROM private.goc_checkpoints
       WHERE checkpoint_id = $1 AND account_id = $2`, [checkpointId, accountId],
    );
    const checkpoint = checkpoints.rows[0];
    if (!checkpoint) throw campaignError("Checkpoint not found for this account.", 404);
    await backup(client, save, `pre_checkpoint_load:${checkpointId}`);
    const updated = await client.query<SaveRow>(
      `UPDATE private.goc_datapad_saves
       SET snapshot = $2::jsonb, revision = revision + 1, updated_at = now()
       WHERE account_id = $1 RETURNING *`,
      [accountId, JSON.stringify(checkpoint.snapshot)],
    );
    return { ok: true, revision: Number(updated.rows[0].revision), checkpointId: checkpoint.checkpoint_id,
      label: checkpoint.label, snapshot: checkpoint.snapshot, updatedAt: iso(updated.rows[0].updated_at) };
  });
}

const reconciliationTargets = new Map([
  ["level", "character"], ["experience", "character"],
  ["health", "gameState"], ["credits", "gameState"], ["creditsCriminal", "gameState"],
  ["location", "gameState"], ["inventory", "gameState"], ["objectives", "gameState"],
  ["combat", "gameState"], ["conditionTrack", "gameState"], ["campaignTimeMinutes", "gameState"],
]);

function applyReconciliation(snapshot: Record<string, any>, patch: Record<string, unknown>) {
  const changedKeys = Object.keys(patch);
  if (!changedKeys.length || changedKeys.some((key) => !reconciliationTargets.has(key) && key !== "lastNarration"))
    throw campaignError("Patch contains no supported reconciliation fields.", 400);
  const next = structuredClone(snapshot);
  for (const [key, value] of Object.entries(patch)) {
    if (key === "lastNarration") {
      if (typeof value !== "string") throw campaignError("lastNarration must be a string.", 400);
      if (!Array.isArray(next.messages)) throw campaignError("Saved messages are not an array.", 409);
      let index = -1;
      for (let i = next.messages.length - 1; i >= 0; i--) {
        if (next.messages[i]?.role === "assistant") { index = i; break; }
      }
      if (index < 0) next.messages.push({ role: "assistant", content: value, administrative: true });
      else next.messages[index] = { ...next.messages[index], content: value };
      continue;
    }
    if (["inventory", "objectives"].includes(key) && !Array.isArray(value))
      throw campaignError(`${key} must be an array.`, 400);
    if (key === "combat" && !record(value)) throw campaignError("combat must be an object.", 400);
    if (key === "location" && typeof value !== "string") throw campaignError("location must be a string.", 400);
    if (key === "campaignTimeMinutes" && (!Number.isSafeInteger(value) || Number(value) < 0))
      throw campaignError("campaignTimeMinutes must be a nonnegative integer.", 400);
    const target = reconciliationTargets.get(key)!;
    if (!record(next[target])) next[target] = {};
    next[target][key] = value;
  }
  return { snapshot: next, changedKeys };
}

export async function neonReconcile(accountId: string, expectedRevision: number, patch: unknown, reason: string) {
  assertAccount(accountId);
  assertRevision(expectedRevision);
  if (!record(patch)) throw campaignError("patch must be a JSON object.", 400);
  return withNeonTransaction(async (client) => {
    const save = await lockedSave(client, accountId);
    if (Number(save.revision) !== expectedRevision) throw conflict(Number(save.revision));
    const result = applyReconciliation(save.snapshot, patch);
    await backup(client, save, `pre_reconcile:${(reason || "OOC reconciliation").slice(0, 180)}`);
    const updated = await client.query<SaveRow>(
      `UPDATE private.goc_datapad_saves
       SET snapshot = $2::jsonb, revision = revision + 1, updated_at = now()
       WHERE account_id = $1 RETURNING revision, updated_at`,
      [accountId, JSON.stringify(result.snapshot)],
    );
    return { ok: true, revision: Number(updated.rows[0].revision),
      changedKeys: result.changedKeys, updatedAt: iso(updated.rows[0].updated_at) };
  });
}

export async function neonHud(accountId: string) {
  const save = await neonGetSaveByAccountId(accountId);
  if (!save) throw campaignError("Save not found for accountId.", 404);
  const state = record(save.snapshot.gameState) ? save.snapshot.gameState : {};
  const get = (key: string, fallback: unknown = null) => state[key] ?? fallback;
  const inventory = get("inventory", []);
  return { ok: true, revision: save.revision, updatedAt: save.updated_at,
    character: save.snapshot.character || {}, hud: {
      health: get("health"), credits: get("credits"), location: get("location"),
      inventory, inventoryCount: Array.isArray(inventory) ? inventory.length : 0,
      conditionTrack: get("conditionTrack"), forcePoints: get("forcePoints"),
      destinyPoints: get("destinyPoints"), darkSideScore: get("darkSideScore"),
      notoriety: get("notoriety"), combat: get("combat"),
      conditions: get("conditions", []), objectives: get("objectives", []),
      relationships: get("relationships", []), properties: get("properties", []),
      investments: get("investments", []), travelAccess: get("travelAccess", []),
    } };
}

export async function neonRagSearch(query: string, limit = 6) {
  const words = [...new Set(String(query || "").toLowerCase().match(/[a-z0-9'-]{3,}/g) || [])]
    .filter((word) => !["the", "and", "for", "with", "this", "that", "from", "into", "your", "you", "dmir", "game", "player", "action", "turn"].includes(word))
    .slice(0, 16);
  if (!words.length) return { ok: true, hits: [] };
  const tsquery = words.join(" OR ");
  const rows = await neonQuery<{
    document_id: string; title: string; authority: string; namespace: string;
    page: number; chunk_index: number; extraction: string; reviewed: boolean;
    content: string; rank: number;
  }>(
    `WITH q AS (SELECT websearch_to_tsquery('english', $1) AS query)
     SELECT c.document_id, d.title, d.authority, d.namespace, c.page, c.chunk_index,
       c.extraction, c.reviewed, left(c.content, 3500) AS content,
       ts_rank_cd(c.search_vector, q.query) AS rank
     FROM private.goc_rag_chunks c
     JOIN private.goc_rag_documents d ON d.document_id = c.document_id
     CROSS JOIN q
     WHERE c.search_vector @@ q.query
     ORDER BY (CASE d.authority WHEN 'saga_core' THEN 3.0 WHEN 'saga_supplement' THEN 2.0 ELSE 1.0 END)
       + (CASE WHEN c.reviewed THEN 0.75 ELSE 0 END)
       + ts_rank_cd(c.search_vector, q.query) DESC, d.title, c.page
     LIMIT $2`,
    [tsquery, Math.max(1, Math.min(Number(limit) || 6, 12))],
  );
  return { ok: true, hits: rows.map((row) => ({ documentId: row.document_id, title: row.title,
    authority: row.authority, namespace: row.namespace, page: row.page,
    chunkIndex: row.chunk_index, extraction: row.extraction, reviewed: row.reviewed,
    content: row.content, rank: Number(row.rank) })) };
}

export async function neonRagStats() {
  const rows = await neonQuery<{ documents: string; chunks: string; reviewed_chunks: string; ocr_chunks: string }>(
    `SELECT (SELECT count(*) FROM private.goc_rag_documents) AS documents,
       (SELECT count(*) FROM private.goc_rag_chunks) AS chunks,
       (SELECT count(*) FROM private.goc_rag_chunks WHERE reviewed) AS reviewed_chunks,
       (SELECT count(*) FROM private.goc_rag_chunks WHERE upper(extraction) = 'OCR') AS ocr_chunks`,
  );
  const row = rows[0];
  return { ok: true, stats: { documents: Number(row.documents), chunks: Number(row.chunks),
    reviewedChunks: Number(row.reviewed_chunks), ocrChunks: Number(row.ocr_chunks) } };
}
