import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NpcOfferMenu } from "@/original/components/NpcOfferMenu";

const location = "Bonadan — public market";
const offer = { id: "offer-1", sourceTurnId: "quote-1", location, status: "open", sellerName: "Supply clerk", totalCredits: 100, items: [{ name: "Medpac", qty: 1, tag: "medical" }] };
const render = (gameState: Record<string, unknown>) => renderToStaticMarkup(React.createElement(NpcOfferMenu, { gameState, onAction: () => {} }));

describe("contextual NPC offer menu", () => {
  it("shows a validated current quote without changing saved state", () => {
    const state = { location, tradeOffers: [offer], credits: 500 };
    const before = JSON.stringify(state);
    expect(render(state)).toContain("Medpac");
    expect(render(state)).toContain("ACCEPT OFFER");
    expect(JSON.stringify(state)).toBe(before);
  });
  it("hides a paid offer even when historical status still says open", () => {
    expect(render({ location, tradeOffers: [offer], tradeReceipts: [{ offerId: offer.id }] })).toBe("");
  });
  it("rejects malformed and out-of-scene records before rendering item details", () => {
    expect(render({ location, tradeOffers: [{ ...offer, items: [null] }, { ...offer, location: "Taris — market" }] })).toBe("");
  });
});
