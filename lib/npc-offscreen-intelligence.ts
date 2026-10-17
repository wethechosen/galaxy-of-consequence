/**
 * Autonomous NPC activity is an evidence-bound scheduler, not a second rules
 * engine. No NPC action below awards XP, applies Saga modifiers, moves assets,
 * spawns reinforcements, injures the player or completes a quest.
 *
 * Committed NPC-intelligence dispatches require a previously recorded
 * communication channel and a source that the sender demonstrably knows.
 * The next GM turn may adjudicate a matured plan through normal STATE rules.
 */
import {sceneNpcRoster} from "./player-scene-roster";
import {DMIR_STORY_NPCS} from "./dmir-story-npcs";
import type {RivalObservation,ObservedStyle} from "./npc-rival-intelligence";

type Row=Record<string,unknown>;
const obj=(v:unknown):Row|null=>v!==null&&typeof v==="object"&&!Array.isArray(v)?v as Row:null;
const list=(v:unknown)=>Array.isArray(v)?v:[];
const str=(v:unknown)=>typeof v==="string"?v.trim():"";
const slug=(v:unknown)=>str(v).toLowerCase().replace(/[^a-z0-9]/g,"");
const cap=(v:unknown,n=240)=>str(v).slice(0,n);
const num=(v:unknown)=>Number.isSafeInteger(Number(v))&&Number(v)>=0?Number(v):0;
const npcCanon=new Map(DMIR_STORY_NPCS.map(n=>[slug(n.name),n]));
export type NpcIntelligenceLink={
 id:string;sender:string;recipient:string;channel:"comlink"|"courier"|"in_person";
 establishedTurnId:string;sourceTurnId:string;minimumTransitMinutes:number;
};
export type NpcIntelligenceReport={
 id:string;sender:string;recipient:string;style:ObservedStyle;outcome:RivalObservation["outcome"];
 originTurnId:string;sentTurnId:string;linkId:string;
 sentAtMinute:number;dueAtMinute:number;deliveredAtMinute:number|null;
 path:string[];status:"in_transit"|"delivered";
};
export type NpcAutonomousPlan={
 id:string;actor:string;kind:"watch"|"negotiate"|"evade"|"investigate"|"protect"|"retaliate";
 tactic:ObservedStyle|"independent_agenda";reasonTurnIds:string[];createdAtMinute:number;dueAtMinute:number;
 status:"preparing"|"awaiting_gm"|"adjudicated"|"abandoned";
 objective:string;disposition:"hostile"|"friendly"|"uncertain";
 adjudicatedTurnId?:string;
};
export type OffscreenNpcState={version:1;links:NpcIntelligenceLink[];reports:NpcIntelligenceReport[];plans:NpcAutonomousPlan[]};
export const emptyNpcOffscreenState=():OffscreenNpcState=>({version:1,links:[],reports:[],plans:[]});

