export type LoreClassification = "established_lore" | "compatible_adaptation" | "campaign_event";
export type EventKind = "roll" | "scene" | "checkpoint" | "restore" | "state_update";

export interface LoreFact {
  id: string;
  label: string;
  classification: LoreClassification;
  source: string;
  verified: boolean;
  playerVisible: boolean;
  detail: string;
}

export interface CharacterState {
  name: string;
  species: string;
  heroicClass: string;
  level: number;
  experience: number;
  hitPoints: { current: number; maximum: number };
  defenses: { reflex: number; fortitude: number; will: number };
  condition: number;
  forcePoints: number;
  destinyPoints: number;
  darkSideScore: number;
  credits: number;
  trainedSkills: string[];
  inventory: string[];
}

export interface RollRecord {
  id: string;
  formula: string;
  raw: number;
  modifier: number;
  total: number;
  target?: number;
  outcome: "success" | "failure" | "unresolved";
  reason: string;
  createdAt: string;
}

export interface CampaignEvent {
  id: string;
  kind: EventKind;
  summary: string;
  createdAt: string;
  playerVisible: boolean;
  rollId?: string;
}

export interface Checkpoint {
  id: string;
  label: string;
  createdAt: string;
  eventCount: number;
}

export interface CampaignState {
  id: string;
  title: string;
  era: "200 ABY";
  continuity: "Legends-first";
  currentLocation: string;
  currentScene: string;
  rulesStatus: "provisional_until_saga_core_is_indexed" | "verified";
  character: CharacterState;
  objectives: string[];
  loreFacts: LoreFact[];
  rolls: RollRecord[];
  events: CampaignEvent[];
  checkpoints: Checkpoint[];
}

export interface GmTurnResponse {
  narration: string;
  campaign: CampaignState;
  roll?: RollRecord;
  source: "nemotron" | "local-safe-fallback";
}
