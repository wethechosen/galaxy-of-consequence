import { describe, expect, it } from "vitest";
import { NvidiaProviderError } from "./nvidia-errors";
import { classifyGmDraftFailure } from "./gm-draft-failure";
import { repairEmbeddedModelLedger } from "./model-ledger-json";
import { parseEngineResponse } from "@/original/lib/engineState";

describe("bounded GM error recovery", () => {
  it("repairs explicit, unambiguous formatting without another AI call", () => {
    const raw = '## GAMEPLAY RESULT\nYou accept a quote only.\n<!--STATE:{tradeOfferAdd:[{sellerName:"Pilot",totalCredits:120,items:[{name:"Charter quote",qty:1,tag:"service",}],}],}-->';
    const repaired = repairEmbeddedModelLedger(raw);
    expect(repaired).toContain('<!--STATE:{"tradeOfferAdd":');
    expect(parseEngineResponse(repaired!, { requireState: true }).delta).toEqual({
      tradeOfferAdd: [{ sellerName: "Pilot", totalCredits: 120, items: [{ name: "Charter quote", qty: 1, tag: "service" }] }],
    });
  });

  it("refuses missing, duplicate, executable or semantically invalid ledgers", () => {
    expect(repairEmbeddedModelLedger("Narration without a ledger.")).toBeNull();
    expect(repairEmbeddedModelLedger("<!--STATE:{}--><!--STATE:{}-->")).toBeNull();
    expect(repairEmbeddedModelLedger('<!--STATE:{credits:process.exit(0)}-->')).toBeNull();
    expect(repairEmbeddedModelLedger('<!--STATE:{credits:undefined}-->')).toBeNull();
    const malformed = repairEmbeddedModelLedger('Narration\n<!--STATE:{credits:"not a number",}-->');
    expect(malformed).not.toBeNull();
    expect(() => parseEngineResponse(malformed!, { requireState: true })).toThrow(/world-state field/i);
  });

  it("distinguishes provider faults from serialization and semantic contradictions", () => {
    expect(classifyGmDraftFailure(new NvidiaProviderError("Quota exceeded", 429))).toBe("provider");
    expect(classifyGmDraftFailure(new NvidiaProviderError("Timed out", 504))).toBe("provider");
    expect(classifyGmDraftFailure(new Error("The world-state JSON block is malformed."))).toBe("format");
    expect(classifyGmDraftFailure(new Error("The merchant narrated a payment without a credit deduction."))).toBe("semantic");
    expect(classifyGmDraftFailure(new Error("The GM returned an invalid world-state field (credits)."))).toBe("semantic");
  });
});
