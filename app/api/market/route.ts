import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/accounts";
import { readDatapad, saveAuthoritativeDatapad } from "@/lib/datapad-save";
import { assertLocalRequest, readLocalObject } from "@/lib/local-http";
import { applyMarketTrade, MarketTradeError, type TradeInput } from "@/lib/market-trade";
import { hostedGet, hostedPersistenceEnabled, hydrateHostedSave, saveHostedResult } from "@/lib/hosted-bridge";
import { campaignTarget, committedOperation, operationIdentity } from "@/lib/server-operation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertLocalRequest(request);
    const actor = requireAccount(request);
    const body = await readLocalObject(request);
    const target = campaignTarget(actor, body.accountId);
    const accountId = target.id;
    if (!Number.isSafeInteger(body.revision) || Number(body.revision) < 0) throw new MarketTradeError("The datapad revision could not be verified.");
    const revision = Number(body.revision);
    const action = body.action === "sell" ? "sell" : body.action === "buy" ? "buy" : null;
    if (!action) throw new MarketTradeError("Unknown market transaction.");
    const input: TradeInput = { action, goodId: typeof body.goodId === "string" ? body.goodId : undefined, itemId: typeof body.itemId === "string" ? body.itemId : undefined,
      merchantId: typeof body.merchantId === "string" ? body.merchantId : undefined, quotedPrice: typeof body.quotedPrice === "number" ? body.quotedPrice : undefined };
    const identity = operationIdentity(body.transactionId, "market", input);
    const useHosted = hostedPersistenceEnabled();
    const hosted = useHosted ? await hostedGet(target.username) : null;
    if (useHosted && !hosted) throw new MarketTradeError("Your shared campaign could not be loaded. No purchase was recorded.", 503);
    if (hosted) hydrateHostedSave(target, hosted);
    const current = readDatapad(actor, accountId);
    if (hosted && current.revision !== hosted.revision) throw new MarketTradeError("The campaign changed elsewhere. Reload the market and try again.", 409);
    if (committedOperation(current.snapshot, "marketTransactions", identity)) return NextResponse.json({ snapshot: current.snapshot, revision: current.revision, updatedAt: current.updatedAt, replayed: true }, { headers: { "Cache-Control": "no-store" } });
    if (!current.snapshot || current.revision !== revision) throw new MarketTradeError("The campaign record changed. Reopen the market and try again.", 409);
    const snapshot = applyMarketTrade(current.snapshot, input);
    const history = Array.isArray(snapshot.gameState.marketTransactions) ? snapshot.gameState.marketTransactions : [];
    // Retain receipts: trimming them would allow an old request to charge again.
    snapshot.gameState.marketTransactions = [...history, { transactionId: identity.id, requestFingerprint: identity.fingerprint, ...input, committedAt: new Date().toISOString() }];
    const saved = saveAuthoritativeDatapad(actor, accountId, revision, snapshot);
    if (hosted) {
      try { await saveHostedResult(target, hosted.revision, snapshot); }
      catch (error) { hydrateHostedSave(target, hosted); throw error; }
    }
    return NextResponse.json({ snapshot, revision: saved.revision, updatedAt: saved.updatedAt }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error && typeof error === "object" && "status" in error ? Number(error.status) : error instanceof Error && /sign in/i.test(error.message) ? 401 : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "The market transaction could not be completed." }, { status });
  }
}
