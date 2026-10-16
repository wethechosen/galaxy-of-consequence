import {randomBytes} from "node:crypto";
import {appendFileSync,mkdirSync} from "node:fs";
import {resolve} from "node:path";
import {describe,it,expect} from "vitest";
import {accountStore,createAccount,type Account} from "./accounts";
import {readDatapad,saveAuthoritativeDatapad,type DatapadSnapshot} from "./datapad-save";
import {runGmTurn} from "./gm";
import {invokeNvidia} from "./original-provider";
import {ALL_NPC_TEST_ROSTER,type NpcTestSubject} from "./npc-test-roster";
import {applySagaFoundation,availableClassSkills,foundationRequirements,SAGA_LANGUAGE_OPTIONS} from "@/original/lib/sagaAdvancement";

const active=process.env.GOC_AUTONOMOUS_NPCS==="1";
const requested=(process.env.GOC_NPC_SUBJECTS||"").split(",").map(x=>x.trim()).filter(Boolean);
const subjects=ALL_NPC_TEST_ROSTER.filter(n=>n.id!=="kelvek"&&(!requested.length||requested.includes(n.id)));
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
  const goals=Array.isArray(s.gameState.objectives)?s.gameState.objectives.filter(isObj):[];
  if(goals.some(g=>String(g.title).toLowerCase()===n.objective.toLowerCase()
      &&String(g.status).toLowerCase()==="completed"))return "goal_complete";
  if(String(s.gameState.lifeStatus||s.character?.lifeStatus).toLowerCase()==="dead"||
      s.character?.deceased===true)return "dead";
  if(Number(s.gameState.health)<=0)return "incapacitated";
  return "active";
}
async function choose(n:NpcTestSubject,s:DatapadSnapshot,turn:number){
  const history=(s.messages as Array<Record<string,unknown>>).slice(-4)
    .map(m=>({role:m.role,content:String(m.content||"").slice(0,900)}));
  const answer=await invokeNvidia({purpose:"npc",temperature:0.6,max_tokens:350,
    system:"You control ONLY this playable character, not the GM. Make ONE concrete first-person Star Wars Saga Edition action that pursues your goal. Respect established place, skills, knowledge and material. No guaranteed success, unearned awards, or narration of GM outcomes. Adapt to setbacks. Return JSON with action string starting I.",
    messages:[{role:"user",content:JSON.stringify({name:n.name,role:n.role,goal:n.objective,
      turn,location:s.gameState.location,health:s.gameState.health,
      inventory:s.gameState.inventory,objectives:s.gameState.objectives,history})}]});
  let action=answer.content.trim();
  try{const parsed=JSON.parse(action);if(typeof parsed.action==="string")action=parsed.action;}catch{
    const match=action.match(/\{[\s\S]*\}/);
    if(match)try{const parsed=JSON.parse(match[0]);if(typeof parsed.action==="string")action=parsed.action;}catch{}
  }
  action=action.replace(/^Action\s*:\s*/i,"").replace(/^["']|["']$/g,"").trim();
  if(!/^I\s+/i.test(action)||action.length<12||action.length>600||
      /STATE:|## |I automatically win/i.test(action))throw Error("Invalid PC action from NVIDIA");
  return action;
}
async function retry<T>(fn:()=>Promise<T>,id:string,phase:string):Promise<T>{
  for(let i=0;i<7;i++)try{return await fn();}catch(err){
    const error=err as Error & {status?:number;retryAfterSeconds?:number};
    const eligible=[429,502,503,504].includes(Number(error.status))||
      /rate|cooldown|busy|unavailable|retry|quota|draft/i.test(String(error.message));
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
  let existing=Array.isArray(saved.snapshot!.gameState.turnEvents)?saved.snapshot!.gameState.turnEvents.length:0;
  for(let turn=existing+1;turn<=Math.min(limit,existing+1);turn++){
    saved=readDatapad(actor,null,db);
    if(status(saved.snapshot!,n)!=="active")break;
    const action=await retry(()=>choose(n,saved.snapshot!,turn),n.id,"pc");
    const turnId="npc-real-"+n.id+"-t"+String(turn).padStart(3,"0");
    record({id:n.id,phase:"declared",turn,turnId,action,revision:saved.revision});
    const gm=await retry(()=>runGmTurn(actor!,{revision:saved.revision,action,turnId}),n.id,"gm");
    if(gm.receipt.status!=="committed")throw Error("No committed GM receipt");
    const after=readDatapad(actor,null,db);
    const events=Array.isArray(after.snapshot?.gameState.turnEvents)?after.snapshot.gameState.turnEvents:[];
    if(after.revision!==gm.revision||after.snapshot?.character?.name!==n.name||
       !events.some((e:Record<string,unknown>)=>e.turnId===turnId))throw Error("Save consistency error");
    record({id:n.id,phase:"committed",turn,revision:after.revision,status:status(after.snapshot!,n),
      xp:after.snapshot?.character?.experience,level:after.snapshot?.character?.level,
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
  it("runs 34 independent character campaigns with audited receipts",async()=>{
    expect(process.env.NVIDIA_API_KEY||process.env.NVIDIA_API_KEY_GM).toBeTruthy();
    expect(process.env.CAMPAIGN_DB_PATH).toBeTruthy();
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
