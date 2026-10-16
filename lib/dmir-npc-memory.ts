import { DMIR_STORY_NPCS, type StoryNpc } from "./dmir-story-npcs";

type RecordValue=Record<string,unknown>;
const isRecord=(v:unknown):v is RecordValue=>Boolean(v)&&typeof v==="object"&&!Array.isArray(v);
const strip=(v:unknown)=>String(v||"").toLocaleLowerCase().replace(/[^a-z0-9]+/g,"");
export type NpcMoment={
  turnId:string; action:string; kind:"contact"|"relationship"|"discovery"|"plot";
  detail:string;
};
export type NpcContinuity={
  id:string; name:string; encountered:boolean; plots:string[];
  firstConfirmedTurn:string|null; moments:NpcMoment[];
};
const fields=["contactAdd","relationshipUpdate","discoveryAdd","objectiveComplete","milestoneAdd","decisionAdd"];
function reportedStrings(delta:RecordValue){
  const result:{kind:NpcMoment["kind"];detail:string}[]=[];
  for(const field of fields){
    const rows=Array.isArray(delta[field])?delta[field]:[];
    for(const row of rows){
      const detail=typeof row==="string"?row:
        isRecord(row)?JSON.stringify(row):"";
      if(detail)result.push({kind:
        field==="contactAdd"?"contact":field==="relationshipUpdate"?"relationship":
        field==="objectiveComplete"||field==="milestoneAdd"?"plot":"discovery",detail});
    }
  }
  return result;
}
/** Persist only server-adjudicated ledger events. Merely saying an NPC's name is not contact. */
export function updateDmirNpcContinuity(
  gameState:RecordValue, validatedDelta:RecordValue|null,
  turnId:string, action:string,
):RecordValue {
  if(!validatedDelta)return gameState;
  const evidence=reportedStrings(validatedDelta);
  if(!evidence.length)return gameState;
  const raw=isRecord(gameState.npcContinuity)?gameState.npcContinuity:{};
  const registry:Record<string,NpcContinuity>={};
  for(const [id,value] of Object.entries(raw)){
    if(isRecord(value))registry[id]=value as NpcContinuity;
  }
  let changed=false;
  for(const npc of DMIR_STORY_NPCS){
    const relevant=evidence.filter(e=>strip(e.detail).includes(strip(npc.name)) ||
      e.detail.toLowerCase().includes(npc.id));
    if(!relevant.length)continue;
    const existing=registry[npc.id]||{
      id:npc.id,name:npc.name,encountered:false,plots:[],
      firstConfirmedTurn:null,moments:[],
    };
    const moments=Array.isArray(existing.moments)?existing.moments:[];
    if(moments.some(m=>m.turnId===turnId))continue;
    const newMoments=relevant.map(r=>({
      turnId,action:action.slice(0,500),kind:r.kind,detail:r.detail.slice(0,1000),
    }));
    registry[npc.id]={
      ...existing,
      encountered:existing.encountered||relevant.some(r=>r.kind==="contact"||r.kind==="relationship"),
      firstConfirmedTurn:existing.firstConfirmedTurn||
        (relevant.some(r=>r.kind==="contact"||r.kind==="relationship")?turnId:null),
      plots:[...new Set([...(existing.plots||[]),...relevant.filter(r=>r.kind==="plot").map(r=>r.detail.slice(0,250))])].slice(-40),
      moments:[...moments,...newMoments].slice(-100),
    };
    changed=true;
  }
  return changed?{...gameState,npcContinuity:registry}:gameState;
}
function mentioned(npc:StoryNpc,action:string,gameState:RecordValue){
  const lower=action.toLocaleLowerCase();
  const scene=isRecord(gameState.scene)?JSON.stringify(gameState.scene).toLocaleLowerCase():"";
  const names=npc.id==="jax"?["jax"]:npc.id==="kelvek"?["kelvek"]:[npc.name.toLocaleLowerCase()];
  return names.some(name=>lower.includes(name)||scene.includes(name));
}
/** GM-only stage-specific persona memory. No forced scenes, no automatic character knowledge. */
export function dmirSceneNpcContext(action:string, gameState:RecordValue, max=3){
  const explicit=DMIR_STORY_NPCS.filter(n=>mentioned(n,action,gameState));
  // Supply plausible local cast to the GM for autonomous encounters. Presence
  // still requires a validated narrated scene; merely being nearby earns no
  // contact, relationship or knowledge.
  const where=String(gameState.location||"").toLowerCase();
  const sites=["nuvorren","yt-1300","level 1313","customs authority","hapan commercial attaché"];
  const relevant=sites.filter(site=>where.includes(site));
  const local=DMIR_STORY_NPCS.filter(n=>
    n.status!=="dead" && relevant.some(site=>n.locationHint.toLowerCase().includes(site)));
  const active=[...new Map([...explicit,...local].map(n=>[n.id,n])).values()].slice(0,max);
  const ledger=isRecord(gameState.npcContinuity)?gameState.npcContinuity:{};
  return active.map(n=>({
    id:n.id,name:n.name,species:n.species,status:n.status,era:n.era,
    role:n.role,persona:n.persona,objective:n.objective,privateArc:n.arc,
    encounterPolicy:n.allowedEncounter,scenePriorEstablished:n.firstKnownEncounter,
    authoritativeMoments:isRecord(ledger[n.id])?ledger[n.id]:null,
    privateFacts:n.privateKnowledge,
    criticalLimitations:n.status==="dead"?
      "Deceased in 150 ABY. Never portray alive outside a confirmed historical flashback.":null,
  }));
}
/** Safe public projection for UI; never provide privateKnowledge or plot spoilers. */
export function publicDmirNpcDossiers(gameState:RecordValue={}){
  const ledger=isRecord(gameState.npcContinuity)?gameState.npcContinuity:{};
  return DMIR_STORY_NPCS.map(n=>{
    const persisted=ledger[n.id];
    const state=isRecord(persisted)?persisted:null;
    return {
      id:n.id,name:n.name,species:n.species,role:n.role,
      status:n.status,era:n.era,relationship:n.relationship,
      encounterStatus:state?.encountered===true?"confirmed":
        n.firstKnownEncounter==="established"?"historical":"proposed",
      personalGoal:n.objective,
      plotStatus:Array.isArray(state?.plots)&&state.plots.length?
        "progress evidenced":"unresolved",
    };
  });
}
