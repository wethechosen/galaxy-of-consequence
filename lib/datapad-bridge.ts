import {
  neonGetConfig, neonGetSaveByAccountId, neonHud, neonListCheckpoints, neonLoadCheckpoint,
  neonPutSave, neonRagSearch, neonRagStats, neonReconcile, neonSaveCheckpoint, neonSaveConfig,
} from "./neon-campaign-store";

function missingSave() {
  return Object.assign(new Error("Campaign save not found for accountId."), { status: 404 });
}

export async function bridgeGet(accountId: string, includeConfig = false): Promise<Record<string, any>> {
  const save = await neonGetSaveByAccountId(accountId);
  if (!includeConfig) return save || {};
  return { save: save || {}, config: await neonGetConfig(accountId) };
}

export async function bridgeGetHud(accountId: string) {
  return neonHud(accountId);
}

export async function bridgeSearchRag(query: string, limit = 6) {
  return neonRagSearch(query, limit);
}

export async function bridgeRagStats() {
  return neonRagStats();
}

export async function bridgeListCheckpoints(accountId: string) {
  return neonListCheckpoints(accountId);
}

export async function bridgeSaveCheckpoint(accountId: string, label: string) {
  return neonSaveCheckpoint(accountId, label);
}

export async function bridgeLoadCheckpoint(accountId: string, checkpointId: string, expectedRevision: number) {
  return neonLoadCheckpoint(accountId, checkpointId, expectedRevision);
}

export type ReconciliationPatch = {
  level?: number;
  experience?: number;
  health?: number;
  credits?: number;
  creditsCriminal?: number;
  location?: string;
  inventory?: unknown[];
  objectives?: unknown[];
  combat?: Record<string, unknown>;
  conditionTrack?: number;
  campaignTimeMinutes?: number;
  lastNarration?: string;
};

export async function bridgeReconcile(
  accountId: string,
  expectedRevision: number,
  patch: ReconciliationPatch,
  reason: string,
) {
  return neonReconcile(accountId, expectedRevision, patch, reason);
}

export async function bridgeSave(accountId: string, expectedRevision: number, snapshot: unknown) {
  const save = await neonGetSaveByAccountId(accountId);
  if (!save) throw missingSave();
  return neonPutSave(save.account_username, accountId, expectedRevision, snapshot);
}

export async function bridgeSaveConfig(accountId: string, expectedRevision: number, config: unknown) {
  return neonSaveConfig(accountId, expectedRevision, config);
}
