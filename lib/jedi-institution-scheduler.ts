/**
 * Persistent institutional plans for the restored New Jedi Order (GOC 150 ABY).
 *
 * Uses the same campaign-clock and existing authoritative turn/CAS save as
 * NPC offscreen plans. It is NOT a second GM and never resolves a world event.
 * Historical Jedi status, credits, troop counts and Council titles are not
 * inferred from these pending plans.
 */
import {JEDI_FIELD_MANDATES_150,JEDI_SITES_150} from "./jedi-order-150aby";
type Row=Record<string,unknown>;
const object=(v:unknown):Row|null=>v&&typeof v==="object"&&!Array.isArray(v)?v as Row:null;
const nonnegative=(n:unknown):number=>{
 const value=Number(n);
 if(!Number.isSafeInteger(value)||value<0)throw Error("Jedi institutional clock must be a nonnegative safe integer.");
 return value;
};
export type JediProgramStage="preparing"|"awaiting_gm";
export type JediProgram={
 id:string;mandateId:string;cycle:number;createdTurnId:string;createdAtMinute:number;
 dueAtMinute:number;stage:JediProgramStage;purpose:string;ethicalBoundary:string;
 prerequisites:string[];locationContext:string;result:"unadjudicated";
};
export type JediInstitutionState={
 version:1;factionId:"new-jedi-order";lastTickTurnId:string;lastMinute:number;
 foundedAtMinute:number;programs:JediProgram[];
};
export function emptyJediInstitutionState(minute:number,turnId:string):JediInstitutionState{
 return {version:1,factionId:"new-jedi-order",lastMinute:minute,lastTickTurnId:turnId,
 foundedAtMinute:minute,programs:[]};
}
const MANDATES=new Map(JEDI_FIELD_MANDATES_150.map(x=>[x.id,x]));
function readState(value:unknown):JediInstitutionState|null{
 const v=object(value);if(!v)return null;
 if(v.version!==1||v.factionId!=="new-jedi-order"||
  !Number.isSafeInteger(v.lastMinute)||Number(v.lastMinute)<0||
  !Number.isSafeInteger(v.foundedAtMinute)||Number(v.foundedAtMinute)<0||
  typeof v.lastTickTurnId!=="string"||!Array.isArray(v.programs))
  throw Error("Malformed authoritative Jedi institutional record.");
 if(v.programs.length>JEDI_FIELD_MANDATES_150.length)throw Error("Unexpected Jedi program count.");
 const unique=new Set<string>();
 const programs:JediProgram[]=v.programs.map(raw=>{
  const item=object(raw);if(!item)throw Error("Invalid Jedi program.");
  const mandateId=String(item.mandateId||"");
  if(!MANDATES.has(mandateId)||unique.has(mandateId)||
   typeof item.id!=="string"||typeof item.createdTurnId!=="string"||
   !["preparing","awaiting_gm"].includes(String(item.stage))||
   item.result!=="unadjudicated"||!Array.isArray(item.prerequisites))
   throw Error("Jedi program is inconsistent with the canon charter.");
  unique.add(mandateId);
  const createdAtMinute=nonnegative(item.createdAtMinute),dueAtMinute=nonnegative(item.dueAtMinute);
  const expectedId=`jedi:${mandateId}:${item.createdTurnId}`;
  if(item.id!==expectedId||dueAtMinute<=createdAtMinute||
     dueAtMinute-createdAtMinute!==MANDATES.get(mandateId)!.durationMinutes||
     item.cycle!==0)
    throw Error("Jedi program identity, timing or cycle is inconsistent with the canon charter.");
  const mandate=MANDATES.get(mandateId)!;
  return {id:item.id,mandateId,cycle:0,createdTurnId:item.createdTurnId,
    createdAtMinute,dueAtMinute,
    stage:item.stage as JediProgramStage,result:"unadjudicated",purpose:mandate.mission,
    ethicalBoundary:mandate.ethicalBoundary,prerequisites:[...mandate.sourceRequirements],
    locationContext:mandate.autonomousPurpose};
 });
 return {version:1,factionId:"new-jedi-order",lastTickTurnId:v.lastTickTurnId,
  foundedAtMinute:nonnegative(v.foundedAtMinute),lastMinute:nonnegative(v.lastMinute),
  programs};
}
/** Only an actually committed, new gameplay turn advances this state. */
export function advanceJediInstitution(priorSnapshot:unknown,finalSnapshot:unknown,turnId:string):JediInstitutionState|null{
 const previous=object(object(priorSnapshot)?.gameState)||{};
 const next=object(object(finalSnapshot)?.gameState)||{};
 const prior=readState(previous.jediInstitution);
 if(!turnId||!Array.isArray(next.turnEvents)||
   !next.turnEvents.some(e=>object(e)?.turnId===turnId)||
   (Array.isArray(previous.turnEvents)&&previous.turnEvents.some(e=>object(e)?.turnId===turnId)))
   return prior;
 const minute=nonnegative(next.campaignTimeMinutes??0);
 const oldMinute=nonnegative(previous.campaignTimeMinutes??0);
 // A 150 ABY institution must not rewrite explicitly earlier-era campaigns.
 const explicitYear=next.campaignYearABY??previous.campaignYearABY;
 if(explicitYear!==undefined&&explicitYear!==null&&Number.isSafeInteger(Number(explicitYear))&&
    Number(explicitYear)<150)return prior;
 if(minute<oldMinute||prior&&minute<prior.lastMinute)throw Error("Jedi institution clock cannot move backward.");
 if(prior?.lastTickTurnId===turnId)return prior;
 const state: JediInstitutionState=prior?{
  ...prior,lastMinute:minute,lastTickTurnId:turnId,
  programs:prior.programs.map(p=>({...p,prerequisites:[...p.prerequisites]}))
 }:emptyJediInstitutionState(minute,turnId);
 // Programs begin with the first authorized committed turn: no retroactive
 // victories or fake completed missions from prior unrecorded years.
 if(!state.programs.length){
  state.programs=JEDI_FIELD_MANDATES_150.map(m=>({
   id:`jedi:${m.id}:${turnId}`,mandateId:m.id,cycle:0,createdTurnId:turnId,
   createdAtMinute:minute,dueAtMinute:minute+m.durationMinutes,
   stage:"preparing" as const,result:"unadjudicated" as const,
   purpose:m.mission,ethicalBoundary:m.ethicalBoundary,
   prerequisites:[...m.sourceRequirements],locationContext:m.autonomousPurpose,
  }));
 }else{
  for(const p of state.programs)if(p.stage==="preparing"&&p.dueAtMinute<=minute)
   p.stage="awaiting_gm";
 }
 return state;
}
/** Readonly operation knowledge. Do not treat a ready proposal as a fact/news. */
export function jediInstitutionGmContext(snapshot:unknown){
 const state=readState(object(object(snapshot)?.gameState)?.jediInstitution);
 if(!state)return {active:false,prepared:0,reviewReady:0,proposals:[],
  constraint:"No institutional cycle yet committed in this save. A sourcebook institution exists but no offscreen result is implied."};
 return {active:true,prepared:state.programs.filter(p=>p.stage==="preparing").length,
  reviewReady:state.programs.filter(p=>p.stage==="awaiting_gm").length,
  proposals:state.programs.map(p=>({id:p.id,mandate:p.purpose,stage:p.stage,
   dueAtMinute:p.dueAtMinute,prerequisites:[...p.prerequisites],ethicalBoundary:p.ethicalBoundary,
   outcome:"unadjudicated" as const})),
  note:"These are institutional preparations, not public news. Committing a real result requires a separate authenticated, evidence-backed GM world-state operation."};
}
export const JEDI_SAFE_SITE_STATUSES=Object.freeze(JEDI_SITES_150.map(s=>({id:s.id,name:s.name,state150:s.state150})));
