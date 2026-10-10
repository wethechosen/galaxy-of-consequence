import { randomInt, randomUUID } from "node:crypto";
import { rollSagaCheck, type SagaCheckPlan } from "./saga-dice";
import { isHostileAttackDeclaration } from "./gpt-turn-intent";
import { positiveActionText } from "./action-intent";
import { sagaArmorDefenseAdjustments, sagaEquipmentAttackModifier } from "./saga-character";

type RecordValue = Record<string, unknown>;
type Roller = (min: number, max: number) => number;

export type CombatActions = { standard: number; move: number; swift: number; reaction: number };
export type CombatCover = "none" | "cover" | "improved" | "total";
export type Combatant = {
  id: string; name: string; side: "player" | "opposition"; level: number;
  hp: number; maxHp: number; reflex: number; fortitude: number; will: number;
  damageThreshold: number; conditionTrack: number; initiative: number;
  attackModifier: number; damage: { count: number; sides: number; modifier: number; type: string };
  initiativeModifier?: number; cover?: CombatCover; coverAgainst?: string[];
  persistentCondition?: boolean; defenseBonus?: number;
  aimTargetId?: string; recoverySwiftActions?: number; recoveryLastRound?: number;
  secondWindLastDay?: string; secondWindUsedInEncounter?: boolean;
  attackMode?: "melee" | "ranged";
  prone?: boolean;
  battleStrike?: { attackBonus: number; damageDice: number; expiresRound: number };
};
export type SagaCombatState = {
  id: string; status: "active" | "player_victory" | "player_defeated" | "escaped";
  round: number; activeSide: "player" | "opposition" | "none";
  initiativeOrder: string[]; combatants: Combatant[]; playerActions: CombatActions;
  log: Array<Record<string, unknown>>; startedAt: string; endedAt?: string;
  resourceDay?: string;
};

export type CombatResolution = {
  combat: SagaCombatState;
  rolls: Array<Record<string, unknown>>;
  playerHealthDelta: number;
  playerConditionDelta: number;
  experienceAward: number;
  summary: string;
  accepted?: boolean;
  /** Server-owned non-ledger state, merged after the validated provider delta. */
  stateDelta?: Record<string, unknown>;
};

export type CombatActionKind = "attack" | "move" | "withdraw" | "aim" | "recover" | "second_wind" | "total_defense" | "end_turn" | "standard" | "swift" | "power";
export type CombatActionRequest = {
  kind: CombatActionKind; action?: string; targetId?: string; swiftActions?: number;
  dayId?: string; cover?: CombatCover; coverEstablished?: boolean;
  /** Only the authoritative scene can establish an actual escape or threat geometry. */
  escapeConfirmed?: boolean; escapeReason?: string; squaresToClearThreat?: number;
  metadata?: Record<string, unknown>;
  actionType?: "standard" | "move" | "swift" | "free" | "reaction";
};
export type CombatActionContext = {
  character?: RecordValue; currentHealth?: number; playerRoll?: Record<string, unknown>;
  roller?: Roller; dayId?: string;
};

// Saga Core, printed pp. 146, 149, 152-154, 157-158 (PDF pp. 154, 157, 160-162,
// 165-166). The supplied pages were inspected for conditions, action exchange,
// second wind, recovery, defensive fighting, aiming, withdrawal and cover.
export function conditionPenalty(conditionTrack: number): number {
  return [0, -1, -2, -5, -10, -10][Math.max(0, Math.min(5, Math.floor(conditionTrack)))] ?? 0;
}

export function combatantReflex(combatant: Combatant, attackerId?: string, ignoreCover = false): number {
  const applies = !combatant.coverAgainst?.length || (attackerId && combatant.coverAgainst.includes(attackerId));
  const cover = !ignoreCover && applies ? combatant.cover === "improved" ? 10 : combatant.cover === "cover" ? 5 : 0 : 0;
  return Math.max(1, combatant.reflex + conditionPenalty(combatant.conditionTrack) + (combatant.defenseBonus || 0) + cover);
}

export function combatAttackContext(combat: SagaCombatState, target: Combatant, ranged: boolean) {
  const player = playerCombatant(combat);
  const aiming = Boolean(ranged && player?.aimTargetId === target.id);
  return {
    conditionModifier: conditionPenalty(player?.conditionTrack || 0),
    situationalModifier: (player?.prone && !ranged ? -5 : 0) + (target.prone ? ranged ? -5 : 5 : 0),
    targetReflex: combatantReflex(target, player?.id, aiming),
    ignoresCover: aiming,
  };
}

