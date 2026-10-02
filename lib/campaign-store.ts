import { randomUUID } from "node:crypto";
import { STARTING_LORE } from "./lore";
import type { CampaignEvent, CampaignState, Checkpoint, RollRecord } from "./types";
import { openStorage } from "./storage";
import { advanceWorldClock, newWorldClock } from "./world-clock";
import { emptyWorld, settleEconomy } from "./world";
import { boundedText } from "./local-http";

const firstEvent: CampaignEvent = {
  id: "event-prologue",
  kind: "scene",
  summary: "150 ABY campaign setup created; no character or starting location selected.",
  createdAt: new Date().toISOString(),
  playerVisible: true,
};

function createSeed(): CampaignState {
  return {
    id: "campaign-150-setup",
    revision: 0, world: emptyWorld(), transcript: [],
    worldClock: newWorldClock(Date.now()),
    title: "Galaxy of Consequence",
    era: "150 ABY",
    continuity: "Legends-first",
    currentLocation: "Starting location not selected",
    currentScene:
      "Your story begins in 150 ABY. Character creation and biography-based starting locations will become available after the Saga rules are verified. No mission or allegiance has been assigned.",
    rulesStatus: "provisional_until_saga_core_is_indexed",
    character: null,
    objectives: [],
    loreFacts: STARTING_LORE,
    rolls: [],
    events: [firstEvent],
    checkpoints: [],
  };
}

let database: ReturnType<typeof openStorage> | undefined;
function db() { return database ??= openStorage(); }

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function getCampaign(id = activeTimelineId()) {
  const row = db().prepare("SELECT state FROM campaigns WHERE id = ?").get(id) as { state: string } | undefined;
  if (row) {
    const state = JSON.parse(row.state) as CampaignState;
    return { ...state, revision: state.revision ?? 0, world: state.world ?? emptyWorld(), transcript: state.transcript ?? [] };
  }
  if (id !== "campaign-150-setup") throw new Error("Campaign not found");
  return saveCampaign(createSeed());
}

function activeTimelineId() {
  return (db().prepare("SELECT value FROM settings WHERE key = 'active_timeline'").get() as { value: string } | undefined)?.value ?? "campaign-150-setup";
}

export function listTimelines() {
  getCampaign();
  return db().prepare("SELECT state FROM campaigns ORDER BY rowid").all().map(row => {
    const state = JSON.parse(row.state as string) as CampaignState;
    return { id: state.id, title: state.title, era: state.era, parentTimelineId: state.parentTimelineId };
  });
}

