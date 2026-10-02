import { getMarket, getSellQuote, getTradeAccess } from "@/original/lib/marketCatalog";
import type { DatapadSnapshot } from "./datapad-save";

export class MarketTradeError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

type TradeInput = { action: "buy" | "sell"; goodId?: string; itemId?: string };
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

export function applyMarketTrade(snapshot: DatapadSnapshot, input: TradeInput): DatapadSnapshot {
  if (!snapshot.character) throw new MarketTradeError("No character record is available for this transaction.");
  const state = structuredClone(snapshot.gameState);
  const character = snapshot.character;
  const location = String(state.location || "");
  const inventory = Array.isArray(state.inventory) ? state.inventory.filter(record).map(item => ({ ...item })) : [];
  const credits = Number(state.credits);
  if (!Number.isSafeInteger(credits) || credits < 0) throw new MarketTradeError("The available credit balance could not be verified.");

  if (input.action === "buy") {
    const market = getMarket(location, Number(character.level) || 1);
    const good = market.goods.find((entry: { id: string }) => entry.id === input.goodId);
    if (!good) throw new MarketTradeError("That item is not listed by the current market.", 404);
    // marketCatalog is legacy JavaScript; its generated declaration narrows the
    // optional good parameter to null even though runtime callers pass a listing.
    const access = getTradeAccess(location, character, state, good as any);
    if (!access.direct) throw new MarketTradeError(access.reason || "This purchase is not currently available.", 403);
    const existing = inventory.find(item => String(item.name).toLocaleLowerCase() === String(good.name).toLocaleLowerCase());
    if (existing) existing.qty = Number(existing.qty || 0) + 1;
    else inventory.push({ id: crypto.randomUUID(), name: good.name, qty: 1, tag: String(good.category || "gear").toLocaleLowerCase() });
    state.credits = credits - Number(good.price);
    state.inventory = inventory;
    return { ...snapshot, gameState: state };
  }

  const item = inventory.find(entry => String(entry.id) === input.itemId);
  if (!item || Number(item.qty || 0) < 1) throw new MarketTradeError("That item is not present in the carried inventory.", 404);
  const access = getTradeAccess(location, character, state);
  const quote = getSellQuote(item, location);
  if (!access.publicMarket || !quote) throw new MarketTradeError(access.reason || "No verified buyer is available here.", 403);
  item.qty = Number(item.qty) - 1;
  state.inventory = inventory.filter(entry => Number(entry.qty || 0) > 0);
  state.credits = credits + Number(quote.price);
  return { ...snapshot, gameState: state };
}