function parsedState(input:unknown):OffscreenNpcState{
 const raw=obj(input);
 if(raw?.version!==1)return emptyNpcOffscreenState();
 // All saved records originate from validated source-link and plan functions.
 return {version:1,
  links:list(raw.links).map(obj).filter((x):x is Row=>!!x).slice(-48) as unknown as NpcIntelligenceLink[],
  reports:list(raw.reports).map(obj).filter((x):x is Row=>!!x).slice(-96) as unknown as NpcIntelligenceReport[],
  plans:list(raw.plans).map(obj).filter((x):x is Row=>!!x).slice(-48) as unknown as NpcAutonomousPlan[]};
}
function validPerson(name:string,state:Row){
 if(!name)return false;
 const canon=npcCanon.get(slug(name));
 if(canon&&(canon.status==="dead"||canon.era==="historic-flashback"))return false;
 const all=[
 ...sceneNpcRoster(state),
 ...list(state.contacts).map(obj).filter((x):x is Row=>!!x),
 ...list(state.relationships).map(obj).filter((x):x is Row=>!!x),
 ];
 return all.some(x=>slug(x.name)===slug(name));
}
function committedEvent(state:Row,turnId:string):Row|null{
 return list(state.turnEvents).map(obj).find(x=>str(x?.turnId)===turnId)||null;
}
function knownObservation(state:Row,name:string,turnId:string):RivalObservation|null{
 const memory=obj(state.rivalIntelligence);
 for(const m of list(memory?.memories).map(obj)){
  if(slug(m?.name)!==slug(name))continue;
  for(const o of list(m?.observations).map(obj)){
   if(str(o?.turnId)===turnId&&committedEvent(state,turnId))
    return o as RivalObservation;
  }
 }
 return null;
}
function messageProof(state:Row,turnId:string,sender:string,recipient:string,channel:string){
 const event=committedEvent(state,turnId);
 if(!event)return false;
 const changes=obj(event.changes)||{};
 const evidence=[...list(changes.relationshipUpdate),...list(changes.contactAdd),...list(changes.milestoneAdd)]
  .map(e=>typeof e==="string"?e:JSON.stringify(e||"")).join(" ");
 const v=evidence.toLowerCase();
 return v.includes(sender.toLowerCase())&&v.includes(recipient.toLowerCase())&&
   (channel==="comlink"?/comlink|comm channel|secure channel|transmission channel/.test(v):
    channel==="courier"?/courier|dispatch|messenger|delivery route/.test(v):
    /meeting|same room|face.to.face|in.person/.test(v));
}
function observedStance(state:Row,name:string):NpcAutonomousPlan["disposition"]{
 const rel=list(state.relationships).map(obj).find(x=>slug(x?.name)===slug(name));
 const value=(str(rel?.status)+" "+str(rel?.disposition)).toLowerCase();
 if(/hostile|enemy|resentful|adversar|vengeful/.test(value))return "hostile";
 if(/friendly|grateful|allied|loyal|trust/.test(value))return "friendly";
 return npcCanon.get(slug(name))?.relationship==="adversary"?"hostile":"uncertain";
}
function resolveKind(stance:NpcAutonomousPlan["disposition"],style:ObservedStyle):NpcAutonomousPlan["kind"]{
 if(stance==="friendly")return style==="mercy"?"protect":"investigate";
 if(stance==="uncertain")return style==="negotiation"?"negotiate":"watch";
 if(style==="retreat"||style==="exposed_stealth")return "investigate";
 if(style==="ranged"||style==="melee")return "evade";
 if(style==="negotiation")return "negotiate";
 if(style==="mercy")return "watch";
 return "watch";
}
function npcObjective(name:string,stance:NpcAutonomousPlan["disposition"]){
 const canon=npcCanon.get(slug(name));
 if(canon)return cap(canon.objective,300);
 return stance==="hostile"?"Protect established interests against a demonstrated threat":
  stance==="friendly"?"Maintain existing trust and obligations":
  "Assess the situation in light of verified observations";
}
function containsConsequence(delta:Row,actor:string){
 // An adjudication cannot consist only of an arbitrary completion flag.
 // It needs a separately validated, actor-linked consequence in the same GM
 // turn; other mechanics own any actual money, health, battle and resources.
 const values=[...list(delta.relationshipUpdate),...list(delta.milestoneAdd),
  ...list(delta.decisionAdd),...list(delta.publicNewsAdd)];
 return values.some(v=>JSON.stringify(v).toLowerCase().includes(actor.toLowerCase()));
}
function recordIntelLinks(result:OffscreenNpcState,state:Row,delta:Row,turnId:string){
 for(const raw of list(delta.npcIntelLinkAdd)){
  const r=obj(raw),sender=str(r?.sender),recipient=str(r?.recipient);
  const channel=str(r?.channel) as NpcIntelligenceLink["channel"];
  const sourceTurnId=str(r?.sourceTurnId);
  if(!sender||!recipient||slug(sender)===slug(recipient)||!validPerson(sender,state)||!validPerson(recipient,state)||
   !["comlink","courier","in_person"].includes(channel)||
   !messageProof(state,sourceTurnId,sender,recipient,channel))
   throw new Error("NPC intelligence channel lacks a confirmed source-linked mutual communication event.");
  const id="link:"+slug(sender)+":"+slug(recipient)+":"+sourceTurnId;
  if(result.links.some(x=>x.id===id))continue;
  result.links.push({id,sender,recipient,channel,sourceTurnId,establishedTurnId:turnId,
   minimumTransitMinutes:channel==="in_person"?1:channel==="comlink"?15:120});
 }
}
function sendReports(result:OffscreenNpcState,state:Row,delta:Row,turnId:string,now:number){
 for(const raw of list(delta.npcIntelReportAdd)){
  const item=obj(raw),sender=str(item?.sender),recipient=str(item?.recipient),
   sourceTurnId=str(item?.sourceTurnId),linkId=str(item?.linkId);
  const link=result.links.find(x=>x.id===linkId&&slug(x.sender)===slug(sender)&&slug(x.recipient)===slug(recipient));
  if(!link||!validPerson(sender,state)||!validPerson(recipient,state))
   throw new Error("NPC intelligence transmission requires an existing directional channel and living named participants.");
  const firsthand=knownObservation(state,sender,sourceTurnId);
  const alreadyReceived=result.reports.find(x=>
   slug(x.recipient)===slug(sender)&&x.originTurnId===sourceTurnId&&x.status==="delivered");
  if(!firsthand&&!alreadyReceived)
   throw new Error("NPC cannot transmit information it never witnessed or received.");
  const style=firsthand?.style||alreadyReceived?.style;
  const outcome=firsthand?.outcome||alreadyReceived?.outcome;
  if(!style||!outcome)throw new Error("NPC intelligence source is missing.");
  const route=alreadyReceived?[...alreadyReceived.path,slug(recipient)]:[slug(sender),slug(recipient)];
  if(new Set(route).size!==route.length||route.length>4)
   throw new Error("Circular or unbounded NPC rumor forwarding rejected.");
  const id="report:"+turnId+":"+slug(sender)+":"+slug(recipient)+":"+sourceTurnId;
  if(result.reports.some(x=>x.id===id))continue;
  const requested=num(item?.transitMinutes);
  if(requested>10080)throw new Error("NPC intelligence travel delay is unsupported.");
  const delay=Math.max(link.minimumTransitMinutes,requested);
  result.reports.push({id,sender,recipient,style,outcome,originTurnId:sourceTurnId,
   sentTurnId:turnId,linkId,sentAtMinute:now,dueAtMinute:now+delay,
   deliveredAtMinute:null,path:route,status:"in_transit"});
 }
}
function seedPlans(result:OffscreenNpcState,state:Row,now:number){
 const memory=obj(state.rivalIntelligence);
 for(const raw of list(memory?.memories)){
  const m=obj(raw),name=str(m?.name);
  if(!validPerson(name,state))continue;
  const observations=list(m?.observations).map(obj).filter((x):x is Row=>!!x&&!!committedEvent(state,str(x.turnId)));
  const count=new Map<string,Row[]>();
  for(const x of observations){
   const kind=str(x.style);
   if(!kind)continue;
   count.set(kind,[...(count.get(kind)||[]),x]);
  }
  const candidates=[...count].filter(([,a])=>a.length>=2).sort((a,b)=>b[1].length-a[1].length);
  if(!candidates.length)continue;
  const [tactic,source]=candidates[0];
  const turnIds=source.map(x=>str(x.turnId)).slice(-3);
  const actorId=slug(name),id="plan:"+actorId+":"+tactic+":"+turnIds.at(-1);
  const duplicate=result.plans.some(x=>slug(x.actor)===actorId&&x.tactic===tactic&&
   (x.status==="preparing"||x.status==="awaiting_gm"));
  if(duplicate||result.plans.some(x=>x.id===id)||result.plans.length>=48)continue;
  const stance=observedStance(state,name),kind=resolveKind(stance,tactic as ObservedStyle);
  result.plans.push({id,actor:name,kind,tactic:tactic as ObservedStyle,
   reasonTurnIds:turnIds,createdAtMinute:now,dueAtMinute:now+Math.max(60,kind==="retaliate"?180:60),
   objective:npcObjective(name,stance),disposition:stance,status:"preparing"});
 }
 // Delivered reports support cautionary planning, never the "two witnessed"
 // threshold for a guaranteed counter. No automatic tactical upgrades.
}
/**
 * Established NPCs with their own committed objectives begin planning even
 * when the player is elsewhere. Source turn IDs must prove a known contact or
 * relationship, or this would silently spawn a hidden NPC.
 */
