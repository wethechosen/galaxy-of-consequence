import {randomBytes} from "node:crypto";
import {existsSync,readFileSync} from "node:fs";
import {appendFileSync,mkdirSync} from "node:fs";
import {resolve} from "node:path";
import {describe,it,expect} from "vitest";
import {accountStore,createAccount,type Account} from "./accounts";
import {readDatapad,saveAuthoritativeDatapad,type DatapadSnapshot} from "./datapad-save";
import {runGmTurn} from "./gm";
import {invokeNvidia} from "./original-provider";
import {ALL_NPC_TEST_ROSTER,type NpcTestSubject} from "./npc-test-roster";
import {NPC_ULTIMATE_ARCS,NPC_ULTIMATE_ARC_VERSION} from "./npc-ultimate-arcs";
import {hasAuditedNpcUltimateCompletion} from "./npc-ultimate-verification";
import {npcRepetitionRecovery} from "./npc-repetition-recovery";
import {rebaseIsolatedNpcPendingAttempt} from "./npc-pending-revision";
import {NPC_HISTORICAL_TIERS,advanceNpcEarnedXp} from "./npc-historical-baselines";
import {CAMPAIGN_NPCS_150_ABY} from "./npc-canon-roster";
import {progressionStatus} from "@/original/lib/sagaAdvancement";
import {applySagaFoundation,availableClassSkills,foundationRequirements,SAGA_LANGUAGE_OPTIONS} from "@/original/lib/sagaAdvancement";

