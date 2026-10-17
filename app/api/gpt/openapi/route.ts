import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const revision = { type: "integer", minimum: 0 };
const responseSchema = {
  type: "object",
  properties: {
    ok: { type: "boolean" },
    revision: { type: "integer", minimum: 0 },
    message: { type: "string" },
    contractVersion: { type: "string", enum: ["goc-gameplay-v1"] },
    turnId: { type: "string" },
    narration: { type: "string" },
    roll: { type: ["object","null"], additionalProperties: true },
    gameplayAdvanced: { type: "boolean" },
    snapshot: { type: "object", description: "Same player-visible authoritative snapshot as the browser; server-private NPC data removed.", additionalProperties: true },
    state: { type: "object", additionalProperties: true },
    character: { type: "object", additionalProperties: true },
    hud: { type: "object", additionalProperties: true },
    retry: { type: "object", properties: {
      status: { type: "string" }, turnId: { type: "string" },
      baseRevision: revision, retryAt: { type: "string", format: "date-time" },
      retryAfterSeconds: { type: "integer", minimum: 1 }, estimated: { type: "boolean" },
      retryTicket: { type: "string" }, gameplayAdvanced: { type: "boolean" },
    }, additionalProperties: false },
    retryTicket: { type: "string" },
    secondsRemaining: { type: "integer", minimum: 0 },
    canSubmit: { type: "boolean" },
    retryAfterSeconds: { type: "integer", minimum: 1 },
    retryAfterEstimated: { type: "boolean" },
    receipt: {
      type: "object",
      description: "Authoritative transaction receipt. A committed receipt proves the turn is already saved; a failed receipt proves gameplay did not advance and identifies the exact retry phase.",
      properties: {
        turnId: { type: "string" },
        baseRevision: revision,
        status: { type: "string", enum: ["processing", "committed", "failed"] },
        phase: { type: "string" },
        draftAttempts: { type: "integer", minimum: 0 },
        committedRevision: revision,
        gameplayAdvanced: { type: "boolean" },
        retriable: { type: "boolean" },
        replayed: { type: "boolean" },
        reason: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: true,
};

const jsonResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: responseSchema } },
});

const playerActions = {
  type: "object",
  properties: {
    standard: { type: "integer" },
    move: { type: "integer" },
    swift: { type: "integer" },
    reaction: { type: "integer" },
  },
  additionalProperties: false,
};
const combatant = {
  type: "object",
  properties: {
    name: { type: "string" },
    side: { type: "string" },
    hp: { type: "integer" },
    maxHp: { type: "integer" },
    conditionTrack: { type: "integer" },
  },
  additionalProperties: true,
};
const combat = {
  type: "object",
  properties: {
    status: { type: "string" },
    round: { type: "integer", minimum: 0 },
    activeSide: { type: "string" },
    playerActions,
    combatants: { type: "array", items: combatant },
  },
  additionalProperties: true,
};
const inventoryItem = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    qty: { type: "integer", minimum: 0 },
    tag: { type: "string" },
  },
  additionalProperties: true,
};
const bearerSecurity = [{ bearerAuth: [] }];

