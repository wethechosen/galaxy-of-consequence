type BridgeResponse = Record<string, any>;

function bridgeConfig() {
  const url = (process.env.GOC_SUPABASE_BRIDGE_URL || process.env.SUPABASE_GOC_BRIDGE_URL)?.replace(/\/$/, "");
  const key = process.env.GOC_SUPABASE_BRIDGE_KEY || process.env.SUPABASE_GOC_BRIDGE_KEY;
  if (!url || !key) throw new Error("Hosted datapad persistence is not configured.");
  return { url, key };
}

const BRIDGE_REQUEST_TIMEOUT_MS = 15_000;
const RAG_REQUEST_TIMEOUT_MS = 5_000;

async function bridgeRequest(target: URL | string, init: RequestInit = {}, timeoutMs = BRIDGE_REQUEST_TIMEOUT_MS) {
  const { key } = bridgeConfig();
  const signal = init.signal || AbortSignal.timeout(timeoutMs);
  try {
    const response = await fetch(target, {
      ...init,
      signal,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${key}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers || {}),
      },
    });
    const data = (await response.json().catch((error: unknown) => {
      if (signal.aborted) throw error;
      return {};
    })) as BridgeResponse;
    if (!response.ok) {
      throw Object.assign(new Error(data?.error || `Datapad bridge failed (${response.status}).`), {
        status: response.status,
        currentRevision: data?.revision,
        data,
      });
    }
    return data;
  } catch (error) {
    // A timeout is an uncertain response, not proof that a write was rolled
    // back. Clients must reload the authoritative revision before retrying.
    if (signal.aborted) throw Object.assign(new Error("Datapad bridge request timed out. Reload state before retrying."), { status: 504 });
    throw error;
  }
}

export async function bridgeGet(accountId: string, includeConfig = false) {
  const { url } = bridgeConfig();
  const target = new URL(url);
  target.searchParams.set("accountId", accountId);
  if (includeConfig) target.searchParams.set("includeConfig", "1");
  return bridgeRequest(target);
}

export async function bridgeGetHud(accountId: string) {
  const { url } = bridgeConfig();
  const target = new URL(url);
  target.searchParams.set("accountId", accountId);
  target.searchParams.set("mode", "hud");
  return bridgeRequest(target);
}

export async function bridgeSearchRag(query: string, limit = 6) {
  const { url } = bridgeConfig();
  const target = new URL(url);
  target.searchParams.set("mode", "rag");
  target.searchParams.set("q", query);
  target.searchParams.set("limit", String(Math.max(1, Math.min(Number(limit) || 6, 12))));
  return bridgeRequest(target, {}, RAG_REQUEST_TIMEOUT_MS);
}

export async function bridgeRagStats() {
  const { url } = bridgeConfig();
  const target = new URL(url);
  target.searchParams.set("mode", "rag_stats");
  return bridgeRequest(target);
}

export async function bridgeListCheckpoints(accountId: string) {
  const { url } = bridgeConfig();
  const target = new URL(url);
  target.searchParams.set("accountId", accountId);
  target.searchParams.set("mode", "checkpoints");
  return bridgeRequest(target);
}

export async function bridgeSaveCheckpoint(accountId: string, label: string) {
  const { url } = bridgeConfig();
  return bridgeRequest(url, {
    method: "POST",
    body: JSON.stringify({ action: "checkpoint_save", accountId, label }),
  });
}

export async function bridgeLoadCheckpoint(accountId: string, checkpointId: string, expectedRevision: number) {
  const { url } = bridgeConfig();
  return bridgeRequest(url, {
    method: "POST",
    body: JSON.stringify({ action: "checkpoint_load", accountId, checkpointId, expectedRevision }),
  });
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
  const { url } = bridgeConfig();
  return bridgeRequest(url, {
    method: "POST",
    body: JSON.stringify({ action: "reconcile", accountId, expectedRevision, patch, reason }),
  });
}

export async function bridgeSave(accountId: string, expectedRevision: number, snapshot: unknown) {
  const { url } = bridgeConfig();
  return bridgeRequest(url, {
    method: "POST",
    body: JSON.stringify({ accountId, expectedRevision, snapshot }),
  });
}

export async function bridgeSaveConfig(accountId: string, expectedRevision: number, config: unknown) {
  const { url } = bridgeConfig();
  return bridgeRequest(url, {
    method: "POST",
    body: JSON.stringify({ action: "config", accountId, expectedRevision, config }),
  });
}
