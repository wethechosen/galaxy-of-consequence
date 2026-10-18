import {afterEach,describe,expect,it} from "vitest";
import {openStorage} from "./storage";
import {accountStore,type Account} from "./accounts";
import {readDatapad,saveDatapad,saveAuthoritativeDatapad,type DatapadSnapshot} from "./datapad-save";
import {playerVisibleSnapshot,preserveNpcPrivateState} from "./npc-private-state";

const actor:Account={id:"offscreen-fixture",username:"offscreen-fixture@invalid.test",displayName:"Fixture",role:"player"};
const original=():DatapadSnapshot=>({
 character:{name:"Explorer",level:2,experience:200},
 gameState:{location:"Bastion",credits:1000,inventory:[],npcMechanics:{captain:{health:20,secretBuild:true}},
  rivalIntelligence:{version:1,memories:[{name:"Captain Vell",observations:[{turnId:"t1",style:"ranged"}]}]},
  npcOffscreen:{version:1,plans:[{id:"secret-plan",actor:"Captain Vell",status:"preparing",dueAtMinute:190}],
   links:[],reports:[]},
  jediInstitution:{version:1,factionId:"new-jedi-order",lastTickTurnId:"t1",lastMinute:130,
   foundedAtMinute:120,programs:[{id:"jedi:relief:t1",mandateId:"relief",cycle:0,createdTurnId:"t1",
   createdAtMinute:120,dueAtMinute:4440,stage:"preparing",purpose:"medical relief",result:"unadjudicated",
   ethicalBoundary:"voluntary care",prerequisites:[],locationContext:"Dantooine"}]},
 }
 ,settings:{tone:"grounded"},messages:[],comms:[],
});
describe("NPC private state stays server-only and survives browser autosaves",()=>{
 it("redacts both GM fields without changing the stored object",()=>{
  const source=original(),visible=playerVisibleSnapshot(source);
  expect(visible?.gameState).not.toHaveProperty("rivalIntelligence");
  expect(visible?.gameState).not.toHaveProperty("npcOffscreen");
  expect(visible?.gameState).not.toHaveProperty("npcMechanics");
  expect(visible?.gameState).not.toHaveProperty("jediInstitution");
  expect(source.gameState).toHaveProperty("npcOffscreen");
  expect(visible).not.toBe(source);
 });
 it("rejects forged client planning fields while preserving server truth",()=>{
  const server=original();
  const candidate=playerVisibleSnapshot(server)!;
  candidate.gameState.rivalIntelligence={version:1,memories:[{name:"Forged"}]};
  candidate.gameState.npcOffscreen={version:1,plans:[{id:"fabricated-win"}]};
  candidate.gameState.npcMechanics={captain:{health:999}};
  candidate.gameState.jediInstitution={version:1,factionId:"new-jedi-order",lastMinute:999999,programs:[]};
  const safe=preserveNpcPrivateState(server,candidate);
  expect(safe.gameState.npcOffscreen).toEqual(server.gameState.npcOffscreen);
  expect(safe.gameState.rivalIntelligence).toEqual(server.gameState.rivalIntelligence);
  expect(safe.gameState.npcMechanics).toEqual(server.gameState.npcMechanics);
  expect(safe.gameState.jediInstitution).toEqual(server.gameState.jediInstitution);
 });
 it("retains hidden rival knowledge through an actual read/public-autosave/reload sequence",()=>{
  const db=accountStore(openStorage(":memory:"));
  try{
   db.prepare("INSERT INTO accounts VALUES (?, ?, ?, ?, '', '')").run(actor.id,actor.username,actor.displayName,actor.role);
   const source=original();
   const saved=saveAuthoritativeDatapad(actor,null,0,source,db);
   expect(saved.revision).toBe(1);
   const publicVersion=playerVisibleSnapshot(readDatapad(actor,null,db).snapshot)!;
   publicVersion.settings={...publicVersion.settings,tone:"quiet"};
   publicVersion.gameState.npcOffscreen={version:1,plans:[{id:"fake"}]};
   publicVersion.gameState.jediInstitution={version:1,programs:[{id:"fake-Jedi-victory"}]};
   const next=saveDatapad(actor,null,1,publicVersion,db);
   expect(next.revision).toBe(2);
   const restored=readDatapad(actor,null,db).snapshot!;
   expect(restored.gameState.npcOffscreen).toEqual(source.gameState.npcOffscreen);
   expect(restored.gameState.rivalIntelligence).toEqual(source.gameState.rivalIntelligence);
   expect(restored.gameState.jediInstitution).toEqual(source.gameState.jediInstitution);
   expect(restored.settings.tone).toBe("quiet");
   expect(restored.character).toEqual(source.character);
  }finally{db.close();}
 });
});
