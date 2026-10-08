import { describe, expect, it } from "vitest";
import { localMarket, localMarketProfile, localSellQuote, localTradeAccess } from "../original/lib/localMarketplace";

describe("place- and merchant-aware marketplace", () => {
  it("uses retail venues instead of a securities exchange and separates merchant stock", () => {
    const market = localMarket("Coruscant — Level 512 market district");
    expect(market.area).toMatchObject({ planet: "Coruscant", level: "512", available: true });
    expect(market.area.name).not.toContain("Exchange");
    expect(market.merchants.map(merchant => merchant.kind)).toEqual(["bazaar", "cantina", "guild", "property", "vehicles"]);
    expect(market.goods.find(good => good.id === "ration").merchantId).toContain(":cantina");
    expect(market.goods.find(good => good.id === "medpac").merchantId).toContain(":bazaar");
    expect(market.goods.find(good => good.id === "apartment").merchantId).toContain(":property");
  });

  it("changes catalog and prices between local Coruscant, Naboo boutiques and shadow markets", () => {
    const ordinary = localMarket("Coruscant — Level 512 market district");
    const luxury = localMarket("Naboo — Theed luxury boutiques");
    const shadow = localMarket("Coruscant — Level 1313 black market");
    expect(luxury.area).toMatchObject({ planet: "Naboo", luxury: true, illicit: false });
    expect(luxury.goods.some(good => good.id === "luxury-speeder")).toBe(true);
    expect(ordinary.goods.some(good => good.id === "luxury-speeder")).toBe(false);
    expect(shadow.goods.find(good => good.id === "hot-speeder")).toMatchObject({ legality: "Disputed / hot", illicit: true });
    expect(luxury.goods.some(good => good.illicit)).toBe(false);
    expect(luxury.goods.find(good => good.id === "medpac").price).toBeGreaterThan(ordinary.goods.find(good => good.id === "medpac").price);
  });

  it("does not use character level as a keyword gate for ordinary equipment", () => {
    const location = "Coruscant — Level 512 market district";
    const state = { credits: 100000 };
    const good = localMarket(location).goods.find(good => good.id === "slicer-kit");
    expect(localTradeAccess(location, { level: 1 }, state, good).direct).toBe(true);
    expect(localTradeAccess("Naboo — Theed luxury boutiques", { level: 1 }, state, good).direct).toBe(false);
  });

  it("shows only outstanding current-place offers and cannot launder hot stock at public retail", () => {
    const location = "Coruscant — Level 512 market district";
    const offers = [{ id: "one", location, status: "open" }, { id: "old", location, status: "accepted" }, { id: "away", location: "Naboo", status: "open" }];
    expect(localMarket(location, 1, { tradeOffers: offers }).offers.map(offer => offer.id)).toEqual(["one"]);
    const hot = { name: "Unregistered encrypted comlink", legality: "Disputed / hot" };
    expect(localSellQuote(hot, location)).toBeNull();
    expect(localSellQuote(hot, "Coruscant — Level 1313 black market").price).toBeGreaterThan(0);
  });

  it("does not turn a stale NPC identity into retail access in detention or tunnels", () => {
    const location = "Coruscant — detention infirmary";
    expect(localMarketProfile(location, { sceneMerchant: { name: "Seller", location } }).available).toBe(false);
    expect(localMarketProfile("Coruscant").available).toBe(false);
    expect(localMarketProfile("Coruscant — transit route").available).toBe(false);
  });
});