function seedIndependentAgendas(result:OffscreenNpcState,state:Row,now:number){
 const persons=[...list(state.contacts),...list(state.relationships)].map(obj)
  .filter((x):x is Row=>!!x);
 for(const record of persons){
  const name=str(record.name),sourceTurnId=str(record.sourceTurnId)||str(record.turnId);
  if(!name||!sourceTurnId||!validPerson(name,state))continue;
  const source=committedEvent(state,sourceTurnId);
  if(!source)continue;
  const change=obj(source.changes)||{};
  const evidence=[...list(change.contactAdd),...list(change.relationshipUpdate)]
   .map(x=>JSON.stringify(x).toLowerCase()).join(" ");
  if(!evidence.includes(name.toLowerCase()))continue;
  const known=npcCanon.get(slug(name));
  const objective=cap(record.objective||known?.objective,300);
  if(!objective)continue;
  const id="agenda:"+slug(name)+":"+sourceTurnId;
  if(result.plans.length>=48||result.plans.some(x=>x.id===id||slug(x.actor)===slug(name)&&
     (x.status==="preparing"||x.status==="awaiting_gm")))continue;
  const attitude=observedStance(state,name),goal=objective.toLowerCase();
  const kind:NpcAutonomousPlan["kind"]=
   /defen[ds]|guard|protect|rescue|shelter/.test(goal)?"protect":
   /negotia|trade|treaty|diploma|agreement/.test(goal)?"negotiate":
   /revenge|retaliat/.test(goal)&&attitude==="hostile"?"retaliate":
   /investigat|discover|recover|evidence|audit|trace|search/.test(goal)?"investigate":"watch";
  result.plans.push({id,actor:name,kind,tactic:"independent_agenda",
   reasonTurnIds:[sourceTurnId],createdAtMinute:now,dueAtMinute:now+120,
   objective,disposition:attitude,status:"preparing"});
 }
}
function resolvePlans(result:OffscreenNpcState,state:Row,delta:Row,turnId:string){
 for(const raw of list(delta.npcOffscreenPlanResolve)){
  const item=obj(raw),id=str(item?.planId),outcome=str(item?.outcome);
  const plan=result.plans.find(x=>x.id===id);
  if(!plan||plan.status!=="awaiting_gm"||
   !["adjudicated","abandoned"].includes(outcome))
   throw new Error("NPC offscreen plan is not matured or has already been processed.");
  if(outcome==="adjudicated"&&!containsConsequence(delta,plan.actor))
   throw new Error("NPC plan cannot resolve without a separately committed actor-linked world consequence.");
  if(outcome==="adjudicated"&&(
    Number(delta.health||0)!==0||Number(delta.credits||0)!==0||
    Number(delta.creditsCriminal||0)!==0||Number(delta.experienceAward||0)!==0||
    list(delta.inventoryAdd).length>0||list(delta.inventoryRemove).length>0||
    list(delta.conditionAdd).length>0||list(delta.conditionRemove).length>0))
   throw new Error("NPC offscreen action cannot directly grant or remove player health, credits, XP, items or conditions.");
  plan.status=outcome as "adjudicated"|"abandoned";
  plan.adjudicatedTurnId=turnId;
 }
}
/**
 * One authoritative gameplay turn == one deterministic offscreen tick.
 * The finalized save and turn ledger must be committed by the existing CAS.
 */
