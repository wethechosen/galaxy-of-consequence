import { NextResponse } from "next/server";
import { GptActionError, authenticateGptAction, readGptActionBody } from "@/lib/gpt-action";
import { runGmTurn, GmTurnError } from "@/lib/gm";
import { hostedGet, hostedPersistenceEnabled, hydrateHostedSave, saveHostedResult } from "@/lib/hosted-bridge";
import { isFreeMovementDeclaration } from "@/lib/gpt-turn-intent";

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

function replayResponse(hosted: Awaited<ReturnType<typeof hostedGet>>, turnId: string) {
  if (!hosted?.snapshot) return null;
  const messages = Array.isArray(hosted.snapshot.messages) ? hosted.snapshot.messages as Array<Record<string, unknown>> : [];
  const match = [...messages].reverse().find((message) => message.role === "assistant" && message.turnId === turnId);
  if (!match || typeof match.content !== "string") return null;
  const state = hosted.snapshot.gameState;
  return {
    revision: hosted.revision, turnId, narration: match.content, roll: null,
    provider: "hosted-replay", fallbackReason: null,
    hud: {
      level: hosted.snapshot.character?.level || 1,
      experience: hosted.snapshot.character?.experience || 0,
      forcePoints: state.forcePoints || 0,
      destinyPoints: state.destinyPoints || 0,
      darkSideScore: state.darkSideScore || 0,
      notoriety: state.notoriety || 0,
      carried: (Array.isArray(state.inventory) ? state.inventory : []).reduce((sum: number, item: unknown) => sum + Number((item as Record<string, unknown>)?.qty || 0), 0),
    },
    state: { location: state.location, health: state.health, conditionTrack: state.conditionTrack, credits: state.credits, inventory: state.inventory, objectives: state.objectives, combat: state.combat },
  };
}

function combatActive(state: RecordValue | null | undefined) {
  const combat = state?.combat;
  return Boolean(combat && typeof combat === "object" && (combat as RecordValue).status === "active");
}

function transitLocation(current: string, action: string) {
  const place = current.trim() || "Current route";
  const lower = action.toLowerCase();
  if (/\b(?:deeper|descend|descending|lower|down|below|beneath)\b/.test(lower)) {
    if (/lower substructure route beyond unit 4-b/i.test(place)) return "Coruscant — deeper lower-city substructure";
    if (/unit 4-b|concealed bunker/i.test(place)) return "Coruscant — lower substructure route beyond Unit 4-B";
    if (/deeper lower-city substructure/i.test(place)) return place;
    return `${place} — deeper access route`;
  }
  if (/\b(?:leave|leaving|exit|outbound|away)\b/.test(lower)) return `${place} — outbound access route`;
  if (/\b(?:climb|ascending|upward|up)\b/.test(lower)) return `${place} — ascending access route`;
  return `${place} — transit route`;
}

function movementFallbackNarration(from: string, to: string, action: string) {
  return `## SCENE\n**Location:** ${to}\n\nYou leave the exact point recorded at ${from || "the prior location"} and continue only as far as the accessible route in front of you allows. Service lighting breaks across worn durasteel and old utility housings while the low vibration of buried Coruscant infrastructure carries through the floor. The movement is real, but the destination you are pursuing is not treated as discovered merely because you intend to reach it.\n\nThe route carries you one scene-length increment farther. Nothing here confirms a hidden vergence, secret chamber, or other player-assumed destination; those facts still have to emerge from the world through play. Your declared movement is preserved without inventing an arrival or forcing another decision.\n\n## GM RESOLUTION\nNo Saga check is required for this increment of ordinary movement. The declared travel advances one step; no hidden destination is confirmed.\n\n## STATE UPDATE\nLocation advances to ${to}. Campaign time advances by 5 minutes.\n\n## PLAYER OPTIONS\nA. Examine the immediate route and nearby access points.\nB. Continue moving in the same general direction.\nC. Stop and listen or observe before proceeding.\nYou may declare another action.`;
}

function anchorNarrationLocation(narration: string, location: string) {
  if (!location) return narration;
  let next = narration;
  if (!/level 1313/i.test(location)) {
    next = next.replace(/^At\s+Coruscant\s*[—-]\s*Level\s*1313\s*[,.:]?/im, `At ${location},`);
  }
  const scene = /^(?:#{1,6}\s*)?SCENE\s*$/im.exec(next);
  if (!scene) return next;
  const after = next.slice(scene.index + scene[0].length, scene.index + scene[0].length + 320);
  if (after.includes(location)) return next;
  return `${next.slice(0, scene.index + scene[0].length)}\n**Location:** ${location}${next.slice(scene.index + scene[0].length)}`;
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
      if (hostedBefore.revision !== revision) {
        const replay = replayResponse(hostedBefore, turnId);
        if (replay) return NextResponse.json(replay, { headers: { "Cache-Control": "no-store" } });
        throw new GptActionError("The campaign changed. Reload state and submit the action again.", 409);
      }
      hydrateHostedSave(actor, hostedBefore);
    }

    const result = await runGmTurn(actor, { accountId: actor.id, revision, action, turnId });
    let snapshot = result.snapshot;
    let narration = result.narration;
    let recoveredMovement = false;

    const beforeState = hostedBefore?.snapshot?.gameState as RecordValue | undefined;
    const beforeLocation = String(beforeState?.location || snapshot.gameState.location || "");
    const locationChanged = beforeState ? String(snapshot.gameState.location || "") !== String(beforeState.location || "") : false;
    const timeChanged = beforeState ? Number(snapshot.gameState.campaignTimeMinutes || 0) !== Number(beforeState.campaignTimeMinutes || 0) : false;
    const deterministicFallback = Boolean(result.fallbackReason || result.provider === "local-safe-fallback");
    const stalledNoRoll = !result.roll && /(?:No persistent change is confirmed|The declaration is recorded without granting|RESULT\s*:\s*FAILURE)/i.test(narration);

    if (!result.roll && (deterministicFallback || stalledNoRoll) && isFreeMovementDeclaration(action) && !combatActive(beforeState) && !locationChanged && !timeChanged) {
      const nextLocation = transitLocation(beforeLocation, action);
      const nextTime = Math.max(0, Number(snapshot.gameState.campaignTimeMinutes || beforeState?.campaignTimeMinutes || 0)) + 5;
      narration = movementFallbackNarration(beforeLocation, nextLocation, action);
      snapshot = {
        ...snapshot,
        gameState: { ...snapshot.gameState, location: nextLocation, campaignTimeMinutes: nextTime },
      };
      snapshot = { ...snapshot, messages: rewriteAssistantMessage(snapshot as unknown as RecordValue, turnId, narration) };
      recoveredMovement = true;
    }

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
      stalledNoRoll,
      recoveredMovement,
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
      movementRecovery: recoveredMovement,
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
    console.error("[gpt/turn] failure", error);
    const status = error instanceof GptActionError || error instanceof GmTurnError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Custom GPT turn failed. No outcome was applied." }, { status });
  }
}
