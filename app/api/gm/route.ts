import { NextResponse } from "next/server";
import { runGmTurn } from "@/lib/gm";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { action?: unknown } | null;
  const action = typeof body?.action === "string" ? body.action.trim() : "";
  if (!action || action.length > 2000) {
    return NextResponse.json({ error: "Provide an action between 1 and 2,000 characters." }, { status: 400 });
  }
  try {
    const result = await runGmTurn(action);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "RULES_NOT_VERIFIED") {
      return NextResponse.json({ error: "Gameplay is locked until Saga rules are verified. No roll or campaign change occurred." }, { status: 409 });
    }
    return NextResponse.json({ error: "The GM request failed." }, { status: 503 });
  }
}
