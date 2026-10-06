import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync } from "node:fs";
import * as accounts from "./accounts";
import { openStorage } from "./storage";
import { saveAuthoritativeDatapad } from "./datapad-save";
import { runGmTurn } from "./gm";
import * as provider from "./original-provider";

if (process.env.GOC_LIVE_TESTS === "1" && existsSync(".env.local")) process.loadEnvFile(".env.local");
const enabled = process.env.GOC_LIVE_TESTS === "1" && Boolean(process.env.NVIDIA_API_KEY && process.env.NVIDIA_API_KEY !== "[SENSITIVE]");
let db: ReturnType<typeof openStorage> | undefined;
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); db?.close(); db = undefined; });

describe.skipIf(!enabled)("actual model plus authoritative sandbox turn loop (no real campaign writes)", () => {
  it("resolves a colloquial paid-lodging reply and a saved bundle purchase with different, concrete scenes", async () => {
    // Deliberately isolate all writes and source retrieval from production.
    vi.stubEnv("VERCEL", ""); vi.stubEnv("GOC_USE_CLOUD_RAG", "0");
    vi.stubEnv("SUPABASE_GOC_BRIDGE_URL", ""); vi.stubEnv("SUPABASE_GOC_BRIDGE_KEY", "");
    db = accounts.accountStore(openStorage(":memory:"));
    vi.spyOn(accounts, "accountStore").mockReturnValue(db);
    const realInvoke = provider.invokeNvidia;
    const contexts: string[] = [];
    vi.spyOn(provider, "invokeNvidia").mockImplementation(async body => {
      const result = await realInvoke(body);
      if (body.sourceQuery) contexts.push(body.system || "");
      return result;
    });
    const actor = { id: "live-test-fixture", username: "fixture@galaxy.invalid", displayName: "Fixture", role: "player" as const };
    db.prepare("INSERT INTO accounts VALUES (?, ?, ?, ?, '', '')").run(actor.id, actor.username, actor.displayName, actor.role);
    const location = "Coruscant — lower-city local market";
    saveAuthoritativeDatapad(actor, null, 0, {
      character: { name: "D'mir Holloran", age: 16, level: 1, experience: 500, appearance: "Dark brown skin, twin Dutch locs braided back, prison-fight scars", equipArmor: "Prison issue clothing", sagaStats: "STR 12 | DEX 14 | CON 10 | INT 12 | WIS 10 | CHA 11", feats: "None", forcePowers: "None" },
      gameState: { location, health: 26, credits: 2000, inventory: [{ id: "comlink", name: "Encrypted comlink", qty: 1 }], combat: { status: "escaped" }, sceneMerchant: { name: "clothing vendor", species: "Twi'lek", location }, scene: { summary: "D'mir is at a Twi'lek clothing vendor's market counter, with a guesthouse sign across the public aisle. The seller quoted an armored suit and tunic for 1500 credits." }, tradeOffers: [{ id: "fixture-quote", sourceTurnId: "fixture-quote-turn", location, status: "open", sellerName: "clothing vendor", sellerSpecies: "Twi'lek", totalCredits: 1500, items: [{ name: "Armored spacer's flight suit", qty: 1, tag: "armor" }, { name: "Plain tunic", qty: 1, tag: "clothing" }] }] },
      messages: [], comms: [], settings: {},
    }, db);
    const reply = await runGmTurn(actor, { revision: 1, turnId: "live-lodging-01", action: "Ain't looking for free, I tell the vendor. Somewhere with a door that locks would do." });
    expect(reply.provider, String(reply.fallbackDetail)).toBe("nvidia");
    expect(reply.roll).toBeNull();
    expect(reply.snapshot.gameState.credits).toBe(2000);
    expect(reply.narration).toMatch(/guesthouse|lodging|room|inn|hotel/i);
    const purchase = await runGmTurn(actor, { revision: reply.revision, turnId: "live-purchase-01", action: "Credits on the counter. Wrap that suit and tunic for me." });
    expect(purchase.provider, String(purchase.fallbackDetail)).toBe("nvidia");
    expect(purchase.roll).toBeNull();
    expect(purchase.snapshot.gameState.credits).toBe(500);
    expect(purchase.snapshot.gameState.inventory).toEqual(expect.arrayContaining([expect.objectContaining({ name: "Armored spacer's flight suit", qty: 1 }), expect.objectContaining({ name: "Plain tunic", qty: 1 })]));
    expect(purchase.snapshot.character?.experience).toBe(500);
    expect(purchase.narration).not.toBe(reply.narration);
    expect(purchase.narration).not.toMatch(/declared action into the immediate scene|PRIOR NARRATION|authoritative campaign state/i);
    expect(contexts.every(context => !context.includes('"summary":'))).toBe(true);
  }, 180_000);
});
