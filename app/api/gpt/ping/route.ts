import { NextResponse } from "next/server";
import { neonQuery } from "@/lib/neon-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await neonQuery("SELECT 1");
    return NextResponse.json({
      ok: true,
      service: "Galaxy of Consequence Custom GPT Controller",
      version: "2.2.0",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[api/gpt/ping] Neon unavailable", error);
    return NextResponse.json({ ok: false, error: "Campaign persistence is unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
