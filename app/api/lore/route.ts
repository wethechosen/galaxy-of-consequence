import { NextResponse } from "next/server";
import { getCampaign } from "@/lib/campaign-store";
import { playerVisibleLore } from "@/lib/lore";
import { assertAuthenticatedRequest as assertLocalRequest } from "@/lib/local-http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try { assertLocalRequest(request); } catch { return NextResponse.json({ error: "Local access only" }, { status: 403 }); }
  const campaign = getCampaign();
  return NextResponse.json({ lore: playerVisibleLore(campaign.loreFacts) });
}
