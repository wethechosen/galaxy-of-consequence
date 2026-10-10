import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { requireAccount } from "@/lib/accounts";
import { readDatapad, saveAuthoritativeDatapad, type DatapadSnapshot } from "@/lib/datapad-save";
import { assertLocalRequest, readLocalObject } from "@/lib/local-http";
import { hostedGet, hostedPersistenceEnabled, hydrateHostedSave, saveHostedResult } from "@/lib/hosted-bridge";
import { applySagaAdvancement, applySagaFoundation } from "@/original/lib/sagaAdvancement";
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
    const revision = Number(body.revision);
    if (!Number.isSafeInteger(revision) || revision < 0) throw Object.assign(new Error("The datapad revision could not be verified."), { status: 400 });
    const hosted = hostedPersistenceEnabled() ? await hostedGet(target.username) : null;
    if (hosted) hydrateHostedSave(target, hosted);
    const current = readDatapad(actor, accountId);
    if (hosted && current.revision !== hosted.revision) throw Object.assign(new Error("The campaign changed elsewhere. Reload the dossier and try again."), { status: 409 });
    const choices = {
      advancementId: body.advancementId,
      classId: body.classId,
      talentId: body.talentId,
      classBonusFeatId: body.classBonusFeatId,
      generalFeatId: body.generalFeatId,
      humanBonusFeatId: body.humanBonusFeatId,
      startingFeatId: body.startingFeatId,
      classBonusFeatSkillId: body.classBonusFeatSkillId,
      generalFeatSkillId: body.generalFeatSkillId,
      humanBonusFeatSkillId: body.humanBonusFeatSkillId,
      startingFeatSkillId: body.startingFeatSkillId,
      abilityIncreases: body.abilityIncreases,
      trainedSkillIds: body.trainedSkillIds,
      languageIds: body.languageIds,
      forcePowerIds: body.forcePowerIds,
    };
    const identity = operationIdentity(body.advancementId, body.foundation === true ? "foundation" : "advancement", { ...choices, advancementId: undefined });
    if (committedOperation(current.snapshot, "advancementHistory", identity)) return NextResponse.json({ snapshot: current.snapshot, revision: current.revision, updatedAt: current.updatedAt, replayed: true }, { headers: { "Cache-Control": "no-store" } });
    if (!current.snapshot || current.revision !== revision) throw Object.assign(new Error("The campaign record changed. Reload the dossier and try again."), { status: 409 });
    const snapshot = (body.foundation === true
      ? applySagaFoundation(current.snapshot, choices)
      : applySagaAdvancement(current.snapshot, choices, (sides: number) => randomInt(1, sides + 1))) as DatapadSnapshot;
    const history = snapshot.gameState.advancementHistory as Array<Record<string, unknown>>;
    const committed = history.find(entry => entry.advancementId === identity.id);
    if (committed) committed.requestFingerprint = identity.fingerprint;
    const saved = saveAuthoritativeDatapad(actor, accountId, revision, snapshot);
    if (hosted) {
      try { await saveHostedResult(target, hosted.revision, snapshot); }
      catch (error) { hydrateHostedSave(target, hosted); throw error; }
    }
    return NextResponse.json({ snapshot, revision: saved.revision, updatedAt: saved.updatedAt }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error && typeof error === "object" && "status" in error && Number.isInteger(Number(error.status)) ? Number(error.status)
      : error instanceof Error && /sign in/i.test(error.message) ? 401 : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "The advancement could not be completed." }, { status });
  }
}
