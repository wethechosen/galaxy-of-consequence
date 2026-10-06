import type { DatapadSnapshot } from "./datapad-save";
import { positiveActionText } from "./action-intent";

type Ledger = Record<string, unknown>;
export type TradeItem = { name: string; qty: number; tag: string };
export type TradeOfferInput = { sellerName: string; sellerSpecies?: string; items: TradeItem[]; totalCredits: number };
export type TradeOffer = TradeOfferInput & {
  id: string; location: string; sourceTurnId: string; status: "open" | "purchased" | "superseded";
  acceptedTurnId?: string;
};
export type ConversationTrade = {
  status: "accepted" | "insufficient-funds" | "unavailable" | "ambiguous" | "already-committed";
  offer?: TradeOffer; reason?: string;
};

const isRecord = (value: unknown): value is Ledger => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const key = (value: unknown) => String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
const validName = (value: unknown) => typeof value === "string" && value.trim().length > 0 && value.length <= 160;
const MAX_CREDITS = 1_000_000_000_000;

/** Offers are terms of an NPC interaction, never an inventory or power grant. */
export function validateTradeOffers(value: unknown): TradeOfferInput[] {
  if (!Array.isArray(value) || value.length > 8) throw new Error("Invalid merchant offer list.");
  return value.map((raw) => {
    if (!isRecord(raw) || !validName(raw.sellerName) || !Array.isArray(raw.items) || !raw.items.length || raw.items.length > 12
      || !Number.isSafeInteger(raw.totalCredits) || Number(raw.totalCredits) < 1 || Number(raw.totalCredits) > MAX_CREDITS) {
      throw new Error("A merchant offer requires a seller, concrete items, and a positive whole-credit bundle price.");
    }
    const seen = new Set<string>();
    const items = raw.items.map((item) => {
      if (!isRecord(item) || !validName(item.name) || !Number.isSafeInteger(item.qty) || Number(item.qty) < 1 || Number(item.qty) > 100
        || (item.tag !== undefined && !validName(item.tag)) || seen.has(key(item.name))) throw new Error("Invalid or duplicate merchandise in offer.");
      seen.add(key(item.name));
      return { name: String(item.name).trim(), qty: Number(item.qty), tag: typeof item.tag === "string" ? item.tag.trim() : "gear" };
    });
    if (raw.sellerSpecies !== undefined && !validName(raw.sellerSpecies)) throw new Error("Invalid merchant species.");
    return { sellerName: String(raw.sellerName).trim(), ...(raw.sellerSpecies ? { sellerSpecies: String(raw.sellerSpecies).trim() } : {}), items, totalCredits: Number(raw.totalCredits) };
  });
}

export function currentTradeOffers(state: Ledger): TradeOffer[] {
  const offers: TradeOffer[] = [];
  for (const raw of Array.isArray(state.tradeOffers) ? state.tradeOffers : []) {
    if (!isRecord(raw) || raw.status !== "open" || !validName(raw.id) || !validName(raw.sourceTurnId)
      || key(raw.location) !== key(state.location)) continue;
    try { offers.push({ ...validateTradeOffers([raw])[0], id: String(raw.id), location: String(raw.location), sourceTurnId: String(raw.sourceTurnId), status: "open" }); }
    catch { /* A malformed historical offer is not a price authority. */ }
  }
  return offers;
}

