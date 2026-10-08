import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync } from "node:fs";
import * as accounts from "./accounts";
import { openStorage } from "./storage";
import { readDatapad, saveAuthoritativeDatapad, type DatapadSnapshot } from "./datapad-save";
import { assertNarratedLocation, extractSceneNarration, runGmTurn } from "./gm";
import * as provider from "./original-provider";
import { currentTradeOffers } from "./conversation-trade";

if (process.env.GOC_LIVE_TESTS === "1" && existsSync(".env.local")) process.loadEnvFile(".env.local");
const enabled = process.env.GOC_LIVE_TESTS === "1" && Boolean(process.env.NVIDIA_API_KEY && process.env.NVIDIA_API_KEY !== "[SENSITIVE]");
let db: ReturnType<typeof openStorage> | undefined;
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); db?.close(); db = undefined; });

const MARKET = "Coruscant — lower-city local market";
const fixtureCharacter = { name: "D'mir Holloran", age: 16, level: 1, experience: 500, appearance: "Dark brown skin, twin Dutch locs braided back, prison-fight scars", equipArmor: "Prison issue clothing", sagaStats: "STR 12 | DEX 14 | CON 10 | INT 12 | WIS 10 | CHA 11", trainedSkills: [], feats: "None", forcePowers: "None" };
const guesthouseScene = "You stand at the market guesthouse desk opposite a human proprietor in a blue work coat. A ceiling fan clicks above her rate terminal, and breakfast dishes rattle behind a frosted partition. She has quoted 500 credits for seven nights in a private room. Monthly stays are also available; you have not accepted any booking or paid anything.";

function fixtureNarration(scene: string, result: string) {
  return `## LOCATION\n${MARKET}\n\n## SCENE\n${scene}\n\n## GM ADJUDICATION\nThe proprietor answers the ordinary public question.\n\n## GAMEPLAY RESULT\n${result}\n\n## SAGA CHECK\nNo check required.\n\n## STATE UPDATE\nNo payment or booking occurs.\n\n## PLAYER OPTIONS\nA. Ask a follow-up question.\nB. Consider the offered terms.\nYou may declare another action.`;
}

function setupFixture(id: string, snapshot: DatapadSnapshot) {
  vi.stubEnv("VERCEL", ""); vi.stubEnv("GOC_USE_CLOUD_RAG", "0");
  vi.stubEnv("SUPABASE_GOC_BRIDGE_URL", ""); vi.stubEnv("SUPABASE_GOC_BRIDGE_KEY", "");
  db = accounts.accountStore(openStorage(":memory:"));
  vi.spyOn(accounts, "accountStore").mockReturnValue(db);
  const actor = { id, username: `${id}@galaxy.invalid`, displayName: "Isolated fixture", role: "player" as const };
  db.prepare("INSERT INTO accounts VALUES (?, ?, ?, ?, '', '')").run(actor.id, actor.username, actor.displayName, actor.role);
  saveAuthoritativeDatapad(actor, null, 0, snapshot, db);
  return actor;
}

