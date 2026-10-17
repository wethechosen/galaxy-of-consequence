import type { DatapadSnapshot } from "./datapad-save";
import { anchorNarrationLocation } from "./gpt-narration";
import { playerVisibleSnapshot } from "./npc-private-state";

type TurnResult = {
  snapshot: DatapadSnapshot;
  revision: number;
  turnId: string;
  narration: string;
  roll?: unknown;
  provider?: string;
  receipt?: { gameplayAdvanced?: boolean } | null;
  [field: string]: unknown;
};

export const GAMEPLAY_CONTRACT_VERSION = "goc-gameplay-v1";

/** One post-GM narrative/location projection, independent of browser or GPT. */
export function alignCommittedTurn<T extends TurnResult>(result: T): T {
  const location = String(result.snapshot.gameState?.location || "");
  const narration = anchorNarrationLocation(result.narration, location);
  if (narration === result.narration) return result;
  const messages = (Array.isArray(result.snapshot.messages) ? [...result.snapshot.messages] : []) as Array<Record<string, unknown>>;
  let idx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "assistant" && messages[i]?.turnId === result.turnId) { idx = i; break; }
  }
  if (idx >= 0) messages[idx] = { ...messages[idx], content: narration };
  return { ...result, narration, snapshot: { ...result.snapshot, messages } };
}

function publicHud(snapshot: DatapadSnapshot) {
  const state = snapshot.gameState || {};
  const character = snapshot.character || {};
  return {
    level: character.level || 1,
    experience: character.experience || 0,
    forcePoints: state.forcePoints || 0,
    destinyPoints: state.destinyPoints || 0,
    darkSideScore: state.darkSideScore || 0,
    notoriety: state.notoriety || 0,
    carried: (Array.isArray(state.inventory) ? state.inventory : []).reduce((sum, item) => sum + Number(item?.qty || 0), 0),
  };
}

/** Same public JSON envelope for any committed game action and any replay. */
export function publicCommittedTurn<T extends TurnResult>(result: T) {
  const canonical = alignCommittedTurn(result);
  const snapshot = playerVisibleSnapshot(canonical.snapshot);
  return {
    ...canonical,
    snapshot,
    contractVersion: GAMEPLAY_CONTRACT_VERSION,
    character: snapshot.character,
    state: snapshot.gameState,
    hud: publicHud(snapshot),
    gameplayAdvanced: true,
  };
}
