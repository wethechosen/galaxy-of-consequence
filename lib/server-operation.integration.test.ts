import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as accounts from "./accounts";
import { openStorage } from "./storage";
import { readDatapad, type DatapadSnapshot } from "./datapad-save";
import { POST as market } from "../app/api/market/route";
import { POST as advancement } from "../app/api/advancement/route";
import { POST as recovery } from "../app/api/recovery/route";
import { hydrateHostedSave, type HostedSave } from "./hosted-bridge";

const bridge = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn() }));
vi.mock("./hosted-bridge", async importOriginal => ({ ...await importOriginal<typeof import("./hosted-bridge")>(), hostedPersistenceEnabled: () => true, hostedGet: bridge.get, saveHostedResult: bridge.save }));
let db: ReturnType<typeof openStorage>;
const player = { id: "test-player", username: "test@galaxy.invalid", displayName: "Test player", role: "player" as const };
let cloud: HostedSave;
const request = (body: object) => new Request("http://127.0.0.1/api/test", { method: "POST", body: JSON.stringify(body) });

beforeEach(() => {
  db = accounts.accountStore(openStorage(":memory:"));
  vi.spyOn(accounts, "accountStore").mockReturnValue(db);
  vi.spyOn(accounts, "requireAccount").mockReturnValue(player);
  cloud = { account_username: player.username, account_id: player.id, revision: 5, updated_at: "2026-10-06", snapshot: {
    character: { name: "Fixture", level: 1, experience: 1000, classLevels: { scoundrel: 1 }, maxHitPoints: 18, sagaStats: "STR 12 | DEX 14 | CON 10 | INT 12 | WIS 10 | CHA 11", featSelections: [], talentSelections: [] },
    gameState: { location: "Coruscant — lower-city local market", credits: 2000, health: 18, inventory: [], advancementHistory: [] },
    messages: [], comms: [], settings: {},
  } };
  bridge.get.mockImplementation(async username => { expect(username).toBe(player.username); return structuredClone(cloud); });
  // Simulate a successful durable CAS whose response is lost.
  bridge.save.mockImplementation(async (target, revision, snapshot: DatapadSnapshot) => {
    expect(target.id).toBe(player.id); expect(revision).toBe(cloud.revision);
    cloud = { ...cloud, revision: revision + 1, snapshot: structuredClone(snapshot) };
    throw Object.assign(new Error("Hosted campaign request timed out. Reload state before retrying."), { status: 504 });
  });
});
afterEach(() => { vi.restoreAllMocks(); bridge.get.mockReset(); bridge.save.mockReset(); db.close(); });

describe("durable button operations through the actual API routes", () => {
  it("replays committed residence rest after a lost response without passing more time or healing twice", async () => {
    cloud.snapshot.character = { ...cloud.snapshot.character, level:2, experience:1000, maxHitPoints:30 };
    cloud.snapshot.gameState = { ...cloud.snapshot.gameState, health:20, location:"Unit A", properties:[{id:"home-a",name:"Unit A",type:"lease",location:"Unit A"}] };
    const body={revision:5,transactionId:"rest-once-0001",propertyId:"home-a"};
    expect((await recovery(request(body))).status).toBe(504);
    expect(cloud.snapshot.gameState.health).toBe(22); expect(cloud.snapshot.gameState.campaignTimeMinutes).toBe(480);
    expect((await recovery(request(body))).status).toBe(200);
    expect(cloud.snapshot.gameState.health).toBe(22); expect(cloud.snapshot.gameState.recoveryTransactions).toHaveLength(1);
    expect(bridge.save).toHaveBeenCalledTimes(1);
  });
  it.each(["market", "advancement"])("replays a committed %s after a lost response with no second debit, item, or HP roll", async kind => {
    if (kind === "market") cloud.snapshot.character!.experience = 500;
    const handler = kind === "market" ? market : advancement;
    const body = kind === "market" ? { revision: 5, transactionId: "purchase-once-01", action: "buy", goodId: "medpac" }
      : { revision: 5, advancementId: "advance-once-01", classId: "scoundrel", classBonusFeatId: "quick-draw", abilityIncreases: [] };
    expect((await handler(request(body))).status).toBe(504);
    expect(cloud.revision).toBe(6);
    // The ephemeral cache was restored, not promoted to false authority.
    expect(readDatapad(player).revision).toBe(5);
    const committed = JSON.parse(JSON.stringify(cloud.snapshot));
    const retried = await handler(request(body));
    expect(retried.status).toBe(200);
    expect(await retried.json()).toMatchObject({ snapshot: committed, revision: 6, replayed: true });
    expect(bridge.save).toHaveBeenCalledTimes(1);
    if (kind === "market") expect((committed.gameState.inventory as unknown[])).toHaveLength(1);
    else expect(committed.character?.level).toBe(2);
    const collision = { ...body, ...(kind === "market" ? { goodId: "other" } : { classBonusFeatId: "point-blank-shot" }) };
    expect((await handler(request(collision))).status).toBe(409);
    expect(bridge.save).toHaveBeenCalledTimes(1);
  });
  it("uses the admin-selected player's hosted save and denies another player before reading it", async () => {
    cloud.snapshot.character!.experience = 500;
    const body = { accountId: player.id, revision: 5, transactionId: "admin-market-01", action: "buy", goodId: "medpac" };
    vi.mocked(accounts.requireAccount).mockReturnValue({ ...player, id: "different-player" });
    expect((await market(request(body))).status).toBe(403);
    expect(bridge.get).not.toHaveBeenCalled();
    vi.mocked(accounts.requireAccount).mockReturnValue({ ...player, id: "operator", role: "admin" });
    vi.spyOn(accounts, "listAccounts").mockReturnValue([player]);
    hydrateHostedSave(player, cloud);
    expect((await market(request(body))).status).toBe(504);
    expect(bridge.get).toHaveBeenCalledWith(player.username);
  });
  it("pauses a new purchase before mutation when advancement is pending", async () => {
    const before = structuredClone(cloud);
    const result = await market(request({ revision: 5, transactionId: "pending-level-market", action: "buy", goodId: "medpac" }));
    expect(result.status).toBe(409);
    expect(await result.json()).toMatchObject({ code: "advancement_required", gameplayAdvanced: false, advancement: { blocked: true, level: 1, earnedLevel: 2 } });
    expect(cloud).toEqual(before);
    expect(bridge.save).not.toHaveBeenCalled();
  });
});
