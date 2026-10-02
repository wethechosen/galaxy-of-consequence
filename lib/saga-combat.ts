import { randomInt, randomUUID } from "node:crypto";
import { rollSagaCheck, type SagaCheckPlan } from "./saga-dice";
import { isExplicitAttackDeclaration } from "./gpt-turn-intent";

type RecordValue = Record<string, unknown>;
type Roller = (min: number, max: number) => number;

export type CombatActions = { standard: number; move: number; swift: number; reaction: number };
export type Combatant = {
  id: string; name: string; side: "player" | "opposition"; level: number;
  hp: number; maxHp: number; reflex: number; fortitude: number; will: number;
  damageThreshold: number; conditionTrack: number; initiative: number;
  attackModifier: number; damage: { count: number; sides: number; modifier: number; type: string };
};
export type SagaCombatState = {
  id: string; status: "active" | "player_victory" | "player_defeated" | "escaped";
  round: number; activeSide: "player" | "opposition" | "none";
  initiativeOrder: string[]; combatants: Combatant[]; playerActions: CombatActions;
  log: Array<Record<string, unknown>>; startedAt: string; endedAt?: string;
};

export type CombatResolution = {
  combat: SagaCombatState;
  rolls: Array<Record<string, unknown>>;
  playerHealthDelta: number;
  playerConditionDelta: number;
  experienceAward: number;
  summary: string;
};