export async function GET(request: Request) {
  // An imported GPT action must follow production releases, not the immutable
  // deployment hostname from which someone happened to open this schema.
  const controllerUrl = process.env.GOC_GPT_PUBLIC_BASE_URL || "https://galaxy-local.vercel.app";
  const paths = {
    "/api/gpt/ping": {
      get: {
        operationId: "pingCampaignService",
        summary: "Verify the campaign controller is reachable",
        description: "Public, read-only health check. Returns no campaign or account data and never advances gameplay.",
        security: [],
        responses: { "200": jsonResponse("Controller is reachable") },
      },
    },
    "/api/gpt/state": {
      get: {
        operationId: "getCampaignState",
        summary: "Load authoritative campaign state",
        description: "Call before gameplay. Returns the current Neon-backed revision, character, HUD, world state, and last narration.",
        security: bearerSecurity,
        responses: { "200": jsonResponse("Current campaign state"), "401": { description: "Unauthorized" }, "409": { description: "No campaign initialized" } },
      },
    },
    "/api/gpt/hud": {
      get: {
        operationId: "getCampaignHUD",
        summary: "Read the authoritative web-app HUD",
        description: "Read-only. Never advances gameplay or rolls dice.",
        security: bearerSecurity,
        responses: { "200": jsonResponse("Current HUD"), "401": { description: "Unauthorized" } },
      },
    },
    "/api/gpt/save": {
      post: {
        operationId: "saveCheckpoint",
        summary: "Create an exact campaign checkpoint",
        description: "Administrative save only. No narration, roll, initiative, or gameplay mutation.",
        security: bearerSecurity,
        requestBody: { required: false, content: { "application/json": { schema: { type: "object", properties: { label: { type: "string", maxLength: 120 } }, additionalProperties: false } } } },
        responses: { "200": jsonResponse("Checkpoint created"), "401": { description: "Unauthorized" } },
      },
    },
    "/api/gpt/checkpoints": {
      get: {
        operationId: "listCheckpoints",
        summary: "List campaign checkpoints",
        description: "Read-only checkpoint listing.",
        security: bearerSecurity,
        responses: { "200": jsonResponse("Checkpoint list"), "401": { description: "Unauthorized" } },
      },
    },
    "/api/gpt/load": {
      post: {
        operationId: "loadCheckpoint",
        summary: "Restore an exact campaign checkpoint",
        description: "Administrative restore only. Does not resolve gameplay.",
        security: bearerSecurity,
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["checkpointId", "expectedRevision"], properties: { checkpointId: { type: "string", minLength: 1 }, expectedRevision: revision }, additionalProperties: false } } } },
        responses: { "200": jsonResponse("Checkpoint restored"), "400": { description: "Invalid request" }, "409": { description: "Revision conflict" } },
      },
    },
    "/api/gpt/reconcile": {
      post: {
        operationId: "reconcileCampaignState",
        summary: "Apply an explicit OOC state correction",
        description: "Administrative correction only. Never narrates, rolls, creates initiative, or advances combat. The response is intentionally compact and never returns the full campaign snapshot.",
        security: bearerSecurity,
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["expectedRevision", "patch"], properties: { expectedRevision: revision, patch: { type: "object", properties: { level: { type: "integer", minimum: 1 }, experience: { type: "integer", minimum: 0 }, health: { type: "integer" }, credits: { type: "integer" }, creditsCriminal: { type: "integer" }, location: { type: "string" }, conditionTrack: { type: "integer" }, campaignTimeMinutes: { type: "integer", minimum: 0 }, inventory: { type: "array", items: inventoryItem }, objectives: { type: "array", items: { type: "object", properties: { title: { type: "string" }, detail: { type: "string" }, status: { type: "string" } }, additionalProperties: true } }, combat, lastNarration: { type: "string", maxLength: 12000 } }, additionalProperties: false }, reason: { type: "string", maxLength: 200 } }, additionalProperties: false } } } },
        responses: { "200": jsonResponse("State reconciled"), "400": { description: "Invalid patch" }, "409": { description: "Revision conflict" } },
      },
    },
    "/api/gpt/pending": {
      post: {
        operationId: "checkPendingPlayerAction",
        summary: "Check pending turn countdown or recover an already committed outcome",
        description: "Read-only. Pass the exact retryTicket from an interrupted turn. Returns cooldown, ready, or the authoritative committed result. Never advances gameplay or rolls dice.",
        security: bearerSecurity,
        requestBody: { required: true, content: { "application/json": { schema: {
          type: "object", required: ["retryTicket"],
          properties: { retryTicket: { type: "string", minLength: 48 } }, additionalProperties: false,
        } } } },
        responses: {
          "200": jsonResponse("Pending cooldown, ready status or committed replay"),
          "400": jsonResponse("Invalid or expired ticket"),
          "401": jsonResponse("Unauthorized"), "409": jsonResponse("Saved campaign revision changed"),
        },
      },
    },
    "/api/gpt/turn": {
      post: {
        operationId: "submitPlayerAction",
        summary: "Resolve exactly one in-world player action",
        description: "Canonical Saga GM action, same result as browser. Use revision + action + turnId for a new action OR retryTicket alone for resumption. On 429 use checkPendingPlayerAction to track cooldown, then replay the ticket unchanged. GPT cannot schedule background tool calls.",
        security: bearerSecurity,
        requestBody: { required: true, content: { "application/json": { schema: {
          oneOf: [
            { type: "object", required: ["revision", "action", "turnId"],
              properties: { revision, action: { type: "string", minLength: 1, maxLength: 2000 },
                turnId: { type: "string", minLength: 8, maxLength: 100, pattern: "^[a-zA-Z0-9_-]+$" } },
              additionalProperties: false },
            { type: "object", required: ["retryTicket"],
              properties: { retryTicket: { type: "string", minLength: 48 } }, additionalProperties: false },
          ],
        } } } },
        responses: { "200": jsonResponse("Committed or safely replayed gameplay turn with a transaction receipt"), "400": { description: "Invalid action" }, "401": { description: "Unauthorized" }, "409": { description: "Revision conflict, replay, or required character advancement" }, "422": { description: "Administrative command; use the indicated control action" }, "429": jsonResponse("Cooldown; encrypted retryTicket preserves action, turnId and base revision. No gameplay applied"), "502": jsonResponse("Draft rejected before commit; receipt identifies the failed phase"), "503": jsonResponse("GM drafting exhausted before commit; receipt confirms a safe retry") },
      },
    },
  };

  return NextResponse.json({
    openapi: "3.1.0",
    info: {
      title: "Galaxy of Consequence Custom GPT Controller",
      version: "2.3.0",
      description: "One authoritative GOC campaign. Browser and GPT receive the same public gameplay contract, with encrypted GPT cooldown/recovery tickets and no invented gameplay on error.",
    },
    servers: [{ url: controllerUrl }],
    paths,
    components: {
      schemas: {
        ParserAnchor: {
          type: "object",
          properties: { value: { type: "string" } },
          additionalProperties: false,
        },
      },
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "GOC GPT action key" },
      },
    },
  }, { headers: { "Cache-Control": "no-store" } });
}
