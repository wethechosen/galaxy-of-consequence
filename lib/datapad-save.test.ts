import { afterEach, describe, expect, it, vi } from "vitest";
import { openStorage } from "./storage";
import { accountStore, type Account } from "./accounts";
import { readDatapad, saveAuthoritativeDatapad, saveDatapad, saveDatapadConfig } from "./datapad-save";
import * as accounts from "./accounts";
import * as hostedBridge from "./hosted-bridge";
import { GET as getHostedDatapad, PUT as putHostedDatapad } from "../app/api/datapad/route";
const databases: ReturnType<typeof openStorage>[] = [];
function setup() {
  const db = accountStore(openStorage(":memory:")); databases.push(db);
  const owner: Account = { id: "gm", username: "gm", displayName: "GM", role: "admin" };
  const one: Account = { id: "one", username: "one", displayName: "One", role: "player" };
  const two: Account = { id: "two", username: "two", displayName: "Two", role: "player" };
  for (const a of [owner, one, two]) db.prepare("INSERT INTO accounts VALUES (?, ?, ?, ?, '', '')").run(a.id, a.username, a.displayName, a.role);
  return { db, owner, one, two };
}
const snapshot = { character: { name: "D'mir" }, gameState: { credits: 500, inventory: [] }, messages: [{ role: "user", content: "Look around" }], comms: [], settings: {} };
afterEach(() => { vi.restoreAllMocks(); databases.splice(0).forEach(db => db.close()); });
describe("original campaign persistence", () => {
  it("separates player saves and permits an administrator to select an actual player", () => {
    const { db, owner, one, two } = setup();
    saveDatapad(one, null, 0, snapshot, db);
    expect(readDatapad(two, null, db).snapshot).toBeNull();
    expect(() => readDatapad(two, one.id, db)).toThrow("own campaign");
    expect(() => saveDatapad(two, one.id, 1, snapshot, db)).toThrow("own campaign");
    expect(readDatapad(owner, one.id, db).snapshot).toEqual(snapshot);
  });
  it("rejects stale writes and prevents browser saves from overwriting established campaign facts", () => {
    const { db, one } = setup();
    saveDatapad(one, null, 0, snapshot, db);
    const advanced = { ...snapshot, gameState: { credits: 450, inventory: [{ name: "Medpac" }] } };
    saveDatapad(one, null, 1, advanced, db);
    expect(() => saveDatapad(one, null, 0, snapshot, db)).toThrow("another window");
    expect(() => saveDatapad(one, null, 1, snapshot, db)).toThrow("another window");
    expect(readDatapad(one, null, db).snapshot).toEqual(snapshot);
  });
  it("allows only the trusted adjudication path to commit campaign mutations", () => {
    const { db, one } = setup();
    saveDatapad(one, null, 0, snapshot, db);
    const advanced = { ...snapshot, gameState: { credits: 450, inventory: [{ name: "Medpac" }] } };
    saveAuthoritativeDatapad(one, null, 1, advanced, db);
    expect(readDatapad(one, null, db).snapshot).toEqual(advanced);
  });
  it("validates an exact catalog trade server-side while rejecting invented inventory", () => {
    const { db, one } = setup();
    const established = { ...snapshot, character: { ...snapshot.character, level: 1 }, gameState: { credits: 500, location: "Coruscant", inventory: [] } };
    saveDatapad(one, null, 0, established, db);
    const purchase = { ...established, gameState: { ...established.gameState, credits: 270, inventory: [{ id: "m", name: "Medpac", qty: 1, tag: "medical" }] } };
    saveDatapad(one, null, 1, purchase, db);
    expect(readDatapad(one, null, db).snapshot?.gameState).toEqual(purchase.gameState);
    const invented = { ...purchase, gameState: { ...purchase.gameState, inventory: [...purchase.gameState.inventory, { id: "x", name: "Kelvek vault key", qty: 1 }] } };
    saveDatapad(one, null, 2, invented, db);
    expect(readDatapad(one, null, db).snapshot?.gameState).toEqual(purchase.gameState);
  });
  it("keeps directives and sourcebooks GM-managed and excludes provider credentials", () => {
    const { db, owner, one } = setup();
    const config = { directive: "Campaign", sourcebooks: [{ title: "Core" }] };
    expect(() => saveDatapadConfig(one, 0, config, db)).toThrow("Only the GM");
    saveDatapadConfig(owner, 0, config, db);
    saveDatapad(one, null, 0, { ...snapshot, apiKey: "do-not-persist" }, db);
    expect(readDatapad(one, null, db).config).toEqual(config);
    expect(readDatapad(one, null, db).snapshot).not.toHaveProperty("apiKey");
  });
});

