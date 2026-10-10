import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "Galaxy of Consequence Custom GPT Controller",
    version: "2.1.0",
  }, { headers: { "Cache-Control": "no-store" } });
}
