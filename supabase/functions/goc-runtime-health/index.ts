import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VERCEL_BASE = Deno.env.get("GOC_VERCEL_BASE_URL") || "https://galaxy-local.vercel.app";
const ACCOUNT_ID = Deno.env.get("GOC_GPT_ACCOUNT_ID") || "bc822f06-3f84-48dd-9468-3151cf3485f9";
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

async function rpc(name: string, body: unknown) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${name} failed (${response.status})`);
  return response.json();
}
async function databaseReady() {
  try {
    return { ok: true, hud: await rpc("goc_hud_get", { p_account_id: ACCOUNT_ID }) };
  } catch {
    return { ok: false, hud: null };
  }
}

async function ragReady() {
  try {
    return { ok: true, stats: await rpc("goc_rag_stats", {}) };
  } catch {
    return { ok: false, stats: null };
  }
}

async function vercelReady() {
  try {
    const response = await fetch(`${VERCEL_BASE}/api/gpt/openapi`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    return { ok: response.ok, status: response.status };
  } catch {
    return { ok: false, status: 0 };
  }
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  const [database, rag, vercel] = await Promise.all([databaseReady(), ragReady(), vercelReady()]);
  const ok = database.ok && rag.ok && vercel.ok;
  return new Response(JSON.stringify({
    ok,
    checkedAt: new Date().toISOString(),
    supabasePersistence: database.ok ? "ready" : "unavailable",
    supabaseRag: rag.ok ? "ready" : "unavailable",
    ragStats: rag.stats,
    vercelGameplayApi: vercel.ok ? "reachable" : "unavailable",
    vercelOpenapiStatus: vercel.status,
    authenticatedGameplayTurn: "not-tested-by-public-health-probe",
  }), {
    status: ok ? 200 : 503,
    headers,
  });
});
