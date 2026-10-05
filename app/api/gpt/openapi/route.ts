import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const responseSchema = {
  type: "object",
  properties: {
    ok: { type: "boolean" },
    revision: { type: "integer", minimum: 0 },
    message: { type: "string" },
  },
  additionalProperties: true,
};

const jsonResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: responseSchema } },
});

const revision = { type: "integer", minimum: 0 };
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

export async function GET(request: Request) {
  // An imported GPT action must follow production releases, not the immutable
  // deployment hostname from which someone happened to open this schema.
  const controllerUrl = process.env.GOC_GPT_PUBLIC_BASE_URL || "https://galaxy-local.vercel.app";
  const paths = {
    "/api/gpt/state": {
      get: {
        operationId: "getCampaignState",
        summary: "Load authoritative campaign state",
        description: "Call before gameplay. Returns the current Supabase-backed revision, character, HUD, world state, and last narration.",
        responses: { "200": jsonResponse("Current campaign state"), "401": { description: "Unauthorized" }, "409": { description: "No campaign initialized" } },
      },
    },
    "/api/gpt/hud": {
      get: {
        operationId: "getCampaignHUD",
        summary: "Read the authoritative web-app HUD",
        description: "Read-only. Never advances gameplay or rolls dice.",
        responses: { "200": jsonResponse("Current HUD"), "401": { description: "Unauthorized" } },
      },
    },
    "/api/gpt/save": {
      post: {
        operationId: "saveCheckpoint",
        summary: "Create an exact campaign checkpoint",
        description: "Administrative save only. No narration, roll, initiative, or gameplay mutation.",
        requestBody: { required: false, content: { "application/json": { schema: { type: "object", properties: { label: { type: "string", maxLength: 120 } }, additionalProperties: false } } } },
        responses: { "200": jsonResponse("Checkpoint created"), "401": { description: "Unauthorized" } },
      },
    },
    "/api/gpt/checkpoints": {
      get: {
        operationId: "listCheckpoints",
        summary: "List campaign checkpoints",
        description: "Read-only checkpoint listing.",
        responses: { "200": jsonResponse("Checkpoint list"), "401": { description: "Unauthorized" } },
      },
    },
    "/api/gpt/load": {
      post: {
        operationId: "loadCheckpoint",
        summary: "Restore an exact campaign checkpoint",
        description: "Administrative restore only. Does not resolve gameplay.",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["checkpointId", "expectedRevision"], properties: { checkpointId: { type: "string", minLength: 1 }, expectedRevision: revision }, additionalProperties: false } } } },
        responses: { "200": jsonResponse("Checkpoint restored"), "400": { description: "Invalid request" }, "409": { description: "Revision conflict" } },
      },
    },
    "/api/gpt/reconcile": {
      post: {
        operationId: "reconcileCampaignState",
        summary: "Apply an explicit OOC state correction",
        description: "Administrative correction only. Never narrates, rolls, creates initiative, or advances combat. The response is intentionally compact and never returns the full campaign snapshot.",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["expectedRevision", "patch"], properties: { expectedRevision: revision, patch: { type: "object", properties: { level: { type: "integer", minimum: 1 }, experience: { type: "integer", minimum: 0 }, health: { type: "integer" }, credits: { type: "integer" }, creditsCriminal: { type: "integer" }, location: { type: "string" }, conditionTrack: { type: "integer" }, campaignTimeMinutes: { type: "integer", minimum: 0 }, inventory: { type: "array", items: inventoryItem }, objectives: { type: "array", items: { type: "object", properties: { title: { type: "string" }, detail: { type: "string" }, status: { type: "string" } }, additionalProperties: true } }, combat, lastNarration: { type: "string", maxLength: 12000 } }, additionalProperties: false }, reason: { type: "string", maxLength: 200 } }, additionalProperties: false } } } },
        responses: { "200": jsonResponse("State reconciled"), "400": { description: "Invalid patch" }, "409": { description: "Revision conflict" } },
      },
    },
    "/api/gpt/turn": {
      post: {
        operationId: "submitPlayerAction",
        summary: "Resolve exactly one in-world player action",
        description: "Gameplay only. Never use this operation for save, load, HUD, sync, reconciliation, or OOC corrections. The server owns dice, Saga resolution, consequences, and persistence.",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["revision", "action"], properties: { revision, action: { type: "string", minLength: 1, maxLength: 2000 }, turnId: { type: "string", minLength: 8, maxLength: 100, pattern: "^[a-zA-Z0-9_-]+$" } }, additionalProperties: false } } } },
        responses: { "200": jsonResponse("Committed gameplay turn"), "400": { description: "Invalid action" }, "401": { description: "Unauthorized" }, "409": { description: "Revision conflict or replay" }, "422": { description: "Administrative command; use the indicated control action" } },
      },
    },
  };

  return NextResponse.json({
    openapi: "3.0.3",
    info: {
      title: "Galaxy of Consequence Custom GPT Controller",
      version: "2.0.5",
      description: "Authoritative GOC controller: state/HUD/checkpoints/reconciliation are separate from gameplay turns.",
    },
    servers: [{ url: controllerUrl }],
    security: [{ bearerAuth: [] }],
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