export function selectCombatTarget(combat: SagaCombatState, declarationOrId?: string): Combatant | null {
  const opponents = combat.combatants.filter(entry => entry.side === "opposition" && entry.hp > 0 && entry.conditionTrack < 5);
  if (!declarationOrId) return opponents.length === 1 ? opponents[0] : null;
  const direct = opponents.find(entry => entry.id === declarationOrId || entry.name.toLowerCase() === declarationOrId.toLowerCase());
  if (direct) return direct;
  const declaration = positiveActionText(declarationOrId).toLowerCase();
  const named = opponents.filter(entry => declaration.includes(entry.name.toLowerCase()));
  return named.length === 1 ? named[0] : opponents.length === 1 ? opponents[0] : null;
}

function playerCombatant(combat: SagaCombatState): Combatant | undefined {
  return combat.combatants.find(entry => entry.side === "player");
}

function actionCost(actions: CombatActions, kind: CombatActionKind, swiftCount = 1): Partial<CombatActions> | null {
  if (kind === "end_turn") return {};
  if (kind === "attack" || kind === "total_defense" || kind === "standard") return actions.standard > 0 ? { standard: 1 } : null;
  if (kind === "move" || kind === "withdraw") {
    return actions.move > 0 ? { move: 1 } : actions.standard > 0 ? { standard: 1 } : null;
  }
  let remaining = kind === "aim" ? 2 : kind === "recover" ? swiftCount : 1;
  const cost: Partial<CombatActions> = {};
  for (const slot of ["swift", "move", "standard"] as const) {
    const spend = Math.min(Math.max(0, actions[slot]), remaining);
    if (spend) cost[slot] = spend;
    remaining -= spend;
  }
  return remaining === 0 ? cost : null;
}

function constitutionScore(character: RecordValue): number | null {
  const abilities = character.abilities && typeof character.abilities === "object" ? character.abilities as RecordValue : {};
  const value = abilities.constitution ?? abilities.CON ?? character.constitution;
  if (value !== undefined && Number.isFinite(Number(value))) return Number(value);
  const match = String(character.sagaStats || "").match(/\bCON\s*(\d+)/i);
  return match ? Number(match[1]) : null;
}

export function preflightCombatAction(combatInput: SagaCombatState, request: CombatActionRequest, context: CombatActionContext = {}) {
  const combat = copyCombat(combatInput);
  const player = playerCombatant(combat);
  const fail = (reason: string) => ({ allowed: false as const, reason, cost: {} as Partial<CombatActions>, availableActions: combat.playerActions });
  if (combat.status !== "active" || combat.activeSide !== "player") return fail("It is not your turn in an active encounter.");
  if (!player || player.hp <= 0 || player.conditionTrack >= 5) return fail("You are unconscious or unable to act.");
  if (request.kind === "attack" || request.kind === "aim") {
    const target = selectCombatTarget(combat, request.targetId || request.action);
    if (!target) return fail("Choose which visible opponent you are targeting.");
    if (request.kind === "attack" && (player.defenseBonus || 0) > 0) return fail("Your defensive stance commits you to no attacks until your next turn.");
    if (target.cover === "total" && (!target.coverAgainst?.length || target.coverAgainst.includes(player.id))) return fail("The target is fully behind cover; change your line of effect before attacking.");
  }
  if (request.kind === "withdraw" && (request.squaresToClearThreat ?? 1) > 1) return fail("This position cannot be cleared in one square; ordinary movement is possible but may provoke an attack of opportunity.");
  if (request.kind === "recover") {
    if (player.conditionTrack < 1) return fail("Your condition is already normal.");
    if (player.persistentCondition) return fail("The cause of your persistent condition must be treated before you can recover.");
    if (!Number.isInteger(request.swiftActions ?? 1) || (request.swiftActions ?? 1) < 1 || (request.swiftActions ?? 1) > 3) return fail("Recovery uses one to three declared swift actions.");
  }
  if (request.kind === "second_wind") {
    const currentHealth = context.currentHealth ?? player.hp;
    const character = context.character || {};
    const day = request.dayId || context.dayId || combat.resourceDay || "campaign-day-1";
    if (currentHealth > Math.floor(player.maxHp / 2)) return fail("You can catch a second wind when you are at half your maximum HP or lower.");
    if (currentHealth <= 0) return fail("You cannot catch a second wind while unconscious.");
    if (character.heroic === false || String(character.class || "").toLowerCase() === "nonheroic") return fail("Second wind requires a heroic character.");
    if (player.secondWindUsedInEncounter || player.secondWindLastDay === day) return fail("Your second wind has already been used today or in this encounter.");
    if (constitutionScore(character) === null) return fail("Establish your Constitution score in your character build so your second wind can be resolved.");
  }
  const powerAction = request.actionType || "standard";
  const cost = request.kind === "power" && ["free", "reaction"].includes(powerAction) ? {} : actionCost(combat.playerActions, request.kind === "power" ? powerAction as CombatActionKind : request.kind, request.swiftActions ?? 1);
  if (!cost) return fail(`You have no remaining actions for that ${request.kind.replace(/_/g, " ")}; end your turn to act in the next round.`);
  return { allowed: true as const, reason: "The declared action fits your remaining actions.", cost, availableActions: combat.playerActions };
}

