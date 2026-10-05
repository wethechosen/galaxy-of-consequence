type ReplaySnapshot = { gameState?: Record<string, unknown>; messages?: unknown[] };

const SECTION = /^(?:#{1,6}[ \t]*)?(?:SCENE|GM ADJUDICATION|GM RESOLUTION|GAMEPLAY RESULT|SAGA CHECK|STATE UPDATE|PLAYER OPTIONS)[ \t]*:?[ \t]*\r?$/im;

/** Keep the displayed location aligned with the state committed by the GM engine. */
export function anchorNarrationLocation(narration: string, location: string) {
  if (!location.trim()) return narration;
  const locationHeading = /^(?:#{1,6}[ \t]*)?LOCATION[ \t]*:?[ \t]*\r?$/im.exec(narration);
  if (locationHeading) {
    const headingEnd = locationHeading.index + locationHeading[0].length;
    const remainder = narration.slice(headingEnd);
    const nextSection = SECTION.exec(remainder);
    return `${narration.slice(0, headingEnd).replace(/\r$/, "")}\n${location.trim()}${nextSection ? `\n\n${remainder.slice(nextSection.index)}` : ""}`;
  }

  // Older saves used a four-section contract with the location inside SCENE.
  let next = narration;
  if (!/level 1313/i.test(location)) {
    next = next.replace(/^At\s+Coruscant\s*[—-]\s*Level\s*1313\s*[,.:]?/im, `At ${location},`);
  }
  const scene = /^(?:#{1,6}[ \t]*)?SCENE[ \t]*:?[ \t]*\r?$/im.exec(next);
  if (!scene) return next;
  const after = next.slice(scene.index + scene[0].length, scene.index + scene[0].length + 320);
  if (after.includes(location)) return next;
  return `${next.slice(0, scene.index + scene[0].length)}\n**Location:** ${location}${next.slice(scene.index + scene[0].length)}`;
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** Return the original declaration so hosted retries cannot replay a different action. */
export function replayedPlayerAction(snapshot: ReplaySnapshot, turnId: string): string | null {
  const events = Array.isArray(snapshot.gameState?.turnEvents) ? snapshot.gameState.turnEvents : [];
  const event = [...events].reverse().find((value) => isRecord(value) && value.turnId === turnId);
  if (isRecord(event) && typeof event.action === "string") return event.action;

  // Legacy/context turns may not have an event, but their preceding user message is retained.
  const messages = Array.isArray(snapshot.messages) ? snapshot.messages : [];
  let responseIndex = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (isRecord(message) && message.role === "assistant" && message.turnId === turnId) {
      responseIndex = index;
      break;
    }
  }
  for (let index = responseIndex - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!isRecord(message)) continue;
    if (message.role === "assistant") break;
    if (message.role === "user" && typeof message.content === "string") return message.content;
  }
  return null;
}
