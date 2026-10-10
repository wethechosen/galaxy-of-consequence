import type { DatapadSnapshot } from "./datapad-save";
import { assertAdvancementReady } from "./advancement-gate";
export const recoveryError = (message: string, status = 400) => Object.assign(new Error(message), { status });

// Core pp. 148–149, visually verified. Ordinary rest, not medical treatment.
export function applyResidenceRest(current: DatapadSnapshot, propertyId: string) {
  assertAdvancementReady(current.character);
  const state = current.gameState;
  const holding = Array.isArray(state.properties) ? state.properties.find(item => item.id === propertyId) : null;
  if (!holding || holding.location !== state.location || !/lease|apartment|residence|home/i.test(String(holding.type || holding.name))) throw recoveryError("You must be at your recorded residence to rest here.");
  const scene = state.scene && typeof state.scene === "object" ? state.scene as Record<string, unknown> : {};
  if ((state.combat && typeof state.combat === "object" && (state.combat as Record<string, unknown>).status === "active") || scene.restInterrupted === true || scene.immediateThreat === true) throw recoveryError("An active threat prevents eight uninterrupted hours here. Resolve the scene before resting.", 409);
  if (current.character?.species === "Droid" || current.character?.living === false) throw recoveryError("Droids require repair rather than natural healing.");
  const maxHp = Number(current.character?.maxHitPoints ?? current.character?.maxHp);
  if (!Number.isFinite(maxHp) || maxHp <= 0) throw recoveryError("Your maximum HP must be established in your character build first.", 409);
  const conditions = Array.isArray(state.conditions) ? state.conditions : [];
  const persistent = state.persistentCondition === true || conditions.some(condition => typeof condition === "object" && condition !== null && (condition as Record<string, unknown>).persistent === true);
  const start = Number(state.campaignTimeMinutes || 0), end = start + 480;
  const previous = state.lastNaturalHealingMinute;
  const eligible = !persistent && (typeof previous !== "number" || end - previous >= 1440);
  const hp = Number(state.health || 0), level = Math.max(1, Number(current.character?.level || 1));
  const healed = eligible ? Math.max(0, Math.min(level, maxHp - hp)) : 0;
  const next = structuredClone(current);
  next.gameState.campaignTimeMinutes = end;
  next.gameState.health = hp + healed;
  if (!persistent) next.gameState.conditionTrack = 0;
  if (eligible) next.gameState.lastNaturalHealingMinute = end;
  const summary = `Eight uninterrupted hours of rest at ${holding.name}. ${healed} HP recovered${persistent ? "; a persistent condition still requires treatment" : "; nonpersistent Condition Track penalties cleared"}.`;
  next.gameState.scene = { ...scene, location: state.location, action: "Rest for eight uninterrupted hours", summary, beat: Number(scene.beat || 0) + 1 };
  return { snapshot: next, healed, persistent, eligible, summary };
}
