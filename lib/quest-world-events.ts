/**
 * Galaxy of Consequence: deterministic quest/world event projection.
 *
 * Only the authoritative GM's COMMITTED turnEvents and their validated STATE
 * changes create events. Player actions and descriptive prose never do.
 * This pure projection is rebuilt during the same save transaction as the
 * authoritative turn, making retries idempotent and old saves replayable.
 *
 * It is not a linear quest script. Players can achieve goals in any order
 * through actions the GM and Saga referee actually resolve.
 */
import {hasAuditedNpcUltimateCompletion} from "./npc-ultimate-verification";

type JsonRecord=Record<string,unknown>;
const obj=(value:unknown):JsonRecord|null=>
  value!==null&&typeof value==="object"&&!Array.isArray(value)?value as JsonRecord:null;
const str=(value:unknown)=>typeof value==="string"?value.trim():"";
const normal=(value:unknown)=>str(value).toLowerCase().replace(/\s+/g," ");
const arrays=(value:unknown)=>Array.isArray(value)?value:[];
export type WorldEventKind=
  "discovery"|"milestone"|"decision"|"objective_opened"|"objective_claimed"|
  "relationship"|"contact"|"travel"|"trade_offer"|"inventory"|"credits"|
  "condition"|"asset"|"faction"|"world_news"|"route_opened"|"trade_settled";
export type CommittedWorldEvent={
  id:string;turnId:string;kind:WorldEventKind;title:string;detail:string;
  resolvedAt:string;rollOutcome:string|null;provenance:"authoritative-committed-turn";
};
export type QuestWorldStage="active"|"gm_claimed_completed"|"independently_verified";
export type QuestWorldState={
 title:string;stage:QuestWorldStage;isUltimate:boolean;eventTurnIds:string[];
};
export type QuestStall={
 stalled:boolean;consecutiveEffectlessTurns:number;repeatedActions:number;
 reason:string|null;
};
export type QuestWorldLedger={
 version:1;sourceTurnCount:number;lastCommittedTurnId:string|null;
 events:CommittedWorldEvent[];quests:QuestWorldState[];stall:QuestStall;
};
const meaningfulKeys=new Set([
 "discoveryAdd","milestoneAdd","decisionAdd","objectiveAdd","objectiveComplete",
 "relationshipUpdate","contactAdd","travelAccessAdd","inventoryAdd","inventoryRemove",
 "credits","creditsCriminal","conditionAdd","conditionRemove","conditionTrack",
 "propertyAdd","shipAdd","investmentAdd","publicNewsAdd","factionRep",
 "location","tradeOfferAdd","legacyAssetUpsert",
]);
const isEffect=(changes:JsonRecord):boolean=>Object.entries(changes).some(([key,value])=>
 meaningfulKeys.has(key)&&(
  Array.isArray(value)?value.length>0:
  typeof value==="number"?value!==0:
  typeof value==="string"?value.trim().length>0:
  Boolean(obj(value))
 ));
