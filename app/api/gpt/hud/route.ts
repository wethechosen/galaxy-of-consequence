import { NextResponse } from "next/server";
import { bridgeGet } from "../../../../lib/datapad-bridge";
import { controllerAccountId, controllerError, requireGptController } from "../../../../lib/gpt-controller-auth";
import { advancementGate } from "@/original/lib/sagaAdvancement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = requireGptController(request);
  if (denied) return denied;

  try {
    const saved = await bridgeGet(controllerAccountId());
    const character = saved.snapshot?.character || {};
    const state = saved.snapshot?.gameState || {};
    const result = { revision: saved.revision, character, hud: {
      location: state.location, health: state.health, conditionTrack: state.conditionTrack || 0,
      credits: state.credits || 0, bankCredits: state.bankCredits || 0, creditsCriminal: state.creditsCriminal || 0,
      level: character.level || 1, experience: character.experience || 0,
      forcePoints: state.forcePoints || 0, destinyPoints: state.destinyPoints || 0, darkSideScore: state.darkSideScore || 0,
      notoriety: state.notoriety || 0, combat: state.combat || null,
      properties: state.properties || [], ships: state.ships || [], inventory: state.inventory || [],
    } };
    return NextResponse.json({
      ...result,
      advancement: { ...advancementGate(result.character || {}), dossierUrl: "https://galaxy-local.vercel.app/character#advancement" },
      controllerMode: "hud-read-only",
      instruction: "Use this as authoritative web HUD state. Do not infer changes from this read.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[api/gpt/hud] failed", error);
    return controllerError(error, "Unable to load HUD state.");
  }
}
