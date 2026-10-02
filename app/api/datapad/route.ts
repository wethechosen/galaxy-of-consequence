import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/accounts";
import { assertLocalRequest } from "@/lib/local-http";
import { DatapadError, readDatapad, saveDatapad, saveDatapadConfig } from "@/lib/datapad-save";
import { hostedGet, hostedPersistenceEnabled, hydrateHostedSave, hostedPut } from "@/lib/hosted-bridge";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function errorResponse(error: unknown) {
  return NextResponse.json({ error: error instanceof Error ? error.message : "Campaign save failed." },
    { status: error instanceof DatapadError ? error.status : 403 });
}
export async function GET(request: Request) {
  try {
    assertLocalRequest(request);
    const actor = requireAccount(request);
    if (hostedPersistenceEnabled()) {
      const hosted = await hostedGet(actor.username);
      if (hosted) hydrateHostedSave(actor, hosted);
    }
    return NextResponse.json(readDatapad(actor, new URL(request.url).searchParams.get("accountId")), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
export async function PUT(request: Request) {
  try {
    assertLocalRequest(request);
    const actor = requireAccount(request);
    if (Number(request.headers.get("content-length")) > 8_100_000) throw new DatapadError("Campaign save is too large.", 413);
    const text = await request.text();
    if (text.length > 8_100_000) throw new DatapadError("Campaign save is too large.", 413);
    const body = JSON.parse(text);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new DatapadError("Invalid save request.");
    if (body.action === "config") return NextResponse.json(saveDatapadConfig(actor, body.revision, body.config));
    if (hostedPersistenceEnabled()) {
      const hosted = await hostedGet(actor.username);
      if (hosted && body.revision !== hosted.revision) throw new DatapadError("The campaign changed elsewhere. Reload the saved game before saving.", 409);
      const result = await hostedPut(actor.username, actor.id, Number(body.revision), body.snapshot);
      hydrateHostedSave(actor, result);
      return NextResponse.json({ accountId: actor.id, revision: result.revision, updatedAt: result.updated_at });
    }
    const result = saveDatapad(actor, typeof body.accountId === "string" ? body.accountId : null, body.revision, body.snapshot);
    return NextResponse.json(result);
  } catch (error) { return errorResponse(error); }
}
