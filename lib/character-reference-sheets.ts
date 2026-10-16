/** Deterministic, rules-checked level-one NONHEROIC reference sheets.
 * These sheets are GM rehearsal baselines, not saved PC characters or a
 * replacement for the heroic Saga Edition foundation and advancement system.
 */
import { NPC_TEST_ROSTER } from "./npc-test-roster";
import { CAMPAIGN_NPCS_150_ABY } from "./npc-canon-roster";
import { buildSagaNpc, sagaNpcBuildErrors } from "./saga-npc";
import { CHARACTER_VISUAL_DOSSIERS } from "./character-visual-dossiers";
const castIds = Object.keys(CHARACTER_VISUAL_DOSSIERS);
export const CHARACTER_REFERENCE_SHEETS = castIds.map(id => {
  const test = NPC_TEST_ROSTER.find(n => n.id === id);
  const canon = CAMPAIGN_NPCS_150_ABY.find(n => n.id === id);
  if (!test && !canon) throw new Error("Unknown reference character: " + id);
  const name = test?.name || canon!.name;
  const role = test?.classId === "soldier" ? "guard" : test?.classId === "scoundrel" ? "skilled" : test?.classId === "scout" ? "skilled" : "skilled";
  const rules = buildSagaNpc({ name, level: 1, role });
  const errors = sagaNpcBuildErrors(rules);
  if (errors.length) throw new Error(name + ": " + errors.join("; "));
  return {
    id, name, species: test?.species || canon!.species,
    homeworld: test?.homeworld || canon!.birthworld,
    affiliation: test?.allegiance || canon!.affiliation,
    occupation: test?.role || canon!.role150,
    publicHistory: test?.background || canon!.biography,
    initialObjective: test?.objective || canon!.objective,
    description: CHARACTER_VISUAL_DOSSIERS[id].description,
    personality: CHARACTER_VISUAL_DOSSIERS[id].personality,
    visual: CHARACTER_VISUAL_DOSSIERS[id],
    referenceRules: rules,
    rulesStatus: "validated-nonheroic-rehearsal",
    playthroughStatus: "unverified",
    assetStatus: "prompts-only",
  };
});
