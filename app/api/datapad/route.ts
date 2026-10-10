import { NextResponse } from "next/server";
import { requireAccount, listAccounts, type Account } from "@/lib/accounts";
import { assertLocalRequest } from "@/lib/local-http";
import { DatapadError, readDatapad, saveDatapad, saveDatapadConfig } from "@/lib/datapad-save";
import { hostedGet, hostedPersistenceEnabled, hydrateHostedSave, hostedPut, ensureHostedActor } from "@/lib/hosted-bridge";
import { AdvancementRequiredError, advancementErrorBody } from "@/lib/advancement-gate";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function errorResponse(error: unknown) {
  if (error instanceof AdvancementRequiredError) return NextResponse.json(advancementErrorBody(error), { status: error.status });
  const status = error instanceof DatapadError ? error.status
    : error instanceof Error && Number.isInteger((error as Error & { status?: number }).status)
      ? (error as Error & { status: number }).status : 403;
  return NextResponse.json({ error: error instanceof Error ? error.message : "Campaign save failed." },
    { status: status >= 400 && status <= 599 ? status : 500 });
}
function hostedTarget(actor: Account, requested: string | null | undefined) {
  if (!requested || requested === actor.id) return actor;
  if (actor.role !== "admin") throw new DatapadError("You can only open your own campaign save.", 403);
  const target = listAccounts().find(account => account.id === requested);
  if (!target) throw new DatapadError("Account no longer exists.", 404);
  return target;
}
export async function GET(request: Request) {
  try {
    assertLocalRequest(request);
    const actor = requireAccount(request);
    const requested = new URL(request.url).searchParams.get("accountId");
    if (hostedPersistenceEnabled()) {
      const target = hostedTarget(actor, requested);
      ensureHostedActor(target);
      const hosted = await hostedGet(target.username);
      if (hosted) hydrateHostedSave(target, hosted);
    }
    return NextResponse.json(readDatapad(actor, requested), { headers: { "Cache-Control": "no-store" } });
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
      const target = hostedTarget(actor, typeof body.accountId === "string" ? body.accountId : null);
      ensureHostedActor(target);
      const hosted = await hostedGet(target.username);
      if (hosted && body.revision !== hosted.revision) throw new DatapadError("The campaign changed elsewhere. Reload the saved game before saving.", 409);
      if (hosted) hydrateHostedSave(target, hosted);
      // Hosted autosave follows the same authority rules as local autosave:
      // preserve confirmed mechanics and validate any exact catalog trade.
      // The local increment is only a cache; Supabase is committed once.
      saveDatapad(actor, target.id, body.revision, body.snapshot);
      const validated = readDatapad(actor, target.id).snapshot;
      if (!validated) throw new DatapadError("Invalid campaign save.");
      try {
        const result = await hostedPut(target.username, target.id, Number(body.revision), validated);
        hydrateHostedSave(target, result);
        return NextResponse.json({ accountId: target.id, revision: result.revision, updatedAt: result.updated_at });
      } catch (error) {
        // A rejected hosted write must not leave an uncommitted cache revision
        // that could be mistaken for a completed gameplay outcome.
        if (hosted) hydrateHostedSave(target, hosted);
        throw error;
      }
    }
    const result = saveDatapad(actor, typeof body.accountId === "string" ? body.accountId : null, body.revision, body.snapshot);
    return NextResponse.json(result);
  } catch (error) { return errorResponse(error); }
}
