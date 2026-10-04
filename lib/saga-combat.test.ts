import { describe, expect, it } from "vitest";
import { beginCombat, endPlayerTurn, isCombatMovementDeclaration, isEndTurnDeclaration, resolvePlayerAttack, spendPlayerMove, type SagaCombatState } from "./saga-combat";

const character = {
  name: "D'mir Holloran", level: 1,
  sagaStats: "STR 12 | DEX 14 | CON 10 | INT 12 | WIS 10 | CHA 11",
  baseAttackBonus: 0, maxHitPoints: 18, damageThreshold: 12,
  defenses: { reflex: 13, fortitude: 12, will: 11 },
};

function sequence(...values: number[]) {
  let index = 0;
  return (min: number, max: number) => Math.min(max - 1, Math.max(min, values[index++] ?? min));
}

function activeFixture(): SagaCombatState {
  return {
    id: "combat-1", status: "active", round: 1, activeSide: "player",
    initiativeOrder: ["pc-dmir", "npc-1"], playerActions: { standard: 1, move: 1, swift: 1, reaction: 1 },
    startedAt: "2026-09-30T00:00:00.000Z", log: [],
    combatants: [
      { id: "pc-dmir", name: "D'mir Holloran", side: "player", level: 1, hp: 18, maxHp: 18, reflex: 13, fortitude: 12, will: 11, damageThreshold: 12, conditionTrack: 0, initiative: 18, attackModifier: 1, damage: { count: 1, sides: 4, modifier: 1, type: "kinetic" } },
      { id: "npc-1", name: "Guard", side: "opposition", level: 1, hp: 12, maxHp: 12, reflex: 12, fortitude: 12, will: 11, damageThreshold: 12, conditionTrack: 0, initiative: 10, attackModifier: 2, damage: { count: 1, sides: 4, modifier: 1, type: "kinetic" } },
    ],
  };
}

describe("Saga combat intent normalization", () => {
  it("recognizes player and controller phrasing for ending a turn", () => {
    expect(isEndTurnDeclaration("I end my turn")).toBe(true);
    expect(isEndTurnDeclaration("D'mir ends his turn without taking further actions.")).toBe(true);
    expect(isEndTurnDeclaration("continue")).toBe(true);
    expect(isEndTurnDeclaration("I continue aiming at the guard")).toBe(false);
  });

  it("recognizes controller-rewritten move declarations", () => {
    expect(isCombatMovementDeclaration("I take cover")).toBe(true);
    expect(isCombatMovementDeclaration("D'mir moves into melee range with the guard.")).toBe(true);
    expect(isCombatMovementDeclaration("D'mir uses his remaining Move action to take the best available cover from the guard.")).toBe(true);
    expect(isCombatMovementDeclaration("D'mir studies the cover without moving.")).toBe(false);
  });
});

describe("Saga combat authority", () => {
  it("establishes initiative and leaves the opening attack unresolved when the player wins", () => {
    const result = beginCombat("I punch the guard", character, { health: 18, conditionTrack: 0 }, { total: 19 }, sequence(5));
    expect(result.combat).toMatchObject({ status: "active", round: 1, activeSide: "player" });
    expect(result.combat.combatants.find((entry) => entry.side === "opposition")?.hp).toBe(12);
    expect(result.rolls).toHaveLength(1);
  });

  it("resolves an opposition opening turn when it wins initiative", () => {
    const result = beginCombat("I punch the guard", character, { health: 18, conditionTrack: 0 }, { total: 2 }, sequence(18, 18, 4));
    expect(result.rolls).toHaveLength(2);
    expect(result.playerHealthDelta).toBeLessThan(0);
    expect(result.combat.activeSide).toBe("player");
  });

  it("spends one standard action and applies server-rolled attack damage", () => {
    const combat = activeFixture();
    const result = resolvePlayerAttack(combat, { id: "roll-1", outcome: "success", damage: { total: 5 } });
    expect(result.combat.playerActions.standard).toBe(0);
    expect(result.combat.combatants[1].hp).toBe(7);
    expect(() => resolvePlayerAttack(result.combat, { id: "roll-2", outcome: "success", damage: { total: 5 } })).toThrow(/standard action/i);
  });

  it("normalizes legacy hosted combat snapshots that omit the log", () => {
    const combat = activeFixture() as SagaCombatState;
    delete (combat as unknown as { log?: Array<Record<string, unknown>> }).log;
    const result = resolvePlayerAttack(combat as SagaCombatState, { id: "legacy-roll", outcome: "success", damage: { total: 2 } });
    expect(result.combat.log).toHaveLength(1);
    expect(result.combat.combatants[1].hp).toBe(10);
  });
  it("spends movement once without inventing position", () => {
    const result = spendPlayerMove(activeFixture(), "I move behind the overturned table");
    expect(result.combat.playerActions.move).toBe(0);
    expect(result.summary).toMatch(/position remains governed/i);
    expect(() => spendPlayerMove(result.combat, "I move again")).toThrow(/move action/i);
  });

  it("resolves the NPC turn and refreshes the next player round", () => {
    const result = endPlayerTurn(activeFixture(), character, 18, sequence(18, 4));
    expect(result.combat).toMatchObject({ status: "active", round: 2, activeSide: "player", playerActions: { standard: 1, move: 1, swift: 1, reaction: 1 } });
    expect(result.playerHealthDelta).toBeLessThan(0);
  });

  it("ends the encounter and awards XP only when the opponent is defeated", () => {
    const combat = activeFixture();
    combat.combatants[1].hp = 3;
    const result = resolvePlayerAttack(combat, { id: "roll-final", outcome: "success", damage: { total: 5 } });
    expect(result.combat).toMatchObject({ status: "player_victory", activeSide: "none" });
    expect(result.experienceAward).toBe(200);
  });
});
