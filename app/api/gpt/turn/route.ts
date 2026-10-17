import { NextResponse } from "next/server";
import { GptActionError, authenticateGptAction, readGptActionBody } from "@/lib/gpt-action";
import { runGmTurn, GmTurnError } from "@/lib/gm";
import { AdvancementRequiredError, advancementErrorBody } from "@/lib/advancement-gate";
import { hostedGet, hostedPersistenceEnabled, hydrateHostedSave, saveHostedResult } from "@/lib/hosted-bridge";
import { alignCommittedTurn, publicCommittedTurn } from "@/lib/gameplay-contract";
import { issuePendingTurnTicket, pendingTurnStatus, readPendingTurnTicket } from "@/lib/gpt-pending-turn";
import { stableGptTurnId } from "@/lib/gpt-turn-identity";
import { replayHostedTurn } from "@/lib/hosted-turn-replay";
import { turnLifecycleFromError } from "@/lib/turn-lifecycle";
import { gptTurnRetryPlan } from "@/lib/gpt-turn-retry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function controlIntent(action: string) {
  const value = action.toLowerCase();
  if (/(load\s+(game|checkpoint|state)|restore\s+(a\s+)?checkpoint)/i.test(value)) return "loadCheckpoint";
  if (/(save\s+(game|checkpoint|state)|create\s+(a\s+)?checkpoint)/i.test(value)) return "saveCheckpoint";
  if (/\bhud\b|show\s+(my\s+)?status/i.test(value)) return "getCampaignHUD";
  if (/(out[- ]of[- ]character|\booc\b|reconcil(e|iation)|sync\s+(state|save)|authoritative\s+save|set\s+and\s+persist)/i.test(value)) return "reconcileCampaignState";
  return null;
}

export async function POST(request: Request) {
  let attemptedTurnId: string | undefined;
  let attemptedBaseRevision: number | undefined;
  let attemptedAction: string | undefined;
  let attemptedUsername: string | undefined;
  try {
    const actor = authenticateGptAction(request);
    const body = await readGptActionBody(request);
    const suppliedTicket = Object.prototype.hasOwnProperty.call(body, "retryTicket");
    if (suppliedTicket && Object.keys(body).some(field => field !== "retryTicket")) {
      throw new GptActionError("Retry tickets must be submitted alone, without changed action, turnId, or revision.", 400);
    }
    const pending = suppliedTicket ? readPendingTurnTicket(body.retryTicket, actor.username) : null;
    const action = pending?.action ?? (typeof body.action === "string" ? body.action.trim() : "");
    const revision = pending?.revision ?? Number(body.revision);
    const turnId = pending?.turnId ?? (typeof body.turnId === "string" ? body.turnId : stableGptTurnId(actor.id, revision, action));
    if (!action || action.length > 2000) throw new GptActionError("Provide one player action between 1 and 2,000 characters.", 400);
    if (!/^[a-zA-Z0-9_-]{8,100}$/.test(turnId)) throw new GptActionError("turnId must contain 8–100 letters, numbers, underscores, or hyphens.", 400);
    if (!Number.isSafeInteger(revision) || revision < 0) throw new GptActionError("Provide the current campaign revision from GET /api/gpt/state.", 400);
    attemptedTurnId = turnId;
    attemptedBaseRevision = revision;
    attemptedAction = action;
    attemptedUsername = actor.username;
    const operation = controlIntent(action);
    if (operation) {
      return NextResponse.json({
        error: "control_command_requires_control_action",
        message: "This is an administrative request, not gameplay. No roll or state mutation was attempted.",
        useOperation: operation,
        revision,
        gameplayAdvanced: false,
      }, { status: 422, headers: { "Cache-Control": "no-store" } });
    }

    let hostedBefore: Awaited<ReturnType<typeof hostedGet>> = null;
    if (hostedPersistenceEnabled()) {
      hostedBefore = await hostedGet(actor.username);
      if (!hostedBefore?.snapshot) throw new GptActionError("No campaign is initialized for the configured action account.", 409);
      const replay = replayHostedTurn(hostedBefore, turnId, action);
      if (replay) return NextResponse.json(publicCommittedTurn(replay), { headers: { "Cache-Control": "no-store" } });
      if (hostedBefore.revision !== revision) {
        throw new GptActionError("The campaign changed. Reload state and submit the action again.", 409);
      }
      if (pending && pending.retryAtMs > Date.now()) {
        const current = pendingTurnStatus(pending);
        return NextResponse.json({
          error: "gm_cooldown",
          message: "The original action remains pending. No narration, roll, or state change exists yet.",
          turnId,
          retry: {
            status: "awaiting_retry", turnId, baseRevision: revision,
            retryAfterSeconds: current.secondsRemaining, retryAt: current.retryAt,
            estimated: current.estimated, gameplayAdvanced: false,
            retryTicket: body.retryTicket,
          },
          gameplayAdvanced: false,
          retryAfterSeconds: current.secondsRemaining,
          retryAfterEstimated: current.estimated,
        }, {
          status: 429,
          headers: { "Retry-After": String(current.secondsRemaining), "Cache-Control": "no-store" },
        });
      }
      hydrateHostedSave(actor, hostedBefore);
    }

    const result = await runGmTurn(actor, { accountId: actor.id, revision, action, turnId });
    const authoritativeResult = alignCommittedTurn(result);
    if (hostedPersistenceEnabled()) await saveHostedResult(actor, revision, authoritativeResult.snapshot);
    console.info("[gpt/turn] committed", {
      turnId, provider: result.provider, receipt: result.receipt, revision: result.revision,
    });
    return NextResponse.json(publicCommittedTurn(authoritativeResult), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof AdvancementRequiredError) return NextResponse.json(advancementErrorBody(error), { status: error.status });
    console.error("[gpt/turn] failure", error);
    const rawStatus = (error as { status?: unknown })?.status;
    const status = typeof rawStatus === "number" && rawStatus >= 400 && rawStatus < 600 ? rawStatus : 500;
    const currentRevision = (error as { currentRevision?: unknown })?.currentRevision;
    const receipt = turnLifecycleFromError(error);
    const retry = gptTurnRetryPlan(error, status, attemptedTurnId, attemptedBaseRevision, receipt);
    const retryTicket = retry && attemptedAction && attemptedUsername
      ? issuePendingTurnTicket({
          username: attemptedUsername, action: attemptedAction,
          turnId: retry.turnId, revision: retry.baseRevision,
          retryAtMs: Date.parse(retry.retryAt), estimated: retry.estimated,
        })
      : null;
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Custom GPT turn failed. No outcome was applied.",
      ...(typeof currentRevision === "number" ? { revision: currentRevision } : {}),
      ...(receipt ? { receipt } : {}),
      ...(retry ? { turnId: attemptedTurnId, retry: { ...retry, retryTicket } } : {}),
      retryAfterSeconds: error instanceof NvidiaProviderError ? error.retryAfterSeconds : undefined,
      retryAfterEstimated: error instanceof NvidiaProviderError ? error.retryAfterEstimated : undefined,
    }, { status, headers: nvidiaRetryHeaders(error) });
  }
}
import { NvidiaProviderError, nvidiaRetryHeaders } from "@/lib/nvidia-errors";