export function selectTimeline(id: string) {
  const campaign = getCampaign(id);
  db().prepare("INSERT INTO settings VALUES ('active_timeline', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(id);
  return campaign;
}

export function restoreCheckpoint(checkpointId: string, campaignId = activeTimelineId(), expectedRevision?: number) {
  db().exec("BEGIN IMMEDIATE");
  try {
    const current = getCampaign(campaignId);
    if (expectedRevision !== undefined && current.revision !== expectedRevision) throw new Error("Campaign changed. Refresh and try again.");
    const row = db().prepare("SELECT state FROM checkpoints WHERE id = ? AND campaign_id = ?").get(checkpointId, campaignId) as { state: string } | undefined;
    if (!row) throw new Error("Checkpoint not found in selected timeline");
    const snapshot = JSON.parse(row.state) as CampaignState;
    const branch: CampaignState = {
    ...snapshot, id: randomUUID(), parentTimelineId: snapshot.id,
    restoredCheckpointId: checkpointId, title: `${snapshot.title} · restored`,
    checkpoints: [],
    worldClock: { ...(snapshot.worldClock ?? newWorldClock(Date.now())), lastRealAtMs: Date.now() },
    events: [{ id: randomUUID(), kind: "restore", summary: "New timeline restored from checkpoint; original history preserved.", createdAt: new Date().toISOString(), playerVisible: true }, ...snapshot.events],
    };
    saveCampaign(branch);
    selectTimeline(branch.id);
    db().exec("COMMIT");
    return branch;
  } catch (error) { db().exec("ROLLBACK"); throw error; }
}

export function catchUpCampaign(now = Date.now()) {
  db().exec("BEGIN IMMEDIATE");
  try {
    const campaign = getCampaign();
    const previous = campaign.worldClock ?? newWorldClock(now);
    const enabled = campaign.rulesStatus === "verified" && campaign.character !== null;
    const result = advanceWorldClock(previous, campaign.economyCatchUpPending ? previous.lastRealAtMs : now, enabled);
    campaign.worldClock = result.clock;
    if (campaign.character && enabled && (result.advancedMs > 0 || campaign.economyCatchUpPending)) {
      const settled = settleEconomy(campaign.world ?? emptyWorld(), campaign.character.credits, result.clock.campaignElapsedMs, new Set(campaign.events.map(e => e.id)));
      campaign.world = settled.world;
      campaign.economyCatchUpPending = settled.pending;
      campaign.character.credits = settled.balance;
      for (const summary of settled.logs) campaign.events.unshift({ id: randomUUID(), kind: "state_update", summary, createdAt: new Date(now).toISOString(), playerVisible: true });
      for (const due of result.newlyDue) {
        if (!due.playerFacing) continue;
        campaign.world.decisions.push({ id: randomUUID(), kind: due.kind === "irreversible_loss" ? "loss" : "danger", title: due.summary, detail: "This event is paused pending your response and validated adjudication.", relatedId: due.id, campaignAtMs: due.dueAtMs, status: "pending" });
      }
    }
    if (result.advancedMs > 0) campaign.events.unshift({
      id: randomUUID(), kind: "state_update", createdAt: new Date(now).toISOString(), playerVisible: true,
      summary: `World clock advanced ${result.advancedMs} campaign milliseconds at 7× real time. ${result.newlyDue.filter(event => event.playerFacing).length} known events await adjudication.`,
    });
    saveCampaign(campaign);
    db().exec("COMMIT");
    return campaign;
  } catch (error) { db().exec("ROLLBACK"); throw error; }
}

function saveCampaign(campaign: CampaignState) {
  campaign.revision = (campaign.revision ?? 0) + 1;
  db().prepare("INSERT INTO campaigns (id, state) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET state = excluded.state").run(campaign.id, JSON.stringify(campaign));
  return clone(campaign);
}

export function mutateCampaign(id: string, expectedRevision: number, change: (campaign: CampaignState) => string) {
  db().exec("BEGIN IMMEDIATE");
  try {
    const campaign = getCampaign(id);
    if (campaign.revision !== expectedRevision) throw new Error("Campaign changed. Refresh and try again.");
    const summary = change(campaign);
    campaign.events.unshift({ id: randomUUID(), kind: "state_update", summary, createdAt: new Date().toISOString(), playerVisible: true });
    const saved = saveCampaign(campaign);
    db().exec("COMMIT");
    return saved;
  } catch (error) { db().exec("ROLLBACK"); throw error; }
}

export function playerCommand(body: Record<string, unknown>) {
  const id = boundedText(body.campaignId, 100);
  if (!Number.isSafeInteger(body.revision)) throw new Error("Revision required");
  return mutateCampaign(id, body.revision as number, campaign => {
    const world = campaign.world ??= emptyWorld();
    switch (body.command) {
      case "save_draft": {
        if (campaign.character) throw new Error("An active character cannot be replaced with a draft");
        world.draft = {
          name: boundedText(body.name, 80), species: boundedText(body.species, 80),
          background: boundedText(body.background, 300), biography: boundedText(body.biography, 6000),
          startingLocation: boundedText(body.startingLocation, 200), aspirations: boundedText(body.aspirations, 1000, true),
          review: "pending_source_review",
        };
        return "Character biography draft saved; rules and lore review remain pending.";
      }
      case "add_note": {
        world.journal.push({ id: randomUUID(), title: boundedText(body.title, 160), detail: boundedText(body.detail, 4000), kind: "note", status: "discovered", discoveredAt: campaign.worldClock?.campaignElapsedMs ?? 0 });
        return "Player journal note recorded.";
      }
      case "journal_status": {
        const entry = world.journal.find(e => e.id === body.id);
        if (!entry || !["discovered", "pursuing", "dismissed", "archived"].includes(String(body.status))) throw new Error("Invalid journal change");
        entry.status = body.status as typeof entry.status;
        return `Journal entry ${entry.title}: ${entry.status}. This does not accept a contract.`;
      }
      case "decision_response": {
        const decision = world.decisions.find(e => e.id === body.id && e.status === "pending");
        if (!decision) throw new Error("Pending decision not found");
        decision.response = boundedText(body.response, 2000);
        decision.status = "submitted";
        return `Response recorded for ${decision.title}; consequences remain paused until adjudicated.`;
      }
      default: throw new Error("Unknown player command");
    }
  });
}

export function createNewCampaign() {
  const campaign = createSeed();
  campaign.id = randomUUID();
  campaign.events = [{ id: randomUUID(), kind: "scene", summary: "New independent 150 ABY campaign created.", createdAt: new Date().toISOString(), playerVisible: true }];
  db().exec("BEGIN IMMEDIATE");
  try { saveCampaign(campaign); selectTimeline(campaign.id); db().exec("COMMIT"); return campaign; }
  catch (error) { db().exec("ROLLBACK"); throw error; }
}

export function appendRoll(campaignId: string, roll: RollRecord) {
  const campaign = getCampaign(campaignId);
  campaign.rolls.unshift(roll);
  campaign.events.unshift({
    id: randomUUID(),
    kind: "roll",
    summary: `${roll.reason}: ${roll.formula} = ${roll.total}.`,
    createdAt: roll.createdAt,
    playerVisible: true,
    rollId: roll.id,
  });
  return saveCampaign(campaign);
}

export function appendScene(campaignId: string, narration: string) {
  const campaign = getCampaign(campaignId);
  campaign.currentScene = narration;
  campaign.events.unshift({
    id: randomUUID(),
    kind: "scene",
    summary: narration.slice(0, 240),
    createdAt: new Date().toISOString(),
    playerVisible: true,
  });
  return saveCampaign(campaign);
}

export function createCheckpoint(campaignId: string, label: string, expectedRevision?: number) {
  db().exec("BEGIN IMMEDIATE");
  try {
    const campaign = getCampaign(campaignId);
    if (expectedRevision !== undefined && campaign.revision !== expectedRevision) throw new Error("Campaign changed. Refresh and try again.");
    const checkpoint: Checkpoint = {
    id: randomUUID(),
    label: label.trim().slice(0, 80) || "Untitled checkpoint",
    createdAt: new Date().toISOString(),
    eventCount: campaign.events.length,
  };
  campaign.checkpoints.unshift(checkpoint);
  campaign.events.unshift({
    id: randomUUID(),
    kind: "checkpoint",
    summary: `Checkpoint created: ${checkpoint.label}.`,
    createdAt: checkpoint.createdAt,
    playerVisible: true,
  });
    saveCampaign(campaign);
    db().prepare("INSERT INTO checkpoints (id, campaign_id, state) VALUES (?, ?, ?)").run(checkpoint.id, campaign.id, JSON.stringify(campaign));
    db().exec("COMMIT");
    return { campaign, checkpoint };
  } catch (error) {
    db().exec("ROLLBACK");
    throw error;
  }
}
