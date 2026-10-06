import { afterEach, describe, expect, it, vi } from "vitest";
import * as accounts from "./accounts";
import type { Account } from "./accounts";
import { openStorage } from "./storage";
import { readDatapad, saveAuthoritativeDatapad, type DatapadSnapshot } from "./datapad-save";
import { runGmTurn } from "./gm";
import { currentTradeOffers } from "./conversation-trade";

const provider = vi.hoisted(() => vi.fn());
vi.mock("./original-provider", async (importOriginal) => ({
  ...await importOriginal<typeof import("./original-provider")>(), invokeNvidia: provider,
}));

const databases: ReturnType<typeof openStorage>[] = [];
afterEach(() => { vi.restoreAllMocks(); provider.mockReset(); databases.splice(0).forEach(db => db.close()); });

const location = "Coruscant — lower-city local market";
const offer = {
  sellerName: "Clothing vendor", sellerSpecies: "Twi'lek", totalCredits: 1500,
  items: [{ name: "Armored spacer's flight suit", qty: 1, tag: "armor" }, { name: "Utility tunic", qty: 1, tag: "clothing" }],
};

function response(scene: string, result: string, update: string, delta: Record<string, unknown>, options: string[]) {
  return {
    provider: "nvidia", model: "mocked-referee", finishReason: "stop",
    content: `## LOCATION\n${location}\n\n## SCENE\n${scene}\n\n## GM ADJUDICATION\nOrdinary retail conversation requires no check. The merchant responds to your request without choosing your next action.\n\n## GAMEPLAY RESULT\n${result}\n\n## SAGA CHECK\nNo check required.\n\n## STATE UPDATE\n${update}\n\n## PLAYER OPTIONS\n${options.map((option, i) => `${String.fromCharCode(65 + i)}. ${option}`).join("\n")}\nYou may declare another action.\n<!--STATE:${JSON.stringify(delta)}-->`,
  };
}

function setup() {
  const db = accounts.accountStore(openStorage(":memory:"));
  databases.push(db);
  const actor: Account = { id: "dmir", username: "dmir@galaxy.local", displayName: "D'mir", role: "player" };
  db.prepare("INSERT INTO accounts VALUES (?, ?, ?, ?, '', '')").run(actor.id, actor.username, actor.displayName, actor.role);
  vi.spyOn(accounts, "accountStore").mockReturnValue(db);
  const initial: DatapadSnapshot = {
    character: { name: "D'mir Holloran", level: 1, experience: 500, equipArmor: "Prison issue clothing" },
    gameState: { credits: 1_199_998_506, health: 26, location, combat: { status: "escaped" },
      inventory: [{ id: "pistol", name: "Blaster pistol", qty: 1, tag: "weapon" }, { id: "comlink", name: "Encrypted comlink", qty: 1, tag: "gear" }] },
    messages: [], comms: [], settings: {},
  };
  saveAuthoritativeDatapad(actor, null, 0, initial, db);
  return { actor, db, initial };
}

