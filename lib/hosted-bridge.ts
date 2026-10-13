import { randomBytes } from "node:crypto";
import { accountStore, type Account } from "./accounts";
import { type DatapadSnapshot } from "./datapad-save";
import { hostedRuntimeRequired } from "./neon-db";
import { neonGetSaveByUsername, neonPutSave } from "./neon-campaign-store";

export type HostedSave = { account_username: string; account_id: string; revision: number; snapshot: DatapadSnapshot; updated_at: string };

export function hostedPersistenceEnabled() {
  // Vercel must never silently fall back to instance-local SQLite when its
  // database environment is missing. The Neon call will fail closed with 503.
  return hostedRuntimeRequired();
}

export async function hostedGet(username: string): Promise<HostedSave | null> {
  return await neonGetSaveByUsername(username) as HostedSave | null;
}

export async function hostedPut(username: string, accountId: string, expectedRevision: number, snapshot: DatapadSnapshot) {
  return await neonPutSave(username, accountId, expectedRevision, snapshot) as unknown as HostedSave;
}

export function ensureHostedActor(actor: Account) {
  const db = accountStore();
  const existing = db.prepare("SELECT id FROM accounts WHERE username = ?").get(actor.username) as { id: string } | undefined;
  if (!existing) {
    const salt = randomBytes(16).toString("hex");
    const hash = randomBytes(32).toString("hex");
    db.prepare("INSERT INTO accounts (id, username, displayName, role, salt, hash) VALUES (?, ?, ?, ?, ?, ?)").run(actor.id, actor.username, actor.displayName, actor.role, salt, hash);
  }
  return actor;
}

export function hydrateHostedSave(actor: Account, save: HostedSave) {
  ensureHostedActor(actor);
  const db = accountStore();
  db.exec("CREATE TABLE IF NOT EXISTS datapad_saves (account_id TEXT PRIMARY KEY, revision INTEGER NOT NULL, snapshot TEXT NOT NULL, updated_at TEXT NOT NULL)");
  db.prepare("INSERT INTO datapad_saves(account_id, revision, snapshot, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(account_id) DO UPDATE SET revision=excluded.revision, snapshot=excluded.snapshot, updated_at=excluded.updated_at")
    .run(actor.id, save.revision, JSON.stringify(save.snapshot), save.updated_at);
}

export async function saveHostedResult(actor: Account, expectedRevision: number, snapshot: DatapadSnapshot) {
  return hostedPut(actor.username, actor.id, expectedRevision, snapshot);
}
