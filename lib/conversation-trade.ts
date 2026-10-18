import type { DatapadSnapshot } from "./datapad-save";
import { positiveActionText } from "./action-intent";
import { validateLeaseTerms, validatePriceComponents } from "@/original/lib/leaseTerms";

type Ledger = Record<string, unknown>;
export type TradeItem = { name: string; qty: number; tag: string };
export type LeaseTerms = { propertyName: string; propertyLocation: string; landlord: string; termMonths: number; rentCredits: number; refundableDepositCredits: number; accessDescription: string };
export type ServiceTerms = {
  kind: "travel" | "freight" | "lodging" | "commission" | "repair" | "medical" | "training" | "other";
  title: string; details?: string; origin?: string; destination?: string; departure?: string;
  durationMinutes?: number; minLevel?: number; requiredFlag?: string;
};
export type TradeOfferInput = { sellerName: string; sellerSpecies?: string; items: TradeItem[]; totalCredits: number;
  lease?: LeaseTerms; service?: ServiceTerms; priceSource?: string;
  priceComponents?: Array<{ label: string; credits: number }> };
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
    if (!isRecord(raw) || !validName(raw.sellerName) || !Array.isArray(raw.items) || (!raw.items.length && !raw.service) || raw.items.length > 12 || (raw.items.length > 0 && raw.service)
      || !Number.isSafeInteger(raw.totalCredits) || Number(raw.totalCredits) < (raw.service ? 0 : 1) || Number(raw.totalCredits) > MAX_CREDITS) {
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
    const lease = raw.lease === undefined ? undefined : validateLeaseTerms(raw.lease, Number(raw.totalCredits)) as LeaseTerms;
    const priceComponents = raw.priceComponents === undefined ? undefined : validatePriceComponents(raw.priceComponents, Number(raw.totalCredits));
    let service: ServiceTerms | undefined;
    if (raw.service !== undefined) {
      if (!isRecord(raw.service) || lease || !validName(raw.service.title)
        || !["travel", "freight", "lodging", "commission", "repair", "medical", "training", "other"].includes(String(raw.service.kind)))
        throw new Error("Invalid merchant service terms.");
      service = { kind: raw.service.kind as ServiceTerms["kind"], title: String(raw.service.title).trim() };
      for (const field of ["details", "origin", "destination", "departure", "requiredFlag"] as const) {
        const value = raw.service[field];
        if (value === undefined) continue;
        if (typeof value !== "string" || !value.trim() || value.length > (field === "details" ? 1200 : 160))
          throw new Error("Invalid service " + field);
        service[field] = value.trim();
      }
      for (const field of ["durationMinutes", "minLevel"] as const) {
        const value = raw.service[field];
        if (value === undefined) continue;
        if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > (field === "minLevel" ? 20 : 525600))
          throw new Error("Invalid service " + field);
        service[field] = Number(value);
      }
    }
    if (raw.priceSource !== undefined && !validName(raw.priceSource)) throw new Error("Invalid price source.");
    return { sellerName: String(raw.sellerName).trim(), ...(raw.sellerSpecies ? { sellerSpecies: String(raw.sellerSpecies).trim() } : {}), items, totalCredits: Number(raw.totalCredits), ...(lease ? { lease } : {}), ...(service ? { service } : {}), ...(raw.priceSource ? { priceSource: String(raw.priceSource).trim() } : {}), ...(priceComponents ? { priceComponents } : {}) };
  });
}

export function currentTradeOffers(state: Ledger): TradeOffer[] {
  const offers: TradeOffer[] = [];
  for (const raw of Array.isArray(state.tradeOffers) ? state.tradeOffers : []) {
    if (!isRecord(raw) || raw.status !== "open" || !validName(raw.id) || !validName(raw.sourceTurnId)
      || key(raw.location) !== key(state.location) || offerAlreadySettled(raw, state)) continue;
    try { offers.push({ ...validateTradeOffers([raw])[0], id: String(raw.id), location: String(raw.location), sourceTurnId: String(raw.sourceTurnId), status: "open" }); }
    catch { /* A malformed historical offer is not a price authority. */ }
  }
  return offers;
}

/** Transaction identity, not merely owning a similar item, prevents replay.
 * Historical reconciliation offers retain the original source turn identity. */
