import { createHash, randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";

const username = String(process.argv[2] || "").trim().toLowerCase();
if (!username) throw new Error("Usage: node scripts/create-password-recovery.mjs <username>");
const requestedMinutes = Number.parseInt(process.env.RECOVERY_TTL_MINUTES || "60", 10);
const ttlMinutes = Number.isFinite(requestedMinutes) ? Math.min(Math.max(requestedMinutes, 10), 1440) : 60;
const db = new DatabaseSync(process.env.CAMPAIGN_DB_PATH || resolve("data", "campaign.sqlite"));
db.exec("CREATE TABLE IF NOT EXISTS password_recovery (tokenHash TEXT PRIMARY KEY, accountId TEXT NOT NULL, expires INTEGER NOT NULL)");
const account = db.prepare("SELECT id FROM accounts WHERE username = ?").get(username);
if (!account) throw new Error("Account not found.");
const token = randomBytes(32).toString("hex"), hash = createHash("sha256").update(token).digest("hex");
db.prepare("DELETE FROM password_recovery WHERE accountId = ? OR expires <= ?").run(account.id, Date.now());
db.prepare("INSERT INTO password_recovery VALUES (?, ?, ?)").run(hash, account.id, Date.now() + ttlMinutes * 60 * 1000);
console.log(`http://127.0.0.1:3101/recover?token=${token}`);