export function advanceNpcOffscreen(
 priorSnapshot:unknown,finalSnapshot:unknown,turnId:string,delta:unknown,
):OffscreenNpcState{
 const before=obj(priorSnapshot)||{},after=obj(finalSnapshot)||{};
 const past=obj(before.gameState)||{},next=obj(after.gameState)||{};
 const base=parsedState(past.npcOffscreen);
 if(!turnId||committedEvent(past,turnId)||!committedEvent(next,turnId))return base;
 const now=num(next.campaignTimeMinutes),previousMinute=num(past.campaignTimeMinutes);
 if(now<previousMinute)throw new Error("NPC campaign time cannot run backward.");
 const result:OffscreenNpcState={
  version:1,links:base.links.map(x=>({...x})),
  reports:base.reports.map(x=>({...x,path:[...x.path]})),
  plans:base.plans.map(x=>({...x,reasonTurnIds:[...x.reasonTurnIds]}))};
 // Every delivery takes nonzero fictional time and is idempotent across saves.
 for(const message of result.reports){
  if(message.status==="in_transit"&&message.dueAtMinute<=now){
   message.status="delivered";message.deliveredAtMinute=now;
  }
 }
 for(const plan of result.plans){
  if(plan.status==="preparing"&&plan.dueAtMinute<=now)
   plan.status="awaiting_gm";
 }
 const changes=obj(delta)||{};
 recordIntelLinks(result,next,changes,turnId);
 sendReports(result,next,changes,turnId,now);
 resolvePlans(result,next,changes,turnId);
 seedPlans(result,next,now);
 seedIndependentAgendas(result,next,now);
 // Bounds are strict: never silently discard a still actionable intelligence
 // report or plan, which would break memory continuity.
 if(result.links.length>48||result.reports.length>96||result.plans.length>48)
  throw new Error("NPC intelligence ledger capacity reached; reconcile archived records before continuing.");
 return result;
}
/**
 * The NPC model sees only intelligence belonging to established scene NPCs,
 * or an NPC for whom the GM has confirmed a current combat encounter.
 * Scheduled plans are private possibilities, NOT narration or a forced scene.
 */
