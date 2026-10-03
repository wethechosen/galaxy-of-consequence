const MOVEMENT_WORDS = /\b(?:walk|go|move|travel|head|proceed|follow|descend|climb|ascend|retreat|withdraw|leave|exit|enter|advance|approach|cross|step|run|dash|crawl|journey|sprint|drive)\b/i;
const ATTACK_WORDS = /\b(?:punch|kick|strike|attack|hit|shoot|fire|stab|slash|lunge|smash|blast)\b/i;
const STATIONARY_WORDS = /\b(?:remain|remains|remaining|stay|stays|staying|sit|sits|sitting|meditate|meditates|meditating|rest|rests|resting|hold\s+position)\b/i;
const NEGATED_PREFIX = /\b(?:do|does|did|can|could|would|should|must|will|shall|i\s+will|i\s+can)\s+not\b|\b(?:don't|doesn't|didn't|never)\b/i;

function stripNegatedActionClauses(action: string) {
  let cleaned = String(action || "");

  cleaned = cleaned.replace(/\b(?:do|does|did|can|could|would|should|must|will|shall)\s+not\s+(?:attempt(?:ed|ing)?\s+to\s+)?(?:attack|shoot|fire|strike|punch|kick|stab|slash|lunge|move|walk|travel|leave|exit|enter|advance|descend|head|proceed|follow|climb|ascend|retreat|withdraw|go|run|step|crawl|approach|cross)\b/gi, " ");
  cleaned = cleaned.replace(/\b(?:don't|doesn't|didn't|never)\s+(?:attempt(?:ed|ing)?\s+to\s+)?(?:attack|shoot|fire|strike|punch|kick|stab|slash|lunge|move|walk|travel|leave|exit|enter|advance|descend|head|proceed|follow|climb|ascend|retreat|withdraw|go|run|step|crawl|approach|cross)\b/gi, " ");
  cleaned = cleaned.replace(/\bwithout\s+(?:attempting\s+to\s+)?(?:attacking|shooting|firing|striking|punching|kicking|stabbing|slashing|lunging|moving|walking|traveling|leaving|exiting|entering|advancing|descending|heading|proceeding|following|climbing|ascending|retreating|withdrawing|going|running|stepping|crawling|approaching|crossing)\b/gi, " ");
  cleaned = cleaned.replace(/\bno\s+(?:hostile\s+action|attack|movement|travel)\b/gi, " ");
  cleaned = cleaned.replace(/\b(?:remain|remains|remaining|stay|stays|staying)\s+(?:exactly\s+)?(?:in\s+place|still|stationary|where\s+(?:i|he|she|they)\s+(?:am|is|are))\b/gi, " ");
  cleaned = cleaned.replace(/\b(?:sit|sits|sitting|meditate|meditates|meditating|rest|rests|resting)\b/gi, " ");
  return cleaned;
}

function hasExplicitNegativeMovement(action: string) {
  const text = String(action || "");
  return /\b(?:do|does|did|can|could|would|should|must|will|shall)\s+not\s+(?:attempt(?:ed|ing)?\s+to\s+)?(?:move|walk|travel|leave|exit|enter|advance|descend|head|proceed|follow|climb|ascend|retreat|withdraw|go|run|step|crawl|approach|cross)\b/i.test(text)
    || /\b(?:don't|doesn't|didn't|never|without)\s+(?:attempt(?:ed|ing)?\s+to\s+)?(?:move|walk|travel|leave|exit|enter|advance|descend|head|proceed|follow|climb|ascend|retreat|withdraw|go|run|step|crawl|approach|cross)\b/i.test(text)
    || /\b(?:not\s+to\s+move|not\s+to\s+travel|no\s+movement|no\s+travel)\b/i.test(text);
}

function hasStationaryDeclaration(action: string) {
  const text = String(action || "");
  if (!STATIONARY_WORDS.test(text)) return false;
  const remaining = stripNegatedActionClauses(text);
  return !MOVEMENT_WORDS.test(remaining);
}

export function isExplicitAttackDeclaration(action: string) {
  const remaining = stripNegatedActionClauses(action);
  return ATTACK_WORDS.test(remaining);
}

export function isFreeMovementDeclaration(action: string) {
  const text = String(action || "");
  if (!text || isExplicitAttackDeclaration(text)) return false;
  if (hasExplicitNegativeMovement(text) || hasStationaryDeclaration(text)) return false;

  const remaining = stripNegatedActionClauses(text);
  if (!MOVEMENT_WORDS.test(remaining)) return false;

  const explicitNegation = NEGATED_PREFIX.test(text) && MOVEMENT_WORDS.test(text);
  return !explicitNegation;
}
