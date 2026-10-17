/**
 * GOC NPC rivalry intelligence, v1.
 *
 * This does NOT model NPCs as omniscient. It records firsthand observation
 * only after an already-authoritative GM turn has been committed. It never
 * alters SAGA checks, character statistics, experience, combat, ownership,
 * or quest completion. No background enemies or random encounters are spawned.
 */
import { sceneNpcRoster } from "./player-scene-roster";
import { DMIR_STORY_NPCS } from "./dmir-story-npcs";
import { positiveActionText } from "./action-intent";

type Row = Record<string, unknown>;
const row=(v:unknown):Row|null=>v!==null&&typeof v==="object"&&!Array.isArray(v)?v as Row:null;
const str=(v:unknown)=>typeof v==="string"?v.trim():"";
const norm=(v:unknown)=>str(v).toLowerCase().replace(/[^a-z0-9]+/g,"");
const list=(v:unknown)=>Array.isArray(v)?v:[];
const capped=(v:string,n=200)=>v.slice(0,n);
const livingNames=new Map(DMIR_STORY_NPCS.map(n=>[norm(n.name),n]));
export type ObservedStyle="ranged"|"melee"|"negotiation"|"mercy"|"retreat"|"visible_force"|"exposed_stealth";
export type RivalObservation={
  turnId:string;style:ObservedStyle;outcome:"attempted"|"success"|"failure"|"resolved";
  source:"witnessed-scene"|"opposing-combatant";scene:string;campaignMinute:number;
};
export type NpcRivalMemory={
 id:string;name:string;observations:RivalObservation[];
};
export type NpcRivalLedger={version:1;memories:NpcRivalMemory[]};
const empty=():NpcRivalLedger=>({version:1,memories:[]});

function asLedger(value:unknown):NpcRivalLedger {
 const data=row(value);
 if(data?.version!==1)return empty();
 const entries=list(data.memories).flatMap(value=>{
  const item=row(value);if(!item||!str(item.id)||!str(item.name))return [];
  const observations=list(item.observations).flatMap(v=>{
   const o=row(v);const turnId=str(o?.turnId);
   const kinds:ObservedStyle[]=["ranged","melee","negotiation","mercy","retreat","visible_force","exposed_stealth"];
   if(!turnId||!kinds.includes(o?.style as ObservedStyle))return [];
   if(o?.source!=="witnessed-scene"&&o?.source!=="opposing-combatant")return [];
   return [{turnId,style:o.style as ObservedStyle,
    source:o.source as RivalObservation["source"],
    outcome:(["attempted","success","failure","resolved"].includes(String(o?.outcome))?
     o.outcome:"attempted") as RivalObservation["outcome"],
    scene:str(o.scene),campaignMinute:Math.max(0,Number(o.campaignMinute)||0)}];
  });
  return [{id:str(item.id),name:str(item.name),observations:observations.slice(-24)}];
 });
 return {version:1,memories:entries.slice(-50)};
}
type Witness={id:string;name:string;source:RivalObservation["source"]};
function confirmedWitnesses(before:Row,after:Row):Witness[]{
 const first=row(before.gameState)||{},next=row(after.gameState)||{};
 const found=new Map<string,Witness>();
 for(const visible of sceneNpcRoster(first)){
  const named=norm(visible.name);
  if(!named)continue;
  const canonical=livingNames.get(named);
  if(canonical?.status==="dead"||canonical?.era==="historic-flashback")continue;
  const stableId=canonical?.id||str(visible.id)||"scene-"+named;
  found.set(named,{id:stableId,name:visible.name,source:"witnessed-scene"});
 }
 const combat=row(first.combat);
 const lastCombat=row(next.combat);
 const opponents=list(combat?.combatants).map(row).filter((v):v is Row=>Boolean(v));
 const afterOpponent=list(lastCombat?.combatants).map(row).filter((v):v is Row=>Boolean(v));
 for(const opponent of opponents){
  if(opponent.side!=="opposition"||Number(opponent.hp)<=0)continue;
  const name=str(opponent.name);if(!name)continue;
  const counterpart=afterOpponent.find(x=>str(x.id)===str(opponent.id));
  if(counterpart&&Number(counterpart.hp)<=0)continue;
  const canonical=livingNames.get(norm(name));
  if(canonical?.status==="dead"||canonical?.era==="historic-flashback")continue;
  found.set(norm(name),{id:canonical?.id||"scene-"+norm(name),name,source:"opposing-combatant"});
 }
 return [...found.values()].slice(0,18);
}

