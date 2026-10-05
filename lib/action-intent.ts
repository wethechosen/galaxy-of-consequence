const PLAYER_SUBJECT = String.raw`(?:i|he|d['’]?mir|my character)`;
const CLAUSE_BOUNDARY = String.raw`(?=\s*(?:,\s*(?:(?:but|then|and then)\b|${PLAYER_SUBJECT}\b)|\b(?:but|then|and then)\b|[.;!?\n]|$))`;
const NEGATABLE_ACTION = String.raw`(?:attack|shoot|fire|strike|punch|kick|stab|slash|lunge|move|walk|travel|leave|exit|enter|advance|descend|head|proceed|follow|climb|ascend|retreat|withdraw|go|run|step|crawl|approach|cross)`;
const NEGATABLE_ACTION_ING = String.raw`(?:attacking|shooting|firing|striking|punching|kicking|stabbing|slashing|lunging|moving|walking|traveling|leaving|exiting|entering|advancing|descending|heading|proceeding|following|climbing|ascending|retreating|withdrawing|going|running|stepping|crawling|approaching|crossing)`;

/** Remove explicitly negated clauses while preserving a later affirmative clause. */
export function positiveActionText(action: string) {
  return String(action || "")
    .replace(new RegExp(String.raw`\b(?:${PLAYER_SUBJECT}\s+)?(?:do(?:es)?\s+not|don't|doesn't|will\s+not|won't|never)\s+[^.;!?\n]*?${CLAUSE_BOUNDARY}`, "gi"), "")
    .replace(new RegExp(String.raw`\bnot\s+to\s+${NEGATABLE_ACTION}\b[^.;!?\n]*?${CLAUSE_BOUNDARY}`, "gi"), "")
    .replace(new RegExp(String.raw`\bwithout\s+(?:attempting\s+to\s+)?${NEGATABLE_ACTION_ING}\b[^.;!?\n]*?${CLAUSE_BOUNDARY}`, "gi"), "")
    .replace(/\bno\s+(?:hostile\s+action|attacks?|movement|travel)\b/gi, "")
    .trim();
}

const TRAVEL_VERB = String.raw`(?:go(?:es|ing|ne)?|enter(?:s|ed|ing)?|leave(?:s|ing)?|exit(?:s|ed|ing)?|walk(?:s|ed|ing)?|run(?:s|ning)?|travel(?:s|ed|ing)?|follow(?:s|ed|ing)?|trace(?:s|d|ing)?|track(?:s|ed|ing)?|pursu(?:e|es|ed|ing)|seek(?:s|ing)?|descend(?:s|ed|ing)?|ascend(?:s|ed|ing)?|cross(?:es|ed|ing)?|climb(?:s|ed|ing)?|approach(?:es|ed|ing)?|escape(?:s|d|ing)?|retreat(?:s|ed|ing)?|withdraw(?:s|ing|n)?|explor(?:e|es|ed|ing)|step(?:s|ped|ping)?|return(?:s|ed|ing)?|head(?:s|ed|ing)?|proceed(?:s|ed|ing)?|advance(?:s|d|ing)?|dash(?:es|ed|ing)?|crawl(?:s|ed|ing)?|journey(?:s|ed|ing)?|sprint(?:s|ed|ing)?|drive(?:s|d|ing)?)`;
const SELF_MOVE_COMPLEMENT = String.raw`(?=$|\s*(?:[,.;!?]|\b(?:to|toward|towards|through|into|onto|across|along|away|back|backward|backwards|forward|forwards|ahead|down|up|deeper|lower|closer|past|around|behind|outside|inside|off|within|near|from|in|out|left|right|north|south|east|west|cautiously|carefully|quietly|slowly|quickly|deliberately|myself|with\s+(?:caution|care)|cover\s+to\s+cover|\d+)\b))`;
const PLAYER_TRAVEL = new RegExp(String.raw`\b${PLAYER_SUBJECT}\s+(?:${TRAVEL_VERB}\b|mov(?:e|es|ed|ing)\b${SELF_MOVE_COMPLEMENT})`, "i");
const IMPERATIVE_TRAVEL = new RegExp(String.raw`(?:^|[.;!?]\s*|,\s*(?:(?:but|then|and then)\s+)?|\b(?:but|then|and then)\s+)(?:continue\s+)?(?:${TRAVEL_VERB}\b|mov(?:e|es|ed|ing)\b${SELF_MOVE_COMPLEMENT})`, "i");

/** True only when the player character, rather than an object or NPC, changes position. */
export function permitsLocationChange(action: string) {
  const positive = positiveActionText(action);
  if (!positive) return false;
  return PLAYER_TRAVEL.test(positive) || IMPERATIVE_TRAVEL.test(positive);
}