function spendCost(combat: SagaCombatState, cost: Partial<CombatActions>) {
  for (const slot of Object.keys(cost) as Array<keyof CombatActions>) combat.playerActions[slot] -= cost[slot] || 0;
}

function noChange(combat: SagaCombatState, reason: string): CombatResolution {
  return { combat, rolls: [], playerHealthDelta: 0, playerConditionDelta: 0, experienceAward: 0, summary: reason, accepted: false };
}

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
  return isHostileAttackDeclaration(action);
}

export function isCombatWithdrawDeclaration(action: string) {
  const clean = positiveActionText(action);
  if (!clean) return false;
  if (/\b(?:withdraw|disengage|break contact|flee|escape|leave combat|exit combat|end combat)\b/i.test(clean)) return true;
  if (/\b(?:turn(?:s|ed|ing)? around|fall(?:s|ing)? back|head(?:s|ed|ing)? back)\b/i.test(clean)) return true;
  const movement = /\b(?:go|head|move|climb|travel|leave|depart|return|continue|push)\w*\b/i.test(clean);
  const away = /\b(?:away|out|upward|higher|back up|past the prison|leave 1313|market|shelter|populated level|civilian district)\b/i.test(clean);
  return movement && away;
}

export function isEndTurnDeclaration(action: string) {
  const clean = positiveActionText(action);
  if (/^(?:continue|proceed|next|next turn|continue combat)$/i.test(clean)) return true;
  return /\b(?:end|ends|finish|finishes|pass|passes)\s+(?:(?:my|his|her|their|the)\s+)?turn\b/i.test(clean);
}

