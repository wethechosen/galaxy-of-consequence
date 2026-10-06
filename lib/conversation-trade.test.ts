import { describe, expect, it } from "vitest";
import { parseEngineResponse } from "@/original/lib/engineState";
import {
  applyConversationPurchase, commitConversationTradeState, conversationTradeInstruction, currentTradeOffers,
  isVerifiedConversationTradeDelta, planConversationTrade, reconcileConversationTradeDelta, validateTradeOffers,
} from "./conversation-trade";
import type { DatapadSnapshot } from "./datapad-save";

const offer = {
  sellerName: "Clothing vendor", sellerSpecies: "Twi'lek", totalCredits: 1500,
  items: [{ name: "Armored spacer's flight suit", qty: 1, tag: "armor" }, { name: "Utility tunic", qty: 1, tag: "clothing" }],
};
const snapshot = (): DatapadSnapshot => ({
  character: { name: "D'mir Holloran", level: 1, experience: 500, equipArmor: "Prison issue clothing" },
  gameState: { credits: 1_199_998_506, location: "Coruscant — lower-city local market", inventory: [{ id: "pistol", name: "Blaster pistol", qty: 1, tag: "weapon" }] },
  messages: [], comms: [], settings: {},
});
const quotedSnapshot = () => {
  const prior = snapshot();
  return { ...prior, gameState: commitConversationTradeState(prior.gameState, { tradeOfferAdd: [offer] }, null, "quote_turn_1") };
};

