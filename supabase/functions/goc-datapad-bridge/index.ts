import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const BRIDGE_KEY = Deno.env.get("GOC_SUPABASE_BRIDGE_KEY") || "";
const PREVIOUS_BRIDGE_KEY = Deno.env.get("GOC_SUPABASE_BRIDGE_KEY_PREVIOUS") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
}

function authorized(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  const supplied = auth.slice("Bearer ".length);
  return (BRIDGE_KEY.length > 0 && supplied === BRIDGE_KEY)
    || (PREVIOUS_BRIDGE_KEY.length > 0 && supplied === PREVIOUS_BRIDGE_KEY);
}

async function rest(path: string, init: RequestInit = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(text || `Supabase request failed (${response.status})`);
  return text ? JSON.parse(text) : null;
}

async function rpc(name: string, body: unknown) {
  return await rest(`/rest/v1/rpc/${name}`, { method: "POST", body: JSON.stringify(body) });
}

async function lookupUsername(accountId: string) {
  const result = await rpc("goc_bridge_lookup_username", { p_account_id: accountId });
  return typeof result === "string" ? result : result?.account_username || null;
}

function resultResponse(result: any) {
  if (result?.ok === false) {
    const status = result?.error === "revision_conflict" ? 409 : 400;
    return new Response(JSON.stringify(result), { status, headers: cors() });
  }
  return new Response(JSON.stringify(result), { headers: cors() });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors() });
  if (!BRIDGE_KEY && !PREVIOUS_BRIDGE_KEY) {
    return new Response(JSON.stringify({ error: "Bridge credential is not configured." }), { status: 503, headers: cors() });
  }
  if (!authorized(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized bridge request." }), { status: 401, headers: cors() });
  }

  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      let username = url.searchParams.get("username")?.trim() || "";
      const accountId = url.searchParams.get("accountId")?.trim() || "";
      const includeConfig = url.searchParams.get("includeConfig") === "1";
      const mode = url.searchParams.get("mode")?.trim().toLowerCase() || "state";

      if (mode === "hud") {
        if (!accountId) return new Response(JSON.stringify({ error: "accountId is required for HUD" }), { status: 400, headers: cors() });
        return resultResponse(await rpc("goc_hud_get", { p_account_id: accountId }));
      }
      if (mode === "checkpoints") {
        if (!accountId) return new Response(JSON.stringify({ error: "accountId is required for checkpoints" }), { status: 400, headers: cors() });
        const checkpoints = await rpc("goc_checkpoint_list", { p_account_id: accountId });
        return new Response(JSON.stringify({ ok: true, checkpoints }), { headers: cors() });
      }

      if (mode === "rag") {
        const query = url.searchParams.get("q")?.trim() || "";
        const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit")) || 6, 12));
        if (!query) return new Response(JSON.stringify({ error: "q is required for RAG search" }), { status: 400, headers: cors() });
        const hits = await rpc("goc_rag_search", { p_query: query, p_limit: limit });
        return new Response(JSON.stringify({ ok: true, hits }), { headers: cors() });
      }
      if (mode === "rag_stats") {
        const stats = await rpc("goc_rag_stats", {});
        return new Response(JSON.stringify({ ok: true, stats }), { headers: cors() });
      }
      if (!username && accountId) username = (await lookupUsername(accountId)) || "";
      if (!username) return new Response(JSON.stringify({ error: "username or accountId is required" }), { status: 400, headers: cors() });
      const save = await rpc("goc_bridge_get", { p_username: username });
      if (!includeConfig) return new Response(JSON.stringify(save), { headers: cors() });
      const resolvedAccountId = accountId || String(save?.account_id || "");
      const config = resolvedAccountId ? await rpc("goc_config_get", { p_account_id: resolvedAccountId }) : null;
      return new Response(JSON.stringify({ save, config }), { headers: cors() });
    }

    if (req.method === "POST") {
      const body = await req.json();
      const accountId = String(body?.accountId || "").trim();
      const action = String(body?.action || "").trim().toLowerCase();

      if (action === "config") {
        if (!accountId || !Number.isInteger(body?.expectedRevision) || !body?.config) {
          return new Response(JSON.stringify({ error: "accountId, expectedRevision, and config are required" }), { status: 400, headers: cors() });
        }
        return resultResponse(await rpc("goc_config_upsert", {
          p_account_id: accountId,
          p_expected_revision: body.expectedRevision,
          p_config: body.config,
        }));
      }

      if (action === "checkpoint_save") {
        if (!accountId) return new Response(JSON.stringify({ error: "accountId is required" }), { status: 400, headers: cors() });
        return resultResponse(await rpc("goc_checkpoint_save", {
          p_account_id: accountId,
          p_label: String(body?.label || "Manual checkpoint"),
        }));
      }

      if (action === "checkpoint_load") {
        if (!accountId || !body?.checkpointId || !Number.isInteger(body?.expectedRevision)) {
          return new Response(JSON.stringify({ error: "accountId, checkpointId, and expectedRevision are required" }), { status: 400, headers: cors() });
        }
        return resultResponse(await rpc("goc_checkpoint_load", {
          p_account_id: accountId,
          p_checkpoint_id: body.checkpointId,
          p_expected_revision: body.expectedRevision,
        }));
      }

      if (action === "reconcile") {
        if (!accountId || !Number.isInteger(body?.expectedRevision) || !body?.patch) {
          return new Response(JSON.stringify({ error: "accountId, expectedRevision, and patch are required" }), { status: 400, headers: cors() });
        }
        return resultResponse(await rpc("goc_reconcile_patch", {
          p_account_id: accountId,
          p_expected_revision: body.expectedRevision,
          p_patch: body.patch,
          p_reason: String(body?.reason || "OOC reconciliation"),
        }));
      }

      if (action === "rag_document") {
        if (!body?.document || typeof body.document !== "object" || Array.isArray(body.document)) {
          return new Response(JSON.stringify({ error: "document is required" }), { status: 400, headers: cors() });
        }
        return resultResponse(await rpc("goc_rag_upsert_document", { p_document: body.document }));
      }
      if (action === "rag_chunks") {
        const documentId = String(body?.documentId || "").trim();
        if (!documentId || !Array.isArray(body?.chunks) || body.chunks.length > 50) {
          return new Response(JSON.stringify({ error: "documentId and up to 50 chunks are required" }), { status: 400, headers: cors() });
        }
        return resultResponse(await rpc("goc_rag_upsert_chunks", { p_document_id: documentId, p_chunks: body.chunks }));
      }
      let username = String(body?.username || "").trim();

      if (!username && accountId) username = (await lookupUsername(accountId)) || "";
      if (!username || !accountId || !Number.isInteger(body?.expectedRevision) || !body?.snapshot) {
        return new Response(JSON.stringify({ error: "username/accountId, expectedRevision, and snapshot are required" }), { status: 400, headers: cors() });
      }
      return resultResponse(await rpc("goc_bridge_upsert", {
        p_username: username,
        p_account_id: accountId,
        p_expected_revision: body.expectedRevision,
        p_snapshot: body.snapshot,
      }));
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: cors() });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Bridge failure" }), { status: 500, headers: cors() });
  }
});
