import { describe, expect, it } from "vitest";
import { applyMarketTrade, MarketTradeError } from "./market-trade";

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
});
