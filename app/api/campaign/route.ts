import { NextResponse } from "next/server";
import { getCampaign, listTimelines, selectTimeline, catchUpCampaign, createNewCampaign } from "@/lib/campaign-store";
import { playerView } from "@/lib/player-view";
import { assertAuthenticatedRequest as assertLocalRequest, readObject } from "@/lib/local-http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try { assertLocalRequest(request); return NextResponse.json({ campaign: playerView(getCampaign()), timelines: listTimelines() }); }
  catch { return NextResponse.json({ error: "Local access only" }, { status: 403 }); }
}

export async function POST(request: Request) {
  try { assertLocalRequest(request); return NextResponse.json({ campaign: playerView(catchUpCampaign()), timelines: listTimelines() }); }
  catch { return NextResponse.json({ error: "Catch-up failed; no partial changes saved" }, { status: 409 }); }
}

export async function PUT(request: Request) {
  const body = await readObject(request).catch(() => null);
  if (typeof body?.timelineId !== "string") return NextResponse.json({ error: "Timeline ID required" }, { status: 400 });
  try { return NextResponse.json({ campaign: playerView(selectTimeline(body.timelineId)), timelines: listTimelines() }); }
  catch { return NextResponse.json({ error: "Timeline not found" }, { status: 404 }); }
}

export async function PATCH(request: Request) {
  const body = await readObject(request).catch(() => null);
  if (body?.command !== "new_campaign") return NextResponse.json({ error: "Invalid command" }, { status: 400 });
  return NextResponse.json({ campaign: playerView(createNewCampaign()), timelines: listTimelines() });
}