function observedStyle(before:Row,after:Row,action:string,roll:unknown):ObservedStyle|null{
 const intent=positiveActionText(action).toLowerCase();
 const check=row(roll);
 const outcome=str(check?.outcome).toLowerCase();
 const kind=str(check?.kind).toLowerCase();
 const label=str(check?.label).toLowerCase();
 const first=row(before.gameState)||{},last=row(after.gameState)||{};
 const change=list(last.turnEvents).map(row).find(event=>str(event?.turnId)&&str(event?.action)===action);
 const effects=row(change?.changes)||{};
 const conflict=row(first.combat);
 if(conflict?.status==="active"&&row(last.combat)?.status==="escaped"&&
   /\b(?:escape|retreat|withdraw|flee|run away)\b/i.test(intent))return "retreat";
 if(/\b(?:spare|forgive|release|show mercy|save the life|refuse to kill)\b/i.test(intent)
  &&(list(effects.relationshipUpdate).length>0||list(effects.milestoneAdd).length>0))
  return "mercy";
 if(/\b(?:negotiate|bargain|propose terms|counteroffer|persuade|mediate)\b/i.test(intent))
  return "negotiation";
 // A successful stealth attempt is concealed. A failed Stealth check does
 // not *alone* establish identification: require a recorded exposure.
 if((label.includes("stealth")||/\b(?:sneak|stealth)\b/.test(intent))&&outcome==="failure"
  &&(list(effects.relationshipUpdate).some(x=>/noticed|spotted|detected|exposed/i.test(JSON.stringify(x)))
    ||list(effects.discoveryAdd).some(x=>/noticed|spotted|detected|exposed/i.test(JSON.stringify(x)))))
  return "exposed_stealth";
 if(label.includes("use the force")&&outcome==="success"&&
  /\b(?:force push|force pull|force choke|battle strike|telekinetic)\b/i.test(intent))return "visible_force";
 if((kind==="attack"||kind==="initiative")&&/\b(?:shoot|fire|blaster|rifle|pistol|snipe)\b/i.test(intent))
  return "ranged";
 if((kind==="attack"||kind==="initiative")&&/\b(?:strike|slash|stab|punch|kick|melee|lightsaber)\b/i.test(intent))
  return "melee";
 return null;
}
function observedOutcome(roll:unknown):RivalObservation["outcome"]{
 const check=row(roll),r=str(check?.outcome).toLowerCase();
 return r==="success"?"success":r==="failure"?"failure":check?"attempted":"resolved";
}

