type Sheet = Record<string, unknown>;
const codes: Record<string, string> = { strength: "STR", dexterity: "DEX", constitution: "CON", intelligence: "INT", wisdom: "WIS", charisma: "CHA" };
export function sagaAbilityScore(character: Sheet, ability: string): number | null {
  const scores = character.abilityScores as Sheet | undefined;
  const stored = scores?.[ability] ?? scores?.[codes[ability]?.toLowerCase()];
  if (stored != null && Number.isFinite(Number(stored)) && Number(stored) >= 1) return Number(stored);
  const match = new RegExp(`\\b${codes[ability]}\\s*(\\d+)`, "i").exec(String(character.sagaStats || ""));
  return match ? Number(match[1]) : null;
}
export const sagaAbilityModifier = (character: Sheet, ability: string) => Math.floor(((sagaAbilityScore(character, ability) ?? 10) - 10) / 2);
const normalized = (value: unknown) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
export function sagaHasFeat(character: Sheet, id: string, name = id) {
  const recorded = Array.isArray(character.featSelections) ? character.featSelections as Sheet[] : [];
  return recorded.some(entry => normalized(entry.id) === normalized(id) || normalized(entry.name) === normalized(name))
    || String(character.feats || "").split(/[,;|\n]/).some(entry => normalized(entry) === normalized(name));
}
export function sagaHasTalent(character: Sheet, id: string, name = id) {
  const recorded = Array.isArray(character.talentSelections) ? character.talentSelections as Sheet[] : [];
  return recorded.some(entry => normalized(entry.id) === normalized(id) || normalized(entry.name) === normalized(name))
    || String(character.talents || "").split(/[,;|\n]/).some(entry => normalized(entry) === normalized(name));
}
export function sagaTrained(character: Sheet, skill: string) {
  if (Array.isArray(character.trainedSkills) && character.trainedSkills.some(entry => normalized(entry) === normalized(skill))) return true;
  const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`trained(?:\\s+in)?\\s+${escaped}`, "i").test(String(character.skills || ""));
}
export function sagaConditionPenalty(step: unknown) { return [0, -1, -2, -5, -10, -10][Math.max(0, Math.min(5, Math.floor(Number(step) || 0)))]; }
const ARMORED_FLIGHT_SUIT = /\barmou?red\b.*\bflight suit\b|\bflight suit\b.*\barmou?red\b/i;
const ARMOR_PENALTY_SKILLS = new Set(["acrobatics", "climb", "endurance", "initiative", "jump", "stealth", "swim"]);
export function sagaWearsArmoredFlightSuit(character: Sheet) {
  return ARMORED_FLIGHT_SUIT.test(String(character.equipArmor || ""));
}
export function sagaLightArmorProficient(character: Sheet) {
  return sagaHasFeat(character, "armor-proficiency-light", "Armor Proficiency (light)");
}
export function sagaEquipmentSkillModifier(character: Sheet, skill: string) {
  return sagaWearsArmoredFlightSuit(character) && !sagaLightArmorProficient(character) && ARMOR_PENALTY_SKILLS.has(normalized(skill)) ? -2 : 0;
}
export function sagaEquipmentAttackModifier(character: Sheet) {
  return sagaWearsArmoredFlightSuit(character) && !sagaLightArmorProficient(character) ? -2 : 0;
}
export function sagaArmorDefenseAdjustments(character: Sheet) {
  if (!sagaWearsArmoredFlightSuit(character)) return { reflex: 0, fortitude: 0 };
  const level = Math.max(1, Math.floor(Number(character.level) || 1));
  const dexterity = sagaAbilityModifier(character, "dexterity");
  return {
    // Saga Core: armor replaces the heroic-level Reflex bonus; this suit has +5 armor and Max Dex +3.
    reflex: (5 - level) + (Math.min(dexterity, 3) - dexterity),
    fortitude: sagaLightArmorProficient(character) ? 2 : 0,
  };
}
export function sagaSkillModifier(character: Sheet, state: Sheet, skill: string, ability: string) {
  const focused = sagaHasFeat(character, `skill-focus-${skill.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`, `Skill Focus (${skill})`);
  return Math.floor(Math.max(1, Number(character.level) || 1) / 2) + sagaAbilityModifier(character, ability)
    + (sagaTrained(character, skill) ? 5 : 0) + (focused ? 5 : 0) + sagaConditionPenalty(state.conditionTrack)
    + sagaEquipmentSkillModifier(character, skill);
}