const active=process.env.GOC_AUTONOMOUS_NPCS==="1";
const requested=(process.env.GOC_NPC_SUBJECTS||"").split(",").map(x=>x.trim()).filter(Boolean);
// Exactly ten independent player-character stress-test campaigns. Kelvek remains story-only.
const TEN_PLAYABLE_NPC_IDS = new Set([
  "jena-lorr","orlan-vale","ari-vess","mirren-sol","torin-kade",
  "lenna-fen","tesa-norr","bren-varo","sorin-pell","calen-vardex",
]);
const subjects=ALL_NPC_TEST_ROSTER.filter(n=>TEN_PLAYABLE_NPC_IDS.has(n.id)&&(!requested.length||requested.includes(n.id)));
const limit=Math.min(200,Math.max(1,Number(process.env.GOC_NPC_MAX_TURNS)||30));
const concurrency=Math.min(3,Math.max(1,Number(process.env.GOC_NPC_CONCURRENCY)||2));
const pause=(ms:number)=>new Promise<void>(r=>setTimeout(r,ms));
const record=(x:Record<string,unknown>)=>{
  mkdirSync(resolve("data"),{recursive:true});
  const row={at:new Date().toISOString(),...x};
  appendFileSync(resolve("data/npc-autoplay.jsonl"),JSON.stringify(row)+"\n");
  console.info("NPC_AUTOPLAY",JSON.stringify(row));
};
const isObj=(x:unknown):x is Record<string,unknown>=>Boolean(x)&&typeof x==="object"&&!Array.isArray(x);
function seed(n:NpcTestSubject):DatapadSnapshot{
  const ch:Record<string,unknown>={name:n.name,age:n.age,species:n.species,homeworld:n.homeworld,
    background:n.background,allegiance:n.allegiance,appearance:n.appearance,
    goal:n.objective,contacts:n.contact,level:1,experience:0,
    forceSensitive:"Unknown",forcePowers:"None known",
    abilityScores:{strength:10,dexterity:12,constitution:12,intelligence:12,wisdom:12,charisma:10}};
  const s:DatapadSnapshot={character:ch,gameState:{location:n.location,
    campaignYearABY:n.yearABY,campaignTimeMinutes:n.yearABY*525600,
    health:24,credits:0,creditsCriminal:0,inventory:[],turnEvents:[],
    objectives:[{title:n.objective,status:"active"}],
    scene:{location:n.location,beat:1,summary:n.background}},
    messages:[],comms:[],settings:{tone:"grounded"}};
  if(n.species!=="Human"){
    ch.mechanicsPending="Alien racial build is not verified by Saga rules; no bonus powers awarded.";
    return s;
  }
  const available=availableClassSkills(ch,n.classId).map((o:{id:string})=>o.id);
  const count=Number(foundationRequirements(ch,n.classId).trainedSkillCount);
  if(available.length<count)throw Error("Invalid trained skill options");
  return applySagaFoundation(s,{advancementId:"live-"+n.id,classId:n.classId,
    trainedSkillIds:available.slice(0,count),generalFeatId:"improved-defenses",
    humanBonusFeatId:"toughness",talentId:n.talentId,
    languageIds:SAGA_LANGUAGE_OPTIONS.filter((o:{id:string})=>o.id!=="basic")
      .slice(0,Number(foundationRequirements(ch,n.classId).bonusLanguageCount))
      .map((o:{id:string})=>o.id),
  },"2026-10-16T00:00:00.000Z") as DatapadSnapshot;
}
function status(s:DatapadSnapshot,n:NpcTestSubject){
  // Completing a small initial chapter (asking a clerk, finding an anomaly)
  // does not finish the character\'s long-form campaign.
  const ultimate=NPC_ULTIMATE_ARCS[n.id]||n.objective;
  // A GM objectiveComplete is not proof that the entire ultimate arc is resolved.
  // Require a separate evidence-linked audit before declaring a true ending.
  if(hasAuditedNpcUltimateCompletion(s,ultimate))return "goal_complete";
  if(String(s.gameState.lifeStatus||s.character?.lifeStatus).toLowerCase()==="dead"||
      s.character?.deceased===true)return "dead";
  if(Number(s.gameState.health)<=0)return "incapacitated";
  return "active";
}
async function choose(n:NpcTestSubject,s:DatapadSnapshot,turn:number){
  const history=(s.messages as Array<Record<string,unknown>>).slice(-6)
    .map(m=>({role:m.role,content:String(m.content||"").slice(0,1100)}));
  const recent=Array.isArray(s.gameState.turnEvents)?s.gameState.turnEvents.slice(-5).map(e=>e.action):[];
  const answer=await invokeNvidia({purpose:"npc",temperature:0.35,max_tokens:260,
    system:"You control ONLY this playable character, not the GM. Make ONE concrete first-person Star Wars Saga Edition action that advances the actual LONG-TERM goal, not just an initial easy chapter. Respect established location, skills, known NPCs, legal access, and inventory. Do not guarantee success, award yourself levels, narrate GM outcomes, teleport or manufacture equipment. If a clerk declined or directed you to another office, go to that office rather than repeating the same question. Never repeat a recent action; change tactics using the previous confirmed result. A completed objective flag without an independent ultimateAudit is NOT a verified ending: continue to fulfill and confirm every clause, including actual repairs and safety checks where required. Take proportionate risks when necessary. Return JSON with exactly one action string starting I, under 450 characters, without markdown.",
    messages:[{role:"user",content:JSON.stringify({name:n.name,role:n.role,
      initialObjective:n.objective,ultimateGoal:NPC_ULTIMATE_ARCS[n.id]||n.objective,
      turn,level:s.character?.level,skills:s.character?.trainedSkills,
      talents:s.character?.talents,feats:s.character?.feats,forcePowers:s.character?.forcePowers,
      location:s.gameState.location,health:s.gameState.health,
      inventory:s.gameState.inventory,objectives:s.gameState.objectives,
      ultimateAudit:s.gameState.npcUltimateAudit||null,
      recentCommittedActions:recent,history})}]});
  let action=answer.content.trim();
  try{const parsed=JSON.parse(action);if(typeof parsed.action==="string")action=parsed.action;}catch{
    const match=action.match(/\{[\s\S]*\}/);
    if(match)try{const parsed=JSON.parse(match[0]);if(typeof parsed.action==="string")action=parsed.action;}catch{}
  }
  action=action.replace(/^Action\s*:\s*/i,"").replace(/^["']|["']$/g,"").trim();
  if(!/^I\s+/i.test(action)||action.length<12||action.length>800||
      /STATE:|## |I automatically win/i.test(action)){
    record({id:n.id,phase:"invalid_pc_output",turn,length:action.length,
      excerpt:action.slice(0,350)});
    throw Error("Invalid PC action from NVIDIA");
  }
  const lastGm=(s.messages as Array<Record<string,unknown>>).slice().reverse()
    .find(m=>m.role==="assistant");
  const recovered=npcRepetitionRecovery(n.id,recent.map(String),String(lastGm?.content||""),action);
  if(recovered){
    record({id:n.id,phase:"controller_loop_avoided",reason:recovered.reason,
      originalDecision:action,declaredInstead:recovered.action});
    return recovered.action;
  }
  return action;
}
async function retry<T>(fn:()=>Promise<T>,id:string,phase:string):Promise<T>{
  for(let i=0;i<7;i++)try{return await fn();}catch(err){
    const error=err as Error & {status?:number;retryAfterSeconds?:number};
    const eligible=[429,502,503,504].includes(Number(error.status))||
      /rate|cooldown|busy|unavailable|retry|quota|draft|invalid pc action/i.test(String(error.message));
    const delay=Math.max(3000,Math.min(70000,Number(error.retryAfterSeconds||2**(i+1)*3)*1000));
    record({id,phase:"retry",stage:phase,attempt:i,error:error.message||String(err),
      delay:eligible&&i<6?delay:0});
    if(!eligible||i===6)throw err;
    await pause(delay);
  }
  throw Error("Maximum retries exceeded");
}
async function run(n:NpcTestSubject){
  const db=accountStore(),username="npc-autoplay-"+n.id;
  let actor=db.prepare("SELECT id,username,displayName,role FROM accounts WHERE username=?")
    .get(username) as Account|undefined;
  if(!actor)actor=createAccount(username,randomBytes(32).toString("hex"),n.name,"player",db);
  let saved=readDatapad(actor,null,db);
  if(!saved.snapshot){
    saveAuthoritativeDatapad(actor,null,0,seed(n),db);
    saved=readDatapad(actor,null,db);
    record({id:n.id,phase:"created",revision:saved.revision});
  }
  // Scenario setup does not resolve an encounter or award XP; GM owns all
  // future goal-completion events.
  if(saved.snapshot!.gameState.npcArcVersion!==NPC_ULTIMATE_ARC_VERSION){
    const objective=NPC_ULTIMATE_ARCS[n.id]||n.objective;
    const current=saved.snapshot!;
    const objectives=Array.isArray(current.gameState.objectives)?
      [...current.gameState.objectives]:[];
    if(!objectives.some(g=>isObj(g)&&g.title===objective))
      objectives.push({title:objective,status:"active",role:"ultimate"});
    const character={...current.character} as Record<string,unknown>;
    if(n.species!=="Human"){
      const tier=CAMPAIGN_NPCS_150_ABY.find(entry=>entry.id===n.id)?.levelBand;
      character.npcLoreRoleTier=tier==="legendary"?12:tier==="senior"?8:3;
      character.npcSpeciesRulesPending=true;
    }
    const prepared={...current,character,gameState:{...current.gameState,
      objectives,npcUltimateGoal:objective,npcArcVersion:NPC_ULTIMATE_ARC_VERSION}};
    saveAuthoritativeDatapad(actor,null,saved.revision,prepared,db);
    saved=readDatapad(actor,null,db);
    record({id:n.id,phase:"arc_initialized",revision:saved.revision,ultimateGoal:objective});
  }
  if(n.species==="Human" && progressionStatus(saved.snapshot!.character||{}).advancementAvailable){
    const advanced=advanceNpcEarnedXp(saved.snapshot!,n);
    if(advanced!==saved.snapshot){
      saveAuthoritativeDatapad(actor,null,saved.revision,advanced,db);
      saved=readDatapad(actor,null,db);
      record({id:n.id,phase:"earned_level_up",revision:saved.revision,
        level:saved.snapshot?.character?.level,xp:saved.snapshot?.character?.experience});
    }
  }
  let existing=Array.isArray(saved.snapshot!.gameState.turnEvents)?saved.snapshot!.gameState.turnEvents.length:0;
  for(let turn=existing+1;turn<=Math.min(limit,existing+1);turn++){
    saved=readDatapad(actor,null,db);
    if(status(saved.snapshot!,n)!=="active")break;
    const turnId="npc-real-"+n.id+"-t"+String(turn).padStart(3,"0");
    // An interrupted GM call must be retried with exactly the same action
    // and idempotency key, never another newly generated PC declaration.
    // Only isolated GM origin/long-arc setup may reconcile a pending
    // test attempt's old revision. No actual gameplay turn may intervene.
    const rebased=rebaseIsolatedNpcPendingAttempt(db,{
      accountId:actor.id,turnId,currentRevision:saved.revision,
      existingGameTurnCount:Array.isArray(saved.snapshot!.gameState.turnEvents)?
        saved.snapshot!.gameState.turnEvents.length:0,
      expectedGameTurnCount:turn-1,
      verifiedAdministrativeChange:saved.snapshot!.gameState.npcArcVersion===NPC_ULTIMATE_ARC_VERSION,
    });
    if(rebased.rebased)record({id:n.id,phase:"rebase_pending",turn,turnId,
      originalRevision:rebased.previousRevision,revision:saved.revision,
      actionPreserved:true,rollPreserved:true});
    let previous=String(rebased.action||"");
    if(!previous && existsSync("data/npc-autoplay.jsonl")){
      const earlier=readFileSync("data/npc-autoplay.jsonl","utf8").split("\n").reverse();
      for(const line of earlier){
        if(!line)continue;
        try{
          const event=JSON.parse(line);
          if(event.turnId===turnId && event.phase==="declared" && typeof event.action==="string"){
            previous=event.action;break;
          }
        }catch{}
      }
    }
    const action=previous||await retry(()=>choose(n,saved.snapshot!,turn),n.id,"pc");
    record({id:n.id,phase:previous?"resumed_declaration":"declared",
      turn,turnId,action,revision:saved.revision});
    const gm=await retry(()=>runGmTurn(actor!,{revision:saved.revision,action,turnId}),n.id,"gm");
    if(gm.receipt.status!=="committed")throw Error("No committed GM receipt");
    const after=readDatapad(actor,null,db);
    const events=Array.isArray(after.snapshot?.gameState.turnEvents)?after.snapshot.gameState.turnEvents:[];
    if(after.revision!==gm.revision||after.snapshot?.character?.name!==n.name||
       !events.some((e:Record<string,unknown>)=>e.turnId===turnId))throw Error("Save consistency error");
    const careerStartingXp=Number(after.snapshot?.character?.npcStartingXp)||0;
    const receiptEarnedXp=events.reduce((sum:number,e:Record<string,unknown>)=>
      sum+(Number(e.experienceAward)||0),0);
    if(Number(after.snapshot?.character?.experience)!==careerStartingXp+receiptEarnedXp)
      throw Error("Career XP and actual committed GM XP do not reconcile");
    record({id:n.id,phase:"committed",turn,revision:after.revision,status:status(after.snapshot!,n),
      xp:after.snapshot?.character?.experience,careerStartingXp,receiptEarnedXp,
      level:after.snapshot?.character?.level,
      location:after.snapshot?.gameState.location,
      excerpt:gm.narration.slice(0,850)});
    await pause(300);
  }
  const final=readDatapad(actor,null,db);
  const end=status(final.snapshot!,n);
  record({id:n.id,phase:"checkpoint",status:end,revision:final.revision,
    endingVerified:end==="dead"||end==="goal_complete"});
  return end==="active"&&Array.isArray(final.snapshot?.gameState.turnEvents)&&
    final.snapshot.gameState.turnEvents.length>=limit?"limit_reached":end;
}
describe.skipIf(!active)("Genuine multi-character NVIDIA PC playthroughs",()=>{
  it("runs exactly ten independent playable NPC campaigns with audited receipts",async()=>{
    expect(process.env.NVIDIA_API_KEY||process.env.NVIDIA_API_KEY_GM).toBeTruthy();
    expect(process.env.CAMPAIGN_DB_PATH).toMatch(/npc-autoplay-150\.sqlite$/i);
    expect(Object.keys(NPC_ULTIMATE_ARCS).length).toBe(34);
    if(!requested.length)expect(subjects).toHaveLength(10);
    expect(subjects.some(n=>n.id==="kelvek"||n.id==="dmir-holloran")).toBe(false);
    const remaining=new Map(subjects.map(n=>[n.id,n]));
    const failures:string[]=[],capped:string[]=[],confirmedEndings:string[]=[],otherStops:string[]=[];
    record({phase:"start",characters:remaining.size,limit,concurrency});
    for(let round=1;round<=limit&&remaining.size;round++){
      const queue=[...remaining.values()];
      await Promise.all(Array.from({length:concurrency},async()=>{
        while(queue.length){
          const n=queue.shift()!;
          try{
            const state=await run(n);
            if(state!=="active"){
              remaining.delete(n.id);
              if(state==="limit_reached")capped.push(n.id);
              else if(state==="dead"||state==="goal_complete")confirmedEndings.push(n.id);
              else otherStops.push(n.id);
            }
          }catch(e){
            record({id:n.id,phase:"blocked",round,error:e instanceof Error?e.message:String(e)});
            failures.push(n.id);
            remaining.delete(n.id);
          }
        }
      }));
      record({phase:"round_complete",round,stillPlaying:remaining.size,blocked:failures.length});
    }
    record({phase:"batch_end",failures,capped,confirmedEndings,otherStops,
      stillActive:[...remaining.keys()],allCharactersReachedGoalOrDied:confirmedEndings.length===subjects.length});
    expect(failures).toEqual([]);
  },1000*60*60*12);
});
