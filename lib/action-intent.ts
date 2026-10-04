/** Remove explicitly negated clauses before verb-based mechanical dispatch. */
export function positiveActionText(action: string) {
  return action.replace(/\b(?:(?:i|d['’]?mir)\s+)?(?:do(?:es)?\s+not|don't|doesn't|will\s+not|won't|never)\s+[^.;!\n]*?(?=\s+but\s+|[.;!\n]|$)/gi, "")
    .replace(/\bwithout\s+(?:attacking|shooting|firing|moving|advancing)[^.;!\n]*?(?=\s+but\s+|[.;!\n]|$)/gi, "").trim();
}

export function permitsLocationChange(action: string) {
  if (/\b(?:remain|stay)\s+(?:still|here|in place)|\bwithout moving\b/i.test(action)) return false;
  return /\b(?:go(?:es|ing|ne)?|enter(?:s|ed|ing)?|leave(?:s|ing)?|exit(?:s|ed|ing)?|move(?:s|d|ing)?|walk(?:s|ed|ing)?|run(?:s|ning)?|travel(?:s|ed|ing)?|follow(?:s|ed|ing)?|trace(?:s|d|ing)?|track(?:s|ed|ing)?|pursu(?:e|es|ed|ing)|seek(?:s|ing)?|descend(?:s|ed|ing)?|ascend(?:s|ed|ing)?|cross(?:es|ed|ing)?|climb(?:s|ed|ing)?|approach(?:es|ed|ing)?|escape(?:s|d|ing)?|retreat(?:s|ed|ing)?|withdraw(?:s|ing|n)?|explor(?:e|es|ed|ing)|step(?:s|ped|ping)?|return(?:s|ed|ing)?)\b/i.test(positiveActionText(action));
}
