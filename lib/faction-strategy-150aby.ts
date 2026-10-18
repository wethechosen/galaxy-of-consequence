/**
 * Deterministic, GM-private faction strategy projections at the existing
 * authoritative campaign clock. This is NOT an independently speaking GM,
 * not an extra ledger and not an event/result authorizer.
 * No credits, kills, ships, XP, wars, promotions or faction allegiance changes
 * are committed here. Proposals require source-grounded GM adjudication.
 */
import {GOC_FACTIONS_150_ABY,GOC_FACTION_BY_ID,GOC_FACTION_MEMBERS,type Faction150} from "./faction-canon-150aby";
import {sceneNpcRoster} from "./player-scene-roster";
import {GOC_NPC_INDEX_BY_ID} from "./npc-canonical-index";
import {jediInstitution150} from "./jedi-order-150aby";
import {jediInstitutionWorkload} from "./jedi-operational-planning";
type Row=Record<string,unknown>;
const rec=(v:unknown):Row=>v&&typeof v==="object"&&!Array.isArray(v)?v as Row:{};
const arr=(v:unknown)=>Array.isArray(v)?v:[];
const plain=(x:unknown)=>String(x||"").toLowerCase();
const slug=(x:unknown)=>plain(x).replace(/[^a-z0-9]/g,"");
const WEEK=10080;
const ALIASES:Readonly<Record<string,readonly string[]>>={
 "galactic-triumvirate":["triumvirate","galactic federation"],
 "galactic-alliance":["galactic alliance"],
 "fel-empire":["fel empire","imperial government","fel dynasty"],
 "imperial-knights":["imperial knights","imperial knight","knight academy"],
 "imperial-navy":["imperial navy"],
 "moff-council":["moff council","sector governor","moffs"],
 "new-jedi-order":["new jedi order","jedi order"],
 "corporate-sector-authority":["corporate sector authority","csa","direx"],
 "espo":["espo security","espos"],
 "igfed":["igfed"],
 "xiii":["xiii"],
 "house-murkhana":["murkhana"],
 "sith-traditionalists":["korvalis","sith traditionalist"],
 "hapes-consortium":["hapes consortium","hapan government"],
 "hapan-royal-house":["hapan royal court","house vhaelor","fountain palace"],
 "hapan-navy":["hapan navy","royal navy"],
 "mandalorian-clans":["mandalorian clans"],
 "chiss-frontier":["chiss ascendancy"],
 "black-sun":["black sun"],
 "hutt-kajidics":["hutt cartel","hutt kajidic"],
 "tenloss":["tenloss"],
 "bounty-hunters-guild":["bounty hunters guild","bounty hunters' guild"],
 "outer-rim-freetraders":["independent freetraders","freetrader routes"],
 "neutral-relief":["civilian relief and archives"],
 "sith-claimants":["sith claimants"],
 "red-key-raiders":["red key raiders"],
 "exchange":["the exchange syndicate"]
};
export type FactionPlanPreview=Readonly<{
 id:string;factionId:string;agendaId:string;intent:string;arena:string;method:string;
 scenarioCycle:number;fromMinute:number;dueMinute:number;
 phase:"preparing"|"review-ready";resolution:"unadjudicated";
 requiredCapability:string;capacityBand:number;visibility:"public"|"gm-only";stakes:string;
}>;
/** A planning window is a deterministic proposal; it has zero authoritative material effect. */
export function factionPlanPreview(faction:Faction150,minute:number):FactionPlanPreview {
 const now=Math.max(0,Math.floor(Number.isFinite(minute)?minute:0));
 const cycle=Math.floor(now/WEEK),agenda=faction.objectives[cycle%faction.objectives.length];
 const fromMinute=cycle*WEEK,dueMinute=fromMinute+Math.min(WEEK,agenda.durationMinutes);
 return {id:`faction:${faction.id}:cycle-${cycle}:${agenda.id}`,factionId:faction.id,
   agendaId:agenda.id,intent:agenda.intent,arena:agenda.arena,method:agenda.method,
   scenarioCycle:cycle,fromMinute,dueMinute,
   phase:now>=dueMinute?"review-ready":"preparing",resolution:"unadjudicated",
   requiredCapability:agenda.requiredCapacity,capacityBand:faction.strengths[agenda.requiredCapacity],
   visibility:agenda.visibility,stakes:agenda.stakes};
}
/**
 * The GM only receives faction context when the player actually asks about a
 * faction or a directly observed NPC belongs to one. Location alone does not
 * make a hidden faction magically relevant.
 */
