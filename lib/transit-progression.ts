/**
 * A player who has already boarded an established interstellar journey may
 * wait for its scheduled destination without personally issuing a movement
 * verb. Never infer a new trip solely from a requested destination.
 */
export type TransitArrivalRequest = {
  destination: string;
  objectiveTitle: string;
};

export function isArrivalWaitDeclaration(action: string): boolean {
  const text = String(action || "").trim().toLowerCase();
  if (/^(?:i\s+)?wait[.!]?$/.test(text) || /^continue waiting[.!]?$/.test(text)) return true;
  const mentionsArrival = /\b(?:arriv(?:e|es|ed|ing|al)|land(?:s|ed|ing)?|destination)\b/.test(text);
  if (!mentionsArrival) return false;
  return /\b(?:wait|until|remain|continue|resolve|attempt|try|again|complete|reach)\b/.test(text)
    || /^(?:the[y]?\s+)?arriv(?:e|al)\b/.test(text);
}

export function pendingTransitArrival(
  state: Record<string, unknown>,
  action: string,
): TransitArrivalRequest | null {
  if (!isArrivalWaitDeclaration(action)) return null;
  const scene = state.scene && typeof state.scene === "object" && !Array.isArray(state.scene)
    ? state.scene as Record<string, unknown>
    : null;
  const summary = String(scene?.summary || "");
  // Legacy saves described the already-completed boarding/departure without
  // moving the stored dock location. Both vessel and flight must be confirmed.
  if (!/\b(?:hyperdrive|hyperspace)\b/i.test(summary)
    || !/\b(?:freighter|starship|ship|vessel|yt-1300)\b/i.test(summary)) return null;

  const objectives = Array.isArray(state.objectives) ? state.objectives : [];
  const active = objectives.find((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const objective = entry as Record<string, unknown>;
    return /^(?:active|in.progress|pursuing)$/i.test(String(objective.status || ""))
      && /^Reach\s+[^\n]{2,80}$/i.test(String(objective.title || ""));
  }) as Record<string, unknown> | undefined;
  if (!active) return null;
  const objectiveTitle = String(active.title).trim();
  const destination = objectiveTitle.replace(/^Reach\s+/i, "").trim();
  const savedLocation = String(state.location || "").trim().toLowerCase();
  // A completed journey must not be replayed as a second arrival.
  if (savedLocation === destination.toLowerCase()
    || savedLocation.startsWith(destination.toLowerCase() + " —")
    || savedLocation.startsWith(destination.toLowerCase() + " -")) return null;
  return { destination, objectiveTitle };
}

/**
 * Reject a draft that repeats old dialogue or announces arrival in prose while
 * leaving the official location and world clock unchanged.
 */
export function transitArrivalFailure(
  trip: TransitArrivalRequest,
  gameplayResult: string,
  delta: Record<string, unknown> | null,
): string | null {
  const place = String(delta?.location || "").trim().toLowerCase();
  const target = trip.destination.toLowerCase();
  const arrived = place === target || place.startsWith(target + " —")
    || place.startsWith(target + " -") || place.startsWith(target + " orbit")
    || place.startsWith(target + " system") || place.startsWith(target + ":");
  if (!arrived) return "The confirmed transport-arrival wait did not save the destination location.";
  if (!Number.isSafeInteger(delta?.timeAdvanceMinutes) || Number(delta?.timeAdvanceMinutes) <= 0) {
    return "The confirmed transport-arrival wait did not advance the campaign clock.";
  }
  if (!/\b(?:arriv(?:e|es|ed|ing|al)|land(?:s|ed|ing)?|dock(?:s|ed|ing)?|hyperspace exit|emerg(?:es|ed)? from hyperspace|exits? hyperspace|orbital approach)\b/i.test(gameplayResult)
    || /\b(?:arrival (?:has )?not (?:been )?confirmed|arrival remains unconfirmed|still (?:in transit|in hyperspace)|has not (?:arrived|landed)|does not arrive)\b/i.test(gameplayResult)) {
    return "The GM did not narrate an actual arrival corresponding to the saved destination.";
  }
  return null;
}