export function npcOffscreenGmContext(snapshot:unknown,limit=4){
 const root=obj(snapshot)||{},state=obj(root.gameState)||{};
 const data=parsedState(state.npcOffscreen);
 const names=new Set(sceneNpcRoster(state).map(x=>slug(x.name)));
 const combat=obj(state.combat);
 if(combat?.status==="active")
  for(const fighter of list(combat.combatants).map(obj))
   if(fighter?.side==="opposition")names.add(slug(fighter.name));
 const reports=data.reports.filter(x=>x.status==="delivered"&&names.has(slug(x.recipient)))
  .slice(-12).map(x=>({recipient:x.recipient,source:x.sender,style:x.style,outcome:x.outcome,
   originTurnId:x.originTurnId,deliveryTurnId:x.sentTurnId,
   evidenceChain:x.path,confidence:"secondhand report, potentially mistaken"}));
 const eligible=data.plans.filter(x=>x.status==="awaiting_gm");
 const describePlan=(x:NpcAutonomousPlan)=>({id:x.id,actor:x.actor,kind:x.kind,tactic:x.tactic,objective:x.objective,
   sourceTurnIds:x.reasonTurnIds,status:x.status,
   constraint:"This is an NPC intention, not an accomplished event. Verify existing resources, time, presence, opponent agency and Saga mechanics before outcomes."});
 const plans=eligible.filter(x=>names.has(slug(x.actor))).slice(-limit).map(describePlan);
 const offscreenDue=eligible.filter(x=>!names.has(slug(x.actor))).slice(0,Math.min(2,limit))
  .map(x=>({...describePlan(x),privateBackgroundOnly:true,
    constraint:"Offscreen GM agenda only. NPCs cannot attack or alter the player when absent. If independent resources, source facts and elapsed time justify a world action, adjudicate it separately and record only valid actor-linked private or public events; otherwise remain pending."}));
 const readyLinks=data.links.filter(x=>names.has(slug(x.sender)))
  .slice(-8).map(x=>({id:x.id,sender:x.sender,recipient:x.recipient,channel:x.channel,
    establishedTurnId:x.establishedTurnId,minimumTransitMinutes:x.minimumTransitMinutes}));
 return {reports,plans,offscreenDue,readyLinks,
  unresolvedElsewhere:eligible.filter(x=>!names.has(slug(x.actor))).length};
}
