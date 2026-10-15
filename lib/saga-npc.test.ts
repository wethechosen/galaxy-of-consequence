import { describe, expect, it } from "vitest";
import { assertSagaNpcBuild, buildSagaNpc, sagaNpcBuildErrors, sagaNpcRole } from "./saga-npc";

describe("Saga Edition NPC builds", () => {
  it("builds a level-1 guard from the nonheroic class instead of ad hoc combat scaling", () => {
    const guard = buildSagaNpc({ name: "Dock guard", level: 1 });
    expect(guard).toMatchObject({
      ruleset: "Star Wars Saga Edition",
      characterLevel: 1,
      heroicLevel: 0,
      classLevels: { nonheroic: 1 },
      baseAttackBonus: 0,
      maxHitPoints: 5,
      defenses: { reflex: 14, fortitude: 11, will: 10 },
      damageThreshold: 11,
      attack: { name: "blaster pistol", mode: "ranged", modifier: 2, damage: { count: 3, sides: 6, modifier: 0 } },
      talents: [], forcePoints: 0, destinyPoints: 0,
    });
    expect(guard.startingFeats).toHaveLength(3);
    expect(guard.generalFeats).toEqual(["Point Blank Shot"]);
    expect(sagaNpcBuildErrors(guard)).toEqual([]);
  });

  it("uses Table 3-1 feat cadence, nonheroic BAB, and excludes nonheroic levels from defenses", () => {
    const guard = buildSagaNpc({ name: "Security sergeant", level: 7 });
    expect(guard.baseAttackBonus).toBe(5);
    expect(guard.generalFeats).toEqual(["Point Blank Shot", "Weapon Focus (pistols)", "Precise Shot"]);
    expect(guard.defenses).toEqual({ reflex: 14, fortitude: 11, will: 10 });
    expect(guard.attack).toMatchObject({ modifier: 8, damage: { modifier: 3 } });
    expect(guard.hitPointRolls).toHaveLength(7);
    expect(assertSagaNpcBuild(guard)).toBe(guard);
  });

  it("rejects a stat block that smuggles nonheroic level into defenses", () => {
    const guard = buildSagaNpc({ name: "Invalid guard", level: 4 });
    const invalid = { ...guard, defenses: { ...guard.defenses, reflex: guard.defenses.reflex + 4 } };
    expect(() => assertSagaNpcBuild(invalid)).toThrow(/defenses must exclude nonheroic levels/i);
  });

  it("selects a rules build profile from the established NPC role", () => {
    expect(sagaNpcRole("Black Sun enforcer")).toBe("thug");
    expect(sagaNpcRole("Dock technician")).toBe("skilled");
    expect(sagaNpcRole("Port authority officer")).toBe("guard");
  });
});
