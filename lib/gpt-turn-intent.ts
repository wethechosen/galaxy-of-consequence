const ACTION_VERBS = "attack|shoot|fire|strike|punch|kick|stab|slash|lunge|hit|move|walk|travel|leave|exit|enter|advance|descend|head|proceed|follow|climb|ascend|retreat|withdraw|manipulate";
const NEGATED_SEQUENCE = new RegExp(`\\b(?:(?:do|does|did)\\s+not|don't|doesn't|didn't|not)(?:\\s+(?:attempt|try)(?:s|ed|ing)?\\s+to)?(?:\\s+to)?\\s+(?:${ACTION_VERBS})(?:\\s+or\\s+(?:${ACTION_VERBS}))*\\b`, "gi");

function stripNegatedActionClauses(action: string) {
  return String(action || "")
    .replace(NEGATED_SEQUENCE, " ")
    .replace(/\bwithout\s+(?:attempting\s+to\s+)?(?:attacking|shooting|firing|striking|punching|kicking|stabbing|slashing|lunging|hitting|moving|walking|traveling|leaving|exiting|entering|advancing|descending|heading|proceeding|following|climbing|ascending|retreating|withdrawing|manipulating)\b/gi, " ")
    .replace(/\bno\s+(?:hostile\s+action|attack|movement|travel)\b/gi, " ");
}

export function isExplicitAttackDeclaration(action: string) {
  const remaining = stripNegatedActionClauses(action);
  return /\b(?:punch|kick|strike|attack|hit|shoot|fire|stab|slash|lunge)\b/i.test(remaining);
}

export function isFreeMovementDeclaration(action: string) {
  if (isExplicitAttackDeclaration(action)) return false;
  const remaining = stripNegatedActionClauses(action)
    .replace(/\b(?:remain|remains|remaining|stay|stays|staying)\s+(?:exactly\s+)?(?:in\s+place|still|stationary|where\s+(?:i|he|she|they)\s+(?:am|is|are))\b/gi, " ");

  if (/\bcontinue(?:s|d|ing)?\s+(?:walking|moving|deeper|forward|down|along|toward|towards|through|into|onward)\b/i.test(remaining)) return true;
  return /\b(?:walk(?:ing)?|go(?:ing)?|move(?:s|d|ing)?|proceed(?:s|ed|ing)?|follow(?:s|ed|ing)?|descend(?:s|ed|ing)?|head(?:s|ed|ing)?|travel(?:s|ed|ing)?|leave|leaving|exit(?:s|ed|ing)?|enter(?:s|ed|ing)?|advance(?:s|d|ing)?|climb(?:s|ed|ing)?|ascend(?:s|ed|ing)?|retreat(?:s|ed|ing)?|withdraw(?:s|n|ing)?|push(?:es|ed|ing)?\s+(?:deeper|forward))\b/i.test(remaining);
}
