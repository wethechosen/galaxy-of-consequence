import {describe,it,expect} from "vitest";
import {DatabaseSync} from "node:sqlite";
import {projectQuestWorld} from "./quest-world-events";
import {NPC_ULTIMATE_ARCS} from "./npc-ultimate-arcs";
import {hasAuditedNpcUltimateCompletion} from "./npc-ultimate-verification";
import type {DatapadSnapshot} from "./datapad-save";
const enabled=process.env.GOC_AUDIT_QUEST_WORLD==="1";
describe.skipIf(!enabled)("READ ONLY quest/world ledger replay over 34 real 150 ABY NPC saves",()=>{
 it("reconstructs every source-linked world fact without writing or pretending an ending",()=>{
  const path=process.env.CAMPAIGN_DB_PATH||"";
  expect(path).toMatch(/npc-autoplay-150\.sqlite$/i);
  const db=new DatabaseSync(path,{readOnly:true});
  try{
   const rows=db.prepare("SELECT a.username,d.snapshot FROM accounts a JOIN datapad_saves d ON a.id=d.account_id WHERE a.username LIKE 'npc-autoplay-%' ORDER BY a.username")
    .all() as Array<{username:string;snapshot:string}>;
   expect(rows).toHaveLength(34);
   let eventCount=0,turnCount=0,verifiedCount=0,claimedCount=0;
   const stalled:string[]=[];
   for(const {username,snapshot:raw} of rows){
    const subject=username.replace(/^npc-autoplay-/,"");
    expect(subject).not.toMatch(/^(?:kelvek|dmir-holloran)$/);
    const snapshot=JSON.parse(raw) as DatapadSnapshot;
    const turnEvents=Array.isArray(snapshot.gameState.turnEvents)?snapshot.gameState.turnEvents:[];
    const projected=projectQuestWorld(snapshot);
    expect(projected.version).toBe(1);
    expect(projected.sourceTurnCount).toBe(turnEvents.length);
    const committed=new Set(turnEvents.map(t=>t.turnId));
    for(const event of projected.events){
     expect(committed.has(event.turnId)).toBe(true);
     expect(event.provenance).toBe("authoritative-committed-turn");
    }
    expect(new Set(projected.events.map(e=>e.id)).size).toBe(projected.events.length);
    expect(projectQuestWorld(snapshot).events).toEqual(projected.events);
    const ultimate=NPC_ULTIMATE_ARCS[subject];
    expect(ultimate).toBeTruthy();
    const actualEnding=hasAuditedNpcUltimateCompletion(snapshot,ultimate);
    const entry=projected.quests.find(q=>q.isUltimate);
    expect(entry).toBeTruthy();
    expect(entry?.stage==="independently_verified").toBe(actualEnding);
    if(actualEnding)verifiedCount++;
    if(entry?.stage==="gm_claimed_completed")claimedCount++;
    if(projected.stall.stalled)stalled.push(subject);
    eventCount+=projected.events.length;
    turnCount+=turnEvents.length;
   }
   expect(verifiedCount).toBeGreaterThanOrEqual(1);
   console.info("NPC_QUEST_WORLD_READONLY_AUDIT",JSON.stringify({
    characters:rows.length,committedTurns:turnCount,derivedEvents:eventCount,
    verifiedEndings:verifiedCount,claimedUnverified:claimedCount,
    stalledCharacters:stalled,
   }));
  }finally{db.close();}
 },30000);
});
