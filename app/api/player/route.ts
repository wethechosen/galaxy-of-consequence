import { NextResponse } from "next/server";
import { playerCommand } from "@/lib/campaign-store";
import { playerView } from "@/lib/player-view";
import { readObject } from "@/lib/local-http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try { return NextResponse.json({ campaign: playerView(playerCommand(await readObject(request))) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Command failed" }, { status: 409 }); }
}
