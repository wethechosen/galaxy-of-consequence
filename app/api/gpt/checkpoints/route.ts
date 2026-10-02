import { NextResponse } from "next/server";
import { bridgeListCheckpoints } from "../../../../lib/datapad-bridge";
import { controllerAccountId, controllerError, requireGptController } from "../../../../lib/gpt-controller-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = requireGptController(request);
  if (denied) return denied;

  try {
    const result = await bridgeListCheckpoints(controllerAccountId());
    return NextResponse.json({
      ...result,
      controllerMode: "checkpoint-list",
      gameplayAdvanced: false,
    });
  } catch (error) {
    console.error("[api/gpt/checkpoints] failed", error);
    return controllerError(error, "Unable to list checkpoints.");
  }
}