describe("authoritative GM conversational commerce end to end", () => {
  it("quotes, accepts once, replays retry, and continues lodging dialogue with fresh scenes and unchanged identity", async () => {
    const { actor, db, initial } = setup();
    const quoteScene = "Under a cracked blue glowpanel, you reach the clothing counter in prison-issued cloth, your pistol and encrypted comlink still carried. The vendor, a Twi'lek with one lekku wrapped in faded fabric, lifts reinforced flight gear from a hanging rail. Steam from the next stall drifts between customers; repaired shoulder plates knock softly against the frame.";
    const purchaseScene = "The counter's scratched payment reader chirps as the vendor, a Twi'lek, folds the armored spacer's flight suit and utility tunic beside your hands. Behind the stall, hangers sway with the passing crowd. Your prison clothes remain on; the bought garments are packed for carrying. Asked about rest, the seller gestures across the market toward a guesthouse sign.";
    const lodgingScene = "A freight cart rattles past while you remain beside the garments at the stall. The vendor, a Rodian, taps a small guesthouse placard clipped to the railing and answers your clarification: 'Paid rooms. Follow that sign across the market; the proprietor can tell you the rate.' A fan turns over the awning, stirring the tunics still hanging above the counter.";
    const quoteResponse = response(quoteScene,
      "The merchant offers the armored spacer's flight suit and utility tunic together for 1,500 credits. No purchase occurs yet.",
      "The quoted bundle is recorded; your credits and equipment remain unchanged.", { tradeOfferAdd: [offer] },
      ["Inspect the suit's reinforced seams.", "Ask the seller about the quoted bundle."]);
    // Deliberately omit the material delta: the trusted saved quote must supply
    // the exact cost and goods before any completed-purchase prose is saved.
    const purchaseResponse = response(purchaseScene,
      "You hand over 1,500 credits and take the suit and tunic. The vendor answers your lodging question with directions to the visible guesthouse sign.",
      "The purchase is recorded; no room is booked and no clothing is equipped.", {},
      ["Ask the guesthouse proprietor for the room rate.", "Inspect the purchased suit's fit."]);
    const lodgingResponse = response(lodgingScene,
      "The same merchant gives ordinary public lodging directions. Your statement of willingness to pay does not book a room.",
      "No credits or items change; no time, equipment, XP or location change is applied.", {},
      ["Ask how to find the guesthouse entrance.", "Ask the vendor about market closing hours."]);
    provider.mockImplementation(async ({ sourceQuery, messages }: { sourceQuery?: string; messages: Array<{ content: string }> }) => {
      if (!sourceQuery) {
        const declaration = messages[0].content.split("\n\nPLAYER DECLARATION:\n")[1];
        return { provider: "nvidia", model: "mocked-intent-translator", finishReason: "stop", content: JSON.stringify({
          intent: declaration.includes("looking for free") ? "dialogue" : "commerce",
          canonicalAction: declaration, declaredSpan: declaration, checkNeeded: false, skill: null,
          rationale: "Ordinary retail conversation or acceptance of the saved affordable quote.", travelTarget: null,
        }) };
      }
      return sourceQuery.includes("robe") ? quoteResponse : sourceQuery.includes("grab") ? purchaseResponse : lodgingResponse;
    });

    const quoted = await runGmTurn(actor, { turnId: "quote_turn_01", revision: 1, action: 'i head towards the clothing vendor. "I need a robe, thick, black, and whatever you have thats armored"' });
    expect(quoted.provider).toBe("nvidia");
    expect(quoted.roll).toBeNull();
    expect(quoted.revision).toBe(2);
    expect(quoted.snapshot.gameState.credits).toBe(initial.gameState.credits);
    expect(quoted.snapshot.gameState.inventory).toEqual(initial.gameState.inventory);
    expect(currentTradeOffers(quoted.snapshot.gameState)).toEqual([expect.objectContaining({ totalCredits: 1500, sellerSpecies: "Twi'lek" })]);

    const purchaseInput = { turnId: "buy_turn_0001", revision: 2, action: 'i grab the suit and the tunic "know where i can get some rest around here?"' };
    const bought = await runGmTurn(actor, purchaseInput);
    expect(bought.provider).toBe("nvidia");
    expect(bought.roll).toBeNull();
    expect(bought.revision).toBe(3);
    expect(bought.snapshot.gameState.credits).toBe(1_199_997_006);
    expect(bought.snapshot.gameState.inventory).toEqual(expect.arrayContaining(offer.items.map(item => expect.objectContaining(item))));
    expect(bought.snapshot.gameState.tradeReceipts).toHaveLength(1);
    expect(bought.snapshot.gameState.sceneMerchant).toMatchObject({ species: "Twi'lek", location });
    expect(bought.snapshot.character).toMatchObject({ experience: 500, level: 1, equipArmor: "Prison issue clothing" });

    expect(await runGmTurn(actor, purchaseInput)).toEqual(bought);
    expect(provider).toHaveBeenCalledTimes(4);
    expect(readDatapad(actor, null, db).revision).toBe(3);

    const lodging = await runGmTurn(actor, { turnId: "lodging_turn_1", revision: 3, action: '"Ain\'t looking for free," I say to the vendor.' });
    expect(lodging.provider).toBe("nvidia");
    expect(lodging.roll).toBeNull();
    expect(lodging.revision).toBe(4);
    expect(lodging.snapshot.gameState.credits).toBe(1_199_997_006);
    expect(lodging.snapshot.gameState.inventory).toEqual(bought.snapshot.gameState.inventory);
    expect(lodging.snapshot.character).toEqual(bought.snapshot.character);
    expect(lodging.snapshot.gameState.health).toBe(26);
    expect(lodging.snapshot.gameState.location).toBe(location);
    expect(lodging.snapshot.gameState.combat).toEqual({ status: "escaped" });
    expect(lodging.snapshot.gameState.tradeReceipts).toHaveLength(1);
    expect(lodging.narration).toContain("vendor, a Twi'lek");
    expect(lodging.narration).not.toContain("Rodian");
    expect(provider).toHaveBeenCalledTimes(6);
    const assistantScenes = (lodging.snapshot.messages as Array<{ role: string; content: string }>).filter(message => message.role === "assistant").map(message => message.content);
    expect(assistantScenes).toHaveLength(3);
    expect(new Set(assistantScenes).size).toBe(3);
    expect(lodging.snapshot.gameState.turnEvents).toHaveLength(3);
    expect(readDatapad(actor, null, db).snapshot).toEqual(lodging.snapshot);
    expect(lodging.snapshot.gameState.scene).toMatchObject({ beat: 3, action: '"Ain\'t looking for free," I say to the vendor.' });
  });
});
