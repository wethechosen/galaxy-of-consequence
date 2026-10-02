import { afterEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { openStorage } from "./storage";
import { accountStore, authenticate, createAccount, endSession, listRequests, needsSetup, refreshSession, resetPassword, reviewRequest, sessionAccount, setupOwner, startSession, submitRequest, updateProfile } from "./accounts";
const databases: ReturnType<typeof openStorage>[] = [];
function fresh() { const db = accountStore(openStorage(":memory:")); databases.push(db); return db; }
afterEach(() => { databases.splice(0).forEach(db => db.close()); });
describe("local terminal accounts", () => {
  it("resets a password through a one-time expiring token without replacing the account", () => {
    const db = fresh(), owner = setupOwner("owner", "test-only-password-123", "Owner", db), token = "a".repeat(64);
    db.prepare("INSERT INTO password_recovery VALUES (?, ?, ?)").run(createHash("sha256").update(token).digest("hex"), owner.id, 2000);
    expect(resetPassword(token, "new-test-password-456", db, 1000).id).toBe(owner.id);
    expect(authenticate("owner", "new-test-password-456", db, 1001).id).toBe(owner.id);
    expect(() => resetPassword(token, "another-password-789", db, 1002)).toThrow("invalid or expired");
  });
  it("creates a single owner and never stores the password or raw session token", () => {
    const db = fresh(); expect(needsSetup(db)).toBe(true);
    const owner = setupOwner("Owner", "test-only-password-123", "Test Owner", db);
    expect(owner.role).toBe("admin"); expect(needsSetup(db)).toBe(false);
    expect(() => setupOwner("second", "test-only-password-123", "Second", db)).toThrow("already exists");
    expect(JSON.stringify(db.prepare("SELECT * FROM accounts").all())).not.toContain("test-only-password-123");
    const token = startSession(owner, db, 1000);
    expect(JSON.stringify(db.prepare("SELECT * FROM sessions").all())).not.toContain(token);
    expect(sessionAccount(token, db, 1001)?.id).toBe(owner.id);
    expect(refreshSession(token, db, 2000)).toBe(true);
    expect(sessionAccount(token, db, 1000 + 28800000)?.id).toBe(owner.id);
    expect(sessionAccount(token, db, 2000 + 28800000)).toBeNull();
    endSession(token, db); expect(sessionAccount(token, db, 1001)).toBeNull();
  });
  it("validates credentials and locks repeated incorrect attempts", () => {
    const db = fresh(); createAccount("pilot", "test-only-password-123", "Pilot", "player", db);
    expect(() => createAccount("bad", "short", "Bad", "player", db)).toThrow();
    expect(authenticate("PILOT", "test-only-password-123", db).role).toBe("player");
    for (let i = 0; i < 8; i++) expect(() => authenticate("pilot", "wrong", db, 1000)).toThrow("incorrect");
    expect(() => authenticate("pilot", "test-only-password-123", db, 1001)).toThrow("Too many");
    expect(authenticate("pilot", "test-only-password-123", db, 901001).username).toBe("pilot");
  });
  it("keeps profiles separate and enforces GM-only review with request visibility", () => {
    const db = fresh(); const owner = setupOwner("owner", "test-only-password-123", "Owner", db);
    const player = createAccount("pilot", "test-only-password-123", "Pilot", "player", db);
    const other = createAccount("other", "test-only-password-123", "Other", "player", db);
    updateProfile(player.id, "New Callsign", db); expect(authenticate("pilot", "test-only-password-123", db).displayName).toBe("New Callsign");
    const id = submitRequest(player, "campaign", "Properties", "Request a residence", db);
    expect(listRequests(other, "campaign", db)).toHaveLength(0);
    expect(listRequests(owner, "campaign", db)).toHaveLength(1);
    expect(listRequests(owner, "other-timeline", db)).toHaveLength(0);
    expect(() => reviewRequest(player, id, "Granted", "answered", db)).toThrow("Administrator");
    reviewRequest(owner, id, "Requires source review", "answered", db);
    expect(listRequests(player, "campaign", db)[0].response).toBe("Requires source review");
    expect(() => reviewRequest(owner, id, "Again", "answered", db)).toThrow("already reviewed");
  });
});
