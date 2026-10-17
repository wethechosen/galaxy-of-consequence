import {describe,it,expect} from "vitest";
import {recordCommittedRivalObservation,relevantRivalGmContext} from "./npc-rival-intelligence";

const key=(name:string)=>({name,role:"Imperial officer",location:"Bastion — checkpoint"});
const make=(scene: Array<Record<string, unknown>>=[]):any=>({
 character:{name:"Player",level:2},
 gameState:{location:"Bastion — checkpoint",campaignTimeMinutes:100,turnEvents:[],
  sceneNpcs:scene,relationships:[{name:"Captain Vell",disposition:"hostile",status:"active"}],
  rivalIntelligence:{version:1,memories:[]}},
 messages:[],comms:[],settings:{},
});
const committed=(before:any,id:string,action:string,changes:any={},roll:any=null)=>{
 const first=before.gameState;
 return {...before,gameState:{...first,
  campaignTimeMinutes:first.campaignTimeMinutes+5,
  turnEvents:[...first.turnEvents,{turnId:id,action,changes,roll,experienceAward:0}]}};
};
const shot={kind:"attack",label:"Ranged attack",outcome:"failure"};
describe("GOC firsthand rivalry and player style adaptation",()=>{
 it("never gives a rival omniscient knowledge when nobody witnessed the action",()=>{
  const prior=make();
  const action="I shoot at the guard with my blaster.";
  const after=committed(prior,"turn-001",action,{},shot);
  const result=recordCommittedRivalObservation(prior,after,"turn-001",action,shot);
  expect(result.memories).toEqual([]);
 });
 it("records only committed witnessed attempts and is idempotent across reload",()=>{
  const prior=make([key("Captain Vell")]);
  const action="I shoot the patrol officer with my blaster.";
  const after=committed(prior,"turn-001",action,{},shot);
  const first=recordCommittedRivalObservation(prior,after,"turn-001",action,shot);
  expect(first.memories).toHaveLength(1);
  expect(first.memories[0].observations).toMatchObject([
   {turnId:"turn-001",style:"ranged",outcome:"failure",source:"witnessed-scene"}
  ]);
  const loaded={...after,gameState:{...after.gameState,rivalIntelligence:first}};
  expect(recordCommittedRivalObservation(loaded,loaded,"turn-001",action,shot)).toEqual(first);
  expect(after.gameState).not.toHaveProperty("credits");
  expect(first).not.toHaveProperty("experience");
 });
 it("rejects uncommitted actions and cannot infer victories from declarations",()=>{
  const prior=make([key("Captain Vell")]);
  const after={...prior,gameState:{...prior.gameState,turnEvents:[]}};
  expect(recordCommittedRivalObservation(prior,after,"nonexistent","I shoot the officer.",shot).memories).toEqual([]);
  expect(recordCommittedRivalObservation(prior,committed(prior,"turn-2","I shoot the officer.",{},shot),"turn-2","I shoot the officer.",shot)
   .memories[0].observations[0].outcome).toBe("failure");
 });
 it("successful stealth and secret Force interests are never disclosed to a witness",()=>{
  const prior=make([key("Captain Vell")]);
  for(const [id,action,roll] of [
   ["turn-sneak","I sneak past the checkpoint unnoticed.",{kind:"skill",label:"Stealth",outcome:"success"}],
   ["turn-force","I secretly consider Force techniques.",null],
  ] as const){
   const after=committed(prior,id,action,{},roll);
   expect(recordCommittedRivalObservation(prior,after,id,action,roll).memories).toEqual([]);
  }
 });
 it("requires an independently resolved exposure before recording failed stealth",()=>{
  const prior=make([key("Captain Vell")]);
  const action="I sneak through the checkpoint.";
  const roll={kind:"skill",label:"Stealth",outcome:"failure"};
  const hidden=committed(prior,"turn-sneak",action,{},roll);
  expect(recordCommittedRivalObservation(prior,hidden,"turn-sneak",action,roll).memories).toEqual([]);
  const exposed=committed(prior,"turn-sneak",action,{relationshipUpdate:[
   {name:"Captain Vell",note:"Detected and identified the intruder"},
  ]},roll);
  const result=recordCommittedRivalObservation(prior,exposed,"turn-sneak",action,roll);
  expect(result.memories[0].observations[0].style).toBe("exposed_stealth");
 });
 it("needs multiple direct observations before proposing a counter and never auto-applies it",()=>{
  const a=make([key("Captain Vell")]);
  const action="I fire my blaster at the patrol guard.";
  const first=committed(a,"turn-001",action,{},shot);
  const memory1=recordCommittedRivalObservation(a,first,"turn-001",action,shot);
  const b={...first,gameState:{...first.gameState,rivalIntelligence:memory1}};
  const context1=relevantRivalGmContext(b);
  expect(context1[0].observedTendency).toBeNull();
  const second=committed(b,"turn-002",action,{},shot);
  const memory2=recordCommittedRivalObservation(b,second,"turn-002",action,shot);
  const c={...second,gameState:{...second.gameState,rivalIntelligence:memory2}};
  const context2=relevantRivalGmContext(c);
  expect(context2[0].observedTendency).toEqual({style:"ranged",numberWitnessed:2});
  expect(context2[0].possibleResponse).toContain("already-present cover");
  expect(context2[0].preparationEstablished).toBe(false);
  expect(context2[0].hadPreparationTime).toBe(false);
  expect(c.gameState).not.toHaveProperty("freeDefenseBonus");
  expect(c.gameState).not.toHaveProperty("combatModifiers");
 });
 it("does not expose memories offscreen, even if the rival is hostile",()=>{
  const a=make([key("Captain Vell")]);
  const action="I fire my blaster at the patrol guard.";
  const b=committed(a,"turn-001",action,{},shot);
  const memory=recordCommittedRivalObservation(a,b,"turn-001",action,shot);
  const elsewhere={...b,gameState:{...b.gameState,location:"Bonadan — shipyards",sceneNpcs:[],rivalIntelligence:memory}};
  expect(relevantRivalGmContext(elsewhere)).toEqual([]);
 });
 it("mercy is remembered only with a committed consequence, not a boast",()=>{
  const a=make([key("Captain Vell")]);
  const action="I spare Captain Vell and release him.";
  const unsupported=committed(a,"turn-mercy",action);
  expect(recordCommittedRivalObservation(a,unsupported,"turn-mercy",action,null).memories).toEqual([]);
  const confirmed=committed(a,"turn-mercy",action,{relationshipUpdate:[
   {name:"Captain Vell",disposition:"resentful",note:"Spared and released"},
  ]});
  const result=recordCommittedRivalObservation(a,confirmed,"turn-mercy",action,null);
  expect(result.memories[0].observations[0].style).toBe("mercy");
 });
 it("does not invent a living rival from a dead NPC or a defunct combatant",()=>{
  const dead=make([key("Kelvek")]);
  const action="I fire my blaster at a target.";
  const after=committed(dead,"turn-001",action,{},shot);
  expect(recordCommittedRivalObservation(dead,after,"turn-001",action,shot).memories).toEqual([]);
  const enemy=make();
  enemy.gameState.combat={status:"active",combatants:[{id:"enemy-1",name:"Captain Vell",side:"opposition",hp:12}]};
  const end=committed(enemy,"turn-002",action,{},shot);
  end.gameState.combat={status:"player_victory",combatants:[{id:"enemy-1",name:"Captain Vell",side:"opposition",hp:0}]};
  expect(recordCommittedRivalObservation(enemy,end,"turn-002",action,shot).memories).toEqual([]);
 });
});
