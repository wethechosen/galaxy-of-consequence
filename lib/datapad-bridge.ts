type BridgeResponse = Record<string, any>;

function bridgeConfig() {
  const url = process.env.GOC_SUPABASE_BRIDGE_URL?.replace(/\/$/, "");
  const key = process.env.GOC_SUPABASE_BRIDGE_KEY;
  if (!url || !key) throw new Error("Hosted datapad persistence is not configured.");
  return { url, key };
}

export async function bridgeGet(accountId: string, includeConfig = false, username?: string) {
  const { url, key } = bridgeConfig();
  const target = new URL(url);
  target.searchParams.set("accountId", accountId);
  if (username) target.searchParams.set("username", username);
  if (includeConfig) target.searchParams.set("includeConfig", "1");

  const response = await fetch(target, {
    method: "GET",
    cache: "no-store",
    headers: { Authorization: `Bearer ${key}` },
  });
  const data = (await response.json().catch(() => ({}))) as BridgeResponse;
  if (!response.ok) {
    throw Object.assign(new Error(data?.error || `Datapad load failed (${response.status}).`), { status: response.status });
  }
  return data;
}

export async function bridgeSave(accountId: string, expectedRevision: number, snapshot: unknown, username?: string) {
  const { url, key } = bridgeConfig();
  const response = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ accountId, username, expectedRevision, snapshot }),
  });
  const data = (await response.json().catch(() => ({}))) as BridgeResponse;
  if (!response.ok) {
    throw Object.assign(new Error(data?.error || `Datapad save failed (${response.status}).`), {
      status: response.status,
      currentRevision: data?.revision,
    });
  }
  return data;
}

export async function bridgeSaveConfig(accountId: string, expectedRevision: number, config: unknown) {
  const { url, key } = bridgeConfig();
  const response = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "config", accountId, expectedRevision, config }),
  });
  const data = (await response.json().catch(() => ({}))) as BridgeResponse;
  if (!response.ok) {
    throw Object.assign(new Error(data?.error || `Datapad config save failed (${response.status}).`), {
      status: response.status,
      currentRevision: data?.revision,
    });
  }
  return data;
}
