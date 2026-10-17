import {npcGameplayResult} from "./npc-decision-context";
import {npcUltimateEvidenceDigest,hasAuditedNpcUltimateCompletion} from "./npc-ultimate-verification";
type JsonRecord=Record<string,unknown>;
const obj=(a:unknown):JsonRecord|null=>a&&typeof a==="object"&&!Array.isArray(a)?a as JsonRecord:null;
const norm=(a:unknown)=>String(a||"").trim().toLowerCase();
const receiptId=/^npc-real-[a-z0-9-]+-t[0-9]{3}$/;
/**
 * This deliberately NEVER marks a campaign complete.
 * It produces a real evidence packet for an independent reviewer when
 * the GM has already marked the exact long-term goal completed.
 */
export function npcUltimateReviewCandidate(snapshot:unknown,goal:string){
 const root=obj(snapshot),state=obj(root?.gameState);
 if(!state||!goal.trim())return null;
 if(hasAuditedNpcUltimateCompletion(snapshot,goal))return null;
 const objectives=Array.isArray(state.objectives)?state.objectives:[];
 const completed=objectives.some(x=>norm(obj(x)?.title)===norm(goal)&&norm(obj(x)?.status)==="completed");
 if(!completed)return null;
 const events=Array.isArray(state.turnEvents)?state.turnEvents:[];
 const committed=new Set(events.map(x=>obj(x)?.turnId).filter(x=>typeof x==="string") as string[]);
 const messages=Array.isArray(root?.messages)?root.messages:[];
 const evidence=messages.map(obj).filter((x):x is JsonRecord=>Boolean(x)&&x?.role==="assistant"&&typeof x?.turnId==="string"&&receiptId.test(x.turnId as string)&&committed.has(x.turnId as string)&&typeof x?.content==="string"&&x?.provider==="nvidia")
   .map(m=>({turnId:m.turnId as string,result:npcGameplayResult(m.content as string)}))
   .filter(x=>x.result.length>0).slice(-12);
 const ids=evidence.map(x=>x.turnId);
 const digest=npcUltimateEvidenceDigest(snapshot,ids);
 return {status:"independent_review_required" as const,goal,committedGmReceipts:evidence.length,
  evidenceTurnIds:ids,evidenceDigest:digest,
  recentResults:evidence.slice(-6).map(x=>({turnId:x.turnId,result:x.result.slice(0,400)})),
  canReview:Boolean(digest)&&evidence.length>0,
  caveat:"A completed objective flag is only a claim. Review the actual GM results against every clause of the long-term goal, then record an independent reviewer and exact receipts. Never infer completion from this candidate packet."};
}
/** A death needs a saved independent review of an actual GM death ruling. */
export function npcIsAuditedDeath(snapshot:unknown):boolean {
 const root=obj(snapshot),state=obj(root?.gameState),character=obj(root?.character);
 if(!state)return false;
 const claimed=norm(state.lifeStatus)==="dead"||norm(character?.lifeStatus)==="dead"||character?.deceased===true;
 if(!claimed)return false;
 const audit=obj(state.npcDeathAudit);
 if(!audit||audit.status!=="verified"||typeof audit.reviewer!=="string"||audit.reviewer.trim().length<8)return false;
 const ids=Array.isArray(audit.evidenceTurnIds)?audit.evidenceTurnIds:[];
 if(!ids.length||ids.some(id=>typeof id!=="string"||!receiptId.test(id)))return false;
 const events=Array.isArray(state.turnEvents)?state.turnEvents:[];
 if(!ids.every(id=>events.some(event=>obj(event)?.turnId===id)))return false;
 const digest=npcUltimateEvidenceDigest(snapshot,ids);
 if(!digest||audit.evidenceDigest!==digest)return false;
 const messages=Array.isArray(root?.messages)?root.messages:[];
 return ids.some(id=>messages.map(obj).some(m=>m?.turnId===id&&m?.role==="assistant"&&m?.provider==="nvidia"
    &&/\b(?:dies|is killed|has died|confirmed dead|death is confirmed)\b/i.test(npcGameplayResult(String(m?.content||"")))));
}
/** Reports death claims separately; incapacitation (zero HP) is not a confirmed death. */
export function npcDeathReviewCandidate(snapshot:unknown){
 const root=obj(snapshot),state=obj(root?.gameState),character=obj(root?.character);
 if(!state)return null;
 const claimed=norm(state.lifeStatus)==="dead"||norm(character?.lifeStatus)==="dead"||character?.deceased===true;
 if(!claimed)return null;
 const events=Array.isArray(state.turnEvents)?state.turnEvents:[];
 const ids=events.map(e=>obj(e)?.turnId).filter(x=>typeof x==="string"&&receiptId.test(x)) as string[];
 const messages=Array.isArray(root?.messages)?root.messages:[];
 const last=messages.map(obj).reverse().find(m=>m?.role==="assistant"&&typeof m?.turnId==="string"&&ids.includes(m.turnId as string));
 const result=npcGameplayResult(String(last?.content||""));
 return {status:"death_review_required" as const,turnId:last?.turnId||null,
   lastGmResult:result.slice(0,1000),claimedDead:true,
   confirmedDeathEvidence:/\b(?:dies|is killed|has died|confirmed dead|death is confirmed)\b/i.test(result),
   caveat:"Health at or below zero can mean incapacitation, not death; independently verify a death from a committed GM ruling."};
}
