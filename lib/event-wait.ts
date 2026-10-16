/** Preserve explicit waiting across model paraphrases; this grants no destination or reward. */
export function isEventWait(action: string): boolean {
  return /^(?:i\s+)?(?:will\s+)?(?:(?:set|put)\b[^.!?]{0,100}\band\s+)?(?:wait|sleep|rest|remain|stay|meditate|continue waiting|enter deep medi[at]+tion)\b[^.!?]*\buntil\b/i.test(action.trim())
    && !/^(?:i\s+)?(?:will\s+)?(?:do not|don't|won't)\b/i.test(action.trim());
}

export const EVENT_WAIT_INSTRUCTION = `EVENT-BOUND WAIT: The player is passing time until an event, not voicing a goal or asking permission to wait. Resolve elapsed time and the awaited event when established, or a concrete interruption that changes the situation. Save positive timeAdvanceMinutes for time that passes. If the event cannot occur because a prerequisite is missing, identify that exact prerequisite and a usable next action; do not narrate sleeping/waiting and then silently reset to the starting moment. Do not invent a purchased journey, destination, payment, recovery benefit, or contract. Use the current journey, not an earlier completed trip.`;

export function eventWaitFailure(action: string, result: string, delta: Record<string, unknown> | null): string | null {
  if (!isEventWait(action)) return null;
  if (Number.isSafeInteger(delta?.timeAdvanceMinutes) && Number(delta?.timeAdvanceMinutes) > 0) return null;
  // An immediate, explicit prerequisite failure is allowed; a narrated passage
  // of time without a clock update is not.
  const blocked = /\b(?:cannot|can't|unable to)\s+(?:depart|leave|arrive|sleep|rest|wait)\b/i.test(result)
    && /\b(?:because|until|requires?)\b/i.test(result);
  const elapsed = /\b(?:you (?:sleep|slept|wait|waited|wake|awaken)|hours? (?:pass|later)|minutes? (?:pass|later))\b/i.test(result);
  return blocked && !elapsed ? null : "The event-bound wait narrated no elapsed campaign time. Resolve the awaited event or a concrete interruption, saving positive timeAdvanceMinutes; do not repeat the departure scene.";
}
