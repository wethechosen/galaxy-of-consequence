import type { DatapadSnapshot } from './datapad-save';
import { positiveActionText } from './action-intent';

export type SceneMerchant = { name: string; species?: string; location: string };
const SPECIES = "Twi['’]?lek|Rodian|Human|Duros|Bothan|Sullustan|Weequay|Zabrak|Devaronian|Trandoshan";
const SELLER = '(?:(clothing|armor|food|weapons?)\\s+)?(vendor|merchant|seller|dealer)';
const genericSellerName = (name: string) => new RegExp(`^${SELLER}$`, 'i').test(name);
const sameName = (left: string, right: string) => left.toLocaleLowerCase() === right.toLocaleLowerCase();
const newMerchantInteraction = (text: string) => /\b(?:another|different|new|next)\s+(?:[\w'-]+\s+){0,3}(?:vendor|merchant|seller|dealer|stall|shop)\b/i.test(text);

function sceneText(content: string) {
  const scene = /(?:^|\n)(?:#{1,6}\s*)?SCENE\s*\n([\s\S]*?)(?=\n(?:#{1,6}\s*)?(?:GM ADJUDICATION|GM RESOLUTION|GAMEPLAY RESULT|SAGA CHECK|STATE UPDATE|PLAYER OPTIONS)\s*\n|$)/i.exec(content);
  return scene?.[1] || content.split(/(?:^|\n)(?:#{1,6}\s*)?PLAYER OPTIONS\s*\n/i)[0];
}

function otherInteraction(text: string) {
  // A spoken referral to lodging does not move the conversation to that desk.
  const visible = text.replace(/“[^”]*”|"[^"]*"/g, '').split(/(?<=[.!?])\s+/)
    .filter((sentence) => !/\b(?:vendor|merchant|seller|dealer)\b[^.!?]{0,70}\b(?:points?|refers?|suggests?|recommends?|directs?|gestures?|mentions?)\b/i.test(sentence)).join(' ');
  return /\b(?:guesthouse|lodging|housing authority|hotel|inn)\b[^.!?\n]{0,100}\b(?:desk|counter|clerk|office|reception)\b/i.test(visible)
    || /\b(?:innkeeper|receptionist)\b/i.test(visible)
    || /\bclerk\b/i.test(visible) && !/\b(?:vendor|merchant|seller|dealer)\b/i.test(visible)
    || /\byou\s+(?:leave|depart|step away from|walk away from)\s+(?:the\s+)?(?:market|stall|counter|vendor|merchant|shop)\b/i.test(visible);
}

function observedSeller(text: string, location: string): SceneMerchant | null {
  const role = new RegExp(`\\b${SELLER}\\b`, 'i').exec(text);
  if (!role) return null;
  const named = /\b(?:vendor|merchant|seller|dealer)\s+(?:named|called)\s+([\p{L}][\p{L}'’-]{1,60})/iu.exec(text)
    || new RegExp(`\\b([A-Z][\\p{L}'’-]{1,60}),\\s+(?:the|an?)\\s+(?:${SPECIES})\\s+${SELLER}\\b`, 'iu').exec(text);
  const before = new RegExp(`\\b(${SPECIES})\\s+${SELLER}\\b`, 'i').exec(text);
  const after = new RegExp(`\\b${SELLER}\\b[^.!?\\n]{0,65}\\b(${SPECIES})\\b`, 'i').exec(text);
  const species = before?.[1] || after?.[3];
  return { name: named?.[1] || role[0].toLocaleLowerCase(), ...(species ? { species: species.replace(/’/g, "'") } : {}), location };
}

/** Preserve identity within the current conversation, not across an entire market. */
export function sceneMerchant(snapshot: DatapadSnapshot): SceneMerchant | null {
  const location = String(snapshot.gameState.location || '');
  const stored = snapshot.gameState.sceneMerchant as SceneMerchant | undefined;
  const assistants = (Array.isArray(snapshot.messages) ? snapshot.messages : [])
    .filter((message): message is Record<string, unknown> => Boolean(message) && typeof message === 'object')
    .filter((message) => message.role === 'assistant' && typeof message.content === 'string');
  const latest = assistants.at(-1);
  const scenes = assistants.filter((message) => message.provider !== 'local-safe-fallback' && !message.fallbackReason && !message.error)
    .reverse().map((message) => String(message.content));
  const frame = snapshot.gameState.scene as { summary?: string; location?: string; action?: string } | undefined;
  // An outage template must not replace the last authored interaction.
  if (frame?.summary && (!frame.location || frame.location === location) && latest?.provider !== 'local-safe-fallback' && !latest?.fallbackReason) scenes.unshift(frame.summary);
  let merchant: SceneMerchant | null = null;
  let crossedBoundary = false;
  for (const content of scenes) {
    const frameLocation = /(?:^|\n)(?:#{1,6}\s*)?LOCATION\s*\n([^\n]+)/i.exec(content)?.[1].trim();
    const text = sceneText(content);
    if (frameLocation && frameLocation !== location || otherInteraction(text)) { crossedBoundary = true; break; }
    const observed = observedSeller(text, location);
    if (!observed) continue;
    if (merchant && !genericSellerName(merchant.name) && !genericSellerName(observed.name) && !sameName(merchant.name, observed.name)) { crossedBoundary = true; break; }
    if (merchant && /^(?:clothing|armor|food|weapons?)\b/i.test(merchant.name) && /^(?:clothing|armor|food|weapons?)\b/i.test(observed.name) && !sameName(merchant.name, observed.name)) { crossedBoundary = true; break; }
    const identity: SceneMerchant = {
      ...observed,
      name: merchant && !genericSellerName(merchant.name) ? merchant.name : observed.name,
      species: observed.species || merchant?.species,
    };
    merchant = identity;
    if (newMerchantInteraction(text)) { crossedBoundary = true; break; }
  }
  if (!merchant) return null;
  if (!crossedBoundary && stored?.name && stored.location === location
    && (genericSellerName(merchant.name) || sameName(stored.name, merchant.name))) {
    return { ...merchant, name: stored.name, species: stored.species || merchant.species };
  }
  return merchant;
}

/** A public retail request is not haggling, a threat, or a concealed-information check. */
export function isRoutineCommerce(action: string, location: unknown) {
  if (!/market|shop|bazaar|vendor|store/i.test(String(location || ''))) return false;
  const text = positiveActionText(action);
  if (/\b(?:attack|shoot|steal|rob|snatch|threaten|intimidate|lie|deceive|bargain|negotiate|persuade|discount|blackmail)\b/i.test(text)) return false;
  return /\b(?:vendor|merchant|clothing|robe|tunic|suit|buy|purchase|price|pay|looking for free|rest|shelter|lodging|room|inn|hotel)\b/i.test(text);
}

/** Preserve a seller's established species in same-stall prose; not a new actor. */
export function alignMerchantIdentity(narration: string, merchant: SceneMerchant | null) {
  if (!merchant?.species || otherInteraction(sceneText(narration)) || newMerchantInteraction(sceneText(narration))) return narration;
  const observed = observedSeller(sceneText(narration), merchant.location);
  if (observed && !genericSellerName(observed.name) && !sameName(observed.name, merchant.name)) return narration;
  // Definite same-stall references only: a new armor dealer or another vendor
  // must not be silently transformed into this seller.
  const after = new RegExp(`(\\bthe\\s+(?:clothing\\s+)?vendor,?\\s+(?:a\\s+)?(?:[\\w-]+\\s+){0,3})(${SPECIES})\\b`, 'gi');
  const before = new RegExp(`(\\bthe\\s+)(${SPECIES})(\\s+(?:clothing\\s+)?vendor\\b)`, 'gi');
  let aligned = narration.replace(after, (_all, prefix) => `${prefix}${merchant.species}`)
    .replace(before, (_all, prefix, _species, suffix) => `${prefix}${merchant.species}${suffix}`);
  if (!genericSellerName(merchant.name)) {
    const name = merchant.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const named = new RegExp(`(\\b${name},\\s+(?:the|an?)\\s+)(${SPECIES})(\\s+${SELLER}\\b)`, 'gi');
    aligned = aligned.replace(named, (_all, prefix, _species, suffix) => `${prefix}${merchant.species}${suffix}`);
  }
  return aligned;
}
