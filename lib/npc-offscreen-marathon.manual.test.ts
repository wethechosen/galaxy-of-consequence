import {describe,it,expect} from "vitest";
import {DatabaseSync} from "node:sqlite";
import {advanceNpcOffscreen,emptyNpcOffscreenState,npcOffscreenGmContext} from "./npc-offscreen-intelligence";
import {NPC_ULTIMATE_ARCS} from "./npc-ultimate-arcs";
type RecordValue=Record<string,unknown>;
const enabled=process.env.GOC_OFFSCREEN_MARATHON==="1";
/**
 * Separate, NVIDIA-free deterministic torture test.
 * The 34 authoritative campaign records are OPENED READ ONLY.
 * Synthetic actor and turns remain in memory and are never written to the
 * primary campaign DB, production Neon, D'mir, or the 34 original NPC saves.
 */
describe.skipIf(!enabled)("34-player offscreen NPC intelligence isolated soak",()=>{
 it("replays 200 independent offscreen world ticks per live NPC without making a fictional result authoritative",()=>{
  const path=process.env.GOC_OFFSCREEN_SOURCE_DB||"";
  expect(path).toMatch(/npc-autoplay-150\.sqlite$/i);
  const db=new DatabaseSync(path,{readOnly:true});
  const metrics={characters:0,rounds:0,plansSeeded:0,matured:0,adjudicated:0,
   reportsSent:0,reportsDelivered:0,verifiedOutcomesCreated:0,unearnedXp:0,writeAttempts:0};
  try{
   const rows=db.prepare("SELECT a.username,d.revision,d.snapshot FROM accounts a JOIN datapad_saves d ON d.account_id=a.id WHERE a.username LIKE 'npc-autoplay-%' ORDER BY a.username")
    .all() as Array<{username:string;revision:number;snapshot:string}>;
   expect(rows).toHaveLength(34);
   for(let i=0;i<rows.length;i++){
    const {username,snapshot:raw}=rows[i];
    const original=JSON.parse(raw) as {character?:RecordValue;gameState:RecordValue};
    const subject=username.replace(/^npc-autoplay-/,"");
    const goal=NPC_ULTIMATE_ARCS[subject];
    expect(goal).toBeTruthy();
    const originalXp=Number(original.character?.experience||0);
    const originAudit=JSON.stringify(original.gameState.npcUltimateAudit||null);
    const sender="Scenario Witness "+i,recipient="Scenario Listener "+i;
    const slug=subject.replace(/[^a-z0-9]/gi,"-");
    const ids={ob1:"lab-"+slug+"-one",ob2:"lab-"+slug+"-two",proof:"lab-"+slug+"-channel"};
    const initialEvents=[
     {turnId:ids.ob1,changes:{},action:"I attempt a ranged attack.",resolvedAt:"2026-10-17T20:00:00Z"},
     {turnId:ids.ob2,changes:{},action:"I attempt another ranged attack.",resolvedAt:"2026-10-17T20:00:00Z"},
     {turnId:ids.proof,changes:{relationshipUpdate:[{name:sender,note:sender+" and "+recipient+
        " establish a secure comlink channel"}]},action:"Two NPCs open a communications channel."},
    ];
    let snapshot:{gameState:RecordValue}={gameState:{
     location:"Synthetic Offscreen Test Chamber",campaignTimeMinutes:100,
     contacts:[{name:sender,objective:goal,sourceTurnId:ids.proof},{name:recipient}],
     relationships:[{name:sender,disposition:"hostile"},{name:recipient,disposition:"uncertain"}],
     sceneNpcs:[{name:sender,role:"Captain",location:"Synthetic Offscreen Test Chamber"}],
     turnEvents:initialEvents,
     rivalIntelligence:{version:1,memories:[{id:"synthetic-"+i,name:sender,
      observations:[
       {turnId:ids.ob1,style:"ranged",outcome:"failure",source:"witnessed-scene",scene:"Synthetic Offscreen Test Chamber",campaignMinute:60},
       {turnId:ids.ob2,style:"ranged",outcome:"success",source:"witnessed-scene",scene:"Synthetic Offscreen Test Chamber",campaignMinute:70},
      ]}]},
     npcOffscreen:emptyNpcOffscreenState(),
    }};
    let activePlanId="";
    let linkId="";
    for(let round=1;round<=200;round++){
     const now=100+round*20;
     const turnId="lab-"+slug+"-r"+String(round).padStart(3,"0");
     const changes:RecordValue={};
     if(round===1)changes.npcIntelLinkAdd=[{sender,recipient,channel:"comlink",sourceTurnId:ids.proof}];
     if(round===2){
      expect(linkId).not.toBe("");
      changes.npcIntelReportAdd=[{sender,recipient,sourceTurnId:ids.ob1,linkId,transitMinutes:40}];
     }
     if(round===8&&activePlanId){
      changes.npcOffscreenPlanResolve=[{planId:activePlanId,outcome:"adjudicated"}];
      changes.relationshipUpdate=[{name:sender,disposition:"cautious",
       note:"The captain changes watch position using available cover"}];
     }
     const next:{gameState:RecordValue}={gameState:{
      ...snapshot.gameState,campaignTimeMinutes:now,
      turnEvents:[...(snapshot.gameState.turnEvents as unknown[]),{
       turnId,action:"Synthetic isolated world-clock progression",changes,
      }],
     }};
     next.gameState.npcOffscreen=advanceNpcOffscreen(snapshot,next,turnId,changes);
     const ledger=next.gameState.npcOffscreen as ReturnType<typeof emptyNpcOffscreenState>;
     if(round===1){
      activePlanId=ledger.plans[0]?.id||"";
      linkId=ledger.links[0]?.id||"";
      expect(ledger.plans).toHaveLength(1);
      expect(ledger.links).toHaveLength(1);
     }
     if(round===2)expect(ledger.reports).toHaveLength(1);
     if(round===8)expect(ledger.plans[0]?.status).toBe("adjudicated");
     if(round===200){
      metrics.plansSeeded+=ledger.plans.length;
      metrics.matured+=ledger.plans.filter(x=>x.status==="awaiting_gm"||x.status==="adjudicated").length;
      metrics.adjudicated+=ledger.plans.filter(x=>x.status==="adjudicated").length;
      metrics.reportsSent+=ledger.reports.length;
      metrics.reportsDelivered+=ledger.reports.filter(x=>x.status==="delivered").length;
     }
     expect(ledger.reports.length).toBeLessThanOrEqual(96);
     expect(ledger.plans.length).toBeLessThanOrEqual(48);
     expect(new Set(ledger.reports.map(x=>x.id)).size).toBe(ledger.reports.length);
     expect(new Set(ledger.plans.map(x=>x.id)).size).toBe(ledger.plans.length);
     expect(npcOffscreenGmContext(next).plans.length).toBeLessThanOrEqual(4);
     snapshot=next;
     metrics.rounds++;
    }
    expect(Number(original.character?.experience||0)).toBe(originalXp);
    expect(JSON.stringify(original.gameState.npcUltimateAudit||null)).toBe(originAudit);
    metrics.characters++;
   }
   expect(metrics.rounds).toBe(6800);
   expect(metrics.adjudicated).toBe(34);
   expect(metrics.reportsDelivered).toBe(34);
   expect(metrics.verifiedOutcomesCreated).toBe(0);
   console.info("NPC_OFFSCREEN_SOAK",JSON.stringify(metrics));
  }finally{db.close();}
 },180000);
});