function merchandiseWords(name: string) {
  return key(name).replace(/[^\p{L}\p{N}\s-]/gu, " ").split(/[\s-]+/).filter((word) => word.length > 2 && !["the", "and", "with", "black", "gray", "grey", "thick", "charcoal", "reinforced", "armored"].includes(word));
}
function matchesItem(action: string, item: TradeItem) {
  // A product's modifier is not an item reference: taking a flight is not
  // accepting a flight suit. The semantic interpreter supplies the full name
  // when needed; this outage fallback accepts its concrete head noun only.
  const words = merchandiseWords(item.name.split(/[,(]/)[0]);
  const noun = words.at(-1);
  return Boolean(noun && new RegExp(`\\b${noun}\\b`, "i").test(action));
}

const escapePattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function mentions(text: string, value: string) {
  return new RegExp(`(?:^|\\s)${escapePattern(key(value))}(?=$|\\s|['.,;!?])`, "i").test(key(text));
}
function namedMerchantOffers(offers: TradeOffer[], action: string): TradeOffer[] | null {
  // Restrict identity evidence to an explicit seller reference, rather than a
  // second NPC mentioned in accompanying lodging dialogue.
  const source = /\bfrom\s+(?:the\s+)?([^.!?"“”;\n]{1,140})/i.exec(action)?.[1]
    .split(/\s+(?:for|and|then|but|after|if)\b/i)[0].trim();
  if (source && !/^(?:you|the vendor|vendor|merchant|seller)$/i.test(source)) {
    const species = offers.filter((offer) => Boolean(offer.sellerSpecies && mentions(source, offer.sellerSpecies)));
    if (species.length) return species;
    const named = offers.filter((offer) => mentions(source, offer.sellerName));
    const longest = Math.max(0, ...named.map((offer) => offer.sellerName.length));
    return named.filter((offer) => offer.sellerName.length === longest);
  }
  const possessed = offers.filter((offer) => new RegExp(`\\b${escapePattern(offer.sellerName)}['’]s\\b`, "i").test(action));
  if (possessed.length) {
    // A longer named merchant wins over a generic name contained within it.
    const longest = Math.max(...possessed.map((offer) => offer.sellerName.length));
    return possessed.filter((offer) => offer.sellerName.length === longest);
  }
  return null;
}

/** Only affirmative acceptance of an established offer can spend credits. */
export function planConversationTrade(action: string, state: Ledger, turnId: string): ConversationTrade | null {
  const receipts = Array.isArray(state.tradeReceipts) ? state.tradeReceipts.filter(isRecord) : [];
  if (receipts.some((receipt) => receipt.turnId === turnId)) return { status: "already-committed" };
  const text = positiveActionText(action).replace(/[’]/g, "'");
  // Asking about price, stock, or shelter does not accept a purchase. Theft is
  // an attempted action for the referee, not permission to debit a retail price.
  if (/\b(?:steal|snatch|rob|without paying|refuse to pay|don't pay|do not pay|don't buy|do not buy|won't buy|will not buy)\b/i.test(action)) return null;
  const isSoldAcceptance = /^["“']?\s*sold[.!]?["”']?\s*$/i.test(text);
  const accepts = isSoldAcceptance || /\b(?:i(?:'ll| will)?\s+(?:buy|purchase|pay|take|grab|accept)|buy\s+(?:the|a|an|it|them)|purchase\s+(?:the|a|an|it|them)|i(?:'ll| will)\s+take\s+(?:it|them)|i(?:'ll| will)?\s+accept\s+(?:the\s+)?(?:offer|deal|bundle|outfit|[^.!?\n]{1,100}\boffer))/i.test(text);
  if (!accepts || /\b(?:can|could|may|should)\s+i\s+(?:buy|purchase|take|grab|pay)\b/i.test(text)) return null;
  const acceptanceClause = text.replace(/^["“']\s*/, "")
    .split(/[.!?\n"“”]|\b(?:and\s+)?(?:i\s+ask|i\s+say|ask\s+(?:if|whether))\b/i)[0];
  if (/\b(?:if|unless|provided|on condition|only when)\b|\b(?:after|once|when|until)\b[^.!?]{0,100}\b(?:agrees?|proves?|confirms?|verifies?|accepts?|discount|refund|lower)\b/i.test(acceptanceClause)) return null;
  if (!/\b(?:buy|purchase|pay|accept|sold)\b/i.test(text) && /\b(?:take\s+(?:a\s+look|stock|note)|examine|inspect|try\s+on|check\s+the\s+fit)\b/i.test(text)) return null;
  const offers = currentTradeOffers(state);
  if (!offers.length) return null;
  const refersToWholeOffer = isSoldAcceptance || /\b(?:take|buy|purchase|accept)\s+(?:it|them|both|(?:the|that) (?:offer|deal|bundle|outfit)|everything|(?:the\s+)?[^.!?\n]{1,100}\boffer)\b|\b(?:pay|hand over)\s+(?:the\s+)?(?:quoted|asking|agreed)\s+(?:price|credits|amount)\b/i.test(text);
  const statedPayment = /\b(?:pay|hand over|offer)\s+(?:the\s+)?([\d,]+)\s*(?:credits?)?\b|\b(?:buy|purchase)\b[^.!?]{0,140}\bfor\s+([\d,]+)\s*(?:credits?)?\b/i.exec(text);
  const payment = statedPayment ? Number(String(statedPayment[1] || statedPayment[2]).replace(/,/g, "")) : null;
  let matches = offers.filter((offer) => refersToWholeOffer || offer.items.every((item) => matchesItem(text, item)));
  const sellers = namedMerchantOffers(matches, text);
  if (sellers) {
    if (!sellers.length) return { status: "unavailable", reason: "That merchant has not made a matching saved offer. Confirm their terms before paying." };
    matches = sellers;
  }
  if (matches.length > 1 && payment !== null) {
    const priced = matches.filter((offer) => offer.totalCredits === payment);
    if (priced.length) matches = priced;
  }
  if (matches.length !== 1) return matches.length > 1 ? { status: "ambiguous", reason: "More than one offer matches. Confirm which merchant's offer you accept." } : null;
  const offer = matches[0];
  if (payment !== null && payment !== offer.totalCredits) {
    return { status: "unavailable", offer, reason: `The merchant's agreed price is ${offer.totalCredits} credits; the different amount is a counteroffer, not an accepted transaction.` };
  }
  if (isRecord(state.combat) && state.combat.status === "active") return { status: "unavailable", offer, reason: "The merchant cannot complete the exchange while this encounter is active." };
  const credits = Number(state.credits);
  if (!Number.isSafeInteger(credits) || credits < 0) return { status: "unavailable", offer, reason: "The available credit balance cannot be verified." };
  if (credits < offer.totalCredits) return { status: "insufficient-funds", offer, reason: `The agreed ${offer.totalCredits}-credit price exceeds the ${credits} credits available.` };
  return { status: "accepted", offer };
}

export function conversationTradeInstruction(trade: ConversationTrade | null) {
  if (!trade) return "";
  if (trade.status === "accepted" && trade.offer) {
    return `AUTHORITATIVE MERCHANT TRANSACTION: The player accepted ${trade.offer.sellerName}'s saved offer${trade.offer.sellerSpecies ? ` (${trade.offer.sellerSpecies})` : ""}. Debit exactly ${trade.offer.totalCredits} galactic credits and add exactly ${JSON.stringify(trade.offer.items)}. This ordinary agreed-price exchange requires no Saga check. Preserve this merchant's identity and answer any accompanying declared dialogue in the same scene. Do not equip items, change clothing, buy lodging, give discounts, or choose further actions unless explicitly declared. Narrate the payment and handover as completed; the server commits them together.`;
  }
  return `AUTHORITATIVE MERCHANT TRANSACTION: ${trade.reason || "This offer is already committed."} No new payment or item handover occurs. Give the concrete in-world reason and respond to any accompanying dialogue. Do not block the conversation or invent a completed purchase.`;
}

/** Generated prose cannot replace the agreed price or add unquoted bonuses. */
export function reconcileConversationTradeDelta(delta: Ledger | null, trade: ConversationTrade | null): Ledger | null {
  if (!trade) return delta;
  if (trade.status === "accepted" && trade.offer) return {
    ...(delta || {}), credits: -trade.offer.totalCredits, creditsCriminal: 0,
    inventoryAdd: trade.offer.items.map((item) => ({ ...item })), inventoryRemove: [],
  };
  return { ...(delta || {}), credits: 0, creditsCriminal: 0, inventoryAdd: [], inventoryRemove: [] };
}

/** Exact quoted commerce is a no-check material cause that the referee can trust. */
export function isVerifiedConversationTradeDelta(delta: Ledger, trade: ConversationTrade | null) {
  if (trade?.status !== "accepted" || !trade.offer || Number(delta.credits) !== -trade.offer.totalCredits || Number(delta.creditsCriminal || 0) !== 0
    || (Array.isArray(delta.inventoryRemove) && delta.inventoryRemove.length > 0)) return false;
  const items = Array.isArray(delta.inventoryAdd) ? delta.inventoryAdd.filter(isRecord) : [];
  return items.length === trade.offer.items.length && trade.offer.items.every((item) => items.some((entry) => key(entry.name) === key(item.name) && Number(entry.qty) === item.qty));
}

/** Called only with a finalized delta, inside the same authoritative save. */
export function commitConversationTradeState(state: Ledger, delta: Ledger | null, trade: ConversationTrade | null, turnId: string): Ledger {
  const priorReceipts = Array.isArray(state.tradeReceipts) ? state.tradeReceipts.filter(isRecord) : [];
  if (priorReceipts.some((receipt) => receipt.turnId === turnId)) return state;
  let offers = Array.isArray(state.tradeOffers) ? state.tradeOffers.filter(isRecord).map((offer) => ({ ...offer })) : [];
  if (trade?.status === "accepted" && trade.offer) {
    if (!delta || !isVerifiedConversationTradeDelta(delta, trade)) throw new Error("The merchant payment and merchandise ledger do not match the agreed offer.");
    offers = offers.map((offer) => offer.id === trade.offer!.id ? { ...offer, status: "purchased", acceptedTurnId: turnId } : offer);
  }
  const additions = delta?.tradeOfferAdd === undefined ? [] : validateTradeOffers(delta.tradeOfferAdd);
  if (!additions.length && trade?.status !== "accepted") return state;
  additions.forEach((offer, index) => {
    const id = `offer:${turnId}:${index}`;
    if (offers.some((existing) => existing.id === id)) return;
    // Updated prices supersede only the same merchant's same bundle, retaining
    // unrelated offers so a conversation never silently chooses a merchant.
    const bundle = offer.items.map((item) => `${key(item.name)}:${item.qty}`).sort().join("|");
    offers = offers.map((existing) => key(existing.sellerName) === key(offer.sellerName) && key(existing.location) === key(state.location)
      && Array.isArray(existing.items) && existing.items.filter(isRecord).map((item) => `${key(item.name)}:${item.qty}`).sort().join("|") === bundle
      && existing.status === "open" ? { ...existing, status: "superseded" } : existing);
    offers.push({ ...offer, id, location: String(state.location || ""), sourceTurnId: turnId, status: "open" });
  });
  const receipt = trade?.status === "accepted" && trade.offer ? [{ turnId, offerId: trade.offer.id, sellerName: trade.offer.sellerName, location: trade.offer.location, totalCredits: trade.offer.totalCredits, items: trade.offer.items.map((item) => ({ ...item })) }] : [];
  return { ...state, tradeOffers: offers.slice(-80), tradeReceipts: [...priorReceipts, ...receipt].slice(-500) };
}

/** Transaction preview for tests and other trusted controllers; persist once. */
export function applyConversationPurchase(snapshot: DatapadSnapshot, action: string, turnId: string): DatapadSnapshot {
  const trade = planConversationTrade(action, snapshot.gameState, turnId);
  if (trade?.status !== "accepted" || !trade.offer) return snapshot;
  const inventory = Array.isArray(snapshot.gameState.inventory) ? snapshot.gameState.inventory.filter(isRecord).map((item) => ({ ...item })) : [];
  for (const item of trade.offer.items) {
    const existing = inventory.find((entry) => key(entry.name) === key(item.name));
    if (existing) existing.qty = Number(existing.qty || 0) + item.qty;
    else inventory.push({ ...item, id: `trade:${turnId}:${inventory.length}` });
  }
  const delta = reconcileConversationTradeDelta({}, trade);
  const state = commitConversationTradeState({ ...snapshot.gameState, credits: Number(snapshot.gameState.credits) - trade.offer.totalCredits, inventory }, delta, trade, turnId);
  return { ...snapshot, gameState: state };
}
