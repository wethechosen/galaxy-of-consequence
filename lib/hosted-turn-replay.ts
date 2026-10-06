import type { HostedSave } from "./hosted-bridge";
import { GmTurnError, normalizeTurnAction } from "./gm";
import { replayedPlayerAction } from "./gpt-narration";

const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** Recover a committed turn from durable state before resolving a retry. */
export function replayHostedTurn(hosted: HostedSave | null, turnId: string, action: string) {
  if (!hosted?.snapshot || !turnId) return null;
  const snapshot = hosted.snapshot;
  const messages = Array.isArray(snapshot.messages) ? snapshot.messages.filter(record) : [];
  const message = [...messages].reverse().find(entry => entry.role === "assistant" && entry.turnId === turnId);
  if (!message || typeof message.content !== "string") return null;
  const originalAction = replayedPlayerAction(snapshot, turnId);
  if (originalAction === null) return null;
  if (normalizeTurnAction(originalAction) !== normalizeTurnAction(action)) {
    throw new GmTurnError("This turn identifier was already used for a different action.", 409);
  }
  const state = snapshot.gameState;
  const events = Array.isArray(state.turnEvents) ? state.turnEvents.filter(record) : [];
  const event = [...events].reverse().find(entry => entry.turnId === turnId);
  let roll = record(event?.roll) ? event.roll : null;
  if (!event) {
    for (let index = messages.indexOf(message) - 1; index >= 0; index -= 1) {
      const prior = messages[index];
      if (prior.role === "user" || prior.role === "assistant") break;
      if (prior.role === "roll" && record(prior.roll)) roll = prior.roll;
    }
  }
  return {
    snapshot,
    revision: hosted.revision,
    updatedAt: hosted.updated_at,
    turnId,
    narration: message.content,
    roll,
    provider: "hosted-replay",
    model: typeof message.model === "string" ? message.model : undefined,
    fallbackReason: message.fallbackReason || null,
    fallbackDetail: message.fallbackDetail || null,
    replayed: true,
    hud: {
      level: snapshot.character?.level || 1,
      experience: snapshot.character?.experience || 0,
      forcePoints: state.forcePoints || 0,
      destinyPoints: state.destinyPoints || 0,
      darkSideScore: state.darkSideScore || 0,
      notoriety: state.notoriety || 0,
      carried: (Array.isArray(state.inventory) ? state.inventory : []).reduce((sum: number, item: unknown) => sum + Number((record(item) ? item.qty : 0) || 0), 0),
    },
    state: { location: state.location, health: state.health, conditionTrack: state.conditionTrack, credits: state.credits, inventory: state.inventory, objectives: state.objectives, combat: state.combat },
  };
}