export function offerAlreadySettled(offer: Ledger, state: Ledger) {
  const sourceTurn = String(offer.sourceTurnId || "").replace(/^reconcile:/, "");
  const bundle = (value: Ledger) => (Array.isArray(value.items) ? value.items.filter(isRecord) : [])
    .map(item => `${key(item.name)}:${Number(item.qty)}`).sort().join("|")
    + (isRecord(value.service) ? `|service:${key(value.service.kind)}:${key(value.service.title)}:${key(value.service.destination)}` : "");
  const receipts = Array.isArray(state.tradeReceipts) ? state.tradeReceipts.filter(isRecord) : [];
  if (receipts.some(receipt => (offer.id && receipt.offerId === offer.id)
    || (offer.acceptedTurnId && receipt.turnId === offer.acceptedTurnId)
    || (sourceTurn && receipt.sourceTurnId === sourceTurn && bundle(receipt) === bundle(offer)
      && Number(receipt.totalCredits) === Number(offer.totalCredits)))) return true;
  const related = (Array.isArray(state.tradeOffers) ? state.tradeOffers.filter(isRecord) : []).some(other =>
    other.id !== offer.id && other.status === "purchased" && sourceTurn
    && String(other.sourceTurnId || "").replace(/^reconcile:/, "") === sourceTurn
    && bundle(other) === bundle(offer) && Number(other.totalCredits) === Number(offer.totalCredits)
    && receipts.some(receipt => receipt.offerId === other.id));
  if (related) return true;
  if (!isRecord(offer.lease)) return false;
  const lease = offer.lease;
  return (Array.isArray(state.properties) ? state.properties.filter(isRecord) : []).some(property =>
    ["active", "leased"].includes(key(property.status)) && isRecord(property.lease)
    && ["leased", "lease", "residential lease"].includes(key(property.tenure || property.type))
    && key(property.name) === key(lease.propertyName) && key(property.location) === key(lease.propertyLocation));
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
export function planConversationTrade(action: string, state: Ledger, turnId: string, acceptedOfferId?: string | null, character?: Ledger | null): ConversationTrade | null {
  const receipts = Array.isArray(state.tradeReceipts) ? state.tradeReceipts.filter(isRecord) : [];
  if (receipts.some((receipt) => receipt.turnId === turnId)) return { status: "already-committed" };
  const text = positiveActionText(action).replace(/[’]/g, "'");
  // Asking about price, stock, or shelter does not accept a purchase. Theft is
  // an attempted action for the referee, not permission to debit a retail price.
  if (/\b(?:steal|snatch|rob|without paying|refuse to pay|don't pay|do not pay|don't buy|do not buy|won't buy|will not buy)\b/i.test(action)) return null;
  const isSoldAcceptance = /^["“']?\s*sold[.!]?["”']?\s*$/i.test(text);
  const accepts = isSoldAcceptance || /\b(?:i(?:'ll| will)?\s+(?:buy|purchase|pay|take|grab|accept)|buy\s+(?:the|a|an|it|them)|purchase\s+(?:the|a|an|it|them)|i(?:'ll| will)\s+take\s+(?:it|them)|i(?:'ll| will)?\s+accept\s+(?:the\s+)?(?:offer|deal|bundle|outfit|[^.!?\n]{1,100}\boffer))/i.test(text);
  // The server's semantic interpreter can confirm a polite acceptance of an
  // exact saved offer. Question-shaped wording is only an outage-fallback
  // ambiguity, not a veto over that interpretation. Consent guards still apply.
  const purchaseQuestion = /\b(?:can|could|may|should)\s+i\s+(?:buy|purchase|take|grab|pay)\b/i.test(text);
  const inquiryOnly = /^["“']?\s*(?:can|could|may|should)\s+i\s+(?:buy|purchase|take|grab|pay)\b[^.!?\n]*\?\s*["”']?\s*$/i.test(text);
  const booksService = /\b(?:book|reserve|hire|charter|commission)\b/i.test(text)
    && !/\b(?:how|whether|what|where|when|could|can|may|should|quote|estimate)\b[^.!?]{0,90}\b(?:book|reserve|hire|charter|commission)\b/i.test(text);
  if (inquiryOnly || (!acceptedOfferId && (!(accepts || booksService) || purchaseQuestion))) return null;
  const acceptanceClause = text.replace(/^["“']\s*/, "")
    .split(/[.!?\n"“”]|\b(?:and\s+)?(?:i\s+ask|i\s+say|ask\s+(?:if|whether))\b/i)[0];
  if (/\b(?:if|unless|provided|on condition|only when)\b|\b(?:after|once|when|until)\b[^.!?]{0,100}\b(?:agrees?|proves?|confirms?|verifies?|accepts?|discount|refund|lower)\b/i.test(acceptanceClause)) return null;
  if (!/\b(?:buy|purchase|pay|accept|sold)\b/i.test(text) && /\b(?:take\s+(?:a\s+look|stock|note)|examine|inspect|try\s+on|check\s+the\s+fit)\b/i.test(text)) return null;
  const offers = currentTradeOffers(state);
  if (!offers.length) return null;
  const refersToWholeOffer = isSoldAcceptance || (booksService && offers.filter(offer => Boolean(offer.service)).length === 1) || /\b(?:take|buy|purchase|accept)\s+(?:it|them|both|(?:the|that) (?:offer|deal|bundle|outfit)|everything|(?:the\s+)?[^.!?\n]{1,100}\boffer)\b|\b(?:pay|hand over)\s+(?:the\s+)?(?:quoted|asking|agreed)\s+(?:price|credits|amount)\b/i.test(text);
  const statedPayment = /\b(?:pay|hand over|offer|transfer|charge|debit)\s+(?:(?:the|exactly|only)\s+)*([\d,]+)\s*(?:credits?)?\b|\b(?:buy|purchase)\b[^.!?]{0,140}\bfor\s+([\d,]+)\s*(?:credits?)?\b/i.exec(text);
  const payment = statedPayment ? Number(String(statedPayment[1] || statedPayment[2]).replace(/,/g, "")) : null;
  const requestedId = /\boffer\s+id\s+([a-z0-9:._-]+)/i.exec(text)?.[1];
  let matches = offers.filter((offer) => acceptedOfferId ? offer.id === acceptedOfferId : requestedId ? offer.id === requestedId
    : (refersToWholeOffer && (!booksService || Boolean(offer.service))) || Boolean(offer.service && (mentions(text, offer.service.title) || Boolean(offer.service.destination && mentions(text, offer.service.destination)))) || Boolean(offer.items.length && offer.items.every((item) => matchesItem(text, item))) || Boolean(offer.lease && mentions(text, offer.lease.propertyName)));
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
  if (offer.service) {
    if (offer.service.minLevel && (!character || Number(character.level) < offer.service.minLevel))
      return { status: "unavailable", offer, reason: `Requires Level ${offer.service.minLevel}. Nothing was booked or charged.` };
    if (offer.service.requiredFlag) {
      const flags = Array.isArray(state.flags) ? state.flags : [];
      if (!flags.some(flag => key(isRecord(flag) ? flag.name || flag.id || flag.flag : flag) === key(offer.service!.requiredFlag)))
        return { status: "unavailable", offer, reason: `Requires ${offer.service.requiredFlag}. Nothing was booked or charged.` };
    }
  }
  if (offer.lease && (Array.isArray(state.properties) ? state.properties.filter(isRecord) : []).some(property => {
    const lease = isRecord(property.lease) ? property.lease : null;
    return property.tenure === "leased" && property.status === "active" && lease
      && key(property.name) === key(offer.lease!.propertyName) && key(property.location) === key(offer.lease!.propertyLocation);
  })) return { status: "unavailable", offer, reason: "This tenancy is already active. No second payment is due for the same lease." };
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
    return `AUTHORITATIVE MERCHANT TRANSACTION: The player accepted ${trade.offer.sellerName}'s saved offer${trade.offer.sellerSpecies ? ` (${trade.offer.sellerSpecies})` : ""}. Debit exactly ${trade.offer.totalCredits} galactic credits. ${trade.offer.service
      ? `Register the paid ${trade.offer.service.kind} contract ${JSON.stringify(trade.offer.service)}; do not add carried inventory, start the journey, teleport or advance time just for booking.`
      : `Add exactly ${JSON.stringify(trade.offer.items)} to inventory.`} ${trade.offer.lease ? `LEASE: ${JSON.stringify(trade.offer.lease)}. The server grants this tenancy and access with the receipt, NOT ownership. The deposit is held by the landlord and does not increase player credits. Do not emit propertyAdd; the server builds the exact lease record.` : ""} This ordinary agreed-price exchange requires no Saga check. Preserve this merchant's identity and answer any accompanying declared dialogue in the same scene. Do not equip items, change clothing, buy anything else, give discounts, or choose further actions unless explicitly declared. Narrate the payment and handover as completed; the server commits them together.`;
  }
  return `AUTHORITATIVE MERCHANT TRANSACTION: ${trade.reason || "This offer is already committed."} No new payment or item handover occurs. Give the concrete in-world reason and respond to any accompanying dialogue. Do not block the conversation or invent a completed purchase.`;
}

/** Generated prose cannot replace the agreed price or add unquoted bonuses. */
export function reconcileConversationTradeDelta(delta: Ledger | null, trade: ConversationTrade | null): Ledger | null {
  if (!trade) return delta;
  if (trade.status === "accepted" && trade.offer) return {
    ...(delta || {}), credits: -trade.offer.totalCredits, creditsCriminal: 0,
    inventoryAdd: trade.offer.service ? [] : trade.offer.items.map((item) => ({ ...item })), inventoryRemove: [],
    ...(trade.offer.lease ? { propertyAdd: [] } : {}),
  };
  return { ...(delta || {}), credits: 0, creditsCriminal: 0, inventoryAdd: [], inventoryRemove: [] };
}

/** Exact quoted commerce is a no-check material cause that the referee can trust. */
export function isVerifiedConversationTradeDelta(delta: Ledger, trade: ConversationTrade | null) {
  if (trade?.status !== "accepted" || !trade.offer || Number(delta.credits) !== -trade.offer.totalCredits || Number(delta.creditsCriminal || 0) !== 0
    || (Array.isArray(delta.inventoryRemove) && delta.inventoryRemove.length > 0)) return false;
  const items = Array.isArray(delta.inventoryAdd) ? delta.inventoryAdd.filter(isRecord) : [];
  const itemKeys = (list: Ledger[]) => list.map(item => `${key(item.name)}:${Number(item.qty)}:${key(item.tag || "gear")}`).sort();
  return JSON.stringify(itemKeys(items)) === JSON.stringify(itemKeys(trade.offer.service ? [] : trade.offer.items));
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
    const bundle = offer.items.map((item) => `${key(item.name)}:${item.qty}`).sort().join("|") + (offer.service ? `|service:${key(offer.service.kind)}:${key(offer.service.title)}:${key(offer.service.destination)}` : "");
    offers = offers.map((existing) => key(existing.sellerName) === key(offer.sellerName) && key(existing.location) === key(state.location)
      && Array.isArray(existing.items) && existing.items.filter(isRecord).map((item) => `${key(item.name)}:${item.qty}`).sort().join("|") === bundle
      && (offer.service ? isRecord(existing.service) && key(existing.service.title) === key(offer.service.title) && key(existing.service.destination) === key(offer.service.destination) : !existing.service)
      && existing.status === "open" ? { ...existing, status: "superseded" } : existing);
    offers.push({ ...offer, id, location: String(state.location || ""), sourceTurnId: turnId, status: "open" });
  });
  const receipt = trade?.status === "accepted" && trade.offer ? [{ turnId, offerId: trade.offer.id, sourceTurnId: trade.offer.sourceTurnId, sellerName: trade.offer.sellerName,
    location: trade.offer.location, totalCredits: trade.offer.totalCredits, items: trade.offer.items.map((item) => ({ ...item })),
    ...(trade.offer.lease ? { lease: { ...trade.offer.lease } } : {}), ...(trade.offer.service ? { service: { ...trade.offer.service } } : {}) }] : [];
  const contracts = Array.isArray(state.serviceContracts) ? state.serviceContracts.filter(isRecord) : [];
  const contract = trade?.status === "accepted" && trade.offer?.service ? {
    id: `service:${trade.offer.id}`, offerId: trade.offer.id, turnId, provider: trade.offer.sellerName,
    purchasedAt: String(state.location || ""), status: "booked", priceCredits: trade.offer.totalCredits, terms: { ...trade.offer.service },
  } : null;
  const lease = trade?.status === "accepted" ? trade.offer?.lease : null;
  const properties = Array.isArray(state.properties) ? state.properties.filter(isRecord) : [];
  const leaseRecord = lease ? { id: `lease:${trade!.offer!.id}`, name: lease.propertyName, location: lease.propertyLocation,
    type: "Residential lease", tenure: "leased", status: "active", baseValue: 0, income: 0, upkeep: 0,
    lease: { ...lease, offerId: trade!.offer!.id, startedAtCampaignMinute: Number(state.campaignTimeMinutes || 0),
      endsAtCampaignMinute: Number(state.campaignTimeMinutes || 0) + lease.termMonths * 30 * 24 * 60 } } : null;
  return { ...state, ...(leaseRecord ? { properties: [...properties, leaseRecord] } : {}),
    ...(contract ? { serviceContracts: [...contracts, contract] } : {}),
    tradeOffers: offers.slice(-80), tradeReceipts: [...priorReceipts, ...receipt].slice(-500) };
}

/** Transaction preview for tests and other trusted controllers; persist once. */
export function applyConversationPurchase(snapshot: DatapadSnapshot, action: string, turnId: string): DatapadSnapshot {
  const trade = planConversationTrade(action, snapshot.gameState, turnId, undefined, snapshot.character as Ledger);
  if (trade?.status !== "accepted" || !trade.offer) return snapshot;
  const inventory = Array.isArray(snapshot.gameState.inventory) ? snapshot.gameState.inventory.filter(isRecord).map((item) => ({ ...item })) : [];
  for (const item of trade.offer.service ? [] : trade.offer.items) {
    const existing = inventory.find((entry) => key(entry.name) === key(item.name));
    if (existing) existing.qty = Number(existing.qty || 0) + item.qty;
    else inventory.push({ ...item, id: `trade:${turnId}:${inventory.length}` });
  }
  const delta = reconcileConversationTradeDelta({}, trade);
  const state = commitConversationTradeState({ ...snapshot.gameState, credits: Number(snapshot.gameState.credits) - trade.offer.totalCredits, inventory }, delta, trade, turnId);
  return { ...snapshot, gameState: state };
}
