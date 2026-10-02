import { randomBytes } from "node:crypto";
import { accountStore, type Account } from "./accounts";
import { type DatapadSnapshot } from "./datapad-save";

export type HostedSave = { account_username: string; account_id: string; revision: number; snapshot: DatapadSnapshot; updated_at: string };

export function hostedPersistenceEnabled() {
  // The hosted bridge is also used by the local browser during development so
  // the browser, Vercel deployment, and Custom GPT all share one revisioned
  // campaign record.  VERCEL is intentionally not part of this gate.
  return Boolean(process.env.SUPABASE_GOC_BRIDGE_URL && process.env.SUPABASE_GOC_BRIDGE_KEY);
}

function bridgeUrl() { return process.env.SUPABASE_GOC_BRIDGE_URL!.replace(/\/$/, ""); }
function bridgeHeaders() { return { Authorization: `Bearer ${process.env.SUPABASE_GOC_BRIDGE_KEY}`, "Content-Type": "application/json" }; }

export async function hostedGet(username: string): Promise<HostedSave | null> {
  const response = await fetch(`${bridgeUrl()}?username=${encodeURIComponent(username)}`, { headers: bridgeHeaders(), cache: "no-store" });
  const body = await response.json() as HostedSave | Record<string, unknown>;
  if (!response.ok) {
    const error = typeof body === "object" && body && "error" in body && typeof body.error === "string" ? body.error : "Hosted campaign state could not be loaded.";
    throw new Error(error);
  }
  return typeof body.revision === "number" && body.snapshot ? body as HostedSave : null;
}

export async function hostedPut(username: string, accountId: string, expectedRevision: number, snapshot: DatapadSnapshot) {
  const response = await fetch(bridgeUrl(), { method: "POST", headers: bridgeHeaders(), body: JSON.stringify({ username, accountId, expectedRevision, snapshot }), cache: "no-store" });
  const body = await response.json() as HostedSave & { error?: string };
  if (!response.ok) throw Object.assign(new Error(body.error || "Hosted campaign state could not be saved."), { status: response.status });
  return body;
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