function titleFor(item:unknown,fallback:string):string {
 const o=obj(item);
 return str(o?.title)||str(o?.name)||str(o?.headline)||
   (typeof item==="string"?item.trim():"")||fallback;
}
function detailFor(item:unknown):string {
 const o=obj(item);
 return str(o?.detail)||str(o?.note)||str(o?.consequence)||str(o?.source)||"";
}
const fields:Array<{field:string;kind:WorldEventKind;label:string}>= [
 {field:"discoveryAdd",kind:"discovery",label:"Established discovery"},
 {field:"milestoneAdd",kind:"milestone",label:"Recorded milestone"},
 {field:"decisionAdd",kind:"decision",label:"Committed decision"},
 {field:"objectiveAdd",kind:"objective_opened",label:"Objective opened"},
 {field:"objectiveComplete",kind:"objective_claimed",label:"GM-reported objective resolution"},
 {field:"relationshipUpdate",kind:"relationship",label:"Relationship update"},
 {field:"contactAdd",kind:"contact",label:"Contact established"},
 {field:"travelAccessAdd",kind:"route_opened",label:"Travel access confirmed"},
 {field:"tradeOfferAdd",kind:"trade_offer",label:"Commercial terms offered"},
 {field:"inventoryAdd",kind:"inventory",label:"Inventory acquired"},
 {field:"inventoryRemove",kind:"inventory",label:"Inventory removed"},
 {field:"conditionAdd",kind:"condition",label:"Condition applied"},
 {field:"conditionRemove",kind:"condition",label:"Condition removed"},
 {field:"propertyAdd",kind:"asset",label:"Property acquired"},
 {field:"shipAdd",kind:"asset",label:"Ship acquired"},
 {field:"investmentAdd",kind:"asset",label:"Investment recorded"},
 {field:"legacyAssetUpsert",kind:"asset",label:"Legacy asset status"},
 {field:"publicNewsAdd",kind:"world_news",label:"Public news"},
];
function renderDetail(item:unknown):string {
 const data=obj(item);
 if(!data)return detailFor(item);
 const status=str(data.status);
 const quantity=typeof data.qty==="number"?`Qty ${data.qty}`:"";
 const cost=typeof data.totalCredits==="number"?`Offer ${data.totalCredits} credits`:"";
 return [detailFor(item),status&&`Status: ${status}`,quantity,cost].filter(Boolean).join(" · ").slice(0,600);
}
function normalizeAction(value:unknown):string {
 return normal(value).replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").slice(0,300);
}
export function detectQuestStall(turns:readonly unknown[]):QuestStall {
 const events=turns.map(obj).filter((event):event is JsonRecord=>Boolean(event));
 const last=events.slice(-7);
 let effectless=0;
 for(const event of [...last].reverse()){
  if(isEffect(obj(event.changes)||{}))break;
  effectless++;
 }
 const actions=last.map(e=>normalizeAction(e.action)).filter(Boolean);
 let repeatCount=0;
 for(let i=1;i<actions.length;i++)if(actions[i]===actions[i-1])repeatCount++;
 const stalled=effectless>=4 || (effectless>=3&&repeatCount>=1);
 return {stalled,consecutiveEffectlessTurns:effectless,repeatedActions:repeatCount,
  reason:stalled?"Multiple committed actions yielded no meaningful world-state consequences. The GM must respond to the next valid action with a concrete world reaction, distinct accessible lead, obstacle, cost, or changed situation. Do not invent success or grant unauthorized resources.":null};
}
export function projectQuestWorld(snapshot:unknown):QuestWorldLedger {
 const root=obj(snapshot)||{},state=obj(root.gameState)||root;
 const turns=arrays(state.turnEvents).map(obj).filter((e):e is JsonRecord=>Boolean(e));
 const events:CommittedWorldEvent[]=[];
 const seen=new Set<string>();
 for(const turn of turns){
  const turnId=str(turn.turnId);
  if(!turnId||seen.has(`turn:${turnId}`))continue;
  seen.add(`turn:${turnId}`);
  const delta=obj(turn.changes)||{};
  const outcome=str(obj(turn.roll)?.outcome)||null;
  let ordinal=0;
  const push=(kind:WorldEventKind,title:string,detail="",fingerprint?:string)=>{
   if(!title)return;
   const dedup=`event:${kind}:${fingerprint||normal(title)}`;
   // Non-unique persistent facts should be recorded once; a second encounter
   // cannot generate a fictitious "new discovery" from the same old entry.
   if(seen.has(dedup))return;
   seen.add(dedup);
   events.push({
    id:`${turnId}:${kind}:${ordinal++}`,turnId,kind,
    title:title.slice(0,200),detail:detail.slice(0,600),
    resolvedAt:str(turn.resolvedAt),rollOutcome:outcome,
    provenance:"authoritative-committed-turn",
   });
  };
  for(const {field,kind,label} of fields){
   if(outcome==="failure"&&["objective_claimed","discovery","milestone","asset"].includes(kind))continue;
   for(const item of arrays(delta[field])){
    const title=titleFor(item,label);
    if(kind==="trade_offer"){
     const offer=obj(item);
     push(kind,titleFor(offer?.sellerName||offer?.sellerId,label),renderDetail(item),
      `${normal(title)}:${String(offer?.totalCredits||0)}:${JSON.stringify(offer?.items||[])}`);
    }else if(kind==="relationship"){
     const record=obj(item);
     push(kind,title,renderDetail(item),`${normal(title)}:${normal(record?.status)}:${normal(record?.disposition)}`);
    }else if(kind==="inventory"){
     const record=obj(item);
     push(kind,title,renderDetail(item),`${turnId}:${field}:${normal(title)}:${record?.qty}`);
    }else{
     push(kind,title,renderDetail(item));
    }
   }
  }
  if(str(delta.location))push("travel",str(delta.location),"Resolved location change");
  for(const money of ["credits","creditsCriminal"]){
   if(typeof delta[money]==="number"&&delta[money]!==0)
    push("credits",money=== "credits"?"Banked credits":"Physical credit chips",
     `Ledger delta: ${delta[money]}`,`${turnId}:${money}`);
  }
  if(typeof delta.conditionTrack==="number"&&delta.conditionTrack!==0)
   push("condition","Saga condition track",`Track delta: ${delta.conditionTrack}`,`condition:${turnId}`);
  const reputation=obj(delta.factionRep);
  if(reputation&&Object.values(reputation).some(x=>typeof x==="number"&&x!==0))
   push("faction","Faction reputation",JSON.stringify(reputation),`rep:${turnId}`);
 }
  // A verified commercial acceptance is committed by the server-owned trade
  // resolver after the core turn delta; never confuse it with an open offer.
  // Bind it to an already-committed turn or fail closed on provenance.
  const sourceTurns=new Map(turns.map(t=>[str(t.turnId),t] as const));
  for(const rawReceipt of arrays(state.tradeReceipts)){
   const receipt=obj(rawReceipt);
   const turnId=str(receipt?.turnId);
   if(!receipt||!turnId||!sourceTurns.has(turnId))continue;
   const fingerprint="settled:"+turnId+":"+str(receipt.offerId);
   if(seen.has(fingerprint))continue;
   seen.add(fingerprint);
   const amount=Number(receipt.totalCredits);
   if(!Number.isSafeInteger(amount)||amount<0)continue;
   const items=arrays(receipt.items).map(x=>titleFor(x,"Item")).slice(0,10);
   events.push({id:turnId+":trade_settled:0",turnId,kind:"trade_settled",
    title:str(receipt.sellerName)||"Verified commercial settlement",
    detail:"Paid "+amount+" credits for "+items.join(", "),
    resolvedAt:str(sourceTurns.get(turnId)?.resolvedAt),
    rollOutcome:str(obj(sourceTurns.get(turnId)?.roll)?.outcome)||null,
    provenance:"authoritative-committed-turn"});
  }
 const ultimate=str(state.npcUltimateGoal);
 const objectives=arrays(state.objectives).map(obj).filter((x):x is JsonRecord=>Boolean(x)&&Boolean(str(x?.title)));
 const quests:QuestWorldState[]=objectives.map(o=>{
  const title=str(o.title);
  const claimed=normal(o.status)==="completed";
  const verified=title===ultimate&&claimed&&hasAuditedNpcUltimateCompletion(snapshot,ultimate);
  const eventTurnIds=events.filter(e=>
   (e.kind==="objective_opened"||e.kind==="objective_claimed")&&normal(e.title)===normal(title))
    .map(e=>e.turnId);
  return {title,stage:verified?"independently_verified":claimed?"gm_claimed_completed":"active",
   isUltimate:Boolean(ultimate)&&normal(title)===normal(ultimate),
   eventTurnIds:[...new Set(eventTurnIds)]};
 });
 return {
  version:1,sourceTurnCount:turns.length,
  lastCommittedTurnId:str(turns.at(-1)?.turnId)||null,
  events,quests,stall:detectQuestStall(turns),
 };
}
/**
 * A concise GM context that never grants an event: it cites only committed
 * source turn IDs and the projection's most recent established facts.
 */
export function questWorldGmContext(snapshot:unknown){
 const ledger=projectQuestWorld(snapshot);
 return {
  questStates:ledger.quests.slice(-12),
  recentConfirmedWorldEvents:ledger.events.slice(-10).map(e=>({
   turnId:e.turnId,kind:e.kind,title:e.title,detail:e.detail,
  })),
  stall:ledger.stall,
  instruction:"The authoritative ledger is the source of truth. Do not repeat obsolete prerequisites or manufacture quest stages. A milestone is not an ending; full goal completion requires proof.",
 };
}
