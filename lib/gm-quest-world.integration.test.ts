import {describe,it,expect} from "vitest";
import {applyFinalizedTurn} from "./gm";
import type {DatapadSnapshot} from "./datapad-save";
import {projectQuestWorld} from "./quest-world-events";
const initial=():DatapadSnapshot=>({
 character:{name:"NPC test subject",level:1,experience:0,maxHitPoints:24},
 gameState:{health:24,credits:100,creditsCriminal:0,location:"Ossus — public archive",objectives:[
  {title:"Locate a verified public star chart",status:"active"},
 ],turnEvents:[],inventory:[],contacts:[],discoveries:[],milestones:[],decisions:[]},
 messages:[],comms:[],settings:{tone:"grounded"},
});
describe("quest event projection commits with actual GM gameplay",()=>{
 it("stores an evidence-linked world fact in the same validated turn without inventing XP",()=>{
  const action="I inspect the public survey chart";
  const delta={discoveryAdd:[{title:"Survey chart mismatch",detail:"Three public coordinates differ"}],timeAdvanceMinutes:15};
  const one=applyFinalizedTurn(initial(),"npc-real-researcher-t001",action,null,delta);
  const ledger=one.gameState.questWorld as ReturnType<typeof projectQuestWorld>;
  expect(ledger.version).toBe(1);
  expect(ledger.sourceTurnCount).toBe(1);
  expect(ledger.events).toHaveLength(1);
  expect(ledger.events[0]).toMatchObject({kind:"discovery",title:"Survey chart mismatch",
   turnId:"npc-real-researcher-t001",provenance:"authoritative-committed-turn"});
  expect(one.character?.experience).toBe(0);
  expect(one.gameState.credits).toBe(100);
 });
 it("returns the exact save unchanged on an idempotent retry",()=>{
  const one=applyFinalizedTurn(initial(),"npc-real-researcher-t001","I examine the chart",null,{
   discoveryAdd:[{title:"Survey chart mismatch"}],
  });
  const twice=applyFinalizedTurn(one,"npc-real-researcher-t001","I examine a different chart",null,{
   objectiveComplete:["Locate a verified public star chart"],credits:500,experienceAward:1000,
  });
  // The campaign scaffold may clone the wrapper on reload; the saved facts
  // and event ledger must remain structurally identical and unmodified.
  expect(twice).toEqual(one);
  expect(twice.gameState.questWorld).toEqual(one.gameState.questWorld);
  expect(twice.gameState.credits).toBe(100);
  expect(twice.character?.experience).toBe(0);
 });
 it("does not let the model complete an entire long-term arc just by checking a box",()=>{
  const goal="Verify a safe shipping corridor and deliver the cargo to its destination.";
  const start=initial();
  start.gameState.npcUltimateGoal=goal;
  start.gameState.objectives=[{title:goal,status:"active"}];
  const one=applyFinalizedTurn(start,"npc-real-trader-t001","I seek an official chart",null,{objectiveComplete:[goal]});
  const ledger=one.gameState.questWorld as ReturnType<typeof projectQuestWorld>;
  expect(ledger.quests[0].stage).toBe("gm_claimed_completed");
  expect(ledger.quests[0].stage).not.toBe("independently_verified");
  expect(one.gameState.turnEvents).toHaveLength(1);
 });
});
