import { NextResponse } from "next/server";
import { listRequests, requireAccount, submitRequest } from "@/lib/accounts";
import { assertAuthenticatedRequest, boundedText, readObject } from "@/lib/local-http";
import { getCampaign } from "@/lib/campaign-store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try { const account = assertAuthenticatedRequest(request); const campaignId = boundedText(new URL(request.url).searchParams.get("campaignId"), 80); getCampaign(campaignId); return NextResponse.json({ requests: listRequests(account, campaignId) }); }
  catch { return NextResponse.json({ error: "Unable to open review requests." }, { status: 403 }); }
}
export async function POST(request: Request) {
  try {
    const body = await readObject(request); const account = requireAccount(request);
    const campaignId = boundedText(body.campaignId, 80); getCampaign(campaignId);
    const category = boundedText(body.category, 40);
    if (!["Action", "Marketplace", "Properties", "Hangar Bay", "Bank", "Comms", "Syndicates"].includes(category)) throw new Error("Unknown request category.");
    submitRequest(account, campaignId, category, boundedText(body.detail, 4000));
    return NextResponse.json({ requests: listRequests(account, campaignId) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Request not saved." }, { status: 400 }); }
}
