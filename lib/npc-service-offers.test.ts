import { describe, expect, it } from "vitest";
import { applyConversationPurchase, currentTradeOffers, planConversationTrade, validateTradeOffers } from "./conversation-trade";

const service = {
  sellerName: "Jax", sellerSpecies: "Human", totalCredits: 18000,
  items: [], priceSource: "Campaign-derived charter quote",
  service: { kind: "travel", title: "Private passage to Taris", origin: "Bonadan", destination: "Taris",
    details: "Charter reservation only; embarkation requires a later declaration", durationMinutes: 420,
    minLevel: 3, requiredFlag: "captain-trust" },
} as const;
const snapshot = () => ({
  character: { name: "D'mir Holloran", level: 3 },
  gameState: { location: "Bonadan — Alien Quarter", credits: 628450006,
    campaignTimeMinutes: 100, inventory: [{ name: "Datapad", qty: 1, tag: "gear" }],
    flags: ["captain-trust"],
    tradeOffers: [{ ...service, id: "offer:captain:0", sourceTurnId: "captain-quote", location: "Bonadan — Alien Quarter", status: "open" }] },
  messages: [], comms: [], settings: {},
}) as any;

describe("contextual NPC service and travel menus", () => {
  it("accepts explicit service terms but never accepts a service as carried merchandise", () => {
    expect(validateTradeOffers([service])[0].service).toMatchObject({ kind: "travel", destination: "Taris" });
    expect(() => validateTradeOffers([{ ...service, items: [{ name: "Fake passenger ticket", qty: 1 }] }])).toThrow();
    expect(currentTradeOffers(snapshot().gameState)).toEqual([expect.objectContaining({ priceSource: "Campaign-derived charter quote", service: expect.objectContaining({ destination: "Taris" }) })]);
  });
  it("does not charge for questions or negotiations and enforces a level and quest flag gate", () => {
    const initial = snapshot();
    expect(planConversationTrade("How do I book the passage?", initial.gameState, "ask", undefined, initial.character)).toBeNull();
    expect(planConversationTrade("I negotiate the charter.", initial.gameState, "haggle", undefined, initial.character)).toBeNull();
    initial.character.level = 2;
    expect(planConversationTrade("I book the charter.", initial.gameState, "book", undefined, initial.character)?.status).toBe("unavailable");
    initial.character.level = 3;
    initial.gameState.flags = [];
    expect(planConversationTrade("I book the charter.", initial.gameState, "book", undefined, initial.character)?.status).toBe("unavailable");
  });
  it("pays once and creates a booking without auto-departure, inventory, HP, or time mutations", () => {
    const initial = snapshot();
    const action = "I accept offer ID offer:captain:0: Jax's offer for private passage to Taris at 18,000 credits.";
    const accepted = planConversationTrade(action, initial.gameState, "accepted", undefined, initial.character);
    expect(accepted?.status).toBe("accepted");
    const result = applyConversationPurchase(initial, action, "accepted");
    expect(result.gameState.credits).toBe(628432006);
    expect(result.gameState.inventory).toEqual(initial.gameState.inventory);
    expect(result.gameState.location).toBe(initial.gameState.location);
    expect(result.gameState.campaignTimeMinutes).toBe(100);
    expect(result.gameState.serviceContracts).toEqual([expect.objectContaining({ status: "booked", terms: expect.objectContaining({ destination: "Taris" }) })]);
    expect(result.gameState.tradeReceipts).toHaveLength(1);
    expect(currentTradeOffers(result.gameState)).toHaveLength(0);
    expect(applyConversationPurchase(result, action, "accepted")).toEqual(result);
  });
  it("rejects false sourcebook price authority and malformed service restrictions", () => {
    expect(() => validateTradeOffers([{ ...service, service: { ...service.service, minLevel: 50 } }])).toThrow();
    expect(() => validateTradeOffers([{ ...service, priceSource: "" }])).toThrow();
  });
});
