import { NextResponse } from "next/server";
import { GptActionError, authenticateGptAction, readGptActionBody } from "@/lib/gpt-action";
import { runGmTurn, GmTurnError } from "@/lib/gm";
import { AdvancementRequiredError, advancementErrorBody } from "@/lib/advancement-gate";
import { hostedGet, hostedPersistenceEnabled, hydrateHostedSave, saveHostedResult } from "@/lib/hosted-bridge";
import { anchorNarrationLocation } from "@/lib/gpt-narration";
import { replayHostedTurn } from "@/lib/hosted-turn-replay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RecordValue = Record<string, unknown>;

function controlIntent(action: string) {
  const value = action.toLowerCase();
  if (/(load\s+(game|checkpoint|state)|restore\s+(a\s+)?checkpoint)/i.test(value)) return "loadCheckpoint";
  if (/(save\s+(game|checkpoint|state)|create\s+(a\s+)?checkpoint)/i.test(value)) return "saveCheckpoint";
  if (/\bhud\b|show\s+(my\s+)?status/i.test(value)) return "getCampaignHUD";
  if (/(out[- ]of[- ]character|\booc\b|reconcil(e|iation)|sync\s+(state|save)|authoritative\s+save|set\s+and\s+persist)/i.test(value)) return "reconcileCampaignState";
  return null;
}

function rewriteAssistantMessage(snapshot: RecordValue, turnId: string, narration: string) {
  const messages = Array.isArray(snapshot.messages) ? [...snapshot.messages] as Array<Record<string, unknown>> : [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "assistant" && messages[index]?.turnId === turnId) {
      messages[index] = { ...messages[index], content: narration };
      break;
    }
  }
  return messages;
}

export async function POST(request: Request) {
  try {
    const actor = authenticateGptAction(request);
    const body = await readGptActionBody(request);
    const action = typeof body.action === "string" ? body.action.trim() : "";
    const turnId = typeof body.turnId === "string" ? body.turnId : crypto.randomUUID();
    const revision = Number(body.revision);
    if (!action || action.length > 2000) throw new GptActionError("Provide one player action between 1 and 2,000 characters.", 400);
    if (!/^[a-zA-Z0-9_-]{8,100}$/.test(turnId)) throw new GptActionError("turnId must contain 8–100 letters, numbers, underscores, or hyphens.", 400);
    if (!Number.isSafeInteger(revision) || revision < 0) throw new GptActionError("Provide the current campaign revision from GET /api/gpt/state.", 400);
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
      if (replay) {
        const { snapshot: _snapshot, ...publicReplay } = replay;
        return NextResponse.json(publicReplay, { headers: { "Cache-Control": "no-store" } });
      }
      if (hostedBefore.revision !== revision) {
        throw new GptActionError("The campaign changed. Reload state and submit the action again.", 409);
      }
      hydrateHostedSave(actor, hostedBefore);
    }

    const result = await runGmTurn(actor, { accountId: actor.id, revision, action, turnId });
    let snapshot = result.snapshot;
    let narration = result.narration;

    const beforeState = hostedBefore?.snapshot?.gameState as RecordValue | undefined;
    const beforeLocation = String(beforeState?.location || snapshot.gameState.location || "");
    const authoritativeLocation = String(snapshot.gameState.location || beforeLocation || "");
    const anchored = anchorNarrationLocation(narration, authoritativeLocation);
    if (anchored !== narration) {
      narration = anchored;
      snapshot = { ...snapshot, messages: rewriteAssistantMessage(snapshot as unknown as RecordValue, turnId, narration) };
    }

    if (hostedPersistenceEnabled()) await saveHostedResult(actor, revision, snapshot);
    const state = snapshot.gameState;
    console.info("[gpt/turn] committed", {
      turnId,
      provider: result.provider,
      fallbackReason: result.fallbackReason || null,
      location: state.location,
      revision: result.revision,
    });

    return NextResponse.json({
      revision: result.revision,
      turnId,
      narration,
      roll: result.roll,
      provider: result.provider,
      fallbackReason: result.fallbackReason || null,
      hud: {
        level: snapshot.character?.level || 1,
        experience: snapshot.character?.experience || 0,
        forcePoints: state.forcePoints || 0,
        destinyPoints: state.destinyPoints || 0,
        darkSideScore: state.darkSideScore || 0,
        notoriety: state.notoriety || 0,
        carried: (Array.isArray(state.inventory) ? state.inventory : []).reduce((sum: number, item: unknown) => sum + Number((item as Record<string, unknown>)?.qty || 0), 0),
      },
      state: { location: state.location, health: state.health, conditionTrack: state.conditionTrack, credits: state.credits, inventory: state.inventory, objectives: state.objectives, combat: state.combat },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AdvancementRequiredError) return NextResponse.json(advancementErrorBody(error), { status: error.status });
    console.error("[gpt/turn] failure", error);
    const status = error instanceof GptActionError || error instanceof GmTurnError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Custom GPT turn failed. No outcome was applied." }, { status });
  }
}
