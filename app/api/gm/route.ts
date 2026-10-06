import { NextResponse } from "next/server";
import { requireAccount, listAccounts } from "@/lib/accounts";
import { GmTurnError, runGmTurn } from "@/lib/gm";
import { assertLocalRequest, readLocalObject } from "@/lib/local-http";
import { NvidiaProviderError } from "@/lib/original-provider";
import { hostedGet, hostedPersistenceEnabled, hydrateHostedSave, saveHostedResult } from "@/lib/hosted-bridge";
import { replayHostedTurn } from "@/lib/hosted-turn-replay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertLocalRequest(request);
    const actor = requireAccount(request);
    const body = await readLocalObject(request);
    const accountId = typeof body.accountId === "string" ? body.accountId : actor.id;
    if (accountId !== actor.id && actor.role !== "admin") throw new GmTurnError("You can only open your own campaign save.", 403);
    const target = accountId === actor.id ? actor : listAccounts().find(account => account.id === accountId);
    if (!target) throw new GmTurnError("Account no longer exists.", 404);
    const hosted = hostedPersistenceEnabled() ? await hostedGet(target.username) : null;
    if (hosted) {
      const replay = replayHostedTurn(hosted, typeof body.turnId === "string" ? body.turnId : "", typeof body.action === "string" ? body.action : "");
      if (replay) return NextResponse.json(replay, { headers: { "Cache-Control": "no-store" } });
      if (typeof body.revision !== "number" || body.revision !== hosted.revision) {
        return NextResponse.json({ error: "The campaign changed elsewhere. Reload the saved game before continuing.", revision: hosted.revision }, { status: 409 });
      }
      hydrateHostedSave(target, hosted);
    }
    const result = await runGmTurn(actor, {
      accountId,
      revision: Number(body.revision),
      action: typeof body.action === "string" ? body.action : "",
      turnId: typeof body.turnId === "string" ? body.turnId : "",
      openScene: body.openScene === true,
      statePolicy: body.statePolicy === "committed-trade" ? "committed-trade" : null,
    });
    if (hosted) await saveHostedResult(target, hosted.revision, result.snapshot);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof GmTurnError || error instanceof NvidiaProviderError ? error.status
      : error instanceof Error && /sign in/i.test(error.message) ? 401
      : error instanceof Error && /local access|cross-origin|cross-site/i.test(error.message) ? 403 : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "The GM request failed. No outcome was applied." }, { status });
  }
}
