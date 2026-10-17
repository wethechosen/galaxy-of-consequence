import { NextResponse } from "next/server";
import { GptActionError, authenticateGptAction, readGptActionBody } from "@/lib/gpt-action";
import { hostedGet } from "@/lib/hosted-bridge";
import { replayHostedTurn } from "@/lib/hosted-turn-replay";
import { publicCommittedTurn } from "@/lib/gameplay-contract";
import { pendingTurnStatus, readPendingTurnTicket } from "@/lib/gpt-pending-turn";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Read-only status: never resolves, narrates, rolls or advances a pending turn. */
export async function POST(request: Request) {
  try {
    const actor = authenticateGptAction(request);
    const body = await readGptActionBody(request);
    if (Object.keys(body).length !== 1 || typeof body.retryTicket !== "string") {
      throw new GptActionError("Provide only the exact retryTicket returned by the interrupted turn.", 400);
    }
    const pending = readPendingTurnTicket(body.retryTicket, actor.username);
    const saved = await hostedGet(actor.username);
    if (!saved?.snapshot) throw new GptActionError("No authoritative campaign save exists.", 409);
    const replay = replayHostedTurn(saved, pending.turnId, pending.action);
    if (replay) return NextResponse.json(publicCommittedTurn(replay), { headers: { "Cache-Control": "no-store" } });
    if (saved.revision !== pending.revision) {
      return NextResponse.json({
        error: "campaign_changed",
        message: "The campaign revision changed; pending action was NOT submitted. Reload authoritative state before a new action.",
        turnId: pending.turnId, revision: saved.revision, gameplayAdvanced: false,
      }, { status: 409, headers: { "Cache-Control": "no-store" } });
    }
    const status = pendingTurnStatus(pending);
    return NextResponse.json({
      ...status, retryTicket: body.retryTicket,
      message: status.canSubmit
        ? "Original declaration is ready for one safe resubmission using retryTicket. No gameplay was applied."
        : "GM cooldown in progress. Original declaration preserved; no gameplay was applied.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const rawStatus = (error as {status?:unknown})?.status;
    const status = typeof rawStatus === "number" && rawStatus >= 400 && rawStatus <= 599 ? rawStatus : 500;
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Pending action status unavailable.",
    }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
