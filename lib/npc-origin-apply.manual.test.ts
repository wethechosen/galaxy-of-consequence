import {expect,it} from "vitest";
import {appendFileSync} from "node:fs";
import {accountStore} from "./accounts";
import {readDatapad,saveAuthoritativeDatapad} from "./datapad-save";
import {ALL_NPC_TEST_ROSTER} from "./npc-test-roster";
import {NPC_HISTORICAL_TIERS,reconstructHumanNpc} from "./npc-historical-baselines";
import {progressionStatus} from "@/original/lib/sagaAdvancement";
const enabled=process.env.GOC_CONFIRM_ORIGIN_REBUILD==="1";
it.skipIf(!enabled)("audits and commits 150 ABY experienced career origin in isolated NPC database",async()=>{
  const path=String(process.env.CAMPAIGN_DB_PATH||"");
  if(!path.endsWith("npc-autoplay-150.sqlite"))throw Error("Danger: this tool only supports the isolated NPC testing database.");
  const db=accountStore(),failures:string[]=[],results:Record<string,unknown>[]=[];
  for(const [id,profile] of Object.entries(NPC_HISTORICAL_TIERS)){
    const npc=ALL_NPC_TEST_ROSTER.find(n=>n.id===id)!;
    const actor=db.prepare("SELECT id,username,displayName,role FROM accounts WHERE username=?")
      .get("npc-autoplay-"+id) as any;
    if(!actor){failures.push(id+" no account");continue;}
    const row=readDatapad(actor,null,db);
    if(!row.snapshot){failures.push(id+" no snapshot");continue;}
    try{
      const before=row.snapshot;
      const next=reconstructHumanNpc(before,npc);
      if(next===before){results.push({id,unchanged:true,level:next.character?.level});continue;}
      const events=JSON.stringify(before.gameState.turnEvents||[]);
      if(JSON.stringify(next.gameState.turnEvents||[])!==events)throw Error("Original turn receipts changed");
      saveAuthoritativeDatapad(actor,null,row.revision,next,db);
      const confirmed=readDatapad(actor,null,db);
      if(!confirmed.snapshot||confirmed.revision!==row.revision+1)throw Error("No confirmed save revision after origin commit");
      if(progressionStatus(confirmed.snapshot.character||{}).pendingLevels!==0)throw Error("Incomplete Saga choices");
      if(JSON.stringify(confirmed.snapshot.gameState.turnEvents||[])!==events)throw Error("Story events changed during commit");
      const entry={id,level:confirmed.snapshot.character?.level,
        startingXp:confirmed.snapshot.character?.npcStartingXp,
        previouslyEarnedXp:confirmed.snapshot.character?.npcEarnedTestXp,
        fromRevision:row.revision,toRevision:confirmed.revision,
        confirmedStoryTurns:Array.isArray(confirmed.snapshot.gameState.turnEvents)?
          confirmed.snapshot.gameState.turnEvents.length:0,
        maxHitPoints:confirmed.snapshot.character?.maxHitPoints,
        forcePowers:confirmed.snapshot.character?.forcePowers,
        careerProvenance:"150 ABY GM NPC baseline, not NPC test-play rewards"};
      results.push(entry);console.info("NPC_ORIGIN_COMMITTED",JSON.stringify(entry));
      appendFileSync("data/npc-origin-audit.jsonl",JSON.stringify({...entry,at:new Date().toISOString()})+"\n");
    }catch(error){failures.push(id+": "+String(error));}
  }
  console.info("NPC_ORIGIN_RESULTS",JSON.stringify({updated:results.length,failures}));
  expect(failures).toEqual([]);
  expect(results.length).toBe(17);
},120000);
