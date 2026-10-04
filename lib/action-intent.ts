/** Remove explicitly negated clauses before verb-based mechanical dispatch. */
export function positiveActionText(action: string) {
  return action.replace(/\b(?:(?:i|d['’]?mir)\s+)?(?:do(?:es)?\s+not|don't|doesn't|will\s+not|won't|never)\s+[^.;!\n]*?(?=,?\s+but\s+|[.;!\n]|$)/gi, "")
    .replace(/\bnot\s+to\s+(?:attack|shoot|fire|strike|punch|kick|stab|slash|lunge|move|walk|travel|leave|exit|enter|advance|descend|head|proceed|follow|climb|ascend|retreat|withdraw|go|run|step|crawl|approach|cross)\b[^.;!\n]*?(?=,?\s+but\s+|[.;!\n]|$)/gi, "")
    .replace(/\bwithout\s+(?:attempting\s+to\s+)?(?:attack(?:ing)?|shoot(?:ing)?|fir(?:e|ing)|strik(?:e|ing)|punch(?:ing)?|kick(?:ing)?|stab(?:bing)?|slash(?:ing)?|lung(?:e|ing)|mov(?:e|ing)|walk(?:ing)?|travel(?:ing)?|leav(?:e|ing)|exit(?:ing)?|enter(?:ing)?|advanc(?:e|ing)|descend(?:ing)?|head(?:ing)?|proceed(?:ing)?|follow(?:ing)?|climb(?:ing)?|ascend(?:ing)?|retreat(?:ing)?|withdraw(?:ing)?|go(?:ing)?|run(?:ning)?|step(?:ping)?|crawl(?:ing)?|approach(?:ing)?|cross(?:ing)?)\b[^.;!\n]*?(?=,?\s+but\s+|[.;!\n]|$)/gi, "")
    .replace(/\bno\s+(?:hostile\s+action|attacks?|movement|travel)\b/gi, "")
    .trim();
}

export function permitsLocationChange(action: string) {
  if (/\b(?:remain|stay)\s+(?:still|here|in place)|\bwithout moving\b/i.test(action)) return false;
  return /\b(?:go(?:es|ing|ne)?|enter(?:s|ed|ing)?|leave(?:s|ing)?|exit(?:s|ed|ing)?|move(?:s|d|ing)?|walk(?:s|ed|ing)?|run(?:s|ning)?|travel(?:s|ed|ing)?|follow(?:s|ed|ing)?|trace(?:s|d|ing)?|track(?:s|ed|ing)?|pursu(?:e|es|ed|ing)|seek(?:s|ing)?|descend(?:s|ed|ing)?|ascend(?:s|ed|ing)?|cross(?:es|ed|ing)?|climb(?:s|ed|ing)?|approach(?:es|ed|ing)?|escape(?:s|d|ing)?|retreat(?:s|ed|ing)?|withdraw(?:s|ing|n)?|explor(?:e|es|ed|ing)|step(?:s|ped|ping)?|return(?:s|ed|ing)?)\b/i.test(positiveActionText(action));
}
