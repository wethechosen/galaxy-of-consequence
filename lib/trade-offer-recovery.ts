import type { DatapadSnapshot } from "./datapad-save";
import { invokeNvidia } from "./original-provider";
import { commitConversationTradeState, currentTradeOffers, validateTradeOffers } from "./conversation-trade";

type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue => !!value && typeof value === "object" && !Array.isArray(value);
const normalize = (value: unknown) => String(value || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const contains = (source: string, value: string) => normalize(source).includes(normalize(value));
const hasAmount = (source: string, amount: number) => [...source.matchAll(/\b\d[\d,]*(?:\.\d+)?\b/g)]
  .some(match => Number(match[0].replace(/,/g, "")) === amount);

/** Repair legacy quotes from confirmed GM prose only. This prepares an offer;
 * it never authorizes payment, changes location, or grants the quoted benefit. */
export async function recoverConfirmedTradeOffer(snapshot: DatapadSnapshot): Promise<DatapadSnapshot> {
  if (currentTradeOffers(snapshot.gameState).length) return snapshot;
  const messages = snapshot.messages.filter(record);
  // A later valid reply can supersede an older price. Never scan backwards past it.
  const source = [...messages].reverse().find(message => message.role === "assistant" && !message.error
    && message.provider !== "local-safe-fallback" && !message.fallbackReason);
  if (!source || typeof source.content !== "string") return snapshot;
  const location = /^\s*(?:#{1,6}\s*)?LOCATION\s*\r?\n([^\r\n]+)/im.exec(source.content)?.[1];
  if (!location || normalize(location) !== normalize(snapshot.gameState.location)) return snapshot;
  // Exclude the options: suggestions cannot establish a price or contract.
  const confirmed = source.content.split(/^(?:#{1,6}\s*)?PLAYER OPTIONS\s*$/im)[0]
    .replace(/<!--STATE:[\s\S]*?-->/g, "");
  if (!/\b(?:credits?|price|rent|deposit)\b/i.test(confirmed) || !/\b\d[\d,]*\b/.test(confirmed)) return snapshot;
  const response = await invokeNvidia({
    system: `Extract an UNPAID concrete merchant offer from the confirmed GM text supplied below. Return STRICT JSON {"offers":[]} when no unpaid exact offer is established, or {"offers":[{"sellerName":"exact established seller","totalCredits":123,"items":[{"name":"exact quoted goods or service","qty":1,"tag":"gear"}]}]}. No commentary. Never extract proposed player terms, completed payments, paid offers, estimates, examples, or options. For a residential lease also include lease:{propertyName,propertyLocation,landlord,termMonths,rentCredits,refundableDepositCredits,accessDescription}; all terms must be explicit in the confirmed text, totalCredits must equal rent plus deposit, items must describe only the contracted tenancy/access, and no ownership is granted. Never infer an omitted price, fee, benefit, term, or credential. Use the source text's numeric amounts. This is a historical serialization repair, not gameplay or payment authorization.`,
    messages: [{ role: "user", content: confirmed.slice(0, 16000) }],
    temperature: 0, top_p: 0.1, max_tokens: 1024, timeout_ms: 10_000,
  });
  const parsed = JSON.parse(response.content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim());
  const offers = validateTradeOffers(parsed.offers);
  if (offers.length !== 1) return snapshot;
  const offer = offers[0];
  if (!contains(confirmed, offer.sellerName) || !hasAmount(confirmed, offer.totalCredits)) return snapshot;
  if (offer.lease) {
    const lease = offer.lease;
    if (![lease.propertyName, lease.landlord].every(value => contains(confirmed, value))
      || !normalize(lease.propertyLocation).split(" ").every(word => normalize(confirmed).split(" ").includes(word))
      || !hasAmount(confirmed, lease.rentCredits) || !hasAmount(confirmed, lease.refundableDepositCredits)
      || !/\b(?:access|credentials?|keys?|chip)\b/i.test(confirmed)
      || !(new RegExp(`\\b${lease.termMonths}[- ]months?\\b`, "i").test(confirmed)
        || contains(confirmed, `${["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"][lease.termMonths]} months`))) return snapshot;
    // No invented chip model, extra furnishing, or transferable ownership.
    offer.items = [{ name: `${lease.propertyName} tenancy and access credentials`, qty: 1, tag: "access" }];
    if (!contains(lease.propertyLocation, lease.propertyName)) lease.propertyLocation = `${lease.propertyLocation} — ${lease.propertyName}`;
    lease.accessDescription = `Access credentials for ${lease.propertyName} during the agreed tenancy`;
  } else if (!offer.items.every(item => contains(confirmed, item.name) && item.qty === 1)) return snapshot;
  const turnId = typeof source.turnId === "string" ? source.turnId : `legacy-quote-${messages.indexOf(source)}`;
  return { ...snapshot, gameState: commitConversationTradeState(snapshot.gameState, { tradeOfferAdd: offers }, null, turnId) };
}
