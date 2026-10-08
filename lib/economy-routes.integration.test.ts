import { afterEach, describe, expect, it, vi } from "vitest";
import * as accounts from "./accounts";
import * as bridge from "./hosted-bridge";
import { openStorage } from "./storage";
import { readDatapad, saveAuthoritativeDatapad, type DatapadSnapshot } from "./datapad-save";
import { POST as bank } from "../app/api/bank/route";
import { POST as market } from "../app/api/market/route";
const databases: ReturnType<typeof openStorage>[] = [];
afterEach(() => { vi.restoreAllMocks(); databases.splice(0).forEach(db => db.close()); });
const seed = (): DatapadSnapshot => ({ character: { name: "Fixture", level: 1, experience: 500 },
  gameState: { credits: 5000, bankCredits: 0, location: "Coruscant — lower-city market", inventory: [], campaignTimeMinutes: 100 }, messages: [], comms: [], settings: {} });
function setup() {
  const db = accounts.accountStore(openStorage(":memory:")); databases.push(db);
  const actor = { id: "economy-fixture", username: "economy@galaxy.invalid", displayName: "Fixture", role: "player" as const };
  db.prepare("INSERT INTO accounts VALUES (?, ?, ?, ?, '', '')").run(actor.id, actor.username, actor.displayName, actor.role);
  vi.spyOn(accounts, "accountStore").mockReturnValue(db);
  vi.spyOn(accounts, "requireAccount").mockReturnValue(actor);
  vi.spyOn(bridge, "hostedPersistenceEnabled").mockReturnValue(false);
  saveAuthoritativeDatapad(actor, null, 0, seed(), db);
  return { db, actor };
}
const request = (path: string, body: object) => new Request(`http://localhost:3100/api/${path}`, { method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost:3100" }, body: JSON.stringify(body) });
const cases = [
  { path: "bank", handler: bank, input: { action: "deposit", amount: 500 }, total: 4500, field: "bankTransactions" },
  { path: "market", handler: market, input: { action: "buy", goodId: "medpac" }, total: 4770, field: "marketTransactions" },
];
describe.each(cases)("$path authoritative request boundary", ({ path, handler, input, total, field }) => {
  it("commits one result, replays the same request, rejects changed choices and other accounts", async () => {
    const { actor, db } = setup();
    const body = { ...input, revision: 1, transactionId: "economy-operation-01" };
    const first = await handler(request(path, body)); expect(first.status).toBe(200);
    const committed = await first.json();
    expect(committed.snapshot.gameState.credits).toBe(total);
    const retry = await handler(request(path, body)); expect(retry.status).toBe(200);
    expect((await retry.json()).replayed).toBe(true);
    const changed = await handler(request(path, { ...body, action: path === "bank" ? "withdraw" : "sell" }));
    expect(changed.status).toBe(409);
    expect((await handler(request(path, { ...body, accountId: "another-player" }))).status).toBe(403);
    const stored = readDatapad(actor, null, db);
    expect(stored.revision).toBe(2);
    expect(stored.snapshot?.gameState[field]).toHaveLength(1);
    expect(stored.snapshot?.gameState.campaignTimeMinutes).toBe(100);
    expect(stored.snapshot?.character?.experience).toBe(500);
  });
  it("recovers a committed cloud write whose response was lost without charging again", async () => {
    const { actor } = setup();
    const cloud = { account_username: actor.username, account_id: actor.id, revision: 1, snapshot: seed(), updated_at: new Date().toISOString() };
    vi.spyOn(bridge, "hostedPersistenceEnabled").mockReturnValue(true);
    vi.spyOn(bridge, "hostedGet").mockImplementation(async () => structuredClone(cloud));
    const put = vi.spyOn(bridge, "saveHostedResult").mockImplementation(async (_actor, expected, snapshot) => {
      expect(expected).toBe(1); cloud.snapshot = structuredClone(snapshot); cloud.revision = 2;
      throw Object.assign(new Error("Response lost after commit"), { status: 504 });
    });
    const body = { ...input, revision: 1, transactionId: "cloud-operation-01" };
    expect((await handler(request(path, body))).status).toBe(504);
    const retry = await handler(request(path, body)); expect(retry.status).toBe(200);
    const result = await retry.json();
    expect(result.replayed).toBe(true); expect(result.revision).toBe(2);
    expect(result.snapshot.gameState.credits).toBe(total);
    expect(result.snapshot.gameState[field]).toHaveLength(1);
    expect(put).toHaveBeenCalledTimes(1);
  });
  it("cannot commit a local mutation when the shared campaign is unavailable", async () => {
    const { actor, db } = setup();
    vi.spyOn(bridge, "hostedPersistenceEnabled").mockReturnValue(true);
    vi.spyOn(bridge, "hostedGet").mockResolvedValue(null);
    const response = await handler(request(path, { ...input, revision: 1, transactionId: "unavailable-01" }));
    expect(response.status).toBe(503);
    expect(readDatapad(actor, null, db).revision).toBe(1);
    expect(readDatapad(actor, null, db).snapshot?.gameState.credits).toBe(5000);
  });
});
