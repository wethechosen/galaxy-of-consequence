import { describe, expect, it } from "vitest";
import { normalizeModelLedgerJson } from "./model-ledger-json";
import { attachRepairedLedger, assertQuotedOfferConsistency } from "./gm";
import { validateTradeOffers } from "./conversation-trade";
import { parseEngineResponse } from "@/original/lib/engineState";

describe("model ledger serialization and complete quotes", () => {
  it("repairs only key quoting and trailing commas without changing string values", () => {
    const source = '{tradeOfferAdd:[{sellerName:"Jax",items:[{name:"Room {foo: bar,}",qty:1,tag:"service",}],totalCredits:1700,}],note:"A comma, } and an escaped \\"key\\""}';
    expect(JSON.parse(normalizeModelLedgerJson(source))).toEqual({ tradeOfferAdd: [{ sellerName: "Jax", items: [{ name: "Room {foo: bar,}", qty: 1, tag: "service" }], totalCredits: 1700 }], note: 'A comma, } and an escaped "key"' });
  });
  it("never evaluates expressions or accepts executable values", () => {
    expect(() => attachRepairedLedger("Scene", '<!--STATE:{credits:process.exit(0)}-->')).toThrow(/malformed/);
    expect(() => attachRepairedLedger("Scene", '<!--STATE:{credits:undefined}-->')).toThrow(/malformed/);
  });
  it("validates exact compound prices in both server and state parser", () => {
    const offer = { sellerName: "Proprietor", totalCredits: 1700, items: [{ name: "Thirty-night room", qty: 1, tag: "service" }], priceComponents: [{ label: "Room", credits: 1500 }, { label: "Deposit", credits: 200 }] };
    const delta = { tradeOfferAdd: [offer] };
    expect(validateTradeOffers([offer])[0].priceComponents).toEqual(offer.priceComponents);
    expect(parseEngineResponse(`Scene\n<!--STATE:${JSON.stringify(delta)}-->`, { requireState: true }).delta).toEqual(delta);
    expect(() => assertQuotedOfferConsistency('## GAMEPLAY RESULT\nThe price is 1,500 credits for the room plus a 200-credit deposit, total 1,700 credits.\n## SAGA CHECK\nNone.', delta)).not.toThrow();
    expect(() => validateTradeOffers([{ ...offer, totalCredits: 1800 }])).toThrow(/equal/);
    expect(() => parseEngineResponse(`Scene\n<!--STATE:${JSON.stringify({ tradeOfferAdd: [{ ...offer, totalCredits: 1800 }] })}-->`, { requireState: true })).toThrow();
  });
  it("requires a separately offered optional extra without billing it", () => {
    const offer = { sellerName: "Proprietor", totalCredits: 1400, items: [{ name: "Thirty-night room", qty: 1, tag: "service" }] };
    const narration = '## GAMEPLAY RESULT\nThe room costs fourteen hundred credits for thirty days. Breakfast costs fifty credits per day.\n## SAGA CHECK\nNone.';
    expect(() => assertQuotedOfferConsistency(narration, { tradeOfferAdd: [offer] })).toThrow(/omitted/);
    expect(() => assertQuotedOfferConsistency(narration, { tradeOfferAdd: [offer, { ...offer, totalCredits: 50, items: [{ name: "One-day breakfast", qty: 1, tag: "service" }] }] })).not.toThrow();
  });
});
