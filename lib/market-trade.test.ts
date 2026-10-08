import { describe, expect, it } from "vitest";
import { applyMarketTrade, MarketTradeError } from "./market-trade";
import { getMarket } from "@/original/lib/marketCatalog";
import type { DatapadSnapshot } from "./datapad-save";

const snapshot = () => ({
  character: { name: "D'mir Holloran", level: 1 },
  gameState: { location: "Coruscant — Level 1313 residential concourse", credits: 1_000, inventory: [] },
  messages: [], comms: [], settings: {},
});

describe("authoritative public-market transactions", () => {
  it("deducts the verified medpac price and adds exactly one medpac atomically", () => {
    const before = snapshot();
    const after = applyMarketTrade(before, { action: "buy", goodId: "medpac" });
    expect(after.gameState.credits).toBeLessThan(before.gameState.credits);
    expect(after.gameState.inventory).toEqual([{ id: expect.any(String), name: "Medpac", qty: 1, tag: "medical" }]);
    expect(before.gameState).toEqual({ location: "Coruscant — Level 1313 residential concourse", credits: 1_000, inventory: [] });
  });

  it("rejects a public purchase while confined without changing the save", () => {
    const before = snapshot();
    before.gameState.location = "Coruscant — Level 1313 detention infirmary";
    expect(() => applyMarketTrade(before, { action: "buy", goodId: "medpac" })).toThrow(MarketTradeError);
    expect(before.gameState.credits).toBe(1_000);
  });

  it.each(["Coruscant", "Coruscant — deeper lower-city substructure — transit route", "Naboo — deep wilderness"])("does not teleport to a merchant from %s", location => {
    const before = snapshot(); before.gameState.location = location;
    expect(() => applyMarketTrade(before, { action: "buy", goodId: "medpac" })).toThrow(MarketTradeError);
    expect(before.gameState.credits).toBe(1000);
  });

  it("rejects forged prices, wrong district merchants, absent goods and insufficient funds", () => {
    expect(() => applyMarketTrade(snapshot(), { action: "buy", goodId: "medpac", quotedPrice: 1 })).toThrow("listing changed");
    expect(() => applyMarketTrade(snapshot(), { action: "buy", goodId: "medpac", merchantId: "naboo:luxury" })).toThrow("seller");
    expect(() => applyMarketTrade(snapshot(), { action: "buy", goodId: "infinite-credit-chip" })).toThrow("not listed");
    const poor = snapshot(); poor.gameState.credits = 0;
    expect(() => applyMarketTrade(poor, { action: "buy", goodId: "medpac" })).toThrow("credits");
  });

  it("records local property ownership with payment once, without moving or generating income", () => {
    const before: DatapadSnapshot = snapshot(); before.gameState.credits = 200000;
    const market = getMarket(String(before.gameState.location), 1, before.gameState);
    const listing = market.goods.find(good => good.id === "apartment")!;
    const next = applyMarketTrade(before, { action: "buy", goodId: listing.id, merchantId: listing.merchantId, quotedPrice: listing.price });
    expect(next.gameState.credits).toBe(200000 - listing.price);
    expect(next.gameState.properties).toEqual([expect.objectContaining({ name: listing.name, location: before.gameState.location, assetType: "property", income: 0 })]);
    expect(next.gameState.location).toBe(before.gameState.location);
    expect(next.gameState.inventory).toEqual([]);
    expect(() => applyMarketTrade(next, { action: "buy", goodId: "apartment" })).toThrow("already own");
    expect(before.gameState.properties).toBeUndefined();
  });

  it("records a purchased vehicle as a local asset, not an equipped item or travel", () => {
    const before: DatapadSnapshot = snapshot(); before.gameState.credits = 200000;
    const next = applyMarketTrade(before, { action: "buy", goodId: "speeder" });
    expect(next.gameState.ships).toEqual([expect.objectContaining({ assetType: "vehicle", location: before.gameState.location, class: "Civilian landspeeder" })]);
    expect(next.gameState.inventory).toEqual([]);
    expect(next.gameState.location).toBe(before.gameState.location);
  });

  it("sells only owned supplies once and cannot resell phantom quantities", () => {
    const before = snapshot();
    const purchase = applyMarketTrade(before, { action: "buy", goodId: "medpac" });
    const item = (purchase.gameState.inventory as Array<{ id: string }>)[0];
    const sold = applyMarketTrade(purchase, { action: "sell", itemId: item.id });
    expect(Number(sold.gameState.credits)).toBeLessThan(1000);
    expect(sold.gameState.inventory).toEqual([]);
    expect(() => applyMarketTrade(sold, { action: "sell", itemId: item.id })).toThrow("not present");
    purchase.gameState.inventory = [{ ...item, name: "Medpac", qty: 0.5 }];
    expect(() => applyMarketTrade(purchase, { action: "sell", itemId: item.id })).toThrow("not present");
  });
});
