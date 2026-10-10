import { NextResponse } from "next/server";
import { readDatapad } from "@/lib/datapad-save";
import { GptActionError, actorSummary, authenticateGptAction } from "@/lib/gpt-action";
import { hostedGet, hostedPersistenceEnabled } from "@/lib/hosted-bridge";
import { buildCampaignRecap, campaignTranscript, sameCampaignLocation } from "@/original/lib/campaignResume";
import { parseImmersiveMessage } from "@/original/lib/immersiveChat";
import { advancementGate } from "@/original/lib/sagaAdvancement";
import { itemStatBlock } from "@/original/lib/itemStats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const actor = authenticateGptAction(request);
    const saved = hostedPersistenceEnabled() ? await hostedGet(actor.username) : readDatapad(actor, actor.id);
    if (!saved || !saved.snapshot) return NextResponse.json({ error: "No campaign is initialized for the configured action account." }, { status: 409 });
    const snapshot = saved.snapshot;
    const state = snapshot.gameState;
    const messages = Array.isArray(saved.snapshot.messages) ? saved.snapshot.messages : [];
    const recap = buildCampaignRecap(saved.snapshot);
    const lastConfirmed = [...campaignTranscript(messages).confirmed].reverse().find((message: Record<string, unknown>) =>
      message.role === "assistant" && sameCampaignLocation(parseImmersiveMessage(String(message.content || "")).location, state.location));
    return NextResponse.json({
      account: actorSummary(actor), revision: saved.revision,
      character: saved.snapshot.character,
      itemStatBlocks: [...(Array.isArray(state.inventory) ? state.inventory : []), ...(Array.isArray(state.properties) ? state.properties : []).map(item => ({ ...item, ownership: "property" })), ...(Array.isArray(state.ships) ? state.ships : []).map(item => ({ ...item, ownership: "vehicle" }))].map(item => ({ id: item.id, ...itemStatBlock(item, snapshot.character || {}, state) })),
      advancement: { ...advancementGate(saved.snapshot.character || {}), dossierUrl: "https://galaxy-local.vercel.app/character#advancement" },
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
        credits: state.credits, bankCredits: state.bankCredits || 0, creditsCriminal: state.creditsCriminal, inventory: state.inventory,
        properties: state.properties, ships: state.ships, investments: state.investments,
        tradeOffers: state.tradeOffers, tradeReceipts: state.tradeReceipts,
        objectives: state.objectives, discoveries: state.discoveries, milestones: state.milestones,
        relationships: state.relationships, factionRep: state.factionRep, combat: state.combat,
        creatorCanon: state.creatorCanon,
      },
      // The GPT must not rebuild its scene from a saved diagnostic/canned reply.
      // This is the same confirmed-history projection used by the web client.
      lastNarration: lastConfirmed?.content || "",
      currentScene: { location: state.location, description: recap.scene, lastOutcome: recap.sceneIsCurrent ? recap.lastOutcome : "" },
      lastConfirmedInteraction: { scene: recap.lastRecordedScene || recap.scene, outcome: recap.lastOutcome,
        current: recap.sceneIsCurrent, note: "Historical narration is not authority to change world.location. Use the exact saved location; do not merge older places into it." },
      storyThusFar: recap,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof GptActionError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Custom GPT state request failed." }, { status });
  }
}
