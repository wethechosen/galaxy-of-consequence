/**
 * Read-only interface metadata shared by the Custom GPT controller responses.
 * Presentation metadata does not grant gameplay authority or modify the save.
 * Existing web navigation, routes, and campaign controller remain unchanged.
 */
export const GPT_MODULES = [
  "scene", "characterHud", "dossier", "abilities", "inventory", "equipment",
  "banking", "galaxyNavigation", "factionIntelligence", "objectives", "chronology",
  "npcRelationships", "diceHistory", "forceAwareness", "missionJournal",
] as const;

export const WEB_ENHANCEMENTS = [
  "galaxyNavigation", "factionIntelligence", "banking",
  "equipment", "chronology",
] as const;

export const GM_ONLY_FIELDS = [
  "hitPoints", "health", "vitality", "conditionTrack", "experience", "level",
  "credits", "bankCredits", "physicalCredits", "inventory", "forcePoints",
  "destinyPoints", "darkSideScore", "combat", "worldLocation",
] as const;

export function playerVisualContract(name?: string) {
  return {
    version: "goc-visual-v1",
    design: "existing-datapad",
    gpt: { mode: "full", panels: [...GPT_MODULES] },
    web: { mode: "existing-ui-selected-enhancements", panels: [...WEB_ENHANCEMENTS] },
    portrait: { status: "awaiting-approved-reference", assetUrl: null, subject: name || "Current character", note: "Use approved character artwork only; never generate a placeholder." },
    statAuthority: {
      mode: "gm-controller-only",
      readOnlyForPlayer: [...GM_ONLY_FIELDS],
      instruction: "Render exact saved values; never provide player-controlled health, vitality or stat sliders. Only committed GM/rules-engine operations update game state.",
    },
    informationBoundary: "Only reveal player-known NPC and faction intelligence. Presentation actions are not save mutations.",
  };
}
