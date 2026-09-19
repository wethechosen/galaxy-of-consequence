import { NextResponse } from "next/server";
import { createCheckpoint, getCampaign } from "@/lib/campaign-store";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ checkpoints: getCampaign().checkpoints });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { label?: unknown } | null;
  const label = typeof body?.label === "string" ? body.label : "";
  const result = createCheckpoint("campaign-celanon-prologue", label);
  return NextResponse.json(result);
}