const abilityModifier = (character: RecordValue, key: string) => {
  const match = String(character.sagaStats || "").match(new RegExp(`${key}\\s*(\\d+)`, "i"));
  return match ? Math.floor((Number(match[1]) - 10) / 2) : 0;
};
const numberField = (value: unknown, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const freshActions = (): CombatActions => ({ standard: 1, move: 1, swift: 1, reaction: 1 });
const copyCombat = (combat: SagaCombatState): SagaCombatState => {
  const copy = structuredClone(combat) as SagaCombatState;
  copy.log = Array.isArray(copy.log) ? copy.log : [];
  copy.combatants = Array.isArray(copy.combatants) ? copy.combatants : [];
  copy.initiativeOrder = Array.isArray(copy.initiativeOrder) ? copy.initiativeOrder : [];
  copy.playerActions = { ...freshActions(), ...(copy.playerActions || {}) };
  return copy;
};

export function activeCombat(state: RecordValue): SagaCombatState | null {
  const combat = state.combat;
  return combat && typeof combat === "object" && !Array.isArray(combat) && (combat as SagaCombatState).status === "active"
    ? combat as SagaCombatState : null;
}

export function isAttackDeclaration(action: string) {
  return isExplicitAttackDeclaration(action);
}

export function isEndTurnDeclaration(action: string) {
  return /^(?:i\s+)?(?:end|finish)\s+(?:my\s+)?turn\b/i.test(action.trim());
}

export function isCombatMovementDeclaration(action: string) {
  return /^(?:i\s+)?(?:move|advance|retreat|withdraw|step|cross|take cover|stand up)\b/i.test(action.trim());
}

export function combatTargetName(action: string) {
  const match = action.match(/\b(?:attack|hit|punch|kick|strike|shoot|fire at|stab|slash|lunge at)\s+(?:the\s+|a\s+|an\s+)?([a-z][a-z '\-]{1,50})/i);
  const clean = match?.[1]?.replace(/\b(?:with|using|in|on|before|after)\b.*$/i, "").trim();
  return clean ? clean.replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Hostile opponent";
}

function playerDefenses(character: RecordValue) {
  const defenses = character.defenses && typeof character.defenses === "object" && !Array.isArray(character.defenses) ? character.defenses as RecordValue : {};
  const level = Math.max(1, Math.floor(numberField(character.level, 1)));
  return {
    reflex: numberField(defenses.reflex, 10 + level + abilityModifier(character, "DEX")),
    fortitude: numberField(defenses.fortitude, 10 + level + abilityModifier(character, "CON")),
    will: numberField(defenses.will, 10 + level + abilityModifier(character, "WIS")),
  };
}

function minorOpponent(name: string, level: number): Omit<Combatant, "initiative"> {
  const opponentLevel = Math.max(1, Math.min(20, level));
  const hp = 8 + opponentLevel * 4;
  return {
    id: `npc-${randomUUID()}`, name, side: "opposition", level: opponentLevel,
    hp, maxHp: hp, reflex: 11 + opponentLevel, fortitude: 11 + opponentLevel,
    will: 10 + opponentLevel, damageThreshold: 11 + opponentLevel,
    conditionTrack: 0, attackModifier: 1 + opponentLevel,
    damage: { count: 1, sides: 4, modifier: 1, type: "kinetic" },
  };
}

function npcAttackPlan(opponent: Combatant, playerReflex: number): SagaCheckPlan {
  return {
    needed: true, actor: "npc", kind: "attack", label: `${opponent.name} attack`,
    modifier: opponent.attackModifier, target: playerReflex, targetLabel: "Reflex Defense",
    targetVisible: false, reason: "Resolve the active opponent's attack on its turn.",
    stakes: "A hit deals the opponent's server-owned damage and may move the player down the Condition Track.",
    provisional: true, damage: opponent.damage,
  };
}

function resolveNpcAttack(combat: SagaCombatState, character: RecordValue, currentHealth: number, roller: Roller) {
  const opponent = combat.combatants.find((entry) => entry.side === "opposition" && entry.hp > 0);
  if (!opponent) return { roll: null, healthDelta: 0, conditionDelta: 0 };
  const defenses = playerDefenses(character);
  const roll = rollSagaCheck(npcAttackPlan(opponent, defenses.reflex), roller);
  const damage = Number((roll.damage as RecordValue | null)?.total || 0);
  const healthDelta = roll.outcome === "success" ? -Math.min(Math.max(0, currentHealth), damage) : 0;
  const threshold = numberField(character.damageThreshold, defenses.fortitude);
  const conditionDelta = damage >= threshold && damage > 0 ? 1 : 0;
  return { roll, healthDelta, conditionDelta };
}

export function beginCombat(
  action: string,
  character: RecordValue,
  gameState: RecordValue,
  playerInitiative: Record<string, unknown>,
  roller: Roller = randomInt,
): CombatResolution {
  const level = Math.max(1, Math.floor(numberField(character.level, 1)));
  const opponentBase = minorOpponent(combatTargetName(action), level);
  const npcInitiative = rollSagaCheck({
    needed: true, actor: "npc", kind: "initiative", label: `${opponentBase.name} Initiative`,
    modifier: Math.max(0, level), target: 1, targetLabel: "Initiative order", targetVisible: false,
    reason: "Establish the opponent's place in combat order.", stakes: "The higher total acts first.", damage: null,
  }, roller);
  const playerId = "pc-dmir";
  const opponent: Combatant = { ...opponentBase, initiative: npcInitiative.total };
  const defenses = playerDefenses(character);
  const player: Combatant = {
    id: playerId, name: String(character.name || "Player character"), side: "player", level,
    hp: numberField(gameState.health, 100), maxHp: numberField(character.maxHitPoints, 100),
    reflex: defenses.reflex, fortitude: defenses.fortitude, will: defenses.will,
    damageThreshold: numberField(character.damageThreshold, defenses.fortitude),
    conditionTrack: numberField(gameState.conditionTrack, 0), initiative: numberField(playerInitiative.total, 0),
    attackModifier: numberField(character.baseAttackBonus, 0) + abilityModifier(character, "STR"),
    damage: { count: 1, sides: 4, modifier: abilityModifier(character, "STR"), type: "kinetic" },
  };
  const order = [player, opponent].sort((a, b) => b.initiative - a.initiative || (a.side === "player" ? -1 : 1));
  const combat: SagaCombatState = {
    id: randomUUID(), status: "active", round: 1, activeSide: order[0].side,
    initiativeOrder: order.map((entry) => entry.id), combatants: [player, opponent], playerActions: freshActions(),
    log: [{ kind: "initiative", player: player.initiative, opponent: opponent.initiative }], startedAt: new Date().toISOString(),
  };
  const rolls: Array<Record<string, unknown>> = [npcInitiative];
  let playerHealthDelta = 0, playerConditionDelta = 0;
  if (combat.activeSide === "opposition") {
    const response = resolveNpcAttack(combat, character, numberField(gameState.health, 100), roller);
    if (response.roll) rolls.push(response.roll);
    playerHealthDelta = response.healthDelta;
    playerConditionDelta = response.conditionDelta;
    combat.log.push({ kind: "npc-turn", round: 1, rollId: response.roll?.id, healthDelta: playerHealthDelta, conditionDelta: playerConditionDelta });
    combat.activeSide = playerHealthDelta <= -numberField(gameState.health, 100) ? "none" : "player";
    if (combat.activeSide === "none") { combat.status = "player_defeated"; combat.endedAt = new Date().toISOString(); }
  }
  return { combat, rolls, playerHealthDelta, playerConditionDelta, experienceAward: 0, summary: `Combat began against ${opponent.name}; initiative order is established.` };
}

export function resolvePlayerAttack(
  combatInput: SagaCombatState,
  playerRoll: Record<string, unknown>,
): CombatResolution {
  const combat = copyCombat(combatInput);
  if (combat.status !== "active" || combat.activeSide !== "player") throw new Error("It is not the player's turn.");
  if (combat.playerActions.standard < 1) throw new Error("The standard action for this turn has already been spent.");
  const opponent = combat.combatants.find((entry) => entry.side === "opposition" && entry.hp > 0);
  if (!opponent) throw new Error("No active opponent remains.");
  combat.playerActions.standard = 0;
  const damage = playerRoll.outcome === "success" ? Number((playerRoll.damage as RecordValue | null)?.total || 0) : 0;
  opponent.hp = Math.max(0, opponent.hp - damage);
  if (damage >= opponent.damageThreshold && damage > 0) opponent.conditionTrack = Math.min(5, opponent.conditionTrack + 1);
  combat.log.push({ kind: "player-attack", round: combat.round, rollId: playerRoll.id, targetId: opponent.id, damage, remainingHp: opponent.hp });
  let experienceAward = 0;
  if (opponent.hp === 0) {
    combat.status = "player_victory";
    combat.activeSide = "none";
    combat.endedAt = new Date().toISOString();
    experienceAward = 200 * opponent.level;
  }
  return { combat, rolls: [], playerHealthDelta: 0, playerConditionDelta: 0, experienceAward, summary: opponent.hp === 0 ? `${opponent.name} was defeated.` : `${opponent.name} has ${opponent.hp}/${opponent.maxHp} HP remaining.` };
}

export function spendPlayerMove(combatInput: SagaCombatState, action: string): CombatResolution {
  const combat = copyCombat(combatInput);
  if (combat.status !== "active" || combat.activeSide !== "player") throw new Error("It is not the player's turn.");
  if (combat.playerActions.move < 1) throw new Error("The move action for this turn has already been spent.");
  combat.playerActions.move = 0;
  combat.log.push({ kind: "player-move", round: combat.round, declaration: action.slice(0, 240) });
  return { combat, rolls: [], playerHealthDelta: 0, playerConditionDelta: 0, experienceAward: 0, summary: "The player's declared movement spent the move action; position remains governed by the narrated scene." };
}

export function endPlayerTurn(
  combatInput: SagaCombatState,
  character: RecordValue,
  currentHealth: number,
  roller: Roller = randomInt,
): CombatResolution {
  const combat = copyCombat(combatInput);
  if (combat.status !== "active" || combat.activeSide !== "player") throw new Error("There is no player turn to end.");
  combat.activeSide = "opposition";
  const response = resolveNpcAttack(combat, character, currentHealth, roller);
  combat.log.push({ kind: "npc-turn", round: combat.round, rollId: response.roll?.id, healthDelta: response.healthDelta, conditionDelta: response.conditionDelta });
  const defeated = response.healthDelta <= -Math.max(0, currentHealth);
  if (defeated) {
    combat.status = "player_defeated";
    combat.activeSide = "none";
    combat.endedAt = new Date().toISOString();
  } else {
    combat.round += 1;
    combat.activeSide = "player";
    combat.playerActions = freshActions();
  }
  return { combat, rolls: response.roll ? [response.roll] : [], playerHealthDelta: response.healthDelta, playerConditionDelta: response.conditionDelta, experienceAward: 0, summary: defeated ? "The player character was reduced to 0 HP." : `Round ${combat.round} begins with the player.` };
}
