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
export function sagaSkillModifier(character: Sheet, state: Sheet, skill: string, ability: string) {
  const focused = sagaHasFeat(character, `skill-focus-${skill.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`, `Skill Focus (${skill})`);
  return Math.floor(Math.max(1, Number(character.level) || 1) / 2) + sagaAbilityModifier(character, ability)
    + (sagaTrained(character, skill) ? 5 : 0) + (focused ? 5 : 0) + sagaConditionPenalty(state.conditionTrack);
}
