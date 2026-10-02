import type { CampaignState } from "./types";
import { emptyWorld } from "./world";

function pick<T extends object, K extends keyof T>(value: T, keys: readonly K[]): Pick<T, K> {
  return Object.fromEntries(keys.map(key => [key, value[key]])) as Pick<T, K>;
}

// Explicit projection: adding a new server field never exposes it by default.
export function playerView(state: CampaignState): CampaignState {
  const world = state.world ?? emptyWorld();
  return {
    id: state.id, title: state.title, era: state.era, continuity: state.continuity,
    revision: state.revision ?? 0, parentTimelineId: state.parentTimelineId,
    economyCatchUpPending: state.economyCatchUpPending ?? false,
    restoredCheckpointId: state.restoredCheckpointId, currentLocation: state.currentLocation,
    currentScene: state.currentScene, rulesStatus: state.rulesStatus, character: state.character,
    objectives: state.objectives, loreFacts: state.loreFacts.filter(f => f.playerVisible).map(f => pick(f, ["id", "label", "classification", "source", "verified", "playerVisible", "detail"])),
    rolls: state.rolls.map(roll => ({ id: roll.id, formula: roll.formula, raw: roll.raw, modifier: roll.modifier, total: roll.total, outcome: roll.outcome, reason: roll.reason, createdAt: roll.createdAt })),
    events: state.events.filter(e => e.playerVisible).map(e => pick(e, ["id", "kind", "summary", "createdAt", "playerVisible", "rollId"])), checkpoints: state.checkpoints.map(c => pick(c, ["id", "label", "createdAt", "eventCount"])),
    transcript: (state.transcript ?? []).map(t => pick(t, ["id", "role", "text", "createdAt"])),
    worldClock: state.worldClock ? { campaignElapsedMs: state.worldClock.campaignElapsedMs, lastRealAtMs: state.worldClock.lastRealAtMs, rate: 7, events: [] } : undefined,
    world: {
      draft: world.draft ? pick(world.draft, ["name", "species", "background", "biography", "startingLocation", "aspirations", "review"]) : null,
      journal: world.journal.map(j => pick(j, ["id", "title", "detail", "kind", "status", "discoveredAt"])),
      assets: world.assets.map(a => pick(a, ["id", "name", "kind", "description"])),
      cashflows: world.cashflows.map(f => pick(f, ["id", "label", "credits", "intervalMs", "nextDueMs", "remainingOccurrences", "status", "authorityEventId"])),
      ledger: world.ledger.map(l => pick(l, ["id", "flowId", "campaignAtMs", "credits", "balance"])),
      contracts: world.contracts.map(c => pick(c, ["id", "title", "deadlineMs", "status", "terms", "authorityEventId"])),
      decisions: world.decisions.map(d => pick(d, ["id", "kind", "title", "detail", "relatedId", "campaignAtMs", "status", "response"])),
      contacts: world.contacts.filter(c => c.playerKnown).map(c => ({
      id: c.id, name: c.name, description: c.description, observedAttitude: c.observedAttitude,
      knownObligations: c.knownObligations, companion: c.companion, playerKnown: true,
      privateGoal: "", knowledge: [], memories: [],
    })) },
  };
}
