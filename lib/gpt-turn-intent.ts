import { permitsLocationChange, positiveActionText } from "./action-intent";

const ATTACK_WORDS = /\b(?:punch(?:es|ed|ing)?|kick(?:s|ed|ing)?|strike(?:s|struck|striking)?|attack(?:s|ed|ing)?|hit(?:s|ting)?|shoot(?:s|ing)?|fire(?:s|d|ing)?|stab(?:s|bed|bing)?|slash(?:es|ed|ing)?|lunge(?:s|d|ing)?|smash(?:es|ed|ing)?|blast(?:s|ed|ing)?)\b/i;
const OBJECT_ATTACK = /\b(?:punch(?:es|ed|ing)?|kick(?:s|ed|ing)?|strike(?:s|struck|striking)?|attack(?:s|ed|ing)?|hit(?:s|ting)?|shoot(?:s|ing)?|fire(?:s|d|ing)?|stab(?:s|bed|bing)?|slash(?:es|ed|ing)?|lunge(?:s|d|ing)?|smash(?:es|ed|ing)?|blast(?:s|ed|ing)?)\s+(?:(?:at|through|into)\s+)?(?:(?:the|a|an|that|this|those|these|some)\s+)?(?:debris|rubble|wreckage|slab|boulder|rock|door|hatch|wall|barrier|barricade|grate|crate|container|lock|panel|console|terminal|machinery|machine|pipe|conduit|obstruction|collapse|bulkhead|window|glass|chain|hinge|support|generator|junction box)\b/i;

export function isExplicitAttackDeclaration(action: string) {
  const remaining = positiveActionText(action);
  return ATTACK_WORDS.test(remaining);
}

/** Destructive attacks against scenery resolve as object attacks, not encounters. */
export function isObjectAttackDeclaration(action: string) {
  const remaining = positiveActionText(action);
  return OBJECT_ATTACK.test(remaining);
}

/** Only attacks against creatures or active vehicles can open or continue combat. */
export function isHostileAttackDeclaration(action: string) {
  return isExplicitAttackDeclaration(action) && !isObjectAttackDeclaration(action);
}

export function isFreeMovementDeclaration(action: string) {
  const text = String(action || "");
  if (!text || isExplicitAttackDeclaration(text)) return false;
  return permitsLocationChange(text);
}
