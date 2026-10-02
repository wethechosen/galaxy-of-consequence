import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/accounts";
import { GmTurnError, runGmTurn } from "@/lib/gm";
import { assertLocalRequest, readLocalObject } from "@/lib/local-http";
import { NvidiaProviderError } from "@/lib/original-provider";
import { hostedGet, hostedPersistenceEnabled, hydrateHostedSave, saveHostedResult } from "@/lib/hosted-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertLocalRequest(request);
    const actor = requireAccount(request);
    const body = await readLocalObject(request);
    const hosted = hostedPersistenceEnabled() ? await hostedGet(actor.username) : null;
    if (hosted) {
      if (typeof body.revision !== "number" || body.revision !== hosted.revision) {
        return NextResponse.json({ error: "The campaign changed elsewhere. Reload the saved game before continuing.", revision: hosted.revision }, { status: 409 });
      }
      hydrateHostedSave(actor, hosted);
    }
    const result = await runGmTurn(actor, {
      accountId: typeof body.accountId === "string" ? body.accountId : undefined,
      revision: Number(body.revision),
      action: typeof body.action === "string" ? body.action : "",
      turnId: typeof body.turnId === "string" ? body.turnId : "",
      openScene: body.openScene === true,
      statePolicy: body.statePolicy === "committed-trade" ? "committed-trade" : null,
    });
    if (hosted) await saveHostedResult(actor, hosted.revision, result.snapshot);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof GmTurnError || error instanceof NvidiaProviderError ? error.status
      : error instanceof Error && /sign in/i.test(error.message) ? 401
      : error instanceof Error && /local access|cross-origin|cross-site/i.test(error.message) ? 403 : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "The GM request failed. No outcome was applied." }, { status });
  }
}
