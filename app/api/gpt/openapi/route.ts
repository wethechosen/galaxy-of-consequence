import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const stateSchema = {
    type: "object",
    required: ["account", "revision", "character", "hud", "world", "lastNarration"],
    properties: {
      account: { type: "object" }, revision: { type: "integer", minimum: 0 }, character: { type: ["object", "null"] },
      hud: { type: "object" }, world: { type: "object" }, lastNarration: { type: "string" },
    },
  };
  const turnSchema = {
    type: "object",
    required: ["revision", "turnId", "narration", "hud", "state"],
    properties: {
      revision: { type: "integer", minimum: 0 }, turnId: { type: "string" }, narration: { type: "string" },
      roll: { type: ["object", "null"] }, provider: { type: "string" }, fallbackReason: { type: ["string", "null"] },
      hud: { type: "object" }, state: { type: "object" },
    },
  };
  return NextResponse.json({
    openapi: "3.1.0",
    info: { title: "Galaxy of Consequence Custom GPT Action", version: "1.0.0", description: "Read D'mir's confirmed campaign state and submit one player action through the authoritative Saga GM." },
    servers: [{ url: `${url.protocol}//${url.host}` }],
    security: [{ bearerAuth: [] }],
    paths: {
      "/api/gpt/state": { get: { operationId: "getCampaignState", summary: "Read the latest confirmed campaign state", description: "Always call this before submitting an action. The revision is the concurrency token for the next turn.", responses: { "200": { description: "Current character, world state, and revision", content: { "application/json": { schema: stateSchema } } }, "401": { description: "Unauthorized" }, "409": { description: "No campaign is initialized" } } } },
      "/api/gpt/turn": { post: { operationId: "submitPlayerAction", summary: "Submit one player action to the Game Master", description: "Submit exactly one intended player action. The server owns dice, Saga resolution, consequences, and persistence. Do not bulk-import transcripts or invent state changes.", requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["revision", "action"], properties: { revision: { type: "integer", minimum: 0 }, action: { type: "string", minLength: 1, maxLength: 2000 }, turnId: { type: "string", minLength: 8, maxLength: 100 } } } } } }, responses: { "200": { description: "Committed GM narration and updated state", content: { "application/json": { schema: turnSchema } } }, "400": { description: "Invalid action or revision" }, "401": { description: "Unauthorized" }, "409": { description: "Stale revision or duplicate turn; re-read state" } } } },
    },
    components: {
      schemas: {},
      securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "GOC GPT action key" } },
    },
  }, { headers: { "Cache-Control": "no-store" } });
}
