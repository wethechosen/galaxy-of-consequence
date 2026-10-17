import {createHash} from "node:crypto";
/** Fail closed: a GM objectiveComplete flag is not a verified ending. */
function obj(value:unknown):Record<string,unknown>|null {
  return value!==null&&typeof value==="object"&&!Array.isArray(value)
    ? value as Record<string,unknown>:null;
}
const norm=(s:unknown)=>String(s??"").trim().toLowerCase();
const validId=(x:unknown):x is string=>typeof x==="string"&&/^npc-real-[a-z0-9-]+-t[0-9]{3}$/.test(x);
/** SHA-256 over exact saved GM responses, bound to their authoritative turn IDs. */
export function npcUltimateEvidenceDigest(snapshot:unknown,turnIds:readonly string[]):string|null {
  const root=obj(snapshot);
  if(!root||!turnIds.length||new Set(turnIds).size!==turnIds.length||turnIds.some(x=>!validId(x)))return null;
  const msgs=Array.isArray(root.messages)?root.messages:[];
  const lines=turnIds.map(id=>{
    const match=msgs.map(obj).find(m=>m?.role==="assistant"&&m.turnId===id&&typeof m.content==="string");
    return match?{turnId:id,narration:match.content}:null;
  });
  if(lines.some(x=>x===null))return null;
  return createHash("sha256").update(JSON.stringify(lines)).digest("hex");
}
export function hasAuditedNpcUltimateCompletion(snapshot:unknown,goal:string):boolean {
  const root=obj(snapshot);
  const state=obj(root?.gameState);
  if(!state||!goal.trim())return false;
  const objectives=Array.isArray(state.objectives)?state.objectives:[];
  if(!objectives.some(x=>{
    const g=obj(x);
    return g&&norm(g.title)===norm(goal)&&norm(g.status)==="completed";
  }))return false;
  const audit=obj(state.npcUltimateAudit);
  if(!audit||audit.status!=="verified"||norm(audit.goal)!==norm(goal))return false;
  const ids=Array.isArray(audit.evidenceTurnIds)?audit.evidenceTurnIds:[];
  if(!ids.length||ids.some(x=>!validId(x)))return false;
  const events=Array.isArray(state.turnEvents)?state.turnEvents:[];
  const committed=new Set(events.map(x=>obj(x)?.turnId).filter(x=>typeof x==="string"));
  if(!ids.every(x=>committed.has(x)))return false;
  if(typeof audit.reviewer!=="string"||audit.reviewer.trim().length<8)return false;
  const digest=npcUltimateEvidenceDigest(snapshot,ids);
  return Boolean(digest)&&audit.evidenceDigest===digest;
}
