import { forcePowerById, forcePowerKnown, forcePowerSelectionsForCharacter } from "../original/lib/sagaForcePowers";
import {
  activeCombat,
  resolveCombatAction,
  selectCombatTarget,
  type CombatResolution,
  type SagaCombatState,
  type CombatActionRequest,
} from "./saga-combat";
import { rollSagaCheck, type SagaCheckPlan } from "./saga-dice";

type RecordValue = Record<string, unknown>;
type Roller = (min: number, max: number) => number;

export type ForcePowerResolution = {
  combat?: SagaCombatState;
  rolls: Array<Record<string, unknown>>;
  stateDelta: Record<string, unknown>;
  playerHealthDelta: number;
  playerConditionDelta: number;
  experienceAward: number;
  summary: string;
  accepted: boolean;
};

const POWER_NAMES: Record<string, string> = {
  "battle-strike": "Battle Strike",
  "force-grip": "Force Grip",
  "force-lightning": "Force Lightning",
  "force-slam": "Force Slam",
  "force-stun": "Force Stun",
  "force-thrust": "Force Thrust",
  "move-object": "Move Object",
  "negate-energy": "Negate Energy",
  surge: "Surge",
};

const abilityModifier = (character: RecordValue, ability: "charisma" | "strength") => {
  const scores = character.abilityScores && typeof character.abilityScores === "object" && !Array.isArray(character.abilityScores)
    ? character.abilityScores as RecordValue : {};
  const direct = scores[ability] ?? scores[ability.slice(0, 3).toUpperCase()];
  const textual = new RegExp(`\\b${ability.slice(0, 3)}\\s*(\\d+)`, "i").exec(String(character.sagaStats || ""));
  const score = Number.isFinite(Number(direct)) ? Number(direct) : textual ? Number(textual[1]) : 10;
  return Math.floor((score - 10) / 2);
};

const trainedUseForce = (character: RecordValue) => {
  const skills = Array.isArray(character.trainedSkills) ? character.trainedSkills : [];
  return skills.some(entry => /use the force/i.test(String(entry))) || /use the force/i.test(String(character.skills || ""));
};

function emptyResolution(summary: string, combat?: SagaCombatState): ForcePowerResolution {
  return { combat, rolls: [], stateDelta: {}, playerHealthDelta: 0, playerConditionDelta: 0, experienceAward: 0, summary, accepted: false };
}

/**
 * Builds the referee-owned check for one executable Core Force power. The
 * model may describe the scene, but it cannot choose the DC, modifier, target
 * defense, or damage dice.
 */
export function buildForcePowerPlan(powerId: string, character: RecordValue, state: RecordValue, combat?: SagaCombatState | null): SagaCheckPlan | null {
  const power = forcePowerById(powerId);
  if (!power || !trainedUseForce(character) || !forcePowerKnown(character, power.id)) return null;
  const level = Math.max(1, Math.floor(Number(character.level) || 1));
  const modifier = Math.floor(level / 2) + abilityModifier(character, "charisma") + 5;
  const target = combat ? selectCombatTarget(combat) : null;
  const targetDefense = target ? power.id === "force-stun" ? target.will : power.id === "force-slam" || power.id === "force-grip" ? target.fortitude : target.reflex : 15;
  const targetLabel = target
    ? power.id === "force-stun" ? "Will Defense" : power.id === "force-grip" || power.id === "force-slam" ? "Fortitude Defense" : "Reflex Defense"
    : "DC";
  const damage = power.id === "force-lightning" ? { count: 8, sides: 6, modifier: 0, type: "energy" }
    : power.id === "force-slam" ? { count: 4, sides: 6, modifier: 0, type: "force" }
      : power.id === "force-grip" ? { count: 2, sides: 6, modifier: 0, type: "force" } : null;
  const selfPower = power.id === "battle-strike" || power.id === "surge";
  return {
    needed: true,
    actor: "player",
    kind: "skill",
    label: `Use the Force — ${power.name}`,
    modifier,
    target: selfPower ? (power.id === "surge" ? 10 : 15) : target ? targetDefense : 15,
    targetLabel: selfPower ? "DC" : targetLabel,
    targetVisible: selfPower,
    reason: `${power.name} is a declared, earned Force power and is resolved from its Saga Edition action and target rules.`,
    stakes: power.id === "force-lightning"
      ? "A failed activation does not grant the effect; the dark-side consequence still applies to using this power."
      : "A failed activation does not grant the declared Force effect, but the attempt still consumes its action and power use.",
    provisional: false,
    damage,
  };
}

function usesFor(character: RecordValue, state: RecordValue, powerId: string) {
  const existing = state.forcePowerUses && typeof state.forcePowerUses === "object" && !Array.isArray(state.forcePowerUses)
    ? { ...(state.forcePowerUses as Record<string, unknown>) } : {};
  const learned = forcePowerSelectionsForCharacter(character).filter((entry: RecordValue) => entry.id === powerId).length;
  const available = Number.isSafeInteger(Number(existing[powerId])) ? Number(existing[powerId]) : learned;
  return { existing, learned, available };
}

