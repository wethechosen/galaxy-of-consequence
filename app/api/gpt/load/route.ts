import { NextResponse } from "next/server";
import { bridgeLoadCheckpoint } from "../../../../lib/datapad-bridge";
import { controllerAccountId, controllerError, requireGptController } from "../../../../lib/gpt-controller-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = requireGptController(request);
  if (denied) return denied;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const checkpointId = String(body?.checkpointId || "").trim();
  const expectedRevision = Number(body?.expectedRevision);
  if (!checkpointId || !Number.isInteger(expectedRevision) || expectedRevision < 0) {
    return NextResponse.json({ error: "checkpointId and expectedRevision are required." }, { status: 400 });
  }

  try {
    const result = await bridgeLoadCheckpoint(controllerAccountId(), checkpointId, expectedRevision);
    return NextResponse.json({
      ...result,
      controllerMode: "checkpoint-load",
      gameplayAdvanced: false,
      rollGenerated: false,
      narrationGenerated: false,
      instruction: "The selected checkpoint was restored exactly. Resume play from the returned revision and state.",
    });
  } catch (error) {
    console.error("[api/gpt/load] failed", error);
    return controllerError(error, "Unable to load checkpoint.");
  }
}
