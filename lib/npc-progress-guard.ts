import {npcGameplayResult} from "./npc-decision-context";

/** A simulated PC may propose an action, but only a GM commit changes the world. */
const administrative=/\b(?:ask|request|inquire|seek|confirm|verify|review|petition|schedule)\b/i;
const procedural=/\b(?:clerk|desk|form|approval|authorization|access|permit|registry|administrator|appointment|supervisor|officer|document|memo|certificate|clearance|filing|audit)\b/i;
const stop=new Set(["i","a","an","the","and","for","to","of","with","that","this","my","their","they","her","his","our","in","on","at","is","have","may","would","from","when","could","please","again","about","if","it","so","can","ask","request","inquire","confirm","verify","review","seek","tell","get","give","me"]);
const words=(input:string)=>new Set((input.toLowerCase().match(/[a-z0-9]+/g)||[]).filter(w=>w.length>2&&!stop.has(w)));
const similarity=(a:string,b:string)=>{
  const x=words(a),y=words(b);
  if(!x.size||!y.size)return 0;
  const overlap=[...x].filter(w=>y.has(w)).length;
  return overlap/Math.max(x.size,y.size);
};
export function npcIsAdministrativeAction(action:string):boolean {
  return administrative.test(action)&&procedural.test(action);
}
export function npcDecisionProgressGuard(recentActions:readonly string[],lastGmNarration:string,proposedAction:string){
  const recent=recentActions.filter(Boolean).slice(-7);
  const action=proposedAction.trim();
  const same=recent.filter(previous=>similarity(previous,action)>=0.76 || previous.trim().toLowerCase()===action.toLowerCase()).length;
  const adminCount=recent.filter(npcIsAdministrativeAction).length;
  const proceduralLoop=npcIsAdministrativeAction(action)&&adminCount>=3;
  const repeated=same>=1;
  const outcome=npcGameplayResult(lastGmNarration)||"";
  const lastResult=outcome.slice(0,1300);
  const stagnantResult=/\b(?:still pending|no progress|remains pending|return tomorrow|denied access|unauthorized|wait for approval|same (?:form|response|answer)|does not (?:change|advance)|nothing (?:changes|has changed))\b/i.test(lastResult);
  // The same exact request is never useful after a response that says it cannot advance.
  const mustRegenerate=(repeated&&(proceduralLoop||stagnantResult))||
    (proceduralLoop&&same>=1);
  return {
    repeated,similarPriorRequests:same,administrativeRequests:adminCount,
    administrativeLoop:proceduralLoop,
    mustRegenerate,
    lastResolvedResult:lastResult,
    guidance:proceduralLoop?
      "ADMINISTRATIVE LOOP: Do not submit another paraphrase of an earlier request. Pursue an established lead, a physically different scene, an available lawful option, or a concrete proposal that the GM can actually adjudicate. Do not assume access, signatures, or success.":
      "Choose a consequential attempt that can change the fictional situation without declaring its outcome.",
  };
}

export type NpcGoalMilestone="investigation"|"agreement"|"journey"|"technical"|"protection"|"resolution";
const goalStages:Record<NpcGoalMilestone,string>={
 investigation:"Gather and test distinct evidence, identify the actual cause or responsible party, then act on findings and verify the response; new clues should change the next decision.",
 agreement:"Make specific terms, seek a real counterparty's commitment or counteroffer, resolve material objections, then perform and verify the agreed undertaking.",
 journey:"Secure actual transportation and logistical arrangements, undertake the journey with real time and risk, and verify arrival and mission outcome.",
 technical:"Investigate and diagnose the condition, perform an authorized meaningful test or repair, and verify functioning and safety with actual results.",
 protection:"Identify the threatened people or resources, take playable protective action under real opposition or risk, and verify consequences.",
 resolution:"Resolve the specific stated problem through actual GM-adjudicated scenes, seek external corroboration, and verify the result.",
};
export function npcGoalProgressPlan(goal:string,objectives:unknown):{
 milestone:NpcGoalMilestone;nextStage:string;completedSubgoals:string[];winCondition:string;
}{
  const g=goal.toLowerCase();
  const milestone:NpcGoalMilestone=
    /convoy|voyage|charter.*complete|freighter.*route/i.test(g)?"journey":
    /repair|prosthetic|crop|wayfinding|medical-supply|training|beacon/i.test(g)?"technical":
    /contract|negotiat|agreement|trade review/i.test(g)?"agreement":
    /sibling|civilian relief|protection|safe|rescue|seizure/i.test(g)?"protection":
    /investigat|fraud|audit|reconcil|record|provenance|collateral|identify|discrepanc/i.test(g)?"investigation":"resolution";
  const completedSubgoals=Array.isArray(objectives)?objectives.flatMap(item=>{
    const obj=item&&typeof item==="object"?item as Record<string,unknown>:null;
    return obj?.status==="completed"&&typeof obj.title==="string"?[obj.title]:[];
  }):[];
  return {
    milestone,nextStage:goalStages[milestone],completedSubgoals,
    winCondition:"Do not stop at a meeting, record request, receipt, training exercise, or clue unless the actual full saved goal has been achieved and independently verified: "+goal,
  };
}
/** A draft reading unrelated merchandise when the PC asked for research is a controller bug, not progress. */
export function npcAdjudicationMismatch(action:string,gmNarration:string):string|null{
  const result=npcGameplayResult(gmNarration);
  if(!result)return null;
  const research=/\b(?:database|archive|datapad|surveillance|security camera|germination|soil moisture|seed condition|medical-safety certification|registry number|test plot|diagnostic readings|records?|manifest|inspection logs?)\b/i.test(action);
  const retail=/\b(?:examine the (?:merchandise|datapad) where it is offered|visible condition, seal, label, and expiration markings|remains with its current owner|inspect its visible packaging and markings)\b/i.test(result);
  return research&&retail?"technical or research action resolved as unrelated retail-inspection fallback":null;
}
