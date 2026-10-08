import { describe, expect, it } from "vitest";
import { buildForcePowerPlan, recoverForcePowerUses, resolveForcePower } from "./saga-force";

const character = {
  name: "D'mir Holloran", level: 1, heroic: true,
  sagaStats: "STR 12 | DEX 14 | CON 10 | INT 12 | WIS 10 | CHA 14",
  abilityScores: { charisma: 14, constitution: 10 },
  trainedSkills: ["Use the Force"],
  forcePowers: "Force Lightning, Battle Strike, Force Stun",
  forcePowerSelections: [{ id: "force-lightning", selectionId: "earned:lightning" }, { id: "battle-strike", selectionId: "earned:strike" }, { id: "force-stun", selectionId: "earned:stun" }],
};

const combat = {
  id: "force-combat", status: "active" as const, round: 1, activeSide: "player" as const,
  initiativeOrder: ["pc-dmir", "npc-1"], playerActions: { standard: 1, move: 1, swift: 1, reaction: 1 },
  startedAt: "2026-10-06T00:00:00.000Z", log: [],
  combatants: [
    { id: "pc-dmir", name: "D'mir Holloran", side: "player" as const, level: 1, hp: 18, maxHp: 18, reflex: 13, fortitude: 12, will: 11, damageThreshold: 12, conditionTrack: 0, initiative: 18, attackModifier: 1, damage: { count: 1, sides: 4, modifier: 1, type: "kinetic" } },
    { id: "npc-1", name: "Guard", side: "opposition" as const, level: 1, hp: 12, maxHp: 12, reflex: 12, fortitude: 12, will: 11, damageThreshold: 12, conditionTrack: 0, initiative: 10, attackModifier: 2, damage: { count: 1, sides: 4, modifier: 1, type: "kinetic" } },
  ],
};

const fixed = (value: number) => (min: number, max: number) => Math.min(max - 1, Math.max(min, value));

describe("server-owned Saga Force powers", () => {
  it("plans only a trained, earned power", () => {
    expect(buildForcePowerPlan("force-lightning", character, {}, combat)).toMatchObject({ label: "Use the Force — Force Lightning", targetLabel: "Reflex Defense" });
    expect(buildForcePowerPlan("force-grip", { ...character, forcePowers: "None known", forcePowerSelections: [] }, {}, combat)).toBeNull();
  });

  it("consumes a power use, applies dark-side score, and persists combat action", () => {
    const result = resolveForcePower("force-lightning", "I use Force Lightning on the guard", character, { health: 18, combat }, { id: "force-roll", outcome: "success", total: 18, target: 12, damage: { total: 12 } }, fixed(10));
    expect(result.accepted).toBe(true);
    expect(result.stateDelta).toMatchObject({ darkSideScoreDelta: 1, forcePowerUses: { "force-lightning": 0 } });
    expect(result.combat?.playerActions.standard).toBe(0);
    expect(result.experienceAward).toBe(50);
  });

  it("does not invent an effect when the suite is exhausted", () => {
    const result = resolveForcePower("battle-strike", "I use Battle Strike", character, { combat, forcePowerUses: { "battle-strike": 0 } }, { id: "force-roll", outcome: "success", total: 20, target: 15 }, fixed(10));
    expect(result.accepted).toBe(false);
    expect(result.stateDelta).toEqual({});
  });

  it("can recover the recorded uses after a rest boundary", () => {
    expect(recoverForcePowerUses({ forcePowerUses: {} }, character)).toEqual({ forcePowerUses: { "force-lightning": 1, "battle-strike": 1, "force-stun": 1 } });
  });
});
