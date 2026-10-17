import {describe,it,expect} from "vitest";
import {advanceNpcOffscreen,emptyNpcOffscreenState,npcOffscreenGmContext} from "./npc-offscreen-intelligence";
type Snapshot={gameState:Record<string,unknown>};
const sender="Captain Vell",recipient="Agent Nira",place="Bastion — liaison office";
const e=(turnId:string,changes:Record<string,unknown>={},action="A witnessed event.")=>({turnId,action,changes});
function fixture():Snapshot {
 return {gameState:{location:place,campaignTimeMinutes:100,
  sceneNpcs:[{id:"captain-vell",name:sender,role:"Officer",location:place}],
  contacts:[{name:sender},{name:recipient}],
  relationships:[{name:sender,disposition:"hostile"},{name:recipient,disposition:"uncertain"}],
  turnEvents:[e("obs-1"),e("obs-2"),e("channel-proof",{relationshipUpdate:[
   {name:sender,note:"Captain Vell and Agent Nira established a secure comlink channel for reports"},
  ]})],
  rivalIntelligence:{version:1,memories:[{id:"captain-vell",name:sender,
   observations:[{turnId:"obs-1",style:"ranged",outcome:"failure",source:"witnessed-scene",scene:place,campaignMinute:30},
    {turnId:"obs-2",style:"ranged",outcome:"success",source:"witnessed-scene",scene:place,campaignMinute:60}],
  }]},
  npcOffscreen:emptyNpcOffscreenState(),
 }};
}
function tick(old:Snapshot,id:string,delta:Record<string,unknown>={},minute=100):Snapshot {
 const next={gameState:{...old.gameState,campaignTimeMinutes:minute,
  turnEvents:[...(old.gameState.turnEvents as unknown[]),e(id,delta)]}} as Snapshot;
 next.gameState.npcOffscreen=advanceNpcOffscreen(old,next,id,delta);
 return next;
}
const linkDelta={npcIntelLinkAdd:[{sender,recipient,channel:"comlink",sourceTurnId:"channel-proof"}]};
function linked(){const result=tick(fixture(),"link-created",linkDelta);
 const link=(result.gameState.npcOffscreen as ReturnType<typeof emptyNpcOffscreenState>).links[0];
 expect(link).toBeDefined();
 return {result,link};
}
describe("offscreen NPC simulation preserves knowledge and player agency",()=>{
 it("seeds an evidence-linked delayed plan but never applies it as a combat advantage",()=>{
  const game=tick(fixture(),"tick-1",{},100);
  const ledger=game.gameState.npcOffscreen as ReturnType<typeof emptyNpcOffscreenState>;
  expect(ledger.plans).toHaveLength(1);
  expect(ledger.plans[0]).toMatchObject({actor:sender,tactic:"ranged",status:"preparing",
   disposition:"hostile",dueAtMinute:160,reasonTurnIds:["obs-1","obs-2"]});
  expect(game.gameState).not.toHaveProperty("credits");
  expect(game.gameState).not.toHaveProperty("forcePowers");
  expect(game.gameState).not.toHaveProperty("playerDamage");
 });
 it("keeps plans merely prepared as time advances; no phantom victories",()=>{
  const first=tick(fixture(),"tick-1",{},100);
  const waiting=tick(first,"tick-2",{},159);
  expect((waiting.gameState.npcOffscreen as ReturnType<typeof emptyNpcOffscreenState>).plans[0].status).toBe("preparing");
  const due=tick(waiting,"tick-3",{},160);
  expect((due.gameState.npcOffscreen as ReturnType<typeof emptyNpcOffscreenState>).plans[0].status).toBe("awaiting_gm");
  expect(npcOffscreenGmContext(due).plans).toHaveLength(1);
  expect(npcOffscreenGmContext(due).plans[0].constraint).toMatch(/intention/);
  expect(due.gameState).not.toHaveProperty("health");
 });
 it("does not change data when a turn is uncommitted or replayed",()=>{
  const a=fixture(),b=tick(a,"tick-1");
  expect(advanceNpcOffscreen(a,a,"future",{})).toEqual(emptyNpcOffscreenState());
  expect(advanceNpcOffscreen(b,b,"tick-1",{npcIntelReportAdd:[]})).toEqual(b.gameState.npcOffscreen);
 });
 it("rejects a forged communications channel lacking named source evidence",()=>{
  const a=fixture();
  expect(()=>tick(a,"bad-link",{npcIntelLinkAdd:[{sender,recipient,channel:"comlink",sourceTurnId:"obs-1"}]}))
   .toThrow(/channel lacks/);
  expect(()=>tick(a,"unknown-link",{npcIntelLinkAdd:[{sender,recipient:"Secret Stranger",channel:"comlink",sourceTurnId:"channel-proof"}]}))
   .toThrow(/channel lacks/);
 });
 it("creates a directional source-verified communications channel",()=>{
  const {result,link}=linked();
  expect(link.sourceTurnId).toBe("channel-proof");
  expect(link.minimumTransitMinutes).toBe(15);
  const replay=advanceNpcOffscreen(result,result,"link-created",linkDelta);
  expect(replay).toEqual(result.gameState.npcOffscreen);
 });
 it("delivers reports only when scheduled fictional travel time has elapsed",()=>{
  const {result,link}=linked();
  const sent=tick(result,"send-report",{npcIntelReportAdd:[{
   sender,recipient,linkId:link.id,sourceTurnId:"obs-1",transitMinutes:15,
  }]},110);
  const reports=(sent.gameState.npcOffscreen as ReturnType<typeof emptyNpcOffscreenState>).reports;
  expect(reports).toMatchObject([{originTurnId:"obs-1",status:"in_transit",dueAtMinute:125}]);
  const early=tick(sent,"early",{},124);
  expect((early.gameState.npcOffscreen as ReturnType<typeof emptyNpcOffscreenState>).reports[0].status).toBe("in_transit");
  const arrived=tick(early,"arrived",{},125);
  expect((arrived.gameState.npcOffscreen as ReturnType<typeof emptyNpcOffscreenState>).reports[0].status).toBe("delivered");
  expect(npcOffscreenGmContext(arrived).reports).toHaveLength(0);
  const inRoom:Snapshot={gameState:{...arrived.gameState,sceneNpcs:[{
   name:recipient,role:"Agent",location:place,
  }]}};
  expect(npcOffscreenGmContext(inRoom).reports).toMatchObject([{
   recipient,source:sender,originTurnId:"obs-1",confidence:"secondhand report, potentially mistaken",
  }]);
 });
 it("rejects information no sender ever witnessed or received",()=>{
  const {result,link}=linked();
  expect(()=>tick(result,"forged-report",{npcIntelReportAdd:[{
   sender,recipient,linkId:link.id,sourceTurnId:"fabricated",transitMinutes:15,
  }]})).toThrow(/never witnessed or received/);
 });
 it("allows delayed, traceable secondhand reports without granting the recipient firsthand knowledge",()=>{
  const initial=fixture();
  (initial.gameState.contacts as Array<Record<string,unknown>>).push({name:"Broker Padd"});
  (initial.gameState.turnEvents as unknown[]).push(e("agent-broker-link",{relationshipUpdate:[{
   name:"Agent Nira",note:"Agent Nira and Broker Padd established a courier delivery route",
  }]}));
  const first=tick(initial,"first-link",{npcIntelLinkAdd:[{sender,recipient,channel:"comlink",sourceTurnId:"channel-proof"},
   {sender:recipient,recipient:"Broker Padd",channel:"courier",sourceTurnId:"agent-broker-link"}]},100);
  const links=(first.gameState.npcOffscreen as ReturnType<typeof emptyNpcOffscreenState>).links;
  const agentToBroker=links.find(x=>x.sender===recipient)!;
  const vellToAgent=links.find(x=>x.sender===sender)!;
  expect(()=>tick(first,"premature-relay",{npcIntelReportAdd:[{
   sender:recipient,recipient:"Broker Padd",sourceTurnId:"obs-1",linkId:agentToBroker.id,
  }]},115)).toThrow(/never witnessed or received/);
  const report=tick(first,"sent-to-agent",{npcIntelReportAdd:[{
   sender,recipient,sourceTurnId:"obs-1",linkId:vellToAgent.id,transitMinutes:15,
  }]},110);
  const delivered=tick(report,"arrived-agent",{},125);
  const forwarded=tick(delivered,"agent-forwards",{npcIntelReportAdd:[{
   sender:recipient,recipient:"Broker Padd",sourceTurnId:"obs-1",linkId:agentToBroker.id,
  }]},140);
  const messages=(forwarded.gameState.npcOffscreen as ReturnType<typeof emptyNpcOffscreenState>).reports;
  expect(messages).toHaveLength(2);
  expect(messages[1]).toMatchObject({originTurnId:"obs-1",status:"in_transit",
   path:["captainvell","agentnira","brokerpadd"],dueAtMinute:260});
  const arrived=tick(forwarded,"broker-receives",{},260);
  const after=(arrived.gameState.npcOffscreen as ReturnType<typeof emptyNpcOffscreenState>).reports;
  expect(after[1].status).toBe("delivered");
  expect(arrived.gameState.rivalIntelligence).toEqual(initial.gameState.rivalIntelligence);
 });
 it("blocks premature automatic plan completion",()=>{
  const starting=tick(fixture(),"tick-1");
  const plan=(starting.gameState.npcOffscreen as ReturnType<typeof emptyNpcOffscreenState>).plans[0];
  expect(()=>tick(starting,"premature",{npcOffscreenPlanResolve:[{
   planId:plan.id,outcome:"adjudicated",
  }]},120)).toThrow(/not matured/);
 });
 it("requires a separately validated, actor-linked consequence for an adjudicated plan",()=>{
  const start=tick(fixture(),"tick-1");
  const ready=tick(start,"mature",{},160);
  const plan=(ready.gameState.npcOffscreen as ReturnType<typeof emptyNpcOffscreenState>).plans[0];
  expect(()=>tick(ready,"unsupported",{npcOffscreenPlanResolve:[{planId:plan.id,outcome:"adjudicated"}]},170))
   .toThrow(/actor-linked/);
  const valid=tick(ready,"resolved",{
   npcOffscreenPlanResolve:[{planId:plan.id,outcome:"adjudicated"}],
   relationshipUpdate:[{name:sender,disposition:"cautious",note:"Repositioned using available cover"}],
  },170);
  expect((valid.gameState.npcOffscreen as ReturnType<typeof emptyNpcOffscreenState>).plans[0])
   .toMatchObject({status:"adjudicated",adjudicatedTurnId:"resolved"});
  expect(valid.gameState).not.toHaveProperty("extraArmor");
 });
 it("seeds offscreen personal agendas from a documented NPC goal, not player tactics",()=>{
  const base=fixture();
  base.gameState.rivalIntelligence={version:1,memories:[]};
  base.gameState.contacts=[{name:"Agent Nira",sourceTurnId:"agenda-known",
    objective:"Investigate corrupt records and protect civilian witnesses"}];
  base.gameState.sceneNpcs=[];
  (base.gameState.turnEvents as unknown[]).push(e("agenda-known",{
    contactAdd:[{name:"Agent Nira",role:"Investigator"}],
  }));
  const game=tick(base,"agenda-tick",{},100);
  const ledger=game.gameState.npcOffscreen as ReturnType<typeof emptyNpcOffscreenState>;
  expect(ledger.plans).toHaveLength(1);
  expect(ledger.plans[0]).toMatchObject({
   actor:"Agent Nira",kind:"protect",tactic:"independent_agenda",
   objective:"Investigate corrupt records and protect civilian witnesses",
   reasonTurnIds:["agenda-known"],status:"preparing",dueAtMinute:220,
  });
  const ripe=tick(game,"agenda-mature",{},220);
  const context=npcOffscreenGmContext(ripe);
  expect(context.offscreenDue).toHaveLength(1);
  expect(context.offscreenDue[0]).toMatchObject({
   actor:"Agent Nira",privateBackgroundOnly:true,
  });
  expect(context.plans).toHaveLength(0);
  const offscreenPlan=(ripe.gameState.npcOffscreen as ReturnType<typeof emptyNpcOffscreenState>).plans[0];
  expect(()=>tick(ripe,"unsafe-background",{
   npcOffscreenPlanResolve:[{planId:offscreenPlan.id,outcome:"adjudicated"}],
   relationshipUpdate:[{name:"Agent Nira",note:"Finds a new witness"}],
   credits:500,
  },230)).toThrow(/cannot directly/);
  const adjudicated=tick(ripe,"safe-background",{
   npcOffscreenPlanResolve:[{planId:offscreenPlan.id,outcome:"adjudicated"}],
   relationshipUpdate:[{name:"Agent Nira",note:"Finds a new witness"}],
  },230);
  expect((adjudicated.gameState.npcOffscreen as ReturnType<typeof emptyNpcOffscreenState>).plans[0].status).toBe("adjudicated");
  expect(adjudicated.gameState).not.toHaveProperty("credits");
 });
 it("ignores a supposed offscreen NPC objective with no committed source",()=>{
  const base=fixture();
  base.gameState.rivalIntelligence={version:1,memories:[]};
  base.gameState.contacts=[{name:"Agent Nira",sourceTurnId:"fictional-proof",objective:"Investigate the dock"}];
  expect((tick(base,"uncorroborated",{},100).gameState.npcOffscreen as ReturnType<typeof emptyNpcOffscreenState>).plans).toHaveLength(0);
 });
 it("rejects campaign clock rollback",()=>{
  const prior=tick(fixture(),"tick-1",{},180);
  expect(()=>tick(prior,"clock-rollback",{},20)).toThrow(/backward/);
 });
});
