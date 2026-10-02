import { afterEach, describe, expect, it } from "vitest";
import { openStorage } from "./storage";
import { accountStore, type Account } from "./accounts";
import { readDatapad, saveAuthoritativeDatapad, saveDatapad, saveDatapadConfig } from "./datapad-save";
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
afterEach(() => { databases.splice(0).forEach(db => db.close()); });
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
