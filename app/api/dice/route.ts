import { NextResponse } from "next/server";
import { readObject } from "@/lib/local-http";
import { rollSagaCheck } from "@/lib/saga-dice";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await readObject(request);
    return NextResponse.json({ roll: rollSagaCheck(body.plan) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid dice request" }, { status: 400 });
  }
}
