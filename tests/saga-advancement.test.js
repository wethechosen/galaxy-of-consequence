import { describe, expect, it } from "vitest";
import {
  SAGA_XP_THRESHOLDS, advancementRequirements, applySagaAdvancement, applySagaFoundation, availableTalents, availableFeats,
  advancementChoiceContext, advancementFeatChoiceContext, availableClassSkills, availableFeatSkills, foundationRequirements, parseAbilityScores,
  forcePowerChoiceRequirements,
  ensureAdvancementScaffold, experienceForLevel, nextLevelExperience, progressionStatus, sagaLevelForExperience,
} from "../original/lib/sagaAdvancement";
import { applyExperienceAward } from "../original/lib/engineState";
import { sagaSkillModifier } from "../lib/saga-character";

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
    const built = applySagaFoundation(current, { advancementId: "foundation-1", classId: "jedi", talentId: "battle-meditation", generalFeatId: "weapon-focus-lightsabers", humanBonusFeatId: "toughness", trainedSkillIds: ["acrobatics", "endurance", "perception", "use-the-force"], languageIds: ["huttese"] }, "2026-10-06T00:00:00.000Z");
    expect(built.character).toMatchObject({ level: 1, experience: 500, heroicClass: "Jedi 1", classLevels: { jedi: 1 }, baseAttackBonus: 1, maxHitPoints: 31, trainedSkills: ["Acrobatics", "Endurance", "Perception", "Use the Force"], languages: ["Basic", "Huttese"] });
    expect(built.character.talentSelections).toContainEqual(expect.objectContaining({ id: "battle-meditation", tree: "Jedi Guardian" }));
    expect(built.character.featSelections).toEqual(expect.arrayContaining([expect.objectContaining({ id: "force-sensitivity", source: "starting-class" }), expect.objectContaining({ id: "weapon-focus-lightsabers", source: "level-1-feat" }), expect.objectContaining({ id: "toughness", source: "human-bonus-feat" })]));
    expect(built.gameState).toMatchObject({ health: 26, forcePoints: 5, destinyPoints: null, levelUpAvailable: false });
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
    const character = { level: 1, experience: 1000, forceSensitive: "Yes", classLevels: { scoundrel: 1 }, sagaStats: "STR 10 | DEX 10 | CON 10 | INT 10 | WIS 10 | CHA 10", maxHitPoints: 18, featSelections: [], talentSelections: [] };
    const jediTalents = availableTalents(character, "jedi").flatMap(tree => tree.talents.map(item => item.id));
    expect(jediTalents).toContain("deflect");
    expect(jediTalents).not.toContain("redirect-shot");
    expect(() => applySagaAdvancement(snapshot(character), { advancementId: "bad-talent", classId: "jedi", startingFeatId: "force-sensitivity", talentId: "redirect-shot", abilityIncreases: [] }, () => 5)).toThrow(/eligible talent/i);
  });

  it("requires two different ability increases at every fourth character level", () => {
    const character = {
      level: 3, experience: 6000, forceSensitive: "No", classLevels: { soldier: 3 },
      sagaStats: "STR 12 | DEX 12 | CON 12 | INT 10 | WIS 10 | CHA 10", maxHitPoints: 42, featSelections: [], talentSelections: [],
    };
    expect(() => applySagaAdvancement(snapshot(character), { advancementId: "level-4-bad", classId: "soldier", classBonusFeatId: "toughness", abilityIncreases: ["strength"] }, () => 6)).toThrow(/two different ability/i);
    const advanced = applySagaAdvancement(snapshot(character), { advancementId: "level-4", classId: "soldier", classBonusFeatId: "toughness", abilityIncreases: ["strength", "constitution"] }, () => 6);
    expect(advanced.character.abilityScores).toMatchObject({ strength: 13, constitution: 13 });
    expect(advanced.character.sagaStats).toContain("STR 13");
  });

  it("is idempotent and advances multiple earned levels one at a time", () => {
    const current = snapshot({ level: 1, experience: 3000, classLevels: { scout: 1 }, sagaStats: "STR 10 | DEX 13 | CON 10 | INT 10 | WIS 12 | CHA 10", maxHitPoints: 24, featSelections: [], talentSelections: [] });
    const once = applySagaAdvancement(current, { advancementId: "advance-once", classId: "scout", classBonusFeatId: "dodge", abilityIncreases: [] }, () => 3);
    expect(once.character.level).toBe(2);
    expect(once.gameState.levelUpAvailable).toBe(true);
    expect(applySagaAdvancement(once, { advancementId: "advance-once", classId: "scout", classBonusFeatId: "dodge", abilityIncreases: [] }, () => 8)).toEqual(once);
  });

  it("does not invent ability scores or award a second foundation to a legacy build", () => {
    expect(parseAbilityScores({ sagaStats: "unestablished" })).toEqual({ strength: null, dexterity: null, constitution: null, intelligence: null, wisdom: null, charisma: null });
    const choices = { advancementId: "foundation", classId: "jedi", talentId: "battle-meditation", generalFeatId: "toughness", humanBonusFeatId: "improved-defenses", trainedSkillIds: ["acrobatics", "perception", "use-the-force"], languageIds: [] };
    expect(() => applySagaFoundation(snapshot({ species: "Human", level: 1, sagaStats: "unestablished" }), choices)).toThrow(/six ability scores/);
    expect(() => applySagaFoundation(snapshot({ species: "Human", level: 1, sagaStats: "STR 10 | DEX 10 | CON 10 | INT 10 | WIS 10 | CHA 10", talents: "Battle Meditation" }), choices)).toThrow(/original build slots/);
    expect(() => applySagaAdvancement(snapshot({ level: 2, experience: 3000, classLevels: { jedi: 1 }, sagaStats: "STR 10 | DEX 10 | CON 10 | INT 10 | WIS 10 | CHA 10", maxHitPoints: 30 }), { advancementId: "invalid-level", classId: "jedi" })).toThrow(/class levels must match/);
  });

  it("uses each core class bonus-feat list and every listed prerequisite", () => {
    const character = { species: "Human", level: 4, classLevels: { jedi: 4 }, baseAttackBonus: 4, sagaStats: "STR 12 | DEX 12 | CON 12 | INT 12 | WIS 12 | CHA 12", feats: "Force Sensitivity, Deflect", featSelections: [], talentSelections: [{ id: "deflect" }], trainedSkills: [] };
    const ids = (classId, bonus = true) => availableFeats(character, classId, bonus).map(item => item.id);
    expect(ids("jedi")).not.toContain("force-training");
    expect(ids("jedi")).not.toContain("force-boon");
    expect(ids("jedi")).not.toContain("toughness");
    expect(ids("noble")).not.toContain("point-blank-shot");
    expect(ids("scoundrel")).not.toContain("sniper");
    expect(ids("soldier")).toContain("toughness");
    expect(ids("jedi", false)).not.toContain("dodge");
    expect(ids("jedi", false)).not.toContain("rapid-shot");
    expect(ids("jedi", false)).not.toContain("weapon-focus-lightsabers");
    expect(availableTalents(character, "jedi").flatMap(tree => tree.talents).map(item => item.id)).not.toContain("redirect-shot");
    const legal = { ...character, baseAttackBonus: 5, featSelections: [{ id: "weapon-proficiency-lightsabers" }], sagaStats: "STR 13 | DEX 13 | CON 13 | INT 13 | WIS 12 | CHA 12", trainedSkills: ["Endurance"] };
    expect(availableFeats(legal, "jedi", false).map(item => item.id)).toEqual(expect.arrayContaining(["dodge", "rapid-shot", "weapon-focus-lightsabers", "shake-it-off"]));
    expect(availableTalents(legal, "jedi").flatMap(tree => tree.talents).map(item => item.id)).toContain("redirect-shot");
  });

  it("offers skill feats with eligible skills and enforces deeper talent prerequisites", () => {
    const character = { species: "Human", baseAttackBonus: 10, sagaStats: "STR 15 | DEX 15 | CON 15 | INT 15 | WIS 15 | CHA 15", feats: "Force Sensitivity", trainedSkills: ["Use the Force"] };
    expect(availableFeats(character, "jedi").map(item => item.id)).toContain("force-training");
    for (const id of ["skill-focus", "skill-training"]) expect(availableFeats(character, "jedi").map(item => item.id)).toContain(id);
    const scoutIds = availableTalents(character, "scout").flatMap(tree => tree.talents).map(item => item.id);
    expect(scoutIds).not.toContain("improved-initiative");
    expect(scoutIds).not.toContain("uncanny-dodge-1");
    expect(scoutIds).not.toContain("hidden-movement");
    for (const id of ["trust", "ignite-fervor", "spontaneous-skill"]) expect(availableTalents(character, "noble").flatMap(tree => tree.talents).map(item => item.id)).not.toContain(id);
    expect(availableTalents(character, "soldier").flatMap(tree => tree.talents).map(item => item.id)).not.toContain("cover-fire");
  });

  it("exposes Force trees only after earned Force Sensitivity and dark talents after a recorded Dark Side Score", () => {
    const character = { forceSensitive: "Yes", sagaStats: "STR 10 | DEX 10 | CON 10 | INT 10 | WIS 10 | CHA 13" };
    expect(availableTalents(character, "scoundrel").map(tree => tree.id)).not.toContain("control");
    const trained = { ...character, feats: "Force Sensitivity" };
    expect(availableTalents(trained, "scoundrel").map(tree => tree.id)).toContain("control");
    expect(availableTalents(trained, "scoundrel", { darkSideScore: 0 }).map(tree => tree.id)).not.toContain("dark-side");
    expect(availableTalents(trained, "scoundrel", { darkSideScore: 1 }).map(tree => tree.id)).toContain("dark-side");
  });

  it("requires legal foundation skills and conditional Noble and Scout starting feats", () => {
    const base = { species: "Human", level: 1, sagaStats: "STR 10 | DEX 10 | CON 12 | INT 12 | WIS 10 | CHA 10", feats: "None", talents: "None" };
    expect(foundationRequirements(base, "jedi")).toMatchObject({ trainedSkillCount: 4, bonusLanguageCount: 1 });
    expect(availableClassSkills(base, "soldier").map(item => item.id)).not.toContain("persuasion");
    const choices = { advancementId: "scout-foundation", classId: "scout", talentId: "acute-senses", generalFeatId: "toughness", humanBonusFeatId: "improved-defenses", trainedSkillIds: ["climb", "endurance", "initiative", "jump", "mechanics", "perception", "survival"], languageIds: ["huttese"] };
    const built = applySagaFoundation(snapshot(base), choices);
    expect(built.character.featSelections.map(item => item.id)).not.toContain("shake-it-off");
    expect(() => applySagaFoundation(snapshot(base), { ...choices, trainedSkillIds: ["persuasion"] })).toThrow(/exactly 7/);
    const nobleChoices = { advancementId: "noble-foundation", classId: "noble", talentId: "educated", generalFeatId: "toughness", humanBonusFeatId: "improved-defenses", trainedSkillIds: ["deception", "gather-information", "initiative", "perception", "persuasion", "pilot", "ride", "treat-injury"], languageIds: ["huttese"] };
    expect(applySagaFoundation(snapshot(base), nobleChoices).character.featSelections.map(item => item.id)).not.toContain("linguist");
    const intelligent = { ...base, sagaStats: "STR 10 | DEX 10 | CON 12 | INT 13 | WIS 10 | CHA 10" };
    expect(foundationRequirements(intelligent, "noble")).toMatchObject({ trainedSkillCount: 8, bonusLanguageCount: 3 });
    expect(() => applySagaFoundation(snapshot(intelligent), nobleChoices)).toThrow(/3 different new languages/);
    expect(applySagaFoundation(snapshot(intelligent), { ...nobleChoices, languageIds: ["huttese", "binary", "bocce"] }).character.featSelections.map(item => item.id)).toContain("linguist");
  });

  it("uses prospective class BAB and starting feats without granting them before commit", () => {
    const character = { species: "Human", level: 1, sagaStats: "STR 10 | DEX 10 | CON 10 | INT 10 | WIS 10 | CHA 10" };
    const context = advancementChoiceContext(character, "jedi");
    expect(availableFeats(context, "jedi").map(item => item.id)).toContain("weapon-focus-lightsabers");
    expect(character.featSelections).toBeUndefined();
    expect(character.classLevels).toBeUndefined();
    const trainedCharacter = { ...character, classLevels: { jedi: 1 }, trainedSkills: ["Acrobatics", "Perception"] };
    expect(advancementChoiceContext(trainedCharacter, "jedi", { trainedSkillIds: [] }).trainedSkills).toEqual(["Acrobatics", "Perception"]);
  });

  it("trains a selected class skill atomically and applies its bonus to checks", () => {
    const current = snapshot({ species: "Human", level: 1, experience: 1050, classLevels: { soldier: 1 }, maxHitPoints: 30, sagaStats: "STR 10 | DEX 10 | CON 10 | INT 10 | WIS 10 | CHA 10", trainedSkills: ["Perception"], featSelections: [], talentSelections: [] });
    const choices = { advancementId: "training-second", classId: "soldier", classBonusFeatId: "skill-training", classBonusFeatSkillId: "mechanics" };
    const before = structuredClone(current);
    expect(() => applySagaAdvancement(current, { ...choices, classBonusFeatSkillId: undefined }, () => { throw new Error("cannot roll before complete choices"); })).toThrow(/untrained class skill/);
    for (const skill of ["perception", "persuasion", "use-the-force", "invented-skill"]) expect(() => applySagaAdvancement(current, { ...choices, classBonusFeatSkillId: skill }, () => 5)).toThrow(/untrained class skill/);
    expect(current).toEqual(before);
    const once = applySagaAdvancement(current, choices, () => 5);
    expect(once.character.trainedSkills).toEqual(["Perception", "Mechanics"]);
    expect(once.character.featSelections).toContainEqual(expect.objectContaining({ id: "skill-training-mechanics", featId: "skill-training", skillId: "mechanics", name: "Skill Training (Mechanics)", source: "class-bonus-feat" }));
    expect(once.gameState.advancementHistory[0].classBonusFeat).toMatchObject({ featId: "skill-training", skillId: "mechanics" });
    expect(sagaSkillModifier(once.character, once.gameState, "Mechanics", "intelligence")).toBe(6);
    expect(sagaSkillModifier(once.character, once.gameState, "Persuasion", "charisma")).toBe(1);
    expect(once.character.experience).toBe(1050);
    expect(applySagaAdvancement(once, choices, () => { throw new Error("must not reroll"); })).toEqual(once);
  });

  it("focuses a trained skill once, allows different skills and never stacks duplicate Focus", () => {
    const current = snapshot({ species: "Human", level: 1, experience: 1050, classLevels: { soldier: 1 }, maxHitPoints: 30, sagaStats: "STR 10 | DEX 10 | CON 10 | INT 10 | WIS 12 | CHA 10", trainedSkills: ["Perception", "Mechanics"], featSelections: [], talentSelections: [] });
    const choices = { advancementId: "focus-second", classId: "soldier", classBonusFeatId: "skill-focus", classBonusFeatSkillId: "perception" };
    expect(() => applySagaAdvancement(current, { ...choices, classBonusFeatSkillId: "pilot" }, () => 5)).toThrow(/trained skill/);
    const once = applySagaAdvancement(current, choices, () => 5);
    expect(once.character.feats).toContain("Skill Focus (Perception)");
    expect(sagaSkillModifier(once.character, once.gameState, "Perception", "wisdom")).toBe(12);
    expect(sagaSkillModifier(once.character, once.gameState, "Mechanics", "intelligence")).toBe(6);
    expect(availableFeatSkills(once.character, "soldier", "skill-focus").map(item => item.id)).toEqual(["mechanics"]);
    const next = { ...once, character: { ...once.character, experience: 3000 } };
    const nextChoices = { advancementId: "focus-third", classId: "soldier", talentId: "melee-smash", generalFeatId: "skill-focus", generalFeatSkillId: "perception" };
    expect(() => applySagaAdvancement(next, nextChoices, () => 5)).toThrow(/trained skill/);
    const twice = applySagaAdvancement(next, { ...nextChoices, generalFeatSkillId: "mechanics" }, () => 5);
    expect(twice.character.featSelections.filter(item => item.featId === "skill-focus")).toHaveLength(2);
    expect(sagaSkillModifier(twice.character, twice.gameState, "Perception", "wisdom")).toBe(12);
    expect(sagaSkillModifier(twice.character, twice.gameState, "Mechanics", "intelligence")).toBe(11);
    expect(availableFeats(twice.character, "soldier").map(item => item.id)).not.toContain("skill-focus");
    expect(availableFeatSkills({ ...current.character, feats: "Skill Focus (Perception)" }, "soldier", "skill-focus").map(item => item.id)).toEqual(["mechanics"]);
  });

  it("can train then focus in separate earned foundation slots with truthful previews", () => {
    const character = { species: "Human", level: 1, experience: 1050, sagaStats: "STR 10 | DEX 10 | CON 10 | INT 10 | WIS 10 | CHA 10", feats: "None", talents: "None" };
    const choices = { advancementId: "skill-foundation", classId: "soldier", talentId: "melee-smash", generalFeatId: "skill-training", generalFeatSkillId: "mechanics", humanBonusFeatId: "skill-focus", humanBonusFeatSkillId: "mechanics", trainedSkillIds: ["climb", "endurance", "initiative", "perception"], languageIds: [] };
    const generalContext = advancementFeatChoiceContext(character, "soldier", choices, "generalFeatId");
    expect(generalContext.trainedSkills).not.toContain("Mechanics");
    expect(availableFeatSkills(generalContext, "soldier", "skill-training").map(item => item.id)).toContain("mechanics");
    const humanContext = advancementFeatChoiceContext(character, "soldier", choices, "humanBonusFeatId");
    expect(humanContext.trainedSkills).toContain("Mechanics");
    expect(availableFeatSkills(humanContext, "soldier", "skill-focus").map(item => item.id)).toContain("mechanics");
    const preview = advancementChoiceContext(character, "soldier", choices);
    expect(availableFeatSkills(preview, "soldier", "skill-focus").map(item => item.id)).not.toContain("mechanics");
    expect(character.trainedSkills).toBeUndefined();
    const once = applySagaFoundation(snapshot(character), choices);
    expect(once.character.trainedSkills).toHaveLength(5);
    expect(sagaSkillModifier(once.character, once.gameState, "Mechanics", "intelligence")).toBe(10);
    expect(once.character.level).toBe(1);
    expect(once.character.experience).toBe(1050);
    expect(once.gameState.advancementHistory[0].featSkillChoices).toEqual({ generalFeatId: "mechanics", humanBonusFeatId: "mechanics" });
    const duplicate = { ...choices, humanBonusFeatId: "skill-training" };
    expect(() => applySagaFoundation(snapshot(character), duplicate)).toThrow(/untrained class skill/);
    const different = applySagaFoundation(snapshot(character), { ...duplicate, humanBonusFeatSkillId: "pilot" });
    expect(different.character.trainedSkills).toEqual(expect.arrayContaining(["Mechanics", "Pilot"]));
    expect(advancementChoiceContext(character, "soldier", { ...choices, generalFeatSkillId: "invalid", humanBonusFeatSkillId: "invalid" }).trainedSkills).not.toContain("invalid");
  });

  it("gates Force skill training by the selected feat and does not invent Force powers", () => {
    const character = { species: "Human", forceSensitive: "Yes, latent", level: 1, sagaStats: "STR 10 | DEX 10 | CON 10 | INT 10 | WIS 10 | CHA 10", feats: "None", talents: "None" };
    expect(availableFeatSkills(character, "soldier", "skill-training").map(item => item.id)).not.toContain("use-the-force");
    const choices = { advancementId: "sensitive-foundation", classId: "soldier", talentId: "melee-smash", generalFeatId: "force-sensitivity", humanBonusFeatId: "skill-training", humanBonusFeatSkillId: "use-the-force", trainedSkillIds: ["climb", "endurance", "initiative", "perception"], languageIds: [] };
    const context = advancementFeatChoiceContext(character, "soldier", choices, "humanBonusFeatId");
    expect(availableFeatSkills(context, "soldier", "skill-training").map(item => item.id)).toContain("use-the-force");
    const built = applySagaFoundation(snapshot(character), choices);
    expect(built.character.trainedSkills).toContain("Use the Force");
    expect(built.character.forcePowerSelections).toBeUndefined();
    expect(built.character.featSelections.map(item => item.id)).not.toContain("force-training");
    const multi = { ...character, classLevels: { soldier: 1, scoundrel: 1 } };
    expect(availableFeatSkills(multi, "soldier", "skill-training").map(item => item.id)).toContain("persuasion");
  });

  it("rejects skill metadata attached to absent or unrelated feat slots", () => {
    const character = { species: "Human", level: 1, experience: 1050, classLevels: { soldier: 1 }, maxHitPoints: 30, sagaStats: "STR 10 | DEX 10 | CON 10 | INT 10 | WIS 10 | CHA 10", trainedSkills: ["Perception"], featSelections: [], talentSelections: [] };
    const choices = { advancementId: "bad-skill-slot", classId: "soldier", classBonusFeatId: "toughness" };
    for (const extras of [{ classBonusFeatSkillId: "mechanics" }, { humanBonusFeatId: "skill-training", humanBonusFeatSkillId: "mechanics" }, { classBonusFeatId: "skill-training", classBonusFeatSkillId: ["mechanics"] }]) expect(() => applySagaAdvancement(snapshot(character), { ...choices, ...extras }, () => { throw new Error("cannot roll for invalid choices"); })).toThrow(/selected skill/);
  });

  it("updates multiclass class defenses, retroactive Constitution HP, Toughness and damage threshold", () => {
    const current = snapshot({ level: 3, experience: 6000, classLevels: { scoundrel: 3 }, maxHitPoints: 34, baseAttackBonus: 2, sagaStats: "STR 12 | DEX 13 | CON 13 | INT 10 | WIS 10 | CHA 10", defenses: { reflex: 16, fortitude: 14, will: 14 }, damageThreshold: 14, feats: "Weapon Proficiency (pistols)", talentSelections: [], featSelections: [{ id: "weapon-proficiency-pistols" }] }, { health: 29 });
    const advanced = applySagaAdvancement(current, { advancementId: "multiclass-four", classId: "soldier", startingFeatId: "armor-proficiency-light", talentId: "melee-smash", abilityIncreases: ["constitution", "strength"] }, () => 5);
    expect(advanced.character).toMatchObject({ level: 4, classLevels: { scoundrel: 3, soldier: 1 }, maxHitPoints: 44, baseAttackBonus: 3, defenses: { reflex: 17, fortitude: 18, will: 15 }, damageThreshold: 18 });
    expect(advanced.gameState.health).toBe(39);
    expect(advanced.gameState.advancementHistory[0]).toMatchObject({ newLevelHitPoints: 7, constitutionHitPoints: 3, hitPointGain: 10 });
    const soldier = snapshot({ ...current.character, classLevels: { soldier: 3 }, featSelections: [], feats: "None", defenses: { reflex: 15, fortitude: 16, will: 13 }, damageThreshold: 21 });
    const tough = applySagaAdvancement(soldier, { advancementId: "tough-four", classId: "soldier", classBonusFeatId: "toughness", abilityIncreases: ["constitution", "strength"] }, () => 5);
    expect(tough.character.maxHitPoints).toBe(48);
    expect(tough.gameState.advancementHistory[0].toughnessHitPoints).toBe(4);
    expect(tough.character.damageThreshold - tough.character.defenses.fortitude).toBe(5);
  });

  it("requires retroactive Intelligence skill and language choices and never rerolls on retry", () => {
    const current = snapshot({ level: 3, experience: 6000, classLevels: { soldier: 3 }, maxHitPoints: 42, sagaStats: "STR 12 | DEX 12 | CON 12 | INT 13 | WIS 10 | CHA 10", trainedSkills: ["Perception"], featSelections: [], talentSelections: [], languages: ["Basic", "Huttese"] });
    const choices = { advancementId: "int-four", classId: "soldier", classBonusFeatId: "toughness", abilityIncreases: ["intelligence", "strength"] };
    expect(() => applySagaAdvancement(current, choices, () => 5)).toThrow(/1 new untrained class skill/);
    const once = applySagaAdvancement(current, { ...choices, trainedSkillIds: ["mechanics"], languageIds: ["binary"] }, () => 5);
    expect(once.character.trainedSkills).toContain("Mechanics");
    expect(once.character.languages).toEqual(["Basic", "Huttese", "Binary"]);
    expect(applySagaAdvancement(once, { ...choices, trainedSkillIds: ["mechanics"], languageIds: ["binary"] }, () => { throw new Error("must not reroll"); })).toEqual(once);
  });

  it("keeps malformed legacy selection data from crashing selectors or being silently dropped on commit", () => {
    const character = { level: 1, experience: 1000, classLevels: { soldier: 1 }, maxHitPoints: 30, sagaStats: "STR 13 | DEX 13 | CON 10 | INT 10 | WIS 10 | CHA 10", featSelections: { id: "toughness" }, talentSelections: null };
    expect(() => availableTalents(character, "soldier")).not.toThrow();
    expect(() => advancementChoiceContext(character, "soldier")).not.toThrow();
    expect(() => applySagaAdvancement(snapshot(character), { advancementId: "malformed-level", classId: "soldier", classBonusFeatId: "toughness" }, () => 5)).toThrow(/reviewed reconstruction/);
  });

  it("commits Wealth's sourced reward with advancement only once", () => {
    const current = snapshot({ level: 1, experience: 1000, classLevels: { noble: 1 }, maxHitPoints: 18, sagaStats: "STR 10 | DEX 10 | CON 10 | INT 10 | WIS 10 | CHA 10", talents: "Wealth", talentSelections: [{ id: "wealth" }], feats: "Weapon Proficiency (pistols), Weapon Proficiency (simple weapons)", featSelections: [{ id: "weapon-proficiency-pistols" }, { id: "weapon-proficiency-simple" }] }, { credits: 100 });
    const choices = { advancementId: "wealth-two", classId: "noble", classBonusFeatId: "armor-proficiency-light", abilityIncreases: [] };
    const once = applySagaAdvancement(current, choices, () => 3);
    expect(once.gameState.credits).toBe(10100);
    expect(once.gameState.advancementHistory[0].wealthCreditGain).toBe(10000);
    expect(applySagaAdvancement(once, choices).gameState.credits).toBe(10100);
  });

  it("requires a complete player-picked Force suite and keeps duplicate picks as separate uses", () => {
    const current = snapshot({ species: "Human", level: 1, experience: 500, sagaStats: "STR 10 | DEX 10 | CON 10 | INT 10 | WIS 14 | CHA 10", feats: "None", talents: "None", forcePowers: "None known" });
    const choices = { advancementId: "force-foundation", classId: "jedi", talentId: "battle-meditation", generalFeatId: "force-training", humanBonusFeatId: "force-training", trainedSkillIds: ["acrobatics", "perception", "use-the-force"], languageIds: [] };
    expect(foundationRequirements(current.character, "jedi", choices)).toMatchObject({ powersPerFeat: 3, newForceTrainingCount: 2, forcePowerCount: 6 });
    expect(() => applySagaFoundation(current, choices)).toThrow(/exactly 6 supported Force powers/);
    expect(() => applySagaFoundation(current, { ...choices, forcePowerIds: ["battle-strike", "surge", "force-grip", "force-lightning", "force-stun", "invented-power"] })).toThrow(/supported Force powers/);
    const forcePowerIds = ["battle-strike", "battle-strike", "surge", "negate-energy", "force-stun", "force-lightning"];
    const once = applySagaFoundation(current, { ...choices, forcePowerIds });
    expect(once.character.featSelections.filter(item => item.id === "force-training")).toHaveLength(2);
    expect(once.character.forcePowerSelections.map(item => item.id)).toEqual(forcePowerIds);
    expect(new Set(once.character.forcePowerSelections.map(item => item.selectionId)).size).toBe(6);
    expect(once.character.forcePowerSelections.filter(item => item.forceTrainingIndex === 1)).toHaveLength(3);
    expect(once.character.forcePowerSelections.filter(item => item.forceTrainingIndex === 2)).toHaveLength(3);
    expect(once.character.forcePowers).toBe("Battle Strike, Battle Strike, Surge, Negate Energy, Force Stun, Force Lightning");
    expect(once.character.experience).toBe(500);
    expect(once.gameState.advancementHistory[0].forcePowerSelections).toHaveLength(6);
    expect(applySagaFoundation(once, { ...choices, forcePowerIds })).toEqual(once);
  });

  it("rejects unearned power lists and requires actual Force Sensitivity and training", () => {
    const character = { species: "Human", level: 1, sagaStats: "STR 10 | DEX 10 | CON 10 | INT 10 | WIS 10 | CHA 10", feats: "None", talents: "None" };
    const ordinary = { advancementId: "ordinary-foundation", classId: "jedi", talentId: "battle-meditation", generalFeatId: "toughness", humanBonusFeatId: "improved-defenses", trainedSkillIds: ["acrobatics", "perception", "use-the-force"], languageIds: [] };
    expect(() => applySagaFoundation(snapshot(character), { ...ordinary, forcePowerIds: ["surge"] })).toThrow(/exactly 0/);
    expect(() => applySagaFoundation(snapshot(character), { ...ordinary, forcePowerIds: "surge" })).toThrow(/list of supported power/);
    expect(availableFeats({ ...character, forceSensitive: "Yes", trainedSkills: ["Use the Force"] }, "scoundrel").map(item => item.id)).not.toContain("force-training");
    expect(availableFeats({ ...character, feats: "Force Sensitivity", trainedSkills: [] }, "jedi").map(item => item.id)).not.toContain("force-training");
    expect(availableFeats({ ...character, feats: "Force Sensitivity", trainedSkills: ["Use the Force"] }, "jedi").map(item => item.id)).toContain("force-training");
  });

  it("adds new earned Force Training powers while preserving legacy named and unsupported powers", () => {
    const character = { level: 2, experience: 3000, classLevels: { jedi: 2 }, maxHitPoints: 35, sagaStats: "STR 10 | DEX 10 | CON 10 | INT 10 | WIS 14 | CHA 10", feats: "Force Sensitivity, Force Training", featSelections: [{ id: "force-sensitivity" }, { id: "force-training" }], talentSelections: [], trainedSkills: ["Use the Force"], forcePowers: "Battle Strike, Battle Strike, Farseeing" };
    const choices = { advancementId: "force-third", classId: "jedi", talentId: "resilience", generalFeatId: "force-training", forcePowerIds: ["force-grip", "surge", "negate-energy"] };
    const once = applySagaAdvancement(snapshot(character), choices, () => 5);
    expect(once.character.forcePowerSelections.map(item => item.id)).toEqual(["battle-strike", "battle-strike", "farseeing", "force-grip", "surge", "negate-energy"]);
    expect(once.character.forcePowerSelections.slice(-3).every(item => item.source === "force-training" && item.forceTrainingIndex === 2 && item.level === 3)).toBe(true);
    expect(once.character.forcePowers).toContain("Farseeing");
    expect(once.gameState.advancementHistory[0].forcePowerSelections).toHaveLength(3);
  });

  it("commits extra player-picked powers from permanent Wisdom increases for every existing training feat", () => {
    const character = { level: 3, experience: 6000, classLevels: { jedi: 3 }, maxHitPoints: 40, sagaStats: "STR 10 | DEX 10 | CON 10 | INT 10 | WIS 13 | CHA 10", feats: "Force Sensitivity, Force Training (2)", featSelections: [{ id: "force-sensitivity" }, { id: "force-training" }, { id: "force-training" }], talentSelections: [], trainedSkills: ["Use the Force"], forcePowers: "Battle Strike, Battle Strike, Surge, Farseeing" };
    const choices = { advancementId: "wisdom-fourth", classId: "jedi", classBonusFeatId: "quick-draw", abilityIncreases: ["wisdom", "strength"] };
    expect(forcePowerChoiceRequirements(character, choices)).toMatchObject({ existingForceTrainingCount: 2, wisdomPowerCount: 2, forcePowerCount: 2 });
    expect(() => applySagaAdvancement(snapshot(character), choices, () => { throw new Error("must validate before rolling"); })).toThrow(/exactly 2/);
    const complete = { ...choices, forcePowerIds: ["surge", "force-slam"] };
    const once = applySagaAdvancement(snapshot(character), complete, () => 5);
    expect(once.character.forcePowerSelections).toHaveLength(6);
    expect(once.character.forcePowerSelections.slice(-2)).toEqual([expect.objectContaining({ id: "surge", source: "wisdom-increase", forceTrainingIndex: 1 }), expect.objectContaining({ id: "force-slam", source: "wisdom-increase", forceTrainingIndex: 2 })]);
    expect(applySagaAdvancement(once, complete, () => { throw new Error("retry must not reroll"); })).toEqual(once);
    expect(forcePowerChoiceRequirements({ ...character, featSelections: [], sagaStats: "STR 10 | DEX 10 | CON 10 | INT 10 | WIS 9 | CHA 10" }, choices).forcePowerCount).toBe(2);
  });
});
