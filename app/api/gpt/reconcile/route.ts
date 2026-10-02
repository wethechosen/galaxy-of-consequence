import { NextResponse } from "next/server";
import { bridgeReconcile, type ReconciliationPatch } from "../../../../lib/datapad-bridge";
import { controllerAccountId, controllerError, requireGptController } from "../../../../lib/gpt-controller-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowed = new Set([
  "level",
  "experience",
  "health",
  "credits",
  "location",
  "inventory",
  "combat",
  "conditionTrack",
]);

function validatePatch(value: unknown): value is ReconciliationPatch {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.keys(value as Record<string, unknown>).every((key) => allowed.has(key));
}

export async function POST(request: Request) {
  const denied = requireGptController(request);
  if (denied) return denied;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const expectedRevision = Number(body?.expectedRevision);
  const patch = body?.patch;
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0 || !validatePatch(patch)) {
    return NextResponse.json(
      {
        error:
          "expectedRevision and a strict reconciliation patch are required. Supported fields: level, experience, health, credits, location, inventory, combat, conditionTrack.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await bridgeReconcile(
      controllerAccountId(),
      expectedRevision,
      patch,
      String(body?.reason || "Explicit OOC campaign reconciliation").slice(0, 200),
    );
    return NextResponse.json({
      ...result,
      controllerMode: "ooc-reconciliation",
      gameplayAdvanced: false,
      rollGenerated: false,
      narrationGenerated: false,
      initiativeGenerated: false,
      instruction:
        "This was an administrative state correction only. Do not narrate it as an in-world event and do not infer any additional changes.",
    });
  } catch (error) {
    console.error("[api/gpt/reconcile] failed", error);
    return controllerError(error, "Unable to reconcile campaign state.");
  }
}
