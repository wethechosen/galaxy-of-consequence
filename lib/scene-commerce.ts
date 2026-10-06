import type { DatapadSnapshot } from './datapad-save';
import { positiveActionText } from './action-intent';

export type SceneMerchant = { name: string; species?: string; location: string };
const SPECIES = "Twi['’]?lek|Rodian|Human|Duros|Bothan|Sullustan|Weequay|Zabrak|Devaronian|Trandoshan";

/** Retain the first established seller at this location, not a later species drift. */
export function sceneMerchant(snapshot: DatapadSnapshot): SceneMerchant | null {
  const location = String(snapshot.gameState.location || '');
  const stored = snapshot.gameState.sceneMerchant as SceneMerchant | undefined;
  if (stored?.name && stored.location === location) return stored;
  for (const message of snapshot.messages as Array<Record<string, unknown>>) {
    if (message.role !== 'assistant' || message.provider === 'local-safe-fallback' || message.fallbackReason) continue;
    const text = String(message.content || '');
    if (!text.includes(location)) continue;
    const after = new RegExp(`(?:the\\s+)?(?:clothing\\s+)?vendor[^.!?\\n]{0,65}\\b(${SPECIES})\\b`, 'i').exec(text);
    const before = new RegExp(`\\bThe\\s+(${SPECIES})\\s+(?:clothing\\s+)?vendor\\b`, 'i').exec(text);
    const match = before || after;
    if (match) return { name: 'clothing vendor', species: match[1].replace(/’/g, "'"), location };
  }
  return null;
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
  if (!merchant?.species) return narration;
  // Definite same-stall references only: a new armor dealer or another vendor
  // must not be silently transformed into this seller.
  const after = new RegExp(`(\\bthe\\s+(?:clothing\\s+)?vendor,?\\s+(?:a\\s+)?(?:[\\w-]+\\s+){0,3})(${SPECIES})\\b`, 'gi');
  const before = new RegExp(`(\\bthe\\s+)(${SPECIES})(\\s+(?:clothing\\s+)?vendor\\b)`, 'gi');
  return narration.replace(after, (_all, prefix) => `${prefix}${merchant.species}`)
    .replace(before, (_all, prefix, _species, suffix) => `${prefix}${merchant.species}${suffix}`);
}
