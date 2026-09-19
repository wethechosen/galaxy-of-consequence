import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export function openStorage(path = process.env.CAMPAIGN_DB_PATH ?? resolve("data", "campaign.sqlite")) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;");
  db.exec(`CREATE TABLE IF NOT EXISTS campaigns (id TEXT PRIMARY KEY, state TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS checkpoints (id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL, state TEXT NOT NULL);`);
  return db;
}
