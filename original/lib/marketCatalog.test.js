import { describe, expect, it } from "vitest";
import { getMarket, getSellQuote, getTradeAccess } from "./marketCatalog";

describe("public market transactions", () => {
  const character = { level: 2 };
  const state = { credits: 1000 };

  it("allows an affordable standard purchase on Coruscant", () => {
    const good = getMarket("Coruscant — Galactic City", character.level).goods.find((item) => item.id === "medpac");
    expect(getTradeAccess("Coruscant — Galactic City", character, state, good).direct).toBe(true);
  });

  it("requires GM resolution when the same character is confined", () => {
    const good = getMarket("Coruscant — Level 1313 detention infirmary", character.level).goods.find((item) => item.id === "medpac");
    expect(getTradeAccess("Coruscant — Level 1313 detention infirmary", character, state, good).direct).toBe(false);
  });

  it("quotes a conservative resale price only for catalog goods", () => {
    expect(getSellQuote({ name: "Medpac" }, "Corellia — Coronet City")?.price).toBeGreaterThan(0);
    expect(getSellQuote({ name: "Kelvek's encrypted cache" }, "Corellia — Coronet City")).toBeNull();
  });
});
