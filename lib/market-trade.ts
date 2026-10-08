import { getMarket, getSellQuote, getTradeAccess } from "@/original/lib/marketCatalog";
import type { DatapadSnapshot } from "./datapad-save";

export class MarketTradeError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export type TradeInput = { action: "buy" | "sell"; goodId?: string; itemId?: string; merchantId?: string; quotedPrice?: number };
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

export function applyMarketTrade(snapshot: DatapadSnapshot, input: TradeInput): DatapadSnapshot {
  if (!snapshot.character) throw new MarketTradeError("No character record is available for this transaction.");
  if (input.action !== "buy" && input.action !== "sell") throw new MarketTradeError("Unknown market transaction.");
  const state = structuredClone(snapshot.gameState);
  const character = snapshot.character;
  const location = String(state.location || "");
  const inventory = Array.isArray(state.inventory) ? state.inventory.filter(record).map(item => ({ ...item })) : [];
  const credits = Number(state.credits);
  if (!Number.isSafeInteger(credits) || credits < 0) throw new MarketTradeError("The available credit balance could not be verified.");

  if (input.action === "buy") {
    const market = getMarket(location, Number(character.level) || 1, state);
    const good = market.goods.find((entry: { id: string }) => entry.id === input.goodId);
    if (!good) throw new MarketTradeError("That item is not listed by the current market.", 404);
    if (input.merchantId && input.merchantId !== good.merchantId) throw new MarketTradeError("That seller is not offering this item in your current district. Reopen the local market.", 409);
    if (input.quotedPrice !== undefined && input.quotedPrice !== good.price) throw new MarketTradeError("The listing changed. Review its current price before buying.", 409);
    // marketCatalog is legacy JavaScript; its generated declaration narrows the
    // optional good parameter to null even though runtime callers pass a listing.
    const access = getTradeAccess(location, character, state, good as any);
    if (!access.direct) throw new MarketTradeError(access.reason || "This purchase is not currently available.", 403);
    if (good.ownership) {
      const field = good.ownership === "property" ? "properties" : "ships";
      const holdings = Array.isArray(state[field]) ? state[field].filter(record) : [];
      state[field] = [...holdings, { id: crypto.randomUUID(), listingId: `${market.area.id}:${good.id}`, name: good.name,
        type: good.id, class: good.ownership === "vehicle" ? "Civilian landspeeder" : undefined, assetType: good.ownership,
        location, baseValue: good.price, income: 0, upkeep: 0, legality: good.legality, merchantId: good.merchantId }];
    } else {
      const existing = inventory.find(item => String(item.name).toLocaleLowerCase() === String(good.name).toLocaleLowerCase());
      if (existing) {
        const quantity = Number(existing.qty || 0) + 1;
        if (!Number.isSafeInteger(quantity)) throw new MarketTradeError("The inventory count could not be verified.");
        existing.qty = quantity;
      } else inventory.push({ id: crypto.randomUUID(), name: good.name, qty: 1, tag: String(good.category || "gear").toLocaleLowerCase(), ...(good.illicit ? { legality: good.legality } : {}) });
    }
    state.credits = credits - Number(good.price);
    state.inventory = inventory;
    return { ...snapshot, gameState: state };
  }

  const item = inventory.find(entry => String(entry.id) === input.itemId);
  if (!item || !Number.isSafeInteger(item.qty) || Number(item.qty) < 1) throw new MarketTradeError("That item is not present in the carried inventory.", 404);
  const access = getTradeAccess(location, character, state);
  const quote = getSellQuote(item, location);
  if (!access.publicMarket || !quote) throw new MarketTradeError(access.reason || "No verified buyer is available here.", 403);
  item.qty = Number(item.qty) - 1;
  if (!Number.isSafeInteger(credits + Number(quote.price))) throw new MarketTradeError("This sale exceeds the supported credit balance.");
  state.inventory = inventory.filter(entry => Number(entry.qty || 0) > 0);
  state.credits = credits + Number(quote.price);
  return { ...snapshot, gameState: state };
}
