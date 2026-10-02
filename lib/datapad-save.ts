import type { DatabaseSync } from "node:sqlite";
import { accountStore, type Account } from "./accounts";
import { getMarket, getSellQuote, getTradeAccess } from "@/original/lib/marketCatalog";

export type DatapadSnapshot = {
  character: Record<string, unknown> | null;
  gameState: Record<string, unknown>;
  messages: unknown[];
  comms: unknown[];
  settings: Record<string, unknown>;
  model?: string;
};
export class DatapadError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
function store(db: DatabaseSync) {
  db.exec(`CREATE TABLE IF NOT EXISTS datapad_saves (
    account_id TEXT PRIMARY KEY, revision INTEGER NOT NULL, snapshot TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS datapad_config (
    id INTEGER PRIMARY KEY CHECK(id = 1), revision INTEGER NOT NULL, config TEXT NOT NULL);`);
  return db;
}
function targetFor(actor: Account, requested: string | null | undefined, db: DatabaseSync) {
  const id = requested || actor.id;
  if (id !== actor.id && actor.role !== "admin") throw new DatapadError("You can only open your own campaign save.", 403);
  if (!db.prepare("SELECT id FROM accounts WHERE id = ?").get(id)) throw new DatapadError("Account no longer exists.", 404);
  return id;
}
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
function validateSnapshot(value: unknown): DatapadSnapshot {
  if (!record(value) || !(value.character === null || record(value.character)) || !record(value.gameState)
    || !record(value.settings) || !Array.isArray(value.messages) || !Array.isArray(value.comms)) {
    throw new DatapadError("Invalid campaign save.");
  }
  if (JSON.stringify(value).length > 8_000_000) throw new DatapadError("Campaign save is too large. Export it before removing old entries.", 413);
  // Deliberately whitelist fields: provider credentials never belong in campaign saves.
  return { character: value.character as DatapadSnapshot["character"], gameState: value.gameState,
    messages: value.messages, comms: value.comms, settings: value.settings,
    model: typeof value.model === "string" ? value.model.slice(0, 160) : undefined };
}
export function readDatapad(actor: Account, requested?: string | null, database = accountStore()) {
  const db = store(database), accountId = targetFor(actor, requested, db);
  const row = db.prepare("SELECT revision, snapshot, updated_at FROM datapad_saves WHERE account_id = ?").get(accountId) as { revision: number; snapshot: string; updated_at: string } | undefined;
  const config = db.prepare("SELECT revision, config FROM datapad_config WHERE id = 1").get() as { revision: number; config: string } | undefined;
  return { accountId, revision: row?.revision ?? 0, snapshot: row ? JSON.parse(row.snapshot) as DatapadSnapshot : null,
    updatedAt: row?.updated_at ?? null, config: config ? JSON.parse(config.config) : null, configRevision: config?.revision ?? 0 };
}
function same(value: unknown, other: unknown) { return JSON.stringify(value) === JSON.stringify(other); }
function inventoryCounts(value: unknown) {
  if (!Array.isArray(value)) return null;
  const counts = new Map<string, number>();
  for (const raw of value) {
    if (!record(raw) || typeof raw.name !== "string" || !raw.name.trim() || !Number.isSafeInteger(raw.qty) || Number(raw.qty) < 1) return null;
    const key = raw.name.trim().toLocaleLowerCase();
    counts.set(key, (counts.get(key) || 0) + Number(raw.qty));
  }
  return counts;
}
function validatedPublicTrade(before: DatapadSnapshot, after: DatapadSnapshot) {
  if (!before.character || !same(before.character, after.character)) return false;
  const priorState = { ...before.gameState }, nextState = { ...after.gameState };
  const priorInventory = priorState.inventory, nextInventory = nextState.inventory;
  const priorCredits = Number(priorState.credits), nextCredits = Number(nextState.credits);
  delete priorState.inventory; delete nextState.inventory; delete priorState.credits; delete nextState.credits;
  if (!same(priorState, nextState) || !Number.isFinite(priorCredits) || !Number.isFinite(nextCredits)) return false;
  const prior = inventoryCounts(priorInventory), next = inventoryCounts(nextInventory);
  if (!prior || !next) return false;
  const names = new Set([...prior.keys(), ...next.keys()]);
  const changed = [...names].filter((name) => (next.get(name) || 0) !== (prior.get(name) || 0));
  if (changed.length !== 1) return false;
  const name = changed[0], quantityDelta = (next.get(name) || 0) - (prior.get(name) || 0);
  const location = String(before.gameState.location || "");
  if (quantityDelta === 1) {
    const good = getMarket(location, Number(before.character.level) || 1).goods.find((entry: { name: string }) => entry.name.toLocaleLowerCase() === name);
    return Boolean(good && getTradeAccess(location, before.character, before.gameState, good as any).direct && nextCredits === priorCredits - good.price);
  }
  if (quantityDelta === -1) {
    const item = Array.isArray(priorInventory) ? priorInventory.find((entry) => record(entry) && String(entry.name).trim().toLocaleLowerCase() === name) : null;
    // marketCatalog is legacy JavaScript and its generated declaration narrows
    // the item parameter too aggressively; runtime validation above guarantees
    // this is a concrete inventory record with a name.
    const quote = getSellQuote(item as any, location);
    return Boolean(quote && getTradeAccess(location, before.character, before.gameState).publicMarket && nextCredits === priorCredits + quote.price);
  }
  return false;
}
function saveSnapshot(actor: Account, requested: string | null | undefined, expectedRevision: number, snapshot: unknown, database: DatabaseSync, authoritative: boolean) {
  const db = store(database), accountId = targetFor(actor, requested, db);
  let validated = validateSnapshot(snapshot);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw new DatapadError("A valid save revision is required.");
  const current = db.prepare("SELECT snapshot FROM datapad_saves WHERE account_id = ?").get(accountId) as { snapshot: string } | undefined;
  if (!authoritative && current) {
    const established = validateSnapshot(JSON.parse(current.snapshot));
    // The browser owns presentation preferences, chat history, and drafts. Once
    // play has begun, only a trusted server adjudicator may replace character
    // or game-state facts. This prevents a generic autosave from self-awarding
    // credits, inventory, XP, levels, or dossier entries.
    if (established.character !== null) {
      if (!validatedPublicTrade(established, validated)) {
        validated = { ...validated, character: established.character, gameState: established.gameState };
      }
    }
  }
  const updatedAt = new Date().toISOString(), nextRevision = expectedRevision + 1;
  const serialized = JSON.stringify(validated);
  const changed = expectedRevision === 0
    ? db.prepare("INSERT OR IGNORE INTO datapad_saves VALUES (?, ?, ?, ?)").run(accountId, nextRevision, serialized, updatedAt)
    : db.prepare("UPDATE datapad_saves SET revision = ?, snapshot = ?, updated_at = ? WHERE account_id = ? AND revision = ?")
      .run(nextRevision, serialized, updatedAt, accountId, expectedRevision);
  if (!changed.changes) throw new DatapadError("This save changed in another window. Your draft is preserved in this browser; reload the saved version before continuing.", 409);
  return { accountId, revision: nextRevision, updatedAt };
}

