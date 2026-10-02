// Derived from the live Supabase schema for the Galaxy of Consequence project.
// Keep server credentials out of this module. This file describes data only.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type GocBridgeGetArgs = {
  p_username: string;
};

export type GocBridgeUpsertArgs = {
  p_username: string;
  p_account_id: string;
  p_expected_revision: number;
  p_snapshot: Json;
};

export type DatapadSnapshotEnvelope = {
  accountId: string;
  revision: number;
  snapshot: Json;
};

export type CharacterRow = {
  id: string;
  campaign_id: string;
  user_id: string | null;
  name: string;
  species: string;
  level: number;
  xp: number;
  hp_current: number;
  hp_max: number;
  condition_step: number;
  credits: number;
  force_points: number;
  destiny_points: number;
  dark_side_score: number;
  current_location_id: string | null;
  state_version: number;
  public_state: Json;
  metadata: Json;
  updated_at: string;
};

export type EncounterRow = {
  id: string;
  campaign_id: string;
  scene_id: string | null;
  name: string | null;
  encounter_type: string;
  status: string;
  round_number: number;
  active_turn: number;
  environment_state: Json;
  started_at: string;
  ended_at: string | null;
};

export type EncounterCombatantRow = {
  id: string;
  campaign_id: string;
  encounter_id: string;
  entity_type: string;
  entity_id: string;
  initiative: number | null;
  turn_order: number | null;
  conditions: Json;
  position_state: Json;
  metadata: Json;
};

export type StateSnapshotRow = {
  id: string;
  campaign_id: string;
  session_id: string | null;
  scene_id: string | null;
  game_tick: number | null;
  snapshot_type: string;
  state: Json;
  state_hash: string | null;
  created_at: string;
};

export type GmRunRow = {
  id: string;
  campaign_id: string;
  thread_id: string;
  input_message_id: string | null;
  output_message_id: string | null;
  provider: string;
  model_name: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  latency_ms: number | null;
  usage: Json;
  error_code: string | null;
  error_message: string | null;
};

export type GameMutationRow = {
  id: string;
  campaign_id: string;
  gm_run_id: string | null;
  tool_call_id: string | null;
  idempotency_key: string;
  mutation_type: string;
  payload: Json;
  expected_state_version: number | null;
  status: string;
  result: Json | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  applied_at: string | null;
};
