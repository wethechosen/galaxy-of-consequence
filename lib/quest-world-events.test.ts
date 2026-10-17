import {describe,it,expect} from "vitest";
import {projectQuestWorld,detectQuestStall,questWorldGmContext} from "./quest-world-events";
import {npcUltimateEvidenceDigest} from "./npc-ultimate-verification";
const goal="Prove the courier-route fraud, protect the caravan, and confirm safe restoration.";
const e=(turnId:string,action:string,changes:Record<string,unknown>,outcome:"success"|"failure"|null=null)=>({
 turnId,action,changes,resolvedAt:"2026-10-17T19:00:00.000Z",
 roll:outcome?{outcome}:null,experienceAward:0,
});
const stage=(state:Record<string,unknown>)=>projectQuestWorld({gameState:state,messages:[]});
describe("authoritative quest-world event sourcing",()=>{
 it("projects real GM deltas into persistent source-linked events, never the PC's prose",()=>{
  const state={npcUltimateGoal:goal,objectives:[{title:goal,status:"active"}],turnEvents:[
   e("npc-real-trader-t001","I discover five stolen freighters and win!",{}),
   e("npc-real-trader-t002","I inspect the manifest",{discoveryAdd:[{title:"Disputed cargo numbers",detail:"Three entries mismatch"}]},"success"),
   e("npc-real-trader-t003","I review the same manifest",{discoveryAdd:[{title:"Disputed cargo numbers",detail:"Three entries mismatch"}]},"success"),
   e("npc-real-trader-t004","I travel to the pier",{location:"Dock Seven",milestoneAdd:[{title:"A witness interviewed"}]}),
  ]};
  const p=stage(state);
  expect(p.sourceTurnCount).toBe(4);
  expect(p.lastCommittedTurnId).toBe("npc-real-trader-t004");
  expect(p.events.map(event=>event.kind)).toEqual(["discovery","milestone","travel"]);
  expect(p.events[0].turnId).toBe("npc-real-trader-t002");
  expect(p.events[0].provenance).toBe("authoritative-committed-turn");
  expect(p.quests[0].stage).toBe("active");
  expect(p.events).toEqual(stage(state).events);
 });
 it("keeps GM-claimed resolutions separate from independently proven ultimate completion",()=>{
  const id="npc-real-trader-t007",narr="## GAMEPLAY RESULT\nThe convoy safely arrives and the cargo fraud is resolved.";
  const base={gameState:{npcUltimateGoal:goal,objectives:[{title:goal,status:"completed"}],
    turnEvents:[e(id,"I escort the convoy to port",{objectiveComplete:[goal],milestoneAdd:[{title:"Convoy arrived"}]})]},
    messages:[{role:"assistant",provider:"nvidia",model:"nemotron",turnId:id,content:narr}]};
  const draft=projectQuestWorld(base);
  expect(draft.quests[0].stage).toBe("gm_claimed_completed");
  expect(draft.events.some(x=>x.kind==="objective_claimed")).toBe(true);
  const audit={status:"verified",goal,reviewer:"independent-content-review",evidenceTurnIds:[id],
    evidenceDigest:npcUltimateEvidenceDigest(base,[id])};
  expect(projectQuestWorld({...base,gameState:{...base.gameState,npcUltimateAudit:audit}}).quests[0].stage)
   .toBe("independently_verified");
  expect(projectQuestWorld({...base,gameState:{...base.gameState,npcUltimateAudit:{...audit,evidenceDigest:"fake"}}}).quests[0].stage)
   .toBe("gm_claimed_completed");
 });
 it("does not treat a failed roll as a successful milestone, discovery, or objective",()=>{
  const state={objectives:[{title:goal,status:"active"}],turnEvents:[
   e("npc-real-trader-t001","I hack the secure terminal",{discoveryAdd:[{title:"Secret codes"}],milestoneAdd:[{title:"Control secured"}],objectiveComplete:[goal]}, "failure"),
  ]};
  const p=stage(state);
  expect(p.events).toHaveLength(0);
  expect(p.quests[0].stage).toBe("active");
 });
 it("projects only server-verified accepted trades, not mere offers",()=>{
  const offer=e("npc-real-merchant-t001","I ask for the price",{tradeOfferAdd:[{sellerName:"Tavo",totalCredits:50,items:[{name:"Medpac",qty:1}]}]});
  const payment=e("npc-real-merchant-t002","I accept Tavo's quoted price",{});
  const state={gameState:{turnEvents:[offer,payment],tradeReceipts:[
    {turnId:"npc-real-merchant-t002",offerId:"offer:npc-real-merchant-t001:0",sellerName:"Tavo",totalCredits:50,items:[{name:"Medpac",qty:1}]},
    {turnId:"uncommitted",offerId:"forged",sellerName:"Unknown",totalCredits:999,items:[]},
  ]}};
  const events=projectQuestWorld(state).events;
  expect(events.map(x=>x.kind)).toEqual(["trade_offer","trade_settled"]);
  expect(events[1]).toMatchObject({turnId:"npc-real-merchant-t002",title:"Tavo"});
  expect(events[1].detail).toContain("Paid 50 credits");
  expect(projectQuestWorld({...state,gameState:{...state.gameState,tradeReceipts:[]}}).events.map(x=>x.kind)).toEqual(["trade_offer"]);
 });
 it("does not duplicate changed events or XP on retries of the same turn ID",()=>{
  const first=e("npc-real-trader-t001","I read the registry",{discoveryAdd:[{title:"Open registry"}]},"success");
  const state={turnEvents:[first,{...first}]};
  const p=stage(state);
  expect(p.events).toHaveLength(1);
  expect(p.events[0].id).toBe("npc-real-trader-t001:discovery:0");
 });
 it("distinguishes an inconsequential conversation from a genuine stalled loop",()=>{
  const early=[e("npc-real-clerk-t001","I ask a clerk about the form",{})];
  expect(detectQuestStall(early).stalled).toBe(false);
  const loop=[
   e("npc-real-clerk-t001","I ask the clerk for approval",{}),
   e("npc-real-clerk-t002","I ask the clerk for approval",{}),
   e("npc-real-clerk-t003","I request the form",{}),
   e("npc-real-clerk-t004","I request the form",{}),
  ];
  const p=detectQuestStall(loop);
  expect(p.stalled).toBe(true);
  expect(p.consecutiveEffectlessTurns).toBe(4);
  expect(p.repeatedActions).toBe(2);
  expect(p.reason).toContain("Do not invent success");
  const resolved=[...loop,e("npc-real-clerk-t005","I go to the public research library",{location:"Library"})];
  expect(detectQuestStall(resolved).stalled).toBe(false);
 });
 it("informs GM using only confirmed world ledger and exposes no unearned outcomes",()=>{
  const state={gameState:{objectives:[{title:goal,status:"active"}],
   turnEvents:[e("npc-real-trader-t001","I demand 20 million credits",{}),
     e("npc-real-trader-t002","I review a witness",{discoveryAdd:[{title:"Verified witness testimony"}]})]}};
  const c=questWorldGmContext(state);
  expect(c.recentConfirmedWorldEvents).toHaveLength(1);
  expect(c.recentConfirmedWorldEvents[0].title).toBe("Verified witness testimony");
  expect(JSON.stringify(c)).not.toMatch(/20 million/);
  expect(c.questStates[0].stage).toBe("active");
 });
});
