import { describe, expect, it } from "vitest";
import {
  SAGA_XP_THRESHOLDS, advancementRequirements, applySagaAdvancement, applySagaFoundation, availableTalents,
  ensureAdvancementScaffold, experienceForLevel, nextLevelExperience, progressionStatus, sagaLevelForExperience,
} from "../original/lib/sagaAdvancement";
import { applyExperienceAward } from "../original/lib/engineState";

const snapshot = (character, gameState = {}) => ({
  character,
  gameState: { health: 18, forcePoints: 1, flags: [], advancementHistory: [], ...gameState },
  messages: [], comms: [], settings: {},
});

describe("Saga Edition advancement", () => {
  it("uses the core XP table through level 20", () => {
    expect(SAGA_XP_THRESHOLDS).toEqual([0, 1000, 3000, 6000, 10000, 15000, 21000, 28000, 36000, 45000, 55000, 66000, 78000, 91000, 105000, 120000, 136000, 153000, 171000, 190000]);
    expect(sagaLevelForExperience(999)).toBe(1);
    expect(sagaLevelForExperience(1000)).toBe(2);
    expect(sagaLevelForExperience(190000)).toBe(20);
    expect(experienceForLevel(4)).toBe(6000);
    expect(nextLevelExperience(4)).toBe(10000);
  });

  it("awards XP without silently choosing or committing a level", () => {
    const character = { level: 1, experience: 900 };
    const awarded = applyExperienceAward(character, 100);
    expect(awarded).toEqual({ level: 1, experience: 1000 });
    expect(progressionStatus(awarded)).toMatchObject({ earnedLevel: 2, advancementAvailable: true, levelsAvailable: 1 });
    expect(ensureAdvancementScaffold(snapshot(awarded)).gameState.levelUpAvailable).toBe(true);
  });

  it("derives talent and bonus-feat cadence from the selected class level", () => {
    const character = { level: 1, experience: 1000, classLevels: { scoundrel: 1 } };
    expect(advancementRequirements(character, "scoundrel")).toMatchObject({ targetLevel: 2, nextClassLevel: 2, talentRequired: false, classBonusFeatRequired: true, generalFeatRequired: false });
    expect(advancementRequirements({ level: 2, experience: 3000, classLevels: { scoundrel: 2 } }, "scoundrel")).toMatchObject({ targetLevel: 3, nextClassLevel: 3, talentRequired: true, classBonusFeatRequired: false, generalFeatRequired: true });
  });

  it("establishes a legacy level-1 build without granting XP or another level", () => {
    const current = snapshot({ name: "D'mir Holloran", species: "Human", level: 1, experience: 500, forceSensitive: "Yes", sagaStats: "STR 12 | DEX 14 | CON 10 | INT 12 | WIS 10 | CHA 11", feats: "None recorded", talents: "None recorded" }, { health: 26, forcePoints: null, destinyPoints: null });
    const built = applySagaFoundation(current, { advancementId: "foundation-1", classId: "jedi", talentId: "battle-meditation", generalFeatId: "force-training", humanBonusFeatId: "toughness" }, "2026-10-06T00:00:00.000Z");
    expect(built.character).toMatchObject({ level: 1, experience: 500, heroicClass: "Jedi 1", classLevels: { jedi: 1 }, baseAttackBonus: 1, maxHitPoints: 30 });
    expect(built.character.talentSelections).toContainEqual(expect.objectContaining({ id: "battle-meditation", tree: "Jedi Guardian" }));
    expect(built.character.featSelections).toEqual(expect.arrayContaining([expect.objectContaining({ id: "force-sensitivity", source: "starting-class" }), expect.objectContaining({ id: "force-training", source: "level-1-feat" }), expect.objectContaining({ id: "toughness", source: "human-bonus-feat" })]));
    expect(built.gameState).toMatchObject({ health: 26, forcePoints: 5, destinyPoints: 1, levelUpAvailable: false });
    expect(built.gameState.advancementHistory).toEqual([expect.objectContaining({ kind: "level-1-foundation", toLevel: 1 })]);
  });

  it("commits one complete legal level and persists its audit record", () => {
    const current = snapshot({
      name: "D'mir Holloran", level: 1, experience: 1000, forceSensitive: "Yes",
      sagaStats: "STR 12 | DEX 14 | CON 10 | INT 12 | WIS 10 | CHA 11",
      classLevels: { scoundrel: 1 }, maxHitPoints: 18, baseAttackBonus: 0,
      feats: "Force Sensitivity", talents: "Fool's Luck",
      featSelections: [{ id: "force-sensitivity", name: "Force Sensitivity" }],
      talentSelections: [{ id: "fools-luck", name: "Fool's Luck", tree: "Fortune" }],
    });
    const advanced = applySagaAdvancement(current, { advancementId: "level-2", classId: "scoundrel", classBonusFeatId: "quick-draw", abilityIncreases: [] }, () => 4, "2026-10-05T12:00:00.000Z");
    expect(advanced.character).toMatchObject({ level: 2, experience: 1000, classLevels: { scoundrel: 2 }, baseAttackBonus: 1, maxHitPoints: 22 });
    expect(advanced.character.featSelections).toContainEqual(expect.objectContaining({ id: "quick-draw", source: "class-bonus-feat" }));
    expect(advanced.gameState).toMatchObject({ health: 22, forcePoints: 6, levelUpAvailable: false });
    expect(advanced.gameState.advancementHistory).toEqual([expect.objectContaining({ advancementId: "level-2", hitDie: "1d6", hitDieRoll: 4, hitPointGain: 4 })]);
  });

  it("enforces talent prerequisites and prevents an ineligible selection", () => {
    const character = { level: 1, experience: 1000, forceSensitive: "Yes", classLevels: { scoundrel: 1 }, featSelections: [], talentSelections: [] };
    const jediTalents = availableTalents(character, "jedi").flatMap(tree => tree.talents.map(item => item.id));
    expect(jediTalents).toContain("deflect");
    expect(jediTalents).not.toContain("redirect-shot");
    expect(() => applySagaAdvancement(snapshot(character), { advancementId: "bad-talent", classId: "jedi", startingFeatId: "force-sensitivity", talentId: "redirect-shot", abilityIncreases: [] }, () => 5)).toThrow(/eligible talent/i);
  });

  it("requires two different ability increases at every fourth character level", () => {
    const character = {
      level: 3, experience: 6000, forceSensitive: "No", classLevels: { soldier: 3 },
      sagaStats: "STR 12 | DEX 12 | CON 12 | INT 10 | WIS 10 | CHA 10", featSelections: [], talentSelections: [],
    };
    expect(() => applySagaAdvancement(snapshot(character), { advancementId: "level-4-bad", classId: "soldier", classBonusFeatId: "toughness", abilityIncreases: ["strength"] }, () => 6)).toThrow(/two different ability/i);
    const advanced = applySagaAdvancement(snapshot(character), { advancementId: "level-4", classId: "soldier", classBonusFeatId: "toughness", abilityIncreases: ["strength", "constitution"] }, () => 6);
    expect(advanced.character.abilityScores).toMatchObject({ strength: 13, constitution: 13 });
    expect(advanced.character.sagaStats).toContain("STR 13");
  });

  it("is idempotent and advances multiple earned levels one at a time", () => {
    const current = snapshot({ level: 1, experience: 3000, classLevels: { scout: 1 }, sagaStats: "STR 10 | DEX 12 | CON 10 | INT 10 | WIS 12 | CHA 10", featSelections: [], talentSelections: [] });
    const once = applySagaAdvancement(current, { advancementId: "advance-once", classId: "scout", classBonusFeatId: "dodge", abilityIncreases: [] }, () => 3);
    expect(once.character.level).toBe(2);
    expect(once.gameState.levelUpAvailable).toBe(true);
    expect(applySagaAdvancement(once, { advancementId: "advance-once", classId: "scout", classBonusFeatId: "dodge", abilityIncreases: [] }, () => 8)).toEqual(once);
  });
});
