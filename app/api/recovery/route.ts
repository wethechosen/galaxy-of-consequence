import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/accounts";
import { readDatapad, saveAuthoritativeDatapad } from "@/lib/datapad-save";
import { assertLocalRequest, readLocalObject } from "@/lib/local-http";
import { hostedGet, hostedPersistenceEnabled, hydrateHostedSave, saveHostedResult } from "@/lib/hosted-bridge";
import { campaignTarget, committedOperation, operationIdentity } from "@/lib/server-operation";
import { AdvancementRequiredError, advancementErrorBody } from "@/lib/advancement-gate";
import { applyResidenceRest, recoveryError } from "@/lib/saga-recovery";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
 try {
  assertLocalRequest(request); const actor=requireAccount(request); const body=await readLocalObject(request);
  const target=campaignTarget(actor,body.accountId);
  if(!Number.isSafeInteger(body.revision) || Number(body.revision)<0 || typeof body.propertyId!=="string") throw recoveryError("Reload the residence record before resting.");
  const identity=operationIdentity(body.transactionId,"recovery",{propertyId:body.propertyId,hours:8});
  const useHosted=hostedPersistenceEnabled(), hosted=useHosted ? await hostedGet(target.username) : null;
  if(useHosted && !hosted) throw recoveryError("The shared save is unavailable; no rest was recorded.",503);
  if(hosted) hydrateHostedSave(target,hosted);
  const current=readDatapad(actor,target.id);
  if(committedOperation(current.snapshot,"recoveryTransactions",identity)) return NextResponse.json({snapshot:current.snapshot,revision:current.revision,replayed:true},{headers:{"Cache-Control":"no-store"}});
  if(!current.snapshot || current.revision!==body.revision || hosted && current.revision!==hosted.revision) throw recoveryError("The campaign changed. Reload before resting.",409);
  const result=applyResidenceRest(current.snapshot,body.propertyId), snapshot=result.snapshot;
  const now=new Date().toISOString();
  snapshot.gameState.recoveryTransactions=[...(Array.isArray(snapshot.gameState.recoveryTransactions)?snapshot.gameState.recoveryTransactions:[]),{transactionId:identity.id,requestFingerprint:identity.fingerprint,propertyId:body.propertyId,hours:8,healed:result.healed,committedAt:now}];
  snapshot.messages=[...snapshot.messages,{role:"assistant",id:identity.id,provider:"saga-recovery",createdAt:now,content:`## LOCATION\n${snapshot.gameState.location}\n\n## SCENE\nYou spend the declared rest period at your recorded residence.\n\n## GM ADJUDICATION\nOrdinary rest under Saga Core pp. 148–149; no medical treatment or roll is implied.\n\n## GAMEPLAY RESULT\n${result.summary}\n\n## SAGA CHECK\nNo check required.\n\n## STATE UPDATE\nEight hours pass. HP: ${snapshot.gameState.health}. Condition Track: ${snapshot.gameState.conditionTrack || 0}. No possessions or credits change.\n\n## PLAYER OPTIONS\nA. Review my possessions.\nB. Examine the immediate surroundings.\nYou may declare another action.`}];
  const saved=saveAuthoritativeDatapad(actor,target.id,current.revision,snapshot);
  if(hosted) {try {await saveHostedResult(target,hosted.revision,snapshot);} catch(error){hydrateHostedSave(target,hosted);throw error;}}
  return NextResponse.json({snapshot,revision:saved.revision,updatedAt:saved.updatedAt,healed:result.healed},{headers:{"Cache-Control":"no-store"}});
 } catch(error) {
  if(error instanceof AdvancementRequiredError) return NextResponse.json(advancementErrorBody(error),{status:error.status});
  const status=error && typeof error==="object" && "status" in error ? Number(error.status) : error instanceof Error && /sign in/i.test(error.message)?401:500;
  return NextResponse.json({error:error instanceof Error ? error.message : "Rest could not be confirmed."},{status});
 }
}
