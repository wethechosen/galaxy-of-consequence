import { permitsLocationChange, positiveActionText } from "./action-intent";

const ATTACK_WORDS = /\b(?:punch(?:es|ed|ing)?|kick(?:s|ed|ing)?|strike(?:s|struck|striking)?|attack(?:s|ed|ing)?|hit(?:s|ting)?|shoot(?:s|ing)?|fire(?:s|d|ing)?|stab(?:s|bed|bing)?|slash(?:es|ed|ing)?|lunge(?:s|d|ing)?|smash(?:es|ed|ing)?|blast(?:s|ed|ing)?)\b/i;

export function isExplicitAttackDeclaration(action: string) {
  const remaining = positiveActionText(action);
  return ATTACK_WORDS.test(remaining);
}

export function isFreeMovementDeclaration(action: string) {
  const text = String(action || "");
  if (!text || isExplicitAttackDeclaration(text)) return false;
  return permitsLocationChange(text);
}