function hostedSetup() {
  const { db, owner, one, two } = setup();
  const established = {
    ...snapshot,
    character: { name: "D'mir", level: 1, experience: 500, talents: "None" },
    gameState: { credits: 500, location: "Coruscant", health: 26, inventory: [] },
  };
  let cloud: hostedBridge.HostedSave = { account_username: one.username, account_id: one.id, revision: 9, snapshot: established, updated_at: "2026-10-06T00:00:00Z" };
  vi.spyOn(accounts, "accountStore").mockReturnValue(db);
  const actor = vi.spyOn(accounts, "requireAccount").mockReturnValue(one);
  vi.spyOn(accounts, "listAccounts").mockReturnValue([owner, one, two]);
  vi.spyOn(hostedBridge, "hostedPersistenceEnabled").mockReturnValue(true);
  vi.spyOn(hostedBridge, "ensureHostedActor").mockImplementation(account => account);
  const get = vi.spyOn(hostedBridge, "hostedGet").mockImplementation(async username => username === cloud.account_username ? cloud : null);
  vi.spyOn(hostedBridge, "hydrateHostedSave").mockImplementation((account, save) => {
    db.exec("CREATE TABLE IF NOT EXISTS datapad_saves (account_id TEXT PRIMARY KEY, revision INTEGER NOT NULL, snapshot TEXT NOT NULL, updated_at TEXT NOT NULL)");
    db.prepare("INSERT INTO datapad_saves VALUES (?, ?, ?, ?) ON CONFLICT(account_id) DO UPDATE SET revision=excluded.revision, snapshot=excluded.snapshot, updated_at=excluded.updated_at")
      .run(account.id, save.revision, JSON.stringify(save.snapshot), save.updated_at);
  });
  const put = vi.spyOn(hostedBridge, "hostedPut").mockImplementation(async (username, accountId, expectedRevision, next) => {
    if (expectedRevision !== cloud.revision) throw Object.assign(new Error("revision_conflict"), { status: 409 });
    cloud = { account_username: username, account_id: accountId, revision: expectedRevision + 1, snapshot: next, updated_at: "2026-10-06T00:01:00Z" };
    return cloud;
  });
  const request = (next: unknown, revision = 9, accountId = one.id) => new Request("http://localhost:3101/api/datapad", {
    method: "PUT", headers: { "Content-Type": "application/json", origin: "http://localhost:3101" },
    body: JSON.stringify({ accountId, revision, snapshot: next }),
  });
  return { db, owner, one, two, established, actor, get, put, request, cloud: () => cloud };
}

describe("hosted autosave authority", () => {
  it("preserves committed XP, levels, talents, credits and inventory while saving presentation once", async () => {
    const test = hostedSetup();
    const draft = { ...test.established, character: { ...test.established.character, level: 20, experience: 190000, talents: "Invented mastery" },
      gameState: { ...test.established.gameState, credits: 900000, health: 99, inventory: [{ name: "Lightsaber", qty: 1 }] },
      messages: [{ role: "assistant", content: "Presentation update" }], settings: { music: false } };
    const response = await putHostedDatapad(test.request(draft));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ accountId: test.one.id, revision: 10 });
    expect(test.put).toHaveBeenCalledTimes(1);
    expect(test.put.mock.calls[0][2]).toBe(9);
    expect(test.cloud().snapshot.character).toEqual(test.established.character);
    expect(test.cloud().snapshot.gameState).toEqual(test.established.gameState);
    expect(test.cloud().snapshot.settings).toEqual({ music: false });
    expect(readDatapad(test.one, null, test.db).revision).toBe(10);
  });

  it("keeps an exact catalog purchase atomic and rejects a stale duplicate", async () => {
    const test = hostedSetup();
    const purchased = { ...test.established, gameState: { ...test.established.gameState, credits: 270,
      inventory: [{ id: "medpac", name: "Medpac", qty: 1, tag: "medical" }] } };
    expect((await putHostedDatapad(test.request(purchased))).status).toBe(200);
    expect(test.cloud().snapshot.gameState).toEqual(purchased.gameState);
    expect((await putHostedDatapad(test.request(purchased))).status).toBe(409);
    expect(test.put).toHaveBeenCalledTimes(1);
    expect(test.cloud().revision).toBe(10);
  });

  it("rejects another player's target before reading or writing its hosted save", async () => {
    const test = hostedSetup();
    expect((await putHostedDatapad(test.request(test.established, 9, test.two.id))).status).toBe(403);
    expect((await getHostedDatapad(new Request(`http://localhost:3101/api/datapad?accountId=${test.two.id}`))).status).toBe(403);
    expect(test.get).not.toHaveBeenCalled();
    expect(test.put).not.toHaveBeenCalled();
  });

  it("hydrates and saves the actual selected player when the operator accesses that campaign", async () => {
    const test = hostedSetup();
    test.actor.mockReturnValue(test.owner);
    const viewed = await getHostedDatapad(new Request(`http://localhost:3101/api/datapad?accountId=${test.one.id}`));
    expect(viewed.status).toBe(200);
    expect((await viewed.json()).snapshot).toEqual(test.established);
    expect(test.get).toHaveBeenCalledWith(test.one.username);
    expect((await putHostedDatapad(test.request({ ...test.established, settings: { sound: false } }))).status).toBe(200);
    expect(test.put).toHaveBeenCalledWith(test.one.username, test.one.id, 9, expect.objectContaining({ settings: { sound: false } }));
  });

  it("restores the cache after a hosted write failure so retry does not double-commit", async () => {
    const test = hostedSetup();
    test.put.mockRejectedValueOnce(Object.assign(new Error("Hosted save unavailable"), { status: 503 }));
    const draft = { ...test.established, settings: { sound: false } };
    expect((await putHostedDatapad(test.request(draft))).status).toBe(503);
    expect(readDatapad(test.one, null, test.db).revision).toBe(9);
    expect(test.cloud().revision).toBe(9);
    expect((await putHostedDatapad(test.request(draft))).status).toBe(200);
    expect(test.cloud().revision).toBe(10);
  });
});
