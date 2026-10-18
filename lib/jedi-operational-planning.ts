/** Deterministic, non-mutating Jedi institutional workload planner for GOC 150 ABY.
 * It reports missions as requests awaiting staffing/authorization, not accomplished events.
 * Never assumes the Grand Master, current Council, Order treasury or transport assets.
 */
import {JEDI_FIELD_MANDATES_150,JEDI_EXISTING_GOC_PEOPLE,JEDI_OFFICES_150,JEDI_SITES_150} from "./jedi-order-150aby";
export type JediMissionReview={
 id:string;window:number;mandateId:string;mission:string;method:string;
 earliestMinute:number;reviewMinute:number;status:"awaiting-authorized-staffing";
 preconditions:readonly string[];ethicalBoundary:string;candidateStaff:readonly string[];
 site:string;effectsCommitted:false;playerAware:false;
};
const CANDIDATES:Readonly<Record<string,readonly string[]>>={
 "return-temple":["kala-morrin"],
 "educate":["akkan-vuu"],
 "relief":["shado-liang"],
 "history":["tarvyn-dree","kala-morrin"],
 "diplomacy":[],
 "oversight":[]
};
const LOCATIONS:Readonly<Record<string,string>>={
 "return-temple":"coruscant","educate":"coruscant","relief":"dantooine",
 "history":"ossus","diplomacy":"coruscant","oversight":"coruscant"
};
/** Every 7-day window considers independent work without asserting it occurred. */
export function jediMissionReviewAtMinute(minute:number):readonly JediMissionReview[]{
 const now=Math.max(0,Math.floor(Number.isFinite(minute)?minute:0));
 const week=Math.floor(now/10080);
 const start=week*10080;
 return JEDI_FIELD_MANDATES_150.map(m=>{
  const site=LOCATIONS[m.id];
  if(!JEDI_SITES_150.some(s=>s.id===site&&s.state150!=="destroyed-historical"))
   throw Error("Jedi mission has no viable declared site: "+m.id);
  const candidateStaff=CANDIDATES[m.id]||[];
  for(const id of candidateStaff){
   if(!JEDI_EXISTING_GOC_PEOPLE.some(p=>p.id===id&&p.status150==="active-goc"))
    throw Error("Unverified Jedi mission candidate: "+id);
  }
  return {id:`jedi-office:${m.id}:window-${week}`,window:week,mandateId:m.id,
   mission:m.mission,method:m.method,earliestMinute:start,reviewMinute:start+m.durationMinutes,
   status:"awaiting-authorized-staffing" as const,site,candidateStaff:[...candidateStaff],
   preconditions:[...m.sourceRequirements,"Verified source-linked staffing and transport",
    "Legitimate office authorization, independent faction resources and clock"],
   ethicalBoundary:m.ethicalBoundary,effectsCommitted:false as const,playerAware:false as const};
 });
}
export function jediInstitutionWorkload(minute:number){
 return {period:"150 ABY campaign-clock operational planning",proposals:jediMissionReviewAtMinute(minute),
  councilSeats: JEDI_OFFICES_150.map(o=>({id:o.id,leader:o.leaderId,authority:o.membershipAuthority})),
  invariant:"A planning preview is not a Jedi assignment, a victory, a completed rebuild, a rank promotion or an event visible to D'mir. Resolve through the existing authoritative event ledger only."};
}