/** Called only after finalized gameState.turnEvents includes this turn ID. */
export function recordCommittedRivalObservation(
 priorSnapshot:unknown,finalSnapshot:unknown,turnId:string,action:string,roll:unknown,
):NpcRivalLedger {
 const before=row(priorSnapshot)||{},after=row(finalSnapshot)||{};
 const first=row(before.gameState)||{},last=row(after.gameState)||{};
 const priorLedger=asLedger(first.rivalIntelligence);
 if(!turnId||list(first.turnEvents).some(e=>row(e)?.turnId===turnId)||
   !list(last.turnEvents).some(e=>row(e)?.turnId===turnId))return priorLedger;
 const style=observedStyle(before,after,action,roll);
 if(!style)return priorLedger;
 const witnesses=confirmedWitnesses(before,after);
 if(!witnesses.length)return priorLedger;
 const sourceCombat=style==="ranged"||style==="melee"||style==="retreat";
 const observed=witnesses.filter(w=>!sourceCombat||w.source==="opposing-combatant"||
  // Established physically present bystanders can see open combat.
  w.source==="witnessed-scene");
 const memories=priorLedger.memories.map(m=>({...m,observations:[...m.observations]}));
 const minute=Number.isFinite(Number(last.campaignTimeMinutes))?Math.max(0,Number(last.campaignTimeMinutes)):0;
 const scene=str(first.location);
 for(const witness of observed){
  const key=norm(witness.name);
  let memory=memories.find(m=>norm(m.name)===key);
  if(!memory){memory={id:witness.id,name:witness.name,observations:[]};memories.push(memory);}
  if(memory.observations.some(x=>x.turnId===turnId))continue;
  memory.observations.push({turnId,style,source:witness.source,scene,
   outcome:observedOutcome(roll),campaignMinute:minute});
  memory.observations=memory.observations.slice(-24);
 }
 return {version:1,memories:memories.slice(-50)};
}
function standpoint(name:string,state:Row):"hostile"|"friendly"|"uncertain"{
 const relation=list(state.relationships).map(row).find(r=>norm(r?.name)===norm(name));
 const evidence=(str(relation?.disposition)+" "+str(relation?.status)).toLowerCase();
 if(/\b(?:hostile|enemy|adversar|vengeful|resentful|hatred)\b/.test(evidence))return "hostile";
 if(/\b(?:ally|friendly|grateful|trusting|loyal)\b/.test(evidence))return "friendly";
 const known=livingNames.get(norm(name));
 if(known?.relationship==="adversary")return "hostile";
 if(known?.relationship==="contact")return "uncertain";
 return "uncertain";
}
function suggestedReaction(style:ObservedStyle,stance:"hostile"|"friendly"|"uncertain",role:string){
 if(stance==="friendly")return "May offer informed cooperation or express concern; trust still requires earned scenes.";
 if(stance==="uncertain")return "May ask careful questions, withdraw, or renegotiate; do not force hostility.";
 if(style==="ranged")return "May seek already-present cover, change approach angles or warn an established lookout; never grant armor or a defense bonus.";
 if(style==="melee")return "May seek existing distance or terrain and avoid close quarters; never grant a free counterattack.";
 if(style==="negotiation")return "May prepare credible counterterms, verify a claim or exploit an existing bargaining position.";
 if(style==="retreat")return "May plan an interception only if pursuit, position, time and actual resources permit.";
 if(style==="visible_force")return "May become cautious of a witnessed technique; no immunity, foreknowledge or free Force powers.";
 if(style==="mercy")return "May question the player's motives or reconsider a grudge; hostility is not compulsory.";
 if(style==="exposed_stealth")return "May inspect an already-available route or coordinate an established guard post; no omniscient detection.";
 return role?"May respond within the authority of their established role.":"May reconsider priorities without guaranteed retaliation.";
}
/** GM-private projection: an NPC knows only its own firsthand memories. */
export function relevantRivalGmContext(snapshot:unknown,action="",limit=4){
 const root=row(snapshot)||{},state=row(root.gameState)||{};
 const ledger=asLedger(state.rivalIntelligence);
 const atScene=confirmedWitnesses({gameState:state},{gameState:state});
 const present=new Set(atScene.map(w=>norm(w.name)));
 const combatNames=new Set(list(row(state.combat)?.combatants).map(x=>norm(row(x)?.name)));
 return ledger.memories.filter(m=>
  present.has(norm(m.name))||combatNames.has(norm(m.name))&&row(state.combat)?.status==="active")
  .slice(0,limit).map(m=>{
   const stance=standpoint(m.name,state);
   const styles=Array.from(new Set(m.observations.map(o=>o.style))).map(style=>({
    style,numberWitnessed:m.observations.filter(o=>o.style===style).length,
   })).filter(p=>p.numberWitnessed>=2);
   const best=styles.sort((a,b)=>b.numberWitnessed-a.numberWitnessed)[0];
   const last=m.observations.at(-1);
   const now=Number(state.campaignTimeMinutes)||0;
   const hadPreparationTime=Boolean(last&&now-last.campaignMinute>=30);
   const canonical=livingNames.get(norm(m.name));
   return {
    name:m.name,stance,firsthandMemories:m.observations.slice(-5),
    observedTendency:best||null,
    possibleResponse:best?suggestedReaction(best.style,stance,canonical?.role||""):null,
    preparationEstablished:false,hadPreparationTime,
    knowledgeBoundary:"No reports, secrets, player build or unseen behavior are known. A suggested response is NOT a committed action. It requires GM adjudication, existing resources, sufficient time and visible counterplay.",
   };
  });
}