function targetName(combat: SagaCombatState | undefined, action: string) {
  const target = combat ? selectCombatTarget(combat, action) : null;
  return target?.name || "the declared target";
}

/** Resolve and consume an earned Force power on the same atomic turn. */
export function resolveForcePower(
  powerId: string,
  action: string,
  character: RecordValue,
  state: RecordValue,
  roll: Record<string, unknown> | null,
  roller: Roller,
): ForcePowerResolution {
  const power = forcePowerById(powerId);
  if (!power) return emptyResolution("That Force technique is not in the executable Core suite.");
  const combat = activeCombat(state);
  if (!trainedUseForce(character) || !forcePowerKnown(character, power.id)) {
    return emptyResolution(`You reach for ${power.name}, but that earned power is not recorded on D'mir's sheet. The attempt remains playable through training, mundane action, or another approach.` , combat || undefined);
  }
  const uses = usesFor(character, state, power.id);
  if (uses.available < 1) return emptyResolution(`${power.name} is exhausted for now. The power returns after the encounter and a minute of recovery.` , combat || undefined);
  const nextUses = { ...uses.existing, [power.id]: uses.available - 1 };
  const stateDelta: Record<string, unknown> = { forcePowerUses: nextUses, forcePowerLastUsed: power.id };
  if (power.id === "force-lightning") stateDelta.darkSideScoreDelta = 1;
  const request: CombatActionRequest = { kind: "power", action, actionType: power.action as CombatActionRequest["actionType"], metadata: { forcePower: power.id } };
  let combatResolution: CombatResolution | null = null;
  if (combat) {
    combatResolution = resolveCombatAction(combat, request, { character, currentHealth: Number(state.health || 0), playerRoll: undefined, roller, dayId: String(state.resourceDay || "campaign-day-1") });
    if (!combatResolution.accepted) return { ...emptyResolution(combatResolution.summary, combat), stateDelta: {} };
  }
  if (!roll) {
    return { ...(combatResolution || emptyResolution(`${power.name} is prepared.`, combat || undefined)), stateDelta, accepted: true, summary: `${power.name} is attempted, but the server did not produce its check.` };
  }
  const target = targetName(combat || undefined, action);
  let summary = roll.outcome === "success" ? `${power.name} takes hold against ${target}.` : `${power.name} fails to produce its intended effect against ${target}.`;
  let playerConditionDelta = combatResolution?.playerConditionDelta || 0;
  if (roll.outcome === "success") {
    if (power.id === "force-stun") {
      const steps = 1 + Math.floor(Math.max(0, Number(roll.total) - Number(roll.target)) / 5);
      playerConditionDelta = 0;
      summary = `${power.name} drops ${target} ${steps} step${steps === 1 ? "" : "s"} down the Condition Track.`;
      if (combatResolution?.combat) {
        const victim = selectCombatTarget(combatResolution.combat, action);
        if (victim) victim.conditionTrack = Math.min(5, victim.conditionTrack + steps);
      }
    } else if (power.id === "force-slam" && combatResolution?.combat) {
      const victim = selectCombatTarget(combatResolution.combat, action);
      if (victim) victim.prone = true;
      summary = `The telekinetic wave hammers ${target} and leaves them prone.`;
    } else if (power.id === "force-thrust") {
      stateDelta.lastForceMovement = { power: power.id, target, squares: 2, at: new Date().toISOString() };
      summary = `${target} is driven backward by the Force, opening space without deciding D'mir's next movement.`;
    } else if (power.id === "move-object") {
      stateDelta.lastForceMovement = { power: power.id, target, squares: 2, at: new Date().toISOString() };
      summary = `The declared object or target shifts under controlled telekinetic pressure.`;
    } else if (power.id === "battle-strike" && combatResolution?.combat) {
      const player = combatResolution.combat.combatants.find(entry => entry.side === "player");
      if (player) player.battleStrike = { attackBonus: 1, damageDice: 1, expiresRound: combatResolution.combat.round + 1 };
      summary = "The Force settles into your next attack: +1 attack and +1d6 damage before the end of your next turn.";
    } else if (power.id === "surge") {
      stateDelta.surgeUntil = "end-of-next-turn";
      summary = "Your muscles answer with a sudden burst of speed; the movement is yours to declare.";
    }
  }
  return {
    combat: combatResolution?.combat,
    rolls: combatResolution?.rolls || [],
    stateDelta,
    playerHealthDelta: combatResolution?.playerHealthDelta || 0,
    playerConditionDelta,
    experienceAward: roll.outcome === "success" ? 50 * Math.max(1, Number(character.level) || 1) : 0,
    summary,
    accepted: true,
  };
}

export function recoverForcePowerUses(state: RecordValue, character: RecordValue) {
  const uses: Record<string, number> = {};
  for (const entry of forcePowerSelectionsForCharacter(character)) uses[entry.id] = (uses[entry.id] || 0) + 1;
  return Object.keys(uses).length ? { forcePowerUses: uses } : {};
}