export function factionGmContext(snapshot:unknown,action:string,limit=2){
 const root=rec(snapshot),game=rec(root.gameState),text=plain(action).trim();
 if(!text)return {factions:[],proposals:[],contract:"No faction query."};
 const observed=new Set(sceneNpcRoster(game).map(x=>slug(x.name)));
 const personIds=new Set(GOC_FACTION_MEMBERS.filter(x=>
   observed.has(slug(GOC_NPC_INDEX_BY_ID.get(x.personId)?.name))&&x.standing!=="historic"&&x.standing!=="unintroduced").map(x=>x.factionId));
 const matches=GOC_FACTIONS_150_ABY.filter(f=>{
   const words=ALIASES[f.id]||[f.name.toLowerCase()];
   return words.some(w=>text.includes(w)) || (personIds.has(f.id)&&
     /politic|faction|house|command|loyal|employer|allegi|authority|organization/i.test(action));
 });
 const candidates=matches.slice(0,Math.max(0,Math.min(4,limit)));
 const minute=Number(game.campaignTimeMinutes)||0;
 return {
  factions:candidates.map(f=>({id:f.id,name:f.name,mandate:f.mandate,governance:f.government,
   jurisdiction:f.presence,resourcesAreOrdinalPlanningBands:f.strengths,internalPressure:f.internalPressure,
   confidential:f.confidential,leaderRule:f.leaderRule,
   relations:f.relations.map(r=>({id:r.id,stance:r.stance,reason:r.reason,secret:!!r.secret}))})),
  proposals:candidates.map(f=>factionPlanPreview(f,minute)),
  jediRecovery:candidates.some(f=>f.id==="new-jedi-order")?(()=>{
    const x=jediInstitution150();
    return {governance:x.council150,historicalFoundation:x.canonicalHistoricalEvents.map(h=>({year:h.yearABY,event:h.event,consequence:h.consequence})),
      sites:x.sites.map(s=>({name:s.name,state150:s.state150,restriction:s.restriction})),
      departmentMandates:x.offices.map(o=>({description:o.description,mandate:o.mandate,leaderId:o.leaderId})),
      confirmedGocJedi:x.existingOriginalGocJedi.map(n=>({name:n.name,position:n.position})),
      institutionalWorkload:jediInstitutionWorkload(minute),
      warning:"No 150 ABY Grand Master, fixed council appointments or force-pursuit mission is automatically established. Kill no NPC and award no XP merely from an institutional profile."};
  })():null,
  contract:"All strategic agendas are GM-private fictional intentions, not historical events, informed player knowledge, or successful operations. A proposed mission never spends funds, grants sovereign authority, moves troops, resolves conflict, or creates news. Verify scene evidence, time, logistics, boundaries and Saga mechanics; commit outcomes only through the existing authoritative turn ledger. Never introduce XIII, Korvalis or another secret into an unrelated player scene."
 };
}
/** Diagnostic roll-up for administrators; reflects potential effort only. */
export function factionStrategicOverview(snapshot:unknown){
 const state=rec(rec(snapshot).gameState),minute=Number(state.campaignTimeMinutes)||0;
 return GOC_FACTIONS_150_ABY.map(f=>factionPlanPreview(f,minute));
}