export function isCombatMovementDeclaration(action: string) {
  const clean = positiveActionText(action);
  if (/^(?:i\s+)?(?:move|advance|retreat|withdraw|step|cross|take cover|stand up)\b/i.test(clean)) return true;
  if (/^d(?:'|\u2019)?mir\b/i.test(clean) && /\b(?:move|moves|advance|advances|retreat|retreats|withdraw|withdraws|step|steps|cross|crosses|stand|stands)\b/i.test(clean)) return true;
  if (/\bmove action\b/i.test(clean) && /\b(?:move|advance|retreat|withdraw|step|cross|stand|take)\b/i.test(clean)) return true;
  return /\btake(?:s)?\b[^.]{0,80}\bcover\b/i.test(clean);
}

export function combatTargetName(action: string) {
  const match = action.match(/\b(?:attack|hit|punch|kick|strike|shoot(?:\s+at)?|fire\s+at|stab|slash|lunge\s+at)\s+(?:the\s+|a\s+|an\s+)?([a-z][a-z '\-]{1,50})/i);
  const clean = match?.[1]?.replace(/\b(?:with|using|in|on|before|after)\b.*$/i, "").trim();
  return clean ? clean.replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Hostile opponent";
}

function playerDefenses(character: RecordValue) {
  const defenses = character.defenses && typeof character.defenses === "object" && !Array.isArray(character.defenses) ? character.defenses as RecordValue : {};
  const level = Math.max(1, Math.floor(numberField(character.level, 1)));
  const armor = sagaArmorDefenseAdjustments(character);
  return {
    reflex: numberField(defenses.reflex, 10 + level + abilityModifier(character, "DEX")) + armor.reflex,
    fortitude: numberField(defenses.fortitude, 10 + level + abilityModifier(character, "CON")) + armor.fortitude,
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
    modifier: opponent.attackModifier + conditionPenalty(opponent.conditionTrack) + (opponent.prone && opponent.attackMode !== "ranged" ? -5 : 0), target: playerReflex, targetLabel: "Reflex Defense",
    targetVisible: false, reason: "Resolve the active opponent's attack on its turn.",
    stakes: "A hit deals the opponent's server-owned damage and may move the player down the Condition Track.",
    provisional: true, damage: opponent.damage,
  };
}

function resolveNpcAttack(combat: SagaCombatState, opponent: Combatant, currentHealth: number, roller: Roller) {
  const player = playerCombatant(combat);
  if (!player || player.hp <= 0 || player.conditionTrack >= 5 || opponent.hp <= 0 || opponent.conditionTrack >= 5) return { roll: null, healthDelta: 0, conditionDelta: 0 };
  if (player.cover === "total" && (!player.coverAgainst?.length || player.coverAgainst.includes(opponent.id))) return { roll: null, healthDelta: 0, conditionDelta: 0 };
  const ranged = opponent.attackMode === "ranged";
  const target = combatantReflex(player, opponent.id) + (player.prone ? ranged ? 5 : -5 : 0);
  const roll = rollSagaCheck(npcAttackPlan(opponent, Math.max(1, target)), roller);
  const damage = Number((roll.damage as RecordValue | null)?.total || 0);
  const healthDelta = roll.outcome === "success" ? -Math.min(Math.max(0, currentHealth), damage) : 0;
  const threshold = Math.max(1, player.damageThreshold + conditionPenalty(player.conditionTrack));
  const oldCondition = player.conditionTrack;
  player.hp = Math.max(0, currentHealth + healthDelta);
  if (player.hp === 0) player.conditionTrack = 5;
  else if (damage >= threshold && damage > 0) player.conditionTrack = Math.min(5, player.conditionTrack + 1);
  const conditionDelta = player.conditionTrack - oldCondition;
  return { roll, healthDelta, conditionDelta };
}

function orderedOpponents(combat: SagaCombatState, ids?: string[]): Combatant[] {
  const order = ids || combat.initiativeOrder;
  return [...combat.combatants].filter(entry => entry.side === "opposition" && entry.hp > 0 && entry.conditionTrack < 5)
    .filter(entry => !ids || ids.includes(entry.id))
    .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}

function oppositionTurns(combat: SagaCombatState, currentHealth: number, roller: Roller, ids?: string[]) {
  const rolls: Array<Record<string, unknown>> = [];
  let healthDelta = 0, conditionDelta = 0;
  for (const opponent of orderedOpponents(combat, ids)) {
    const player = playerCombatant(combat);
    if (!player || player.hp <= 0 || player.conditionTrack >= 5) break;
    const response = resolveNpcAttack(combat, opponent, currentHealth + healthDelta, roller);
    if (response.roll) rolls.push(response.roll);
    healthDelta += response.healthDelta;
    conditionDelta += response.conditionDelta;
    combat.log.push({ kind: "npc-turn", actorId: opponent.id, round: combat.round, rollId: response.roll?.id, healthDelta: response.healthDelta, conditionDelta: response.conditionDelta });
  }
  return { rolls, healthDelta, conditionDelta };
}

export function beginCombat(
  action: string,
  character: RecordValue,
  gameState: RecordValue,
  playerInitiative: Record<string, unknown>,
  roller: Roller = randomInt,
  establishedOpponents?: Array<Omit<Combatant, "initiative"> & { initiative?: number }>,
): CombatResolution {
  const level = Math.max(1, Math.floor(numberField(character.level, 1)));
  const bases: Array<Omit<Combatant, "initiative"> & { initiative?: number }> = establishedOpponents?.length ? establishedOpponents : [minorOpponent(combatTargetName(action), level)];
  const rolls: Array<Record<string, unknown>> = [];
  const opponents: Combatant[] = bases.map(opponentBase => {
    if (opponentBase.initiative !== undefined) return { ...opponentBase, initiative: opponentBase.initiative };
    const npcInitiative = rollSagaCheck({
      needed: true, actor: "npc", kind: "initiative", label: `${opponentBase.name} Initiative`,
      modifier: opponentBase.initiativeModifier ?? Math.max(0, opponentBase.level), target: 1, targetLabel: "Initiative order", targetVisible: false,
      reason: "Establish the opponent's place in combat order.", stakes: "The higher total acts first.", damage: null,
    }, roller);
    rolls.push(npcInitiative);
    return { ...opponentBase, initiative: npcInitiative.total };
  });
  const playerId = "pc-dmir";
  const defenses = playerDefenses(character);
  const player: Combatant = {
    id: playerId, name: String(character.name || "Player character"), side: "player", level,
    hp: numberField(gameState.health, 100), maxHp: numberField(character.maxHitPoints, 100),
    reflex: defenses.reflex, fortitude: defenses.fortitude, will: defenses.will,
    damageThreshold: numberField(character.damageThreshold, defenses.fortitude),
    conditionTrack: numberField(gameState.conditionTrack, 0), initiative: numberField(playerInitiative.total, 0),
    initiativeModifier: numberField(playerInitiative.modifier, abilityModifier(character, "DEX")),
    persistentCondition: gameState.persistentCondition === true,
    secondWindLastDay: typeof gameState.secondWindLastDay === "string" ? gameState.secondWindLastDay : undefined,
    attackModifier: numberField(character.baseAttackBonus, 0) + abilityModifier(character, "STR") + sagaEquipmentAttackModifier(character),
    damage: { count: 1, sides: 4, modifier: abilityModifier(character, "STR"), type: "kinetic" },
  };
  const order = [player, ...opponents].sort((a, b) => b.initiative - a.initiative || (b.initiativeModifier || 0) - (a.initiativeModifier || 0) || roller(0, 2) * 2 - 1);
  const combat: SagaCombatState = {
    id: randomUUID(), status: "active", round: 1, activeSide: order[0].side,
    initiativeOrder: order.map((entry) => entry.id), combatants: [player, ...opponents], playerActions: freshActions(),
    log: [{ kind: "initiative", player: player.initiative, opponents: opponents.map(opponent => ({ id: opponent.id, initiative: opponent.initiative })) }], startedAt: new Date().toISOString(),
    resourceDay: typeof gameState.resourceDay === "string" ? gameState.resourceDay : "campaign-day-1",
  };
  let playerHealthDelta = 0, playerConditionDelta = 0;
  if (combat.activeSide === "opposition") {
    const beforePlayer = combat.initiativeOrder.slice(0, combat.initiativeOrder.indexOf(playerId));
    const response = oppositionTurns(combat, numberField(gameState.health, 100), roller, beforePlayer);
    rolls.push(...response.rolls);
    playerHealthDelta = response.healthDelta;
    playerConditionDelta = response.conditionDelta;
    combat.activeSide = player.hp <= 0 || player.conditionTrack >= 5 ? "none" : "player";
    if (combat.activeSide === "none") { combat.status = "player_defeated"; combat.endedAt = new Date().toISOString(); }
  }
  return { combat, rolls, playerHealthDelta, playerConditionDelta, experienceAward: 0, summary: `Combat began against ${opponents.map(opponent => opponent.name).join(", ")}; initiative order is established.` };
}

export function resolvePlayerAttack(
  combatInput: SagaCombatState,
  playerRoll: Record<string, unknown>,
  targetId?: string,
): CombatResolution {
  const combat = copyCombat(combatInput);
  if (combat.status !== "active" || combat.activeSide !== "player") throw new Error("It is not the player's turn.");
  if (combat.playerActions.standard < 1) throw new Error("The standard action for this turn has already been spent.");
  const opponent = selectCombatTarget(combat, targetId || String(playerRoll.targetId || ""));
  if (!opponent) throw new Error("Choose a living opponent as the attack target.");
  combat.playerActions.standard = 0;
  const player = playerCombatant(combat);
  if (player) player.aimTargetId = undefined;
  const damage = playerRoll.outcome === "success" ? Number((playerRoll.damage as RecordValue | null)?.total || 0) : 0;
  opponent.hp = Math.max(0, opponent.hp - damage);
  if (opponent.hp === 0) opponent.conditionTrack = 5;
  else if (damage >= Math.max(1, opponent.damageThreshold + conditionPenalty(opponent.conditionTrack)) && damage > 0) opponent.conditionTrack = Math.min(5, opponent.conditionTrack + 1);
  combat.log.push({ kind: "player-attack", round: combat.round, rollId: playerRoll.id, targetId: opponent.id, damage, remainingHp: opponent.hp });
  let experienceAward = 0;
  const allDefeated = combat.combatants.filter(entry => entry.side === "opposition").every(entry => entry.hp <= 0 || entry.conditionTrack >= 5);
  if (allDefeated) {
    combat.status = "player_victory";
    combat.activeSide = "none";
    combat.endedAt = new Date().toISOString();
    experienceAward = combat.combatants.filter(entry => entry.side === "opposition").reduce((sum, entry) => sum + 200 * entry.level, 0);
  }
  return { combat, rolls: [], playerHealthDelta: 0, playerConditionDelta: 0, experienceAward, summary: opponent.hp === 0 || opponent.conditionTrack >= 5 ? `${opponent.name} was defeated.${allDefeated ? " The encounter is over." : " Other opponents remain in the encounter."}` : `${opponent.name} has ${opponent.hp}/${opponent.maxHp} HP remaining.` };
}

export function spendPlayerMove(combatInput: SagaCombatState, action: string): CombatResolution {
  const combat = copyCombat(combatInput);
  if (combat.status !== "active" || combat.activeSide !== "player") throw new Error("It is not the player's turn.");
  const cost = actionCost(combat.playerActions, "move");
  if (!cost) throw new Error("The move action and any standard-action substitute have already been spent.");
  spendCost(combat, cost);
  const player = playerCombatant(combat);
  if (player) player.aimTargetId = undefined;
  combat.log.push({ kind: "player-move", round: combat.round, declaration: action.slice(0, 240) });
  return { combat, rolls: [], playerHealthDelta: 0, playerConditionDelta: 0, experienceAward: 0, summary: "The player's declared movement spent the move action; position remains governed by the narrated scene." };
}

/** Withdrawal clears a threatened square; the scene must establish actual escape. */
export function withdrawFromCombat(combatInput: SagaCombatState, action: string, options: Pick<CombatActionRequest, "escapeConfirmed" | "escapeReason" | "squaresToClearThreat"> = {}): CombatResolution {
  const combat = copyCombat(combatInput);
  if (combat.status !== "active" || combat.activeSide !== "player") throw new Error("It is not the player's turn.");
  const cost = actionCost(combat.playerActions, "withdraw");
  if (!cost) throw new Error("The move action and any standard-action substitute have already been spent.");
  if ((options.squaresToClearThreat ?? 1) > 1) throw new Error("Withdrawal requires clearing all threatened areas in the first square.");
  spendCost(combat, cost);
  const player = playerCombatant(combat);
  if (player) player.aimTargetId = undefined;
  const escape = (options.escapeConfirmed === true && Boolean(options.escapeReason?.trim())) || orderedOpponents(combat).length === 0;
  if (escape) {
    combat.status = "escaped";
    combat.activeSide = "none";
    combat.endedAt = new Date().toISOString();
  }
  if (player?.battleStrike) player.battleStrike = undefined;
  combat.log.push({
    kind: "player-withdraw",
    round: combat.round,
    declaration: action.slice(0, 240),
    distance: "half-speed",
    attackOfOpportunityAvoided: "first-square",
    escaped: escape, escapeReason: escape ? options.escapeReason : undefined,
  });
  return {
    combat,
    rolls: [],
    playerHealthDelta: 0,
    playerConditionDelta: 0,
    experienceAward: 0,
    summary: escape ? "You withdraw along the established escape route and break contact. No victory or XP is awarded." : "You withdraw by up to half your speed, clearing the immediate threat in the first square. Opponents remain in the encounter and may pursue; attacks of opportunity can still apply beyond that first square.",
  };
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
  const player = playerCombatant(combat);
  if (player) player.hp = Math.max(0, currentHealth);
  const playerIndex = combat.initiativeOrder.findIndex(id => id === player?.id);
  const after = combat.initiativeOrder.slice(playerIndex + 1);
  const before = combat.initiativeOrder.slice(0, playerIndex);
  const response = oppositionTurns(combat, currentHealth, roller, [...after, ...before]);
  const defeated = !player || player.hp <= 0 || player.conditionTrack >= 5;
  if (defeated) {
    combat.status = "player_defeated";
    combat.activeSide = "none";
    combat.endedAt = new Date().toISOString();
  } else {
    combat.round += 1;
    combat.activeSide = "player";
    combat.playerActions = freshActions();
    if (player) {
      player.defenseBonus = 0;
      player.aimTargetId = undefined;
      if ((player.recoveryLastRound ?? 0) < combat.round - 1) player.recoverySwiftActions = 0;
    }
  }
  return { combat, rolls: response.rolls, playerHealthDelta: response.healthDelta, playerConditionDelta: response.conditionDelta, experienceAward: 0, summary: defeated ? "The player character can no longer act." : `Each active opponent completes its turn; round ${combat.round} begins with the player.` };
}

/** Apply server-owned mechanics after preflight; exhausted slots return a playable response. */
export function resolveCombatAction(combatInput: SagaCombatState, request: CombatActionRequest, context: CombatActionContext = {}): CombatResolution {
  const combat = copyCombat(combatInput);
  const preflight = preflightCombatAction(combat, request, context);
  if (!preflight.allowed) return noChange(combat, preflight.reason);
  if (request.kind === "attack") {
    if (!context.playerRoll) return noChange(combat, "The attack awaits its server-owned Saga roll.");
    return { ...resolvePlayerAttack(combat, context.playerRoll, selectCombatTarget(combat, request.targetId || request.action)?.id), accepted: true };
  }
  if (request.kind === "end_turn") return { ...endPlayerTurn(combat, context.character || {}, context.currentHealth ?? playerCombatant(combat)!.hp, context.roller), accepted: true };
  if (request.kind === "withdraw") return { ...withdrawFromCombat(combat, request.action || "Withdraw", request), accepted: true };
  if (request.kind === "move") {
    const resolution = spendPlayerMove(combat, request.action || "Move");
    const player = playerCombatant(resolution.combat)!;
    if (request.coverEstablished && request.cover) player.cover = request.cover;
    if (/\bstand(?:\s+up)?\b/i.test(request.action || "")) player.prone = false;
    return { ...resolution, accepted: true };
  }
  const player = playerCombatant(combat)!;
  spendCost(combat, preflight.cost);
  if (request.kind !== "aim") player.aimTargetId = undefined;
  let playerHealthDelta = 0, playerConditionDelta = 0, summary = "The declared action is spent; its effect must be resolved by the governing mechanic.";
  if (request.kind === "aim") {
    const target = selectCombatTarget(combat, request.targetId || request.action)!;
    player.aimTargetId = target.id;
    summary = `You spend two consecutive swift actions aiming at ${target.name}. Your next ranged attack ignores its cover bonus while line of sight remains; another action breaks your aim.`;
  } else if (request.kind === "recover") {
    const previous = (player.recoveryLastRound ?? combat.round) >= combat.round - 1 ? player.recoverySwiftActions || 0 : 0;
    const total = previous + (request.swiftActions ?? 1);
    player.recoveryLastRound = combat.round;
    player.recoverySwiftActions = total % 3;
    const improved = Math.min(player.conditionTrack, Math.floor(total / 3));
    player.conditionTrack -= improved;
    playerConditionDelta = -improved;
    summary = improved ? "You recover one step on the condition track." : `You devote ${total}/3 swift actions to recovery; continue on your next consecutive turn.`;
  } else if (request.kind === "second_wind") {
    const hp = context.currentHealth ?? player.hp;
    const constitution = constitutionScore(context.character || {})!;
    const constitutionModifier = Math.floor((constitution - 10) / 2);
    const healing = Math.max(Math.floor(player.maxHp / 4), constitutionModifier);
    playerHealthDelta = Math.max(0, Math.min(player.maxHp - hp, healing));
    player.hp = hp + playerHealthDelta;
    player.secondWindLastDay = request.dayId || context.dayId || combat.resourceDay || "campaign-day-1";
    player.secondWindUsedInEncounter = true;
    summary = `You catch a second wind and regain ${playerHealthDelta} HP. This daily use is spent.`;
  } else if (request.kind === "total_defense") {
    const rawSkills = context.character?.trainedSkills;
    const skills = Array.isArray(rawSkills) ? rawSkills : [];
    const acrobatics = skills.some(skill => String(skill).toLowerCase() === "acrobatics");
    player.defenseBonus = acrobatics ? 10 : 5;
    summary = `You commit to defensive fighting with no attacks until your next turn, gaining +${player.defenseBonus} dodge Reflex Defense.`;
  }
  combat.log.push({ kind: `player-${request.kind}`, round: combat.round, cost: preflight.cost, declaration: request.action?.slice(0, 240), targetId: request.targetId, metadata: request.metadata, playerHealthDelta, playerConditionDelta });
  return { combat, rolls: [], playerHealthDelta, playerConditionDelta, experienceAward: 0, summary, accepted: true };
}
