import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/accounts";
import { readDatapad, saveAuthoritativeDatapad } from "@/lib/datapad-save";
import { assertLocalRequest, readLocalObject } from "@/lib/local-http";
import { applyMarketTrade, MarketTradeError } from "@/lib/market-trade";
import { hostedGet, hostedPersistenceEnabled, hydrateHostedSave, saveHostedResult } from "@/lib/hosted-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertLocalRequest(request);
    const actor = requireAccount(request);
    const body = await readLocalObject(request);
    const accountId = typeof body.accountId === "string" ? body.accountId : null;
    const revision = Number(body.revision);
    if (!Number.isSafeInteger(revision) || revision < 0) throw new MarketTradeError("The datapad revision could not be verified.");
    const action = body.action === "sell" ? "sell" : body.action === "buy" ? "buy" : null;
    if (!action) throw new MarketTradeError("Unknown market transaction.");
    const hosted = hostedPersistenceEnabled() ? await hostedGet(actor.username) : null;
    if (hosted) hydrateHostedSave(actor, hosted);
    const current = readDatapad(actor, accountId);
    if (hosted && current.revision !== hosted.revision) throw new MarketTradeError("The campaign changed elsewhere. Reload the market and try again.", 409);
    if (!current.snapshot || current.revision !== revision) throw new MarketTradeError("The campaign record changed. Reopen the market and try again.", 409);
    const snapshot = applyMarketTrade(current.snapshot, {
      action,
      goodId: typeof body.goodId === "string" ? body.goodId : undefined,
      itemId: typeof body.itemId === "string" ? body.itemId : undefined,
    });
    const saved = saveAuthoritativeDatapad(actor, accountId, revision, snapshot);
    if (hosted) await saveHostedResult(actor, hosted.revision, snapshot);
    return NextResponse.json({ snapshot, revision: saved.revision, updatedAt: saved.updatedAt }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof MarketTradeError ? error.status : error instanceof Error && /sign in/i.test(error.message) ? 401 : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "The market transaction could not be completed." }, { status });
  }
}
