import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VERCEL_BASE = Deno.env.get("GOC_VERCEL_BASE_URL") || "https://galaxy-local.vercel.app";
const DEFAULT_ACCOUNT_ID = Deno.env.get("GOC_GPT_ACCOUNT_ID") || "bc822f06-3f84-48dd-9468-3151cf3485f9";

function headers(extra: Record<string, string> = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    ...extra,
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: headers() });
}

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
  const text = await response.text();
  if (!response.ok) throw new Error(text || `Supabase RPC failed (${response.status})`);
  return text ? JSON.parse(text) : null;
}

function normalizeRoute(url: URL) {
  const marker = "/goc-gpt-controller";
  let route = url.pathname.includes(marker) ? url.pathname.split(marker)[1] || "/" : url.pathname;
  if (route.startsWith("/api/gpt/")) route = route.slice("/api/gpt".length);
  if (route === "/api/gpt") route = "/";
  return route.replace(/\/+$/, "") || "/";
}

function controllerAuth(req: Request) {
  const auth = req.headers.get("authorization") || "";
  return auth.startsWith("Bearer ") && auth.length > 12 ? auth : "";
}

async function vercelState(auth: string) {
  const response = await fetch(`${VERCEL_BASE}/api/gpt/state`, {
    method: "GET",
    headers: { Authorization: auth, Accept: "application/json" },
    cache: "no-store",
  });
  const text = await response.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  return { response, data };
}

async function validate(auth: string) {
  const current = await vercelState(auth);
  if (!current.response.ok) {
    return {
      ok: false as const,
      response: json(
        { error: "Controller authorization failed.", upstreamStatus: current.response.status },
        current.response.status === 401 || current.response.status === 403 ? 401 : 502,
      ),
    };
  }
  return { ok: true as const, state: current.data };
}

function controlIntent(action: string) {
  const value = action.toLowerCase();
  if (/(load\s+(game|checkpoint|state)|restore\s+(a\s+)?checkpoint)/i.test(value)) return "loadCheckpoint";
  if (/(save\s+(game|checkpoint|state)|create\s+(a\s+)?checkpoint)/i.test(value)) return "saveCheckpoint";
  if (/\bhud\b/i.test(value)) return "getCampaignHUD";
  if (/(out[- ]of[- ]character|\booc\b|reconcil(e|iation)|sync\s+(state|save)|set\s+and\s+persist|authoritative\s+save)/i.test(value)) return "reconcileCampaignState";
  return null;
}

async function proxyVercel(req: Request, path: string, bodyText?: string) {
  const response = await fetch(`${VERCEL_BASE}${path}`, {
    method: req.method,
    headers: {
      Authorization: req.headers.get("authorization") || "",
      ...(bodyText !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(bodyText !== undefined ? { body: bodyText } : {}),
    cache: "no-store",
  });
  const text = await response.text();
  return new Response(text, { status: response.status, headers: headers() });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: headers() });

  const auth = controllerAuth(req);
  if (!auth) return json({ error: "Bearer controller authorization is required." }, 401);

  const route = normalizeRoute(new URL(req.url));

  try {
    if (route === "/state" && req.method === "GET") {
      return await proxyVercel(req, "/api/gpt/state");
    }

    const validated = await validate(auth);
    if (!validated.ok) return validated.response;
    const accountId = String(validated.state?.accountId || validated.state?.account_id || DEFAULT_ACCOUNT_ID);

    if (route === "/turn" && req.method === "POST") {
      const bodyText = await req.text();
      let body: any = {};
      try { body = bodyText ? JSON.parse(bodyText) : {}; } catch { return json({ error: "Invalid JSON body." }, 400); }
      const operation = controlIntent(String(body?.action || ""));
      if (operation) {
        return json({
          error: "control_command_requires_control_action",
          message: "This request is administrative, not gameplay. No roll or state mutation was attempted.",
          useOperation: operation,
          revision: validated.state?.revision,
        }, 422);
      }
      return await proxyVercel(req, "/api/gpt/turn", JSON.stringify(body));
    }

    if (route === "/hud" && req.method === "GET") {
      const result = await rpc("goc_hud_get", { p_account_id: accountId });
      return json({ ...result, controllerMode: "hud-read-only", gameplayAdvanced: false });
    }

    if (route === "/checkpoints" && req.method === "GET") {
      const checkpoints = await rpc("goc_checkpoint_list", { p_account_id: accountId });
      return json({ ok: true, checkpoints, controllerMode: "checkpoint-list", gameplayAdvanced: false });
    }

    if (route === "/save" && req.method === "POST") {
      let body: any = {};
      try { body = await req.json(); } catch { body = {}; }
      const result = await rpc("goc_checkpoint_save", {
        p_account_id: accountId,
        p_label: String(body?.label || "GPT manual checkpoint"),
      });
      return json({ ...result, controllerMode: "checkpoint-save", gameplayAdvanced: false, rollGenerated: false, initiativeGenerated: false, narrationGenerated: false });
    }

    if (route === "/load" && req.method === "POST") {
      const body = await req.json();
      if (!body?.checkpointId || !Number.isInteger(body?.expectedRevision)) return json({ error: "checkpointId and expectedRevision are required." }, 400);
      const result = await rpc("goc_checkpoint_load", {
        p_account_id: accountId,
        p_checkpoint_id: body.checkpointId,
        p_expected_revision: body.expectedRevision,
      });
      if (result?.ok === false) return json(result, result?.error === "revision_conflict" ? 409 : 400);
      return json({ ...result, controllerMode: "checkpoint-load", gameplayAdvanced: false, rollGenerated: false, initiativeGenerated: false, narrationGenerated: false });
    }

    if (route === "/reconcile" && req.method === "POST") {
      const body = await req.json();
      if (!Number.isInteger(body?.expectedRevision) || !body?.patch || typeof body.patch !== "object" || Array.isArray(body.patch)) return json({ error: "expectedRevision and patch are required." }, 400);
      const result = await rpc("goc_reconcile_patch", {
        p_account_id: accountId,
        p_expected_revision: body.expectedRevision,
        p_patch: body.patch,
        p_reason: String(body?.reason || "Explicit OOC campaign reconciliation"),
      });
      if (result?.ok === false) return json(result, result?.error === "revision_conflict" ? 409 : 400);
      return json({ ...result, controllerMode: "ooc-reconciliation", gameplayAdvanced: false, rollGenerated: false, initiativeGenerated: false, narrationGenerated: false });
    }

    return json({ error: "Unknown controller route.", route }, 404);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Controller failure" }, 500);
  }
});
