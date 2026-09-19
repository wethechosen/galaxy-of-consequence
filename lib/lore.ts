import type { LoreFact } from "./types";

export const LORE_POLICY = [
  "Verified Legacy-era Legends/EU history is authoritative.",
  "Canon may fill a gap only when it does not contradict Legends/EU.",
  "Approved campaign adaptations must be labelled and must not rewrite history.",
  "AI-created filler may only address an undocumented gap and must be saved as a campaign event.",
] as const;

export const STARTING_LORE: LoreFact[] = [
  {
    id: "legacy-era",
    label: "Legacy era baseline",
    classification: "established_lore",
    source: "Star Wars: Legacy era reference",
    verified: true,
    playerVisible: true,
    detail: "The campaign begins in 200 ABY, after the Sith-Imperial War.",
  },
  {
    id: "celanon-spur",
    label: "Celanon Spur",
    classification: "compatible_adaptation",
    source: "Galaxy of Consequence campaign setting",
    verified: false,
    playerVisible: true,
    detail: "A campaign sandbox at the intersection of Imperial, Corporate Sector, and Hapan interests.",
  },
  {
    id: "saga-core-lock",
    label: "Saga rules verification lock",
    classification: "campaign_event",
    source: "Application safeguard",
    verified: true,
    playerVisible: true,
    detail: "No rule is presented as page-accurate until the authorized Saga Edition Core Rulebook is indexed.",
  },
];

export function canIntroduceFact(fact: Pick<LoreFact, "classification" | "verified">) {
  return fact.classification !== "established_lore" || fact.verified;
}

export function playerVisibleLore(facts: LoreFact[]) {
  return facts.filter((fact) => fact.playerVisible);
}
