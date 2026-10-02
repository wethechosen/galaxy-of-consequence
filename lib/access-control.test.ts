import { afterEach, describe, expect, it } from "vitest";
import { accountStore, type Account } from "./accounts";
import { hasPermission, permissionsFor, setPermission } from "./access-control";
import { openStorage } from "./storage";

const databases: ReturnType<typeof openStorage>[] = [];
function setup() {
  const db = accountStore(openStorage(":memory:")); databases.push(db);
  const admin: Account = { id: "admin", username: "admin", displayName: "Admin", role: "admin" };
  const player: Account = { id: "player", username: "player", displayName: "Player", role: "player" };
  for (const account of [admin, player]) db.prepare("INSERT INTO accounts VALUES (?, ?, ?, ?, '', '')").run(account.id, account.username, account.displayName, account.role);
  return { db, admin, player };
}
afterEach(() => databases.splice(0).forEach(db => db.close()));

describe("capability access control", () => {
  it("keeps player access limited to campaign play while admin has the GM capabilities", () => {
    const { db, admin, player } = setup();
    expect(hasPermission(player, "campaign:play", db)).toBe(true);
    expect(hasPermission(player, "gm:configure", db)).toBe(false);
    expect(hasPermission(player, "sources:read", db)).toBe(false);
    expect(hasPermission(admin, "gm:configure", db)).toBe(true);
    expect(permissionsFor(admin, db)).toContain("accounts:manage");
  });
  it("allows an administrator to grant a named capability without changing the account role", () => {
    const { db, admin, player } = setup();
    setPermission(admin, player.id, "sources:read", true, db);
    expect(hasPermission(player, "sources:read", db)).toBe(true);
    expect(player.role).toBe("player");
    setPermission(admin, player.id, "sources:read", false, db);
    expect(hasPermission(player, "sources:read", db)).toBe(false);
  });
});
