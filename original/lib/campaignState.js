import { ensureAdvancementScaffold } from "@/original/lib/sagaAdvancement";

const array = (value) => Array.isArray(value) ? value : [];
const hasTitle = (items, title) => items.some((item) => String(item?.title || item?.name || "").toLowerCase() === title.toLowerCase());

export const CAMPAIGN_STATE_DEFAULTS = {
  combat: null,
  conditionTrack: 0,
  forcePoints: null,
  destinyPoints: null,
  darkSideScore: 0,
  campaignTimeMinutes: 0,
  levelUpAvailable: false,
  conditions: [],
  decisions: [],
  objectives: [],
  discoveries: [],
  milestones: [],
  relationships: [],
  legacyAssets: [],
  turnEvents: [],
  storyDirectives: [],
  creatorCanon: [],
  campaignExceptions: [],
  advancementHistory: [],
};

/** Backfills additive campaign-ledger fields without replacing established save data. */
export function ensureCampaignScaffold(snapshot = {}) {
  const character = snapshot.character && typeof snapshot.character === "object" ? snapshot.character : null;
  const previous = snapshot.gameState && typeof snapshot.gameState === "object" ? snapshot.gameState : {};
  const state = { ...CAMPAIGN_STATE_DEFAULTS, ...previous };
  for (const field of ["conditions", "decisions", "objectives", "discoveries", "milestones", "relationships", "legacyAssets", "turnEvents", "storyDirectives", "creatorCanon", "campaignExceptions", "advancementHistory"]) state[field] = array(previous[field]).map((item) => ({ ...item }));

  if (/^d['’]mir holloran$/i.test(String(character?.name || "").trim())) {
    const objectives = [
      { title: "Survive the prison aftermath", detail: "Recover, learn what happened to Kelvek, and endure the immediate consequences.", status: "active" },
      { title: "Escape Level 1313 detention", detail: "Find and execute a viable escape on D'mir's terms.", status: "active" },
      { title: "Leave Coruscant", detail: "Eventually secure passage offworld after escaping confinement.", status: "future" },
    ];
    for (const objective of objectives) if (!hasTitle(state.objectives, objective.title)) state.objectives.push({ ...objective, createdAt: 0 });
    if (!hasTitle(state.relationships, "Kelvek")) state.relationships.push({ name: "Kelvek", role: "mentor", disposition: "trusted", status: "deceased", note: "Former IGBC executive and prison librarian who mentored D'mir in finance and investing.", updatedAt: 0 });
    if (!hasTitle(state.legacyAssets, "Kelvek legacy network")) state.legacyAssets.push({
      name: "Kelvek legacy network",
      category: "ownership claims and financial network",
      status: "suspected",
      estimatedValue: 100000000,
      accessRequirements: "Discover evidence, authenticate claims, establish access, and survive any opposing interests.",
      evidence: "Player-established campaign direction; no liquid control has been earned.",
      updatedAt: 0,
    });
    if (!state.campaignExceptions.some((entry) => entry?.id === "dmir-kelvek-inheritance-1-2b")) state.campaignExceptions.push({
      id: "dmir-kelvek-inheritance-1-2b",
      scope: "dmir-primary-campaign-only",
      kind: "historical-authorized-outcome",
      amount: 1200000000,
      note: "Preserves the previously authorized Kelvek inheritance outcome. It grants no authority for future rewards or transfers.",
    });
    if (!state.creatorCanon.some((entry) => entry?.id === "dmir-xiii-chronology")) state.creatorCanon.push({
      id: "dmir-xiii-chronology",
      title: "XIII chronology boundary",
      detail: "D'mir knew Kelvek before learning anything about XIII. XIII has no confirmed connection to D'mir's parents, childhood home, or their bunker.",
      source: "Creator clarification",
      establishedAt: 0,
    });
    if (!state.creatorCanon.some((entry) => entry?.id === "dmir-parents-bunker")) state.creatorCanon.push({
      id: "dmir-parents-bunker",
      title: "Parents' untouched smuggling bunker",
      detail: "The concealed smuggling bunker beneath Unit 4-B belonged to D'mir's parents and remained untouched from his childhood until he rediscovered it after escaping prison.",
      source: "Creator clarification",
      establishedAt: 0,
    });
  }

  return ensureAdvancementScaffold({ ...snapshot, character, gameState: state });
}