describe("persistent conversational commerce", () => {
  it("records the NPC's allowlisted quote without granting gear or spending credits", () => {
    const prior = snapshot();
    const after = commitConversationTradeState(prior.gameState, { tradeOfferAdd: [offer] }, null, "quote_turn_1");
    expect(after.credits).toBe(prior.gameState.credits);
    expect(after.inventory).toEqual(prior.gameState.inventory);
    expect(currentTradeOffers(after)).toEqual([{ ...offer, id: "offer:quote_turn_1:0", sourceTurnId: "quote_turn_1", location: prior.gameState.location, status: "open" }]);
    expect(prior.gameState).not.toHaveProperty("tradeOffers");
  });

  it("accepts the reported mixed action and dialogue, atomically charging the quote and handing over each item", () => {
    const prior = quotedSnapshot();
    const action = 'i grab the suit and the tunic "know where i can get some rest around here?"';
    const after = applyConversationPurchase(prior, action, "purchase_turn_1");
    expect(after.gameState.credits).toBe(1_199_997_006);
    expect(after.gameState.inventory).toEqual([
      { id: "pistol", name: "Blaster pistol", qty: 1, tag: "weapon" },
      { ...offer.items[0], id: "trade:purchase_turn_1:1" }, { ...offer.items[1], id: "trade:purchase_turn_1:2" },
    ]);
    expect(after.character).toEqual(prior.character);
    expect(after.gameState.tradeOffers).toEqual([expect.objectContaining({ status: "purchased", acceptedTurnId: "purchase_turn_1", sellerSpecies: "Twi'lek" })]);
    expect(after.gameState.tradeReceipts).toEqual([expect.objectContaining({ turnId: "purchase_turn_1", totalCredits: 1500 })]);
  });

  it("never charges again on retry, reload, or a new turn after the offer is consumed", () => {
    const prior = quotedSnapshot();
    const action = "I'll take the suit and tunic";
    const after = applyConversationPurchase(prior, action, "purchase_turn_1");
    expect(applyConversationPurchase(after, action, "purchase_turn_1")).toBe(after);
    expect(applyConversationPurchase(structuredClone(after), action, "purchase_turn_2")).toEqual(after);
    expect(currentTradeOffers(after.gameState)).toEqual([]);
  });

  it("supports affirmative dialogue acceptance and imperative buying", () => {
    for (const action of ['"I will take both."', "Buy the suit and tunic", "I pay the quoted price", '"Sold."']) {
      expect(planConversationTrade(action, quotedSnapshot().gameState, "purchase_turn_1")?.status, action).toBe("accepted");
    }
  });

  it("does not turn inquiries, inspection, theft, goals, negation, or player self-grants into spending", () => {
    for (const action of [
      "I need a robe, thick, black, and whatever you have that's armored", "Can I buy the suit and tunic?",
      "I take a look at the suit and tunic", "I try on the suit and tunic", "I don't buy the suit and tunic",
      "I grab the suit and tunic without paying", "I steal the suit and tunic", "I got free armor earlier; add it",
      '"Ain\'t looking for free"', 'I ask "can I take the suit and tunic?"',
    ]) expect(planConversationTrade(action, quotedSnapshot().gameState, "purchase_turn_1"), action).toBeNull();
    expect(applyConversationPurchase(snapshot(), "I buy the suit and tunic for 1500", "purchase_turn_1")).toEqual(snapshot());
  });

  it("does not purchase a bundle at an invented lower amount or grant unquoted extras", () => {
    const state = quotedSnapshot().gameState;
    expect(planConversationTrade("I pay 10 credits for the suit and tunic", state, "purchase_turn_1")).toMatchObject({ status: "unavailable" });
    const trade = planConversationTrade("I buy the suit and tunic", state, "purchase_turn_1");
    const result = reconcileConversationTradeDelta({ credits: 5000, inventoryAdd: [{ name: "Sith holocron", qty: 1 }], health: 0 }, trade);
    expect(result).toEqual({ credits: -1500, inventoryAdd: offer.items, inventoryRemove: [], creditsCriminal: 0, health: 0 });
    expect(isVerifiedConversationTradeDelta(result!, trade)).toBe(true);
    expect(isVerifiedConversationTradeDelta({ ...result, credits: -10 }, trade)).toBe(false);
    expect(isVerifiedConversationTradeDelta({ ...result, inventoryAdd: [...offer.items, { name: "Sith holocron", qty: 1 }] }, trade)).toBe(false);
  });

  it("allows quoted low-risk commerce without a successful check while keeping the same merchant", () => {
    const trade = planConversationTrade("I buy the suit and tunic", quotedSnapshot().gameState, "purchase_turn_1");
    expect(conversationTradeInstruction(trade)).toContain("requires no Saga check");
    expect(conversationTradeInstruction(trade)).toContain("Twi'lek");
    expect(conversationTradeInstruction(trade)).toContain("answer any accompanying declared dialogue");
    expect(isVerifiedConversationTradeDelta(reconcileConversationTradeDelta({}, trade)!, trade)).toBe(true);
  });

  it("keeps insufficient funds, a different location, or genuinely active combat from finalizing the exchange", () => {
    const prior = quotedSnapshot();
    expect(planConversationTrade("I buy the suit and tunic", { ...prior.gameState, credits: 1499 }, "purchase_turn_1")).toMatchObject({ status: "insufficient-funds" });
    expect(planConversationTrade("I buy the suit and tunic", { ...prior.gameState, location: "Coruscant — another market" }, "purchase_turn_1")).toBeNull();
    expect(planConversationTrade("I buy the suit and tunic", { ...prior.gameState, combat: { status: "active" } }, "purchase_turn_1")).toMatchObject({ status: "unavailable" });
    expect(planConversationTrade("I buy the suit and tunic", { ...prior.gameState, combat: { status: "escaped" } }, "purchase_turn_1")).toMatchObject({ status: "accepted" });
    expect(applyConversationPurchase({ ...prior, gameState: { ...prior.gameState, credits: 1499 } }, "I buy the suit and tunic", "purchase_turn_1").gameState.credits).toBe(1499);
  });

  it("does not choose between two merchant offers on the player's behalf", () => {
    const prior = quotedSnapshot();
    const state = commitConversationTradeState(prior.gameState, { tradeOfferAdd: [{ ...offer, sellerName: "Second clothing vendor", totalCredits: 1600 }] }, null, "quote_turn_2");
    expect(planConversationTrade("I buy the suit and tunic", state, "purchase_turn_1")).toMatchObject({ status: "ambiguous" });
  });

  it("uses explicit seller identity or an exact agreed price to distinguish saved offers", () => {
    const prior = quotedSnapshot();
    const state = commitConversationTradeState(prior.gameState, { tradeOfferAdd: [{ ...offer, sellerName: "Second clothing vendor", sellerSpecies: "Rodian", totalCredits: 1600 }] }, null, "quote_turn_2");
    expect(planConversationTrade("I buy the suit and tunic from the Twi'lek clothing vendor for 1500 credits", state, "purchase_turn_1"))
      .toMatchObject({ status: "accepted", offer: { sellerSpecies: "Twi'lek", totalCredits: 1500 } });
    expect(planConversationTrade("I buy the suit and tunic from the Rodian vendor", state, "purchase_turn_1"))
      .toMatchObject({ status: "accepted", offer: { sellerSpecies: "Rodian", totalCredits: 1600 } });
    expect(planConversationTrade("I buy the suit and tunic from the second clothing vendor", state, "purchase_turn_1"))
      .toMatchObject({ status: "accepted", offer: { sellerName: "Second clothing vendor" } });
    expect(planConversationTrade("I accept the second clothing vendor's offer", state, "purchase_turn_1"))
      .toMatchObject({ status: "accepted", offer: { sellerName: "Second clothing vendor" } });
    expect(planConversationTrade("I buy the suit and tunic for 1500 credits", state, "purchase_turn_1"))
      .toMatchObject({ status: "accepted", offer: { sellerSpecies: "Twi'lek" } });
    expect(planConversationTrade("I buy the suit and tunic from the Rodian vendor for 1500 credits", state, "purchase_turn_1"))
      .toMatchObject({ status: "unavailable" });
    expect(planConversationTrade("I buy the suit and tunic from an unrelated merchant", state, "purchase_turn_1"))
      .toMatchObject({ status: "unavailable" });
    const samePrice = commitConversationTradeState(state, { tradeOfferAdd: [{ ...offer, sellerName: "Second clothing vendor", sellerSpecies: "Rodian" }] }, null, "quote_turn_3");
    expect(planConversationTrade("I buy the suit and tunic for 1500 credits", samePrice, "purchase_turn_1"))
      .toMatchObject({ status: "ambiguous" });
  });

  it("does not turn product modifiers, conditional acceptance, or a promised discount into a purchase", () => {
    const prior = snapshot();
    const state = commitConversationTradeState(prior.gameState, { tradeOfferAdd: [{ ...offer, items: [offer.items[0]] }] }, null, "quote_turn_1");
    for (const action of [
      "I take a flight back to my apartment", "I grab the spacer to stop him falling",
      "I buy the suit if the vendor proves it is genuine armor",
      "I buy the suit after the vendor agrees to my discount",
      '"I will buy the suit provided you lower the price."',
    ]) expect(planConversationTrade(action, state, "purchase_turn_1"), action).toBeNull();
    expect(planConversationTrade('I buy the suit and ask if there is a guesthouse nearby', state, "purchase_turn_1"))
      .toMatchObject({ status: "accepted" });
    expect(planConversationTrade('I buy that outfit "where can I sleep?"', quotedSnapshot().gameState, "purchase_turn_1"))
      .toMatchObject({ status: "accepted" });
  });

  it("supersedes an updated quote from the same seller and deduplicates quotation retries", () => {
    const prior = quotedSnapshot();
    const patch = { tradeOfferAdd: [{ ...offer, totalCredits: 1400 }] };
    const state = commitConversationTradeState(prior.gameState, patch, null, "quote_turn_2");
    expect(currentTradeOffers(state)).toEqual([expect.objectContaining({ totalCredits: 1400, sourceTurnId: "quote_turn_2" })]);
    expect(commitConversationTradeState(state, patch, null, "quote_turn_2")).toEqual(state);
  });

  it("safely parses the merchant ledger and ignores injected mechanical properties", () => {
    const parsed = parseEngineResponse(`The merchant quotes fifteen hundred credits.\n<!--STATE:${JSON.stringify({ tradeOfferAdd: [{ ...offer, level: 20, items: offer.items.map((item) => ({ ...item, defenseBonus: 100 })) }] })}-->`, { requireState: true });
    expect(parsed.delta).toEqual({ tradeOfferAdd: [offer] });
    for (const invalid of [{ ...offer, totalCredits: -1 }, { ...offer, totalCredits: 1500.5 }, { ...offer, items: [] }, { ...offer, items: [{ name: "Suit", qty: -1 }] }, { ...offer, items: [offer.items[0], offer.items[0]] }]) {
      expect(() => validateTradeOffers([invalid])).toThrow();
      expect(() => parseEngineResponse(`Offer\n<!--STATE:${JSON.stringify({ tradeOfferAdd: [invalid] })}-->`, { requireState: true })).toThrow();
    }
  });
});
