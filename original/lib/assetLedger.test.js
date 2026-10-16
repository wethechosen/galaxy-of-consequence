import { describe, expect, it } from "vitest";
import { buildAssetLedger } from "./assetLedger";

describe("read-only saved-asset dossier", () => {
  it("keeps cash, bank deposits and underworld credits separate without double counting", () => {
    const ledger = buildAssetLedger({ credits: 100, bankCredits: 40, creditsCriminal: 300 });
    expect(ledger.balances).toEqual({ spendable: 100, deposited: 40, totalGalactic: 140, underworld: 300 });
  });

  it("treats residential tenancy as access, never property equity or spendable deposit", () => {
    const state = { credits: 500, properties: [
      { id: "lease:1", name: "Unit 3-G", tenure: "leased", status: "active", baseValue: 0,
        lease: { rentCredits: 12000, refundableDepositCredits: 24000 } },
      { id: "deed:2", name: "Warehouse", baseValue: 90000 },
    ] };
    const before = JSON.stringify(state);
    const ledger = buildAssetLedger(state);
    expect(ledger.holdings).toMatchObject([
      { status: "leasehold", basisCredits: null, depositCredits: 24000, rentCredits: 12000 },
      { status: "recorded holding", basisCredits: 90000 },
    ]);
    expect(ledger.balances.totalGalactic).toBe(500);
    expect(JSON.stringify(state)).toBe(before);
  });

  it("reports missing valuations as unknown and keeps inheritance claims separate", () => {
    const ledger = buildAssetLedger({
      credits: 150, ships: [{ name: "Starwind", baseValue: 0 }],
      investments: [{ name: "IGFED bond", amount: 2000 }, { name: "Unpriced stock" }],
      legacyAssets: [{ name: "Kelvek inheritance", status: "suspected", estimatedValue: 4000000 }],
    });
    expect(ledger.holdings.map(item => item.basisCredits)).toEqual([null, 2000, null]);
    expect(ledger.legacyClaims).toEqual([{ id: "legacy-0", name: "Kelvek inheritance", status: "suspected", category: "legacy claim" }]);
    expect(ledger.balances.totalGalactic).toBe(150);
    expect(JSON.stringify(ledger)).not.toContain("4000000");
  });

  it("shows only saved receipts, not offers, and never converts a purchase to a reward", () => {
    const state = { credits: 123, tradeOffers: [{ totalCredits: 999 }],
      tradeReceipts: [{ turnId: "t1", sellerName: "Tailor", totalCredits: 25, items: [{ name: "Robe", qty: 1 }] }],
      bankTransactions: [{ transactionId: "bank1", action: "deposit", amount: 10, committedAt: "2026-10-12T00:00:00Z" }] };
    const ledger = buildAssetLedger(state);
    expect(ledger.purchases).toMatchObject([{ id: "t1", amountCredits: 25, items: [{ name: "Robe", quantity: 1 }] }]);
    expect(ledger.transfers).toMatchObject([{ id: "bank1", action: "deposit", amountCredits: 10 }]);
    expect(ledger.balances.totalGalactic).toBe(123);
    expect(JSON.stringify(ledger)).not.toContain("999");
  });

  it("does not interpret malformed values as wealth", () => {
    const ledger = buildAssetLedger({ credits: "10000", bankCredits: -2, ships: [{ name: "Unknown", baseValue: "80000" }] });
    expect(ledger.balances.totalGalactic).toBeNull();
    expect(ledger.holdings[0].basisCredits).toBeNull();
  });
});
