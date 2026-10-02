import { NextResponse } from "next/server";
import { gameplayReadiness } from "@/lib/game-readiness";
import { assertAuthenticatedRequest } from "@/lib/local-http";
export async function GET(request: Request) {
  try { assertAuthenticatedRequest(request); return NextResponse.json(gameplayReadiness()); }
  catch { return NextResponse.json({ error: "Sign in required." }, { status: 403 }); }
}
