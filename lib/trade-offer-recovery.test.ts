import { afterEach, describe, expect, it, vi } from "vitest";
import { recoverConfirmedTradeOffer } from "./trade-offer-recovery";
import { currentTradeOffers, planConversationTrade } from "./conversation-trade";
import { validateSagaSemanticAction } from "./saga-action-plan";
import type { DatapadSnapshot } from "./datapad-save";

const provider = vi.hoisted(() => vi.fn());
vi.mock("./original-provider", async importOriginal => ({ ...await importOriginal<typeof import("./original-provider")>(), invokeNvidia: provider }));
afterEach(() => provider.mockReset());
const location = "Coruscant — upper-city transit spine, Level 512";
const offer = { sellerName: "Jax", totalCredits: 126000, items: [{ name: "Unit 3-G tenancy", qty: 1, tag: "access" }],
  lease: { propertyName: "Unit 3-G", propertyLocation: "Coruscant — Level 512 — Unit 3-G", landlord: "Vestara Holdings LLC", termMonths: 6,
    rentCredits: 108000, refundableDepositCredits: 18000, accessDescription: "Access credentials during tenancy" } };
function snapshot(): DatapadSnapshot {
  return { character: { name: "D'mir", level: 1, experience: 500 }, gameState: { location, credits: 1199996506, properties: [], inventory: [], campaignTimeMinutes: 100 },
    messages: [{ role: "assistant", turnId: "confirmed-contract", provider: "nvidia", content:
      `## LOCATION\n${location}\n## SCENE\nJax displays the unpaid contract.\n## GAMEPLAY RESULT\nUnit 3-G, Coruscant Level 512. Landlord: Vestara Holdings LLC. Six months: 108,000 credits rent plus 18,000 credits refundable deposit. Total price: 126,000 credits. Access credentials are issued after payment.\n## PLAYER OPTIONS\nA. Consider the offer.` },
      { role: "user", content: "I authorize payment." }, { role: "assistant", provider: "local-safe-fallback", fallbackReason: "validation", content: "Your action meets the immediate world." }],
    comms: [], settings: {} };
}
describe("legacy confirmed offer recovery and natural consent", () => {
  it("recovers confirmed unpaid terms with provenance without paying, moving, or rewarding", async () => {
    const before = snapshot();
    provider.mockResolvedValue({ content: JSON.stringify({ offers: [offer] }) });
    const next = await recoverConfirmedTradeOffer(before);
    const saved = currentTradeOffers(next.gameState)[0];
    expect(saved).toMatchObject({ sourceTurnId: "confirmed-contract", totalCredits: 126000,
      lease: { ...offer.lease, accessDescription: "Access credentials for Unit 3-G during the agreed tenancy" } });
    expect(next.gameState.credits).toBe(before.gameState.credits);
    expect(next.gameState.inventory).toEqual([]);
    expect(next.gameState.properties).toEqual([]);
    expect(next.gameState.campaignTimeMinutes).toBe(100);
    expect(next.character).toEqual(before.character);
    expect(before.gameState).not.toHaveProperty("tradeOffers");
    expect(await recoverConfirmedTradeOffer(next)).toBe(next);
    expect(provider).toHaveBeenCalledTimes(1);
    const trade = planConversationTrade("Charge it.", next.gameState, "payment-next", saved.id);
    expect(trade?.status).toBe("accepted");
    expect(planConversationTrade("Transfer exactly 125,000 credits.", next.gameState, "wrong-price", saved.id)?.status).toBe("unavailable");
    expect(planConversationTrade("Could I buy it?", next.gameState, "question", saved.id)).toBeNull();
    expect(planConversationTrade("I accept if you lower the rent.", next.gameState, "condition", saved.id)).toBeNull();
  });
  it("rejects invented amounts, landlords and locations rather than completing a fabricated contract", async () => {
    for (const forged of [
      { ...offer, totalCredits: 126001, lease: { ...offer.lease, rentCredits: 108001 } },
      { ...offer, lease: { ...offer.lease, landlord: "Invented Holdings" } },
      { ...offer, lease: { ...offer.lease, propertyLocation: "Naboo — Unit 3-G" } },
    ]) {
      provider.mockResolvedValue({ content: JSON.stringify({ offers: [forged] }) });
      const before = snapshot();
      expect(await recoverConfirmedTradeOffer(before)).toBe(before);
    }
  });
  it("does not recover player claims, failed drafts, another location, or a superseded quote", async () => {
    const before = snapshot();
    (before.messages[0] as Record<string, unknown>).role = "user";
    expect(await recoverConfirmedTradeOffer(before)).toBe(before);
    const elsewhere = snapshot(); elsewhere.gameState.location = "Naboo — Theed";
    expect(await recoverConfirmedTradeOffer(elsewhere)).toBe(elsewhere);
    const withdrawn = snapshot(); withdrawn.messages.push({ role: "assistant", content: `LOCATION\n${location}\nSCENE\nJax withdraws the offer.`, provider: "nvidia" });
    expect(await recoverConfirmedTradeOffer(withdrawn)).toBe(withdrawn);
    expect(provider).not.toHaveBeenCalled();
  });
  it("semantic offer references cannot introduce state changes or bypass uncertainty", () => {
    const action = "We have a deal.";
    const intent = { intent: "commerce", canonicalAction: "I accept the quoted lease.", declaredSpan: action, checkNeeded: false, skill: null, rationale: "Explicit consent to the saved offer.", travelTarget: null, acceptedOfferId: "offer:confirmed-contract:0" };
    expect(validateSagaSemanticAction(intent, action).acceptedOfferId).toBe(intent.acceptedOfferId);
    expect(() => validateSagaSemanticAction({ ...intent, credits: -126000 }, action)).toThrow();
    expect(() => validateSagaSemanticAction({ ...intent, intent: "social", checkNeeded: true, skill: "Persuasion" }, action)).toThrow();
  });
});
