import type { Account } from "./accounts";
import type { DatapadSnapshot } from "./datapad-save";

type RecordValue = Record<string, unknown>;

export const DMIR_PRIMARY_USERNAME = "dmir@galaxy.local";
export const DMIR_HISTORICAL_EXCEPTION = {
  id: "dmir-kelvek-inheritance-1-2b",
  scope: "dmir-primary-campaign-only",
  kind: "historical-authorized-outcome",
  amount: 1_200_000_000,
  note: "Preserves the previously authorized Kelvek inheritance outcome. It grants no authority for future rewards or transfers.",
} as const;

const normalized = (value: unknown) => String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
const records = (value: unknown) => Array.isArray(value) ? value.filter((entry): entry is RecordValue => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry)) : [];

export function isDmirPrimaryCampaign(actor: Pick<Account, "username">, character: RecordValue | null | undefined) {
  return normalized(actor.username) === DMIR_PRIMARY_USERNAME && /^d['’]mir holloran$/i.test(String(character?.name || "").trim());
}

/**
 * Creator canon is historical/identity context only. Keeping it in its own
 * namespace prevents a biography clarification from mutating mechanical state.
 */
export function appendDmirCreatorCanon(
  state: RecordValue,
  detail: string,
  actor: Pick<Account, "username">,
  character: RecordValue | null | undefined,
  now = new Date().toISOString(),
) {
  if (!isDmirPrimaryCampaign(actor, character)) throw new Error("Only D'mir's creator may establish D'mir's primary campaign canon.");
  const clean = detail.trim().replace(/\s+/g, " ").slice(0, 8_000);
  if (!clean) return state;
  const creatorCanon = records(state.creatorCanon).map((entry) => ({ ...entry }));
  if (!creatorCanon.some((entry) => normalized(entry.detail) === normalized(clean))) {
    creatorCanon.push({
      id: `dmir-canon-${creatorCanon.length + 1}`,
      detail: clean,
      scope: "identity-and-history-only",
      mechanicalAuthority: false,
      establishedAt: now,
    });
  }
  return { ...state, creatorCanon };
}

/** Adds the policy marker without changing D'mir's balance or any earned field. */
export function preserveDmirHistoricalException(state: RecordValue, character: RecordValue | null | undefined) {
  if (!/^d['’]mir holloran$/i.test(String(character?.name || "").trim())) return state;
  const campaignExceptions = records(state.campaignExceptions).map((entry) => ({ ...entry }));
  if (!campaignExceptions.some((entry) => entry.id === DMIR_HISTORICAL_EXCEPTION.id)) campaignExceptions.push({ ...DMIR_HISTORICAL_EXCEPTION });
  return { ...state, campaignExceptions };
}

/**
 * A read-only NPC projection. Other campaigns receive a copy of confirmed
 * earned state; they never receive a mutation handle to D'mir's primary save.
 */
export function createDmirNpcSnapshot(snapshot: DatapadSnapshot, sourceRevision = 0) {
  const character = snapshot.character || {};
  if (!/^d['’]mir holloran$/i.test(String(character.name || "").trim())) throw new Error("D'mir's primary campaign is not loaded.");
  const state = snapshot.gameState || {};
  const characterFields = ["name", "species", "age", "background", "appearance", "personality", "beliefs", "motivations", "level", "experience", "sagaStats", "trainedSkills", "skills", "feats", "talents", "forcePowers", "forceSensitive", "imageHeadshot"];
  const projectedCharacter = Object.fromEntries(characterFields.filter((field) => Object.prototype.hasOwnProperty.call(character, field)).map((field) => [field, structuredClone(character[field])]));
  const stateFields = ["health", "conditionTrack", "conditions", "forcePoints", "destinyPoints", "darkSideScore", "credits", "creditsCriminal", "location", "inventory", "properties", "ships", "investments", "relationships", "factionRep", "objectives", "discoveries", "milestones", "legacyAssets", "creatorCanon"];
  const earnedState = Object.fromEntries(stateFields.filter((field) => Object.prototype.hasOwnProperty.call(state, field)).map((field) => [field, structuredClone(state[field])]));
  return {
    id: "dmir-holloran-primary-snapshot",
    source: "dmir-primary-earned-campaign",
    sourceRevision,
    immutableInOtherCampaigns: true,
    character: projectedCharacter,
    earnedState,
  };
}
