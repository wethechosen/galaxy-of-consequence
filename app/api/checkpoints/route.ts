import { NextResponse } from "next/server";
import { createCheckpoint, getCampaign, restoreCheckpoint } from "@/lib/campaign-store";
import { playerView } from "@/lib/player-view";
import { assertAuthenticatedRequest as assertLocalRequest, readObject } from "@/lib/local-http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try { assertLocalRequest(request); } catch { return NextResponse.json({ error: "Local access only" }, { status: 403 }); }
  return NextResponse.json({ checkpoints: getCampaign().checkpoints });
}

export async function POST(request: Request) {
  const body = await readObject(request).catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  if (typeof body.campaignId !== "string" || !Number.isSafeInteger(body.revision)) return NextResponse.json({ error: "Campaign ID and revision required" }, { status: 400 });
  const label = typeof body?.label === "string" ? body.label : "";
  try {
    const result = createCheckpoint(body.campaignId, label, body.revision as number);
    return NextResponse.json({ ...result, campaign: playerView(result.campaign) });
  } catch { return NextResponse.json({ error: "Checkpoint not saved. Refresh the selected timeline and retry." }, { status: 409 }); }
}

export async function PUT(request: Request) {
  const body = await readObject(request).catch(() => null);
  if (typeof body?.checkpointId !== "string" || typeof body.campaignId !== "string" || !Number.isSafeInteger(body.revision)) return NextResponse.json({ error: "Checkpoint, campaign ID and revision required" }, { status: 400 });
  try { return NextResponse.json({ campaign: playerView(restoreCheckpoint(body.checkpointId, body.campaignId, body.revision as number)) }); }
  catch { return NextResponse.json({ error: "Unable to restore checkpoint. Refresh the selected timeline and retry." }, { status: 409 }); }
}
