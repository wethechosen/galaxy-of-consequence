import { NextResponse } from "next/server";
import { getCampaign } from "@/lib/campaign-store";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ campaign: getCampaign() });
}
