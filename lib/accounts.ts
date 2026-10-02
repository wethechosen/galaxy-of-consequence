import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { openStorage } from "./storage";
import type { DatabaseSync } from "node:sqlite";
import { hostedAuthEnabled, hostedListAccounts, hostedSessionAccount, hostedStartSession } from "./hosted-auth";

export type Account = { id: string; username: string; displayName: string; role: "admin" | "player" };
export type ReviewRequest = { id: string; campaignId: string; accountId: string; category: string; detail: string; status: string; response: string; createdAt: string };
export const SESSION_COOKIE = "goc_session";
const sessionLength = 8 * 60 * 60 * 1000;
let database: DatabaseSync | undefined;
export function accountStore(db = database ??= openStorage()) {
  db.exec(`CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, displayName TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin','player')), salt TEXT NOT NULL, hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, accountId TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS login_attempts (name TEXT PRIMARY KEY, count INTEGER NOT NULL, untilMs INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS password_recovery (
      tokenHash TEXT PRIMARY KEY, accountId TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS review_requests (id TEXT PRIMARY KEY, campaignId TEXT NOT NULL, accountId TEXT NOT NULL,
    category TEXT NOT NULL, detail TEXT NOT NULL, status TEXT NOT NULL, response TEXT NOT NULL, createdAt TEXT NOT NULL);`);
  db.exec(`CREATE TABLE IF NOT EXISTS account_permissions (
    account_id TEXT NOT NULL, permission TEXT NOT NULL, granted INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY(account_id, permission));`);
  return db;
}
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const safeAccount = (row: Account): Account => ({ id: row.id, username: row.username, displayName: row.displayName, role: row.role });
export function needsSetup(db = accountStore()) { if (hostedAuthEnabled()) return false; return !db.prepare("SELECT id FROM accounts LIMIT 1").get(); }
export function createAccount(username: string, password: string, displayName: string, role: Account["role"], db = accountStore()) {
  if (hostedAuthEnabled()) throw new Error("Hosted registration is disabled.");
  username = username.trim().toLowerCase(); displayName = displayName.trim();
  if (!/^[a-z0-9_.@-]{3,80}$/.test(username)) throw new Error("Use 3–80 letters, numbers, dots, @, underscores or hyphens for your username.");
  if (password.length < 12 || password.length > 128) throw new Error("Use a password of 12–128 characters.");
  if (!displayName || displayName.length > 80) throw new Error("Display name must be 1–80 characters.");
  const salt = randomBytes(32).toString("hex");
  const hash = scryptSync(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString("hex");
  const account = { id: randomUUID(), username, displayName, role };
  try { db.prepare("INSERT INTO accounts VALUES (?, ?, ?, ?, ?, ?)").run(account.id, username, displayName, role, salt, hash); }
  catch { throw new Error("That username is already registered."); }
  return account;
}
export function setupOwner(username: string, password: string, displayName: string, db = accountStore()) {
  if (hostedAuthEnabled()) throw new Error("Hosted owner setup is disabled.");
  db.exec("BEGIN IMMEDIATE");
  try {
    if (!needsSetup(db)) throw new Error("Owner already exists. Sign in instead.");
    const owner = createAccount(username, password, displayName, "admin", db);
    db.exec("COMMIT"); return owner;
  } catch (error) { db.exec("ROLLBACK"); throw error; }
}
export function authenticate(username: string, password: string, db = accountStore(), now = Date.now()) {
  const name = username.trim().toLowerCase();
  const attempt = db.prepare("SELECT * FROM login_attempts WHERE name = ?").get(name) as { count: number; untilMs: number } | undefined;
  if (attempt && attempt.count >= 8 && attempt.untilMs > now) throw new Error("Too many attempts. Try again in 15 minutes.");
  const row = db.prepare("SELECT * FROM accounts WHERE username = ?").get(name) as (Account & { salt: string; hash: string }) | undefined;
  const supplied = scryptSync(password, row?.salt ?? "unknown-local-account", 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  if (!row || !timingSafeEqual(supplied, Buffer.from(row.hash, "hex"))) {
    db.prepare("INSERT OR REPLACE INTO login_attempts VALUES (?, ?, ?)").run(name, attempt && attempt.untilMs > now ? attempt.count + 1 : 1, now + 900000);
    throw new Error("Username or password is incorrect.");
  }
  db.prepare("DELETE FROM login_attempts WHERE name = ?").run(name);
  return safeAccount(row);
}
export function startSession(account: Account, db = accountStore(), now = Date.now()) {
  if (hostedAuthEnabled()) return hostedStartSession(account, now);
  const token = randomBytes(32).toString("hex");
  db.prepare("DELETE FROM sessions WHERE expires <= ?").run(now);
  db.prepare("INSERT INTO sessions VALUES (?, ?, ?)").run(digest(token), account.id, now + sessionLength);
  return token;
}
export function requestToken(request: Request) {
  return request.headers.get("cookie")?.split(";").map(item => item.trim()).find(item => item.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1) ?? "";
}
export function sessionAccount(token: string, db = accountStore(), now = Date.now()): Account | null {
  if (hostedAuthEnabled()) return hostedSessionAccount(token, now) as Account | null;
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const row = db.prepare("SELECT a.id, a.username, a.displayName, a.role FROM accounts a JOIN sessions s ON a.id = s.accountId WHERE s.token = ? AND s.expires > ?").get(digest(token), now) as Account | undefined;
  return row ? safeAccount(row) : null;
}
export function refreshSession(token: string, db = accountStore(), now = Date.now()) {
  if (hostedAuthEnabled()) return Boolean(hostedSessionAccount(token, now));
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  const result = db.prepare("UPDATE sessions SET expires = ? WHERE token = ? AND expires > ?")
    .run(now + sessionLength, digest(token), now);
  return Boolean(result.changes);
}
export function requireAccount(request: Request, admin = false) {
  const account = sessionAccount(requestToken(request));
  if (!account) throw new Error("Sign in to open your datapad.");
  if (admin && account.role !== "admin") throw new Error("Administrator access required.");
  return account;
}
export function endSession(token: string, db = accountStore()) { if (hostedAuthEnabled()) return; db.prepare("DELETE FROM sessions WHERE token = ?").run(digest(token)); }
export function listAccounts(db = accountStore()) { if (hostedAuthEnabled()) return hostedListAccounts() as Account[]; return db.prepare("SELECT id, username, displayName, role FROM accounts ORDER BY username").all() as Account[]; }
export function updateProfile(id: string, displayName: string, db = accountStore()) {
  if (!displayName.trim() || displayName.length > 80) throw new Error("Display name must be 1–80 characters.");
  db.prepare("UPDATE accounts SET displayName = ? WHERE id = ?").run(displayName.trim(), id);
}
export function resetPassword(token: string, password: string, db = accountStore(), now = Date.now()) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error("This recovery link is invalid or expired.");
  if (password.length < 12 || password.length > 128) throw new Error("Use a password of 12–128 characters.");
  const tokenHash = digest(token);
  const recovery = db.prepare("SELECT accountId FROM password_recovery WHERE tokenHash = ? AND expires > ?").get(tokenHash, now) as { accountId: string } | undefined;
  if (!recovery) throw new Error("This recovery link is invalid or expired.");
  const salt = randomBytes(32).toString("hex");
  const hash = scryptSync(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString("hex");
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("UPDATE accounts SET salt = ?, hash = ? WHERE id = ?").run(salt, hash, recovery.accountId);
    db.prepare("DELETE FROM sessions WHERE accountId = ?").run(recovery.accountId);
    db.prepare("DELETE FROM login_attempts WHERE name = (SELECT username FROM accounts WHERE id = ?)").run(recovery.accountId);
    db.prepare("DELETE FROM password_recovery WHERE accountId = ?").run(recovery.accountId);
    db.exec("COMMIT");
  } catch (error) { db.exec("ROLLBACK"); throw error; }
  return safeAccount(db.prepare("SELECT id, username, displayName, role FROM accounts WHERE id = ?").get(recovery.accountId) as Account);
}
export function listRequests(account: Account, campaignId: string, db = accountStore()) {
  return (account.role === "admin"
    ? db.prepare("SELECT * FROM review_requests WHERE campaignId = ? ORDER BY createdAt DESC").all(campaignId)
    : db.prepare("SELECT * FROM review_requests WHERE campaignId = ? AND accountId = ? ORDER BY createdAt DESC").all(campaignId, account.id)) as ReviewRequest[];
}
export function submitRequest(account: Account, campaignId: string, category: string, detail: string, db = accountStore()) {
  const id = randomUUID();
  db.prepare("INSERT INTO review_requests VALUES (?, ?, ?, ?, ?, 'pending', '', ?)").run(id, campaignId, account.id, category, detail, new Date().toISOString());
  return id;
}
export function reviewRequest(account: Account, id: string, response: string, status: string, db = accountStore()) {
  if (account.role !== "admin") throw new Error("Administrator access required.");
  if (!["answered", "declined"].includes(status)) throw new Error("Invalid review status.");
  const result = db.prepare("UPDATE review_requests SET response = ?, status = ? WHERE id = ? AND status = 'pending'").run(response, status, id);
  if (!result.changes) throw new Error("Request was already reviewed or does not exist.");
}
