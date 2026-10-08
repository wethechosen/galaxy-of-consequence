import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/accounts";
import { readDatapad, saveAuthoritativeDatapad } from "@/lib/datapad-save";
import { assertLocalRequest, readLocalObject } from "@/lib/local-http";
import { applyBankTransfer, BankTransferError, type BankTransfer } from "@/lib/bank-transfer";
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
    if (!Number.isSafeInteger(body.revision) || Number(body.revision) < 0) throw new BankTransferError("Reload your account record before transferring.");
    if (body.action !== "deposit" && body.action !== "withdraw" || typeof body.amount !== "number") throw new BankTransferError("Choose deposit or withdraw and a positive whole-credit amount.");
    const input: BankTransfer = { action: body.action, amount: body.amount };
    const identity = operationIdentity(body.transactionId, "bank", input);
    const useHosted = hostedPersistenceEnabled();
    const hosted = useHosted ? await hostedGet(target.username) : null;
    if (useHosted && !hosted) throw new BankTransferError("Your shared account could not be loaded. No transfer was recorded.", 503);
    if (hosted) hydrateHostedSave(target, hosted);
    const current = readDatapad(actor, target.id);
    if (hosted && current.revision !== hosted.revision) throw new BankTransferError("The account changed elsewhere. Reload before transferring.", 409);
    if (committedOperation(current.snapshot, "bankTransactions", identity)) return NextResponse.json({ snapshot: current.snapshot, revision: current.revision, updatedAt: current.updatedAt, replayed: true }, { headers: { "Cache-Control": "no-store" } });
    if (!current.snapshot || current.revision !== body.revision) throw new BankTransferError("The account changed. Reload before transferring.", 409);
    const snapshot = applyBankTransfer(current.snapshot, input);
    const history = Array.isArray(snapshot.gameState.bankTransactions) ? snapshot.gameState.bankTransactions : [];
    snapshot.gameState.bankTransactions = [...history, { transactionId: identity.id, requestFingerprint: identity.fingerprint, ...input,
      creditsAfter: snapshot.gameState.credits, bankCreditsAfter: snapshot.gameState.bankCredits, committedAt: new Date().toISOString() }];
    const saved = saveAuthoritativeDatapad(actor, target.id, current.revision, snapshot);
    if (hosted) {
      try { await saveHostedResult(target, hosted.revision, snapshot); }
      catch (error) { hydrateHostedSave(target, hosted); throw error; }
    }
    return NextResponse.json({ snapshot, revision: saved.revision, updatedAt: saved.updatedAt }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error && typeof error === "object" && "status" in error ? Number(error.status) : error instanceof Error && /sign in/i.test(error.message) ? 401 : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "The transfer could not be confirmed." }, { status });
  }
}