function observeLiveProvider() {
  const realInvoke = provider.invokeNvidia;
  const calls: Array<{ stage: string; model?: string; finishReason?: string; content?: string; error?: string }> = [];
  vi.spyOn(provider, "invokeNvidia").mockImplementation(async (request) => {
    const stage = !request.sourceQuery ? "interpretation" : request.messages[0]?.content.startsWith("PLAYER ACTION:") ? "ledger repair" : "narration";
    try {
      const result = await realInvoke(request);
      calls.push({ stage, model: result.model, finishReason: result.finishReason, content: result.content });
      return result;
    } catch (error) {
      calls.push({ stage, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  });
  return (fixture: string, error: unknown) => console.error("[live-fixture failure]", JSON.stringify({
    fixture, error: error instanceof Error ? error.message : String(error),
    calls: calls.map(({ content, ...entry }) => ({ ...entry,
      ...(content ? { excerpt: entry.stage === "interpretation" ? content.slice(0, 900) : (content.match(/(?:##\s*)?GAMEPLAY RESULT\s*\n([\s\S]*?)(?=\n(?:##\s*)?SAGA CHECK|$)/i)?.[1] || content).slice(0, 1000) } : {}),
    })),
  }));
}

describe.skipIf(!enabled)("actual model plus authoritative sandbox turn loop (no real campaign writes)", () => {
  it("recovers an omitted lease quote and resolves terminal authorization once without a roll", async () => {
    const location = "Coruscant — upper-city transit spine, Level 512";
    const contract = `## LOCATION\n${location}\n\n## SCENE\nJax stands at a broker's counter beside the public transit concourse. A portable payment terminal displays the unpaid lease while commuters move past the frosted office partition.\n\n## GM ADJUDICATION\nReading an ordinary contract requires no check.\n\n## GAMEPLAY RESULT\nJax displays the contract: Unit 3-G, Coruscant Level 512; landlord Vestara Holdings LLC; six months of tenancy; 108,000 credits rent and 18,000 credits refundable deposit; total price 126,000 credits. The terminal is ready. The unit's access credentials will be handed over after payment clears. No payment has been made.\n\n## SAGA CHECK\nNo check required.\n\n## STATE UPDATE\nNo credits or access changed.\n\n## PLAYER OPTIONS\nA. Review the contract.\nB. Decide whether to accept.\nYou may declare another action.`;
    const initial: DatapadSnapshot = { character: { ...fixtureCharacter }, gameState: {
      location, health: 26, credits: 1_199_996_506, campaignTimeMinutes: 180, inventory: [], properties: [], combat: { status: "escaped" },
      scene: { summary: "Your action meets the immediate world and stops.", location },
    }, messages: [{ role: "assistant", turnId: "confirmed-lease-contract", provider: "nvidia", content: contract },
      { role: "assistant", provider: "local-safe-fallback", fallbackReason: "validation", content: "Your action meets the immediate world and stops." }], comms: [], settings: {} };
    const actor = setupFixture("live-lease-fixture", initial);
    const diagnose = observeLiveProvider();
    try {
      const action = "I authorize the payment terminal to transfer exactly 126,000 credits for the displayed Unit 3-G lease. Give me the receipt and the unit's access credentials after payment clears.";
      const result = await runGmTurn(actor, { revision: 1, turnId: "live-lease-payment-01", action });
      expect(result.provider, String(result.fallbackDetail)).toBe("nvidia");
      expect(result.fallbackReason).toBeNull();
      expect(result.roll).toBeNull();
      expect(result.snapshot.gameState.credits).toBe(1_199_870_506);
      expect(result.snapshot.gameState.location).toBe(location);
      expect(result.snapshot.gameState.properties).toEqual([expect.objectContaining({ name: "Unit 3-G", tenure: "leased", lease: expect.objectContaining({ landlord: "Vestara Holdings LLC", rentCredits: 108000, refundableDepositCredits: 18000, termMonths: 6 }) })]);
      expect(result.snapshot.gameState.tradeReceipts).toHaveLength(1);
      expect(result.snapshot.character?.experience).toBe(500);
      const replay = await runGmTurn(actor, { revision: 1, turnId: "live-lease-payment-01", action });
      expect(replay).toEqual(result);
      expect(readDatapad(actor, null, db).revision).toBe(2);
    } catch (error) { diagnose("lease-authorization", error); throw error; }
  }, 180_000);
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
    expect(contexts.every(context => context.includes('"summary":'))).toBe(true);
  }, 180_000);

  it("follows the established Jax lead to Docking Bay 94 without a check or a scene reset", async () => {
    const lead = "The human guesthouse proprietor says, 'Jax handles private housing at Docking Bay 94. Follow the signed public concourse from this desk to the bay entrance, then ask at the broker reception desk just inside. Tell them the guesthouse proprietor sent you. Keep your credits until you agree terms.' The marked route is open, nearby, and accessible on foot. Jax's availability still needs confirming; these directions do not buy a home or guarantee his cooperation.";
    const initial: DatapadSnapshot = {
      character: { ...fixtureCharacter },
      gameState: { location: MARKET, health: 26, credits: 5000, campaignTimeMinutes: 120,
        inventory: [{ id: "comlink", name: "Encrypted comlink", qty: 1 }], combat: { status: "escaped" },
        sceneMerchant: { name: "clothing vendor", species: "Twi'lek", location: MARKET },
        scene: { summary: guesthouseScene, location: MARKET, beat: 3, action: "I ask where to find the private housing broker." },
        discoveries: [{ title: "Jax private housing broker", detail: lead }],
      },
      messages: [{ role: "user", content: "Where can I find Jax, the private housing broker?" },
        { role: "assistant", provider: "nvidia", content: fixtureNarration(guesthouseScene, lead) }],
      comms: [], settings: {},
    };
    const actor = setupFixture("live-broker-fixture", initial);
    const diagnose = observeLiveProvider();
    try {
      const result = await runGmTurn(actor, { revision: 1, turnId: "live-follow-jax-01", action: "i follow the instructions" });
      expect(result.provider, String(result.fallbackDetail)).toBe("nvidia");
      expect(result.fallbackReason).toBeNull();
      expect(result.roll).toBeNull();
      expect(result.snapshot.gameState.location).toMatch(/Docking Bay 94/i);
      expect(result.snapshot.gameState.location).not.toBe(MARKET);
      expect(() => assertNarratedLocation(result.narration, { location: result.snapshot.gameState.location }, MARKET)).not.toThrow();
      expect(extractSceneNarration(result.narration)).toMatch(/Docking Bay 94/i);
      expect(result.narration).toMatch(/\b(?:arrive|arrives|reach|reaches|stop|stand|step|enter|entrance|reception)\b/i);
      expect(result.narration).not.toMatch(/clothing vendor|clothing rack|maintenance (?:corridor|junction)|utility corridor|floor's vibration|declared action into the immediate scene/i);
      expect(result.snapshot.gameState.credits).toBe(5000);
      expect(result.snapshot.gameState.inventory).toEqual(initial.gameState.inventory);
      expect(result.snapshot.character?.experience).toBe(500);
      expect(readDatapad(actor, null, db).snapshot).toEqual(result.snapshot);
      console.info("[live-fixture result]", JSON.stringify({ fixture: "follow-jax", provider: result.provider, model: result.model, roll: result.roll, location: result.snapshot.gameState.location, revision: result.revision }));
    } catch (error) { diagnose("follow-jax", error); throw error; }
  }, 180_000);

  it("quotes a full month at the current guesthouse and saves the service terms without charging", async () => {
    const legacyFallback = "Clothing hangs from rails above the stall. The Twi'lek clothing vendor points you toward the guesthouse desk again.";
    const initial: DatapadSnapshot = {
      character: { ...fixtureCharacter },
      gameState: { location: MARKET, health: 26, credits: 5000, campaignTimeMinutes: 120,
        inventory: [{ id: "comlink", name: "Encrypted comlink", qty: 1 }], combat: { status: "escaped" },
        sceneMerchant: { name: "clothing vendor", species: "Twi'lek", location: MARKET },
        scene: { summary: legacyFallback, location: MARKET, beat: 3, action: "How much for a full month?" },
        tradeOffers: [{ id: "weekly-live-quote", sourceTurnId: "weekly-live", location: MARKET, status: "open",
          sellerName: "Market guesthouse proprietor", sellerSpecies: "Human", totalCredits: 500,
          items: [{ name: "Private guesthouse room for seven nights", qty: 1, tag: "service" }] }],
      },
      messages: [{ role: "user", content: "I ask the guesthouse proprietor about paid lodging." },
        { role: "assistant", provider: "nvidia", content: fixtureNarration(guesthouseScene, "The proprietor quotes 500 credits for seven nights in a private room. Monthly rates are available on request. No booking is made.") },
        { role: "user", content: "How much for a full month?" },
        { role: "assistant", provider: "local-safe-fallback", fallbackReason: "provider", content: fixtureNarration(legacyFallback, "The vendor refers you to the guesthouse desk.") }],
      comms: [], settings: {},
    };
    const actor = setupFixture("live-month-fixture", initial);
    const diagnose = observeLiveProvider();
    try {
      const result = await runGmTurn(actor, { revision: 1, turnId: "live-month-quote-01", action: "How much for a full month?" });
      expect(result.provider, String(result.fallbackDetail)).toBe("nvidia");
      expect(result.fallbackReason).toBeNull();
      expect(result.roll).toBeNull();
      expect(result.narration).toMatch(/guesthouse|proprietor/i);
      expect(result.narration).not.toMatch(/clothing vendor|clothing rack|maintenance junction|PRIOR TURN OUTCOME/i);
      expect(result.snapshot.gameState.location).toBe(MARKET);
      expect(result.snapshot.gameState.credits).toBe(5000);
      expect(result.snapshot.gameState.inventory).toEqual(initial.gameState.inventory);
      expect(result.snapshot.gameState.campaignTimeMinutes).toBe(120);
      expect(result.snapshot.character?.experience).toBe(500);
      expect(result.snapshot.gameState.tradeReceipts || []).toHaveLength(0);
      const quotes = currentTradeOffers(result.snapshot.gameState).filter((offer) => offer.sourceTurnId === "live-month-quote-01");
      expect(quotes.length, "The spoken monthly rate must have a saved offer.").toBeGreaterThan(0);
      for (const quote of quotes) {
        expect(quote.items.some((item) => item.tag === "service" && /month|30\s*(?:days|nights)|thirty/i.test(item.name))).toBe(true);
        expect(quote.totalCredits).toBeGreaterThan(0);
        expect(result.narration.replace(/,/g, "")).toMatch(new RegExp(`\\b${quote.totalCredits}\\s*(?:galactic\\s+)?credits?\\b`, "i"));
      }
      expect(readDatapad(actor, null, db).snapshot).toEqual(result.snapshot);
      console.info("[live-fixture result]", JSON.stringify({ fixture: "monthly-lodging", provider: result.provider, model: result.model, roll: result.roll, location: result.snapshot.gameState.location, quotes: quotes.map((offer) => ({ totalCredits: offer.totalCredits, items: offer.items })), revision: result.revision }));
    } catch (error) { diagnose("monthly-lodging", error); throw error; }
  }, 180_000);
});
