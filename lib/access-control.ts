import type { Account } from "./accounts";
import { accountStore, requireAccount } from "./accounts";
import type { DatabaseSync } from "node:sqlite";

export const PERMISSIONS = [
  "campaign:read", "campaign:play", "campaign:manage",
  "gm:configure", "gm:review", "accounts:manage",
  "sources:read", "sources:manage", "maps:read", "maps:manage",
  "world:read", "world:manage", "audit:read",
] as const;
export type Permission = typeof PERMISSIONS[number];
const ADMIN_PERMISSIONS = new Set<Permission>(PERMISSIONS);
// Private sourcebooks, world controls, and map imports remain GM-only by
// default. Players need only their campaign read/play capabilities.
const PLAYER_PERMISSIONS = new Set<Permission>(["campaign:read", "campaign:play"]);

export function accessStore(db = accountStore()) {
  db.exec(`CREATE TABLE IF NOT EXISTS account_permissions (
    account_id TEXT NOT NULL, permission TEXT NOT NULL, granted INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY(account_id, permission));`);
  return db;
}
export function permissionsFor(account: Account, db = accountStore()): Permission[] {
  const result = new Set(account.role === "admin" ? ADMIN_PERMISSIONS : PLAYER_PERMISSIONS);
  const rows = accessStore(db).prepare("SELECT permission, granted FROM account_permissions WHERE account_id = ?").all(account.id) as { permission: string; granted: number }[];
  for (const row of rows) {
    if (!PERMISSIONS.includes(row.permission as Permission)) continue;
    if (row.granted) result.add(row.permission as Permission); else result.delete(row.permission as Permission);
  }
  return [...result].sort();
}
export function hasPermission(account: Account, permission: Permission, db = accountStore()) { return permissionsFor(account, db).includes(permission); }
export function requirePermission(request: Request, permission: Permission) {
  const account = requireAccount(request);
  if (!hasPermission(account, permission)) throw new Error(`Permission required: ${permission}.`);
  return account;
}
export function setPermission(actor: Account, accountId: string, permission: Permission, granted: boolean, db: DatabaseSync = accountStore()) {
  if (actor.role !== "admin" || !hasPermission(actor, "accounts:manage", db)) throw new Error("Account permission changes require an administrator.");
  if (!PERMISSIONS.includes(permission)) throw new Error("Unknown permission.");
  if (!db.prepare("SELECT id FROM accounts WHERE id = ?").get(accountId)) throw new Error("Account not found.");
  if (accountId === actor.id && !granted && permission === "accounts:manage") throw new Error("You cannot remove your own account-management permission.");
  accessStore(db).prepare("INSERT INTO account_permissions(account_id, permission, granted) VALUES (?, ?, ?) ON CONFLICT(account_id, permission) DO UPDATE SET granted = excluded.granted").run(accountId, permission, granted ? 1 : 0);
}
