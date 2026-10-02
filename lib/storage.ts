import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

function defaultPath() {
  if (process.env.CAMPAIGN_DB_PATH) return process.env.CAMPAIGN_DB_PATH;
  // Vercel's deployment filesystem is read-only. Use its ephemeral temp
  // volume so requests fail cleanly on missing campaign data instead of
  // throwing ENOENT while trying to create /var/task/data.
  if (process.env.VERCEL) return ":memory:";
  return resolve("data", "campaign.sqlite");
}

export function openStorage(path = defaultPath()) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;");
  db.exec(`CREATE TABLE IF NOT EXISTS campaigns (id TEXT PRIMARY KEY, state TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS checkpoints (id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL, state TEXT NOT NULL);`);
  return db;
}
