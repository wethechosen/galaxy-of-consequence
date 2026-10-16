import type { DatapadSnapshot } from "./datapad-save";

// Repair only an explicit completed local arrival in the LAST saved GM result.
// Never derive arrival from a player goal, rejected draft, or old journey.
export function reconcileCommittedArrival(snapshot: DatapadSnapshot): DatapadSnapshot {
  const state = snapshot.gameState;
  const action = String((state.scene as Record<string, unknown> | undefined)?.action || "");
  if (!/\b(?:head|return|go|travel|walk|move)\b/i.test(action)) return snapshot;
  const last = (snapshot.messages as Array<{role:string; content:string}>).filter(message => message.role === "assistant").at(-1);
  const content = String(last?.content || "");
  const result = /##\s*GAMEPLAY RESULT\s*\n([\s\S]*?)(?=\n##|$)/i.exec(content)?.[1] || "";
  const arrived = /\byou\s+(?:arrive\s+at|[^.!?\n]{0,100}\band\s+arrive\s+at)\s+((?:Docking Bay|Spaceport)\s+[^.!?\n]{1,100}?)(?=\s+(?:without|where|and)|[.!?\n]|$)/i.exec(result)?.[1];
  if (!arrived || /\b(?:do not|cannot|can't|have not|will|would)\b/i.test(result.split(/[.!?\n]/)[0])) return snapshot;
  const planet = String(state.location || "").split(/\s+[—–]\s+/)[0];
  if (!planet || planet.length > 60) return snapshot;
  const location = `${planet} — ${arrived.replace(/[’']s\s+/g, ", ").trim()}`;
  if (location === state.location) return snapshot;
  return {...snapshot, gameState:{...state, location, scene:{...(state.scene as object), location, summary:result.trim()},
    repairHistory:[...(Array.isArray(state.repairHistory) ? state.repairHistory : []), {id:`arrival:${String((state.scene as Record<string, unknown>)?.id || "last")}`,reason:"Reconciled the last committed local arrival; no new journey or payment.",previousLocation:state.location,location}]} };
}
