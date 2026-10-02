import { NextResponse } from "next/server";
import { readDatapad } from "@/lib/datapad-save";
import { GptActionError, actorSummary, authenticateGptAction } from "@/lib/gpt-action";
import { hostedGet, hostedPersistenceEnabled } from "@/lib/hosted-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const actor = authenticateGptAction(request);
    const saved = hostedPersistenceEnabled() ? await hostedGet(actor.username) : readDatapad(actor, actor.id);
    if (!saved || !saved.snapshot) return NextResponse.json({ error: "No campaign is initialized for the configured action account." }, { status: 409 });
    const state = saved.snapshot.gameState;
    const messages = Array.isArray(saved.snapshot.messages) ? saved.snapshot.messages as Array<{ role?: unknown; content?: unknown }> : [];
    return NextResponse.json({
      account: actorSummary(actor), revision: saved.revision,
      character: saved.snapshot.character,
      hud: {
        level: saved.snapshot.character?.level || 1,
        experience: saved.snapshot.character?.experience || 0,
        forcePoints: state.forcePoints || 0,
        destinyPoints: state.destinyPoints || 0,
        darkSideScore: state.darkSideScore || 0,
        notoriety: state.notoriety || 0,
        carried: (Array.isArray(state.inventory) ? state.inventory : []).reduce((sum, item) => sum + Number((item as Record<string, unknown>)?.qty || 0), 0),
      },
      world: {
        location: state.location, health: state.health, conditionTrack: state.conditionTrack,
        credits: state.credits, creditsCriminal: state.creditsCriminal, inventory: state.inventory,
        objectives: state.objectives, discoveries: state.discoveries, milestones: state.milestones,
        relationships: state.relationships, factionRep: state.factionRep, combat: state.combat,
      },
      lastNarration: messages.filter((message) => message?.role === "assistant").at(-1)?.content || "",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof GptActionError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Custom GPT state request failed." }, { status });
  }
}
