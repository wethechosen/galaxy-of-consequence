import { randomBytes, createHash } from "node:crypto";
import { accountStore, createAccount, needsSetup, setupOwner, type Account } from "./accounts";
export const googleCookie = "goc_google_state";
export function googleStore() {
  const db = accountStore();
  db.exec(`CREATE TABLE IF NOT EXISTS google_flows (state TEXT PRIMARY KEY, verifier TEXT, nonce TEXT, returnTo TEXT, expires INTEGER);
    CREATE TABLE IF NOT EXISTS google_accounts (subject TEXT PRIMARY KEY, accountId TEXT NOT NULL);`);
  return db;
}
export function beginGoogleFlow(returnTo: string) {
  const db = googleStore(), state = randomBytes(32).toString("hex"), verifier = randomBytes(32).toString("base64url"), nonce = randomBytes(32).toString("hex");
  db.prepare("DELETE FROM google_flows WHERE expires < ?").run(Date.now());
  db.prepare("INSERT INTO google_flows VALUES (?,?,?,?,?)").run(state, verifier, nonce, /^\/(?!\/)/.test(returnTo) && !returnTo.includes("\\") ? returnTo : "/", Date.now() + 600000);
  return { state, nonce, challenge: createHash("sha256").update(verifier).digest("base64url") };
}
export function consumeGoogleFlow(state: string) {
  return googleStore().prepare("DELETE FROM google_flows WHERE state = ? AND expires > ? RETURNING verifier, nonce, returnTo").get(state, Date.now()) as { verifier: string; nonce: string; returnTo: string } | undefined;
}
export function googleAccount(subject: string, email: string, name: string): Account {
  const db = googleStore();
  const existing = db.prepare("SELECT a.id,a.username,a.displayName,a.role FROM accounts a JOIN google_accounts g ON a.id=g.accountId WHERE g.subject=?").get(subject) as Account | undefined;
  if (existing) return existing;
  // Never auto-link an unverified local username to a Google identity.
  const account = needsSetup(db) ? setupOwner(email, randomBytes(48).toString("hex"), name, db) : createAccount(email, randomBytes(48).toString("hex"), name, "player", db);
  db.prepare("INSERT INTO google_accounts VALUES (?,?)").run(subject, account.id);
  return account;
}
