import { NextResponse } from "next/server";
import { bridgeGetHud } from "../../../../lib/datapad-bridge";
import { controllerAccountId, controllerError, requireGptController } from "../../../../lib/gpt-controller-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = requireGptController(request);
  if (denied) return denied;

  try {
    const result = await bridgeGetHud(controllerAccountId());
    return NextResponse.json({
      ...result,
      controllerMode: "hud-read-only",
      instruction: "Use this as authoritative web HUD state. Do not infer changes from this read.",
    });
  } catch (error) {
    console.error("[api/gpt/hud] failed", error);
    return controllerError(error, "Unable to load HUD state.");
  }
}
