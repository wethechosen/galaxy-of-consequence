import { NextResponse } from "next/server";
import { getCampaign } from "@/lib/campaign-store";
import { playerVisibleLore } from "@/lib/lore";

export const runtime = "nodejs";

export async function GET() {
  const campaign = getCampaign();
  return NextResponse.json({ lore: playerVisibleLore(campaign.loreFacts) });
}
