import { NextResponse } from "next/server";
import { sourceStatus } from "@/lib/sources";
import { assertAuthenticatedRequest as assertLocalRequest } from "@/lib/local-http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try { assertLocalRequest(request); return NextResponse.json({ sources: sourceStatus() }); }
  catch { return NextResponse.json({ error: "Source library unavailable" }, { status: 503 }); }
}
