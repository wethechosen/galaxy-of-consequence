import { NextResponse } from "next/server";
import { bridgeSaveCheckpoint } from "../../../../lib/datapad-bridge";
import { controllerAccountId, controllerError, requireGptController } from "../../../../lib/gpt-controller-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = requireGptController(request);
  if (denied) return denied;

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  try {
    const label = String(body?.label || "GPT manual checkpoint").trim().slice(0, 120) || "GPT manual checkpoint";
    const result = await bridgeSaveCheckpoint(controllerAccountId(), label);
    return NextResponse.json({
      ...result,
      controllerMode: "checkpoint-save",
      gameplayAdvanced: false,
      rollGenerated: false,
      narrationGenerated: false,
      instruction: "The checkpoint is an exact copy of the authoritative save. No gameplay was resolved.",
    });
  } catch (error) {
    console.error("[api/gpt/save] failed", error);
    return controllerError(error, "Unable to create checkpoint.");
  }
}
