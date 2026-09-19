import { randomUUID } from "node:crypto";
import { STARTING_LORE } from "@/lib/lore";
import type { CampaignEvent, CampaignState, Checkpoint, RollRecord } from "@/lib/types";
import { openStorage } from "./storage";

const firstEvent: CampaignEvent = {
  id: "event-prologue",
  kind: "scene",
  summary: "Campaign initialized: a character-specific prologue begins at Mercia Hub.",
  createdAt: "200-01-01T08:00:00.000Z",
  playerVisible: true,
};

function createSeed(): CampaignState {
  return {
    id: "campaign-celanon-prologue",
    title: "Galaxy of Consequence",
    era: "200 ABY",
    continuity: "Legends-first",
    currentLocation: "Mercia Hub, Celanon Spur",
    currentScene:
      "Rain streaks the transparisteel of Docking Ring Seven. A courier has vanished with an encrypted ledger while a CSA security detail locks down the concourse.",
    rulesStatus: "provisional_until_saga_core_is_indexed",
    character: {
      name: "Talon Vey",
      species: "Human",
      heroicClass: "Scoundrel",
      level: 1,
      experience: 0,
      hitPoints: { current: 24, maximum: 24 },
      defenses: { reflex: 15, fortitude: 12, will: 13 },
      condition: 0,
      forcePoints: 5,
      destinyPoints: 1,
      darkSideScore: 0,
      credits: 750,
      trainedSkills: ["Deception", "Gather Information", "Mechanics", "Perception", "Persuasion", "Stealth"],
      inventory: ["Hold-out blaster", "Comlink", "Datapad", "Field kit"],
    },
    objectives: ["Find the missing courier before CSA Security does.", "Learn why the ledger matters without exposing yourself."],
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

export function getCampaign(id = "campaign-celanon-prologue") {
  const row = db().prepare("SELECT state FROM campaigns WHERE id = ?").get(id) as { state: string } | undefined;
  if (row) return JSON.parse(row.state) as CampaignState;
  if (id !== "campaign-celanon-prologue") throw new Error("Campaign not found");
  return saveCampaign(createSeed());
}

function saveCampaign(campaign: CampaignState) {
  db().prepare("INSERT INTO campaigns (id, state) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET state = excluded.state").run(campaign.id, JSON.stringify(campaign));
  return clone(campaign);
}

export function appendRoll(campaignId: string, roll: RollRecord) {
  const campaign = getCampaign(campaignId);
  campaign.rolls.unshift(roll);
  campaign.events.unshift({
    id: randomUUID(),
    kind: "roll",
    summary: `${roll.reason}: ${roll.formula} = ${roll.total}${roll.target ? ` vs ${roll.target}` : ""}.`,
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

export function createCheckpoint(campaignId: string, label: string) {
  const campaign = getCampaign(campaignId);
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
  db().exec("BEGIN IMMEDIATE");
  try {
    db().prepare("INSERT INTO checkpoints (id, campaign_id, state) VALUES (?, ?, ?)").run(checkpoint.id, campaign.id, JSON.stringify(campaign));
    saveCampaign(campaign);
    db().exec("COMMIT");
  } catch (error) {
    db().exec("ROLLBACK");
    throw error;
  }
  return { campaign, checkpoint };
}
