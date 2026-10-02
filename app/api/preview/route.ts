import { NextResponse } from "next/server";
import { boundedText, readObject } from "@/lib/local-http";
import { previewTurn } from "@/lib/gm-provider";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try { const body = await readObject(request); return NextResponse.json({ preview: await previewTurn(boundedText(body.action, 2000)) }); }
  catch { return NextResponse.json({ error: "Provide a preview action between 1 and 2,000 characters" }, { status: 400 }); }
}