/** Browser/autosave path. Established campaign facts are preserved. */
export function saveDatapad(actor: Account, requested: string | null | undefined, expectedRevision: number, snapshot: unknown, database = accountStore()) {
  return saveSnapshot(actor, requested, expectedRevision, snapshot, database, false);
}

/** Trusted adjudication path used only after server-side outcome validation. */
export function saveAuthoritativeDatapad(actor: Account, requested: string | null | undefined, expectedRevision: number, snapshot: unknown, database = accountStore()) {
  return saveSnapshot(actor, requested, expectedRevision, snapshot, database, true);
}
export function saveDatapadConfig(actor: Account, expectedRevision: number, value: unknown, database = accountStore()) {
  if (actor.role !== "admin") throw new DatapadError("Only the GM can edit the campaign directive and source library.", 403);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || !record(value)
    || typeof value.directive !== "string" || !Array.isArray(value.sourcebooks) || JSON.stringify(value).length > 8_000_000) throw new DatapadError("Invalid campaign configuration.");
  const db = store(database), serialized = JSON.stringify({ directive: value.directive, sourcebooks: value.sourcebooks });
  const result = expectedRevision === 0
    ? db.prepare("INSERT OR IGNORE INTO datapad_config VALUES (1, 1, ?)").run(serialized)
    : db.prepare("UPDATE datapad_config SET revision = ?, config = ? WHERE id = 1 AND revision = ?").run(expectedRevision + 1, serialized, expectedRevision);
  if (!result.changes) throw new DatapadError("Campaign configuration changed in another window. Reload before editing.", 409);
  return { configRevision: expectedRevision + 1 };
}
