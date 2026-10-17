import {afterEach,describe,expect,it,vi} from "vitest";
import * as accounts from "./accounts";
import type {Account} from "./accounts";
import {openStorage} from "./storage";
import {readDatapad,saveAuthoritativeDatapad} from "./datapad-save";
import {runGmTurn} from "./gm";
import type {NvidiaRequest} from "./original-provider";

const provider=vi.hoisted(()=>vi.fn());
vi.mock("./original-provider",async(importOriginal)=>({
 ...await importOriginal<typeof import("./original-provider")>(),invokeNvidia:provider,
}));
let db:ReturnType<typeof openStorage>|null=null;
afterEach(()=>{
 vi.restoreAllMocks();
 provider.mockReset();
 db?.close();
 db=null;
});
const room="Bastion — liaison office";
function response(turn:number) {
 const description="The liaison office is a long chamber with an open doorway to the public hall, a battered metal briefing table, and a posted passage timetable. Captain Vell stands opposite you, wearing the confirmed uniform described in the current scene. A datapad sits on the table, untouched, and uniformed staff pass the open doorway without stopping. The captain studies your proposal and responds without claiming to have accepted any agreement.";
 const revised=turn>1;
 const discovered={discoveryAdd:[{title:"Public guarantor register is accessible",detail:"Captain Vell names the public register as an actionable route to independent surety",source:"Captain Vell"}]};
 return `## LOCATION
${room}

## SCENE
${description}

## GM ADJUDICATION
The player may propose terms, but acceptance remains Captain Vell's decision. There is no automatic agreement, skill check, gear transfer, or payment.

## GAMEPLAY RESULT
${revised ? "Captain Vell responds to the revised guarantee by naming the public guarantor registry at the east entrance. He agrees only that the registry is open for verification; he expressly does not accept the proposed agreement. The newly identified register gives the player a distinct, immediately accessible lead, and Captain Vell remains at the liaison desk." : "Captain Vell says he will not accept a contract without concrete guarantees. He records this first request as an inquiry, not a contract or permit; no agreement is executed. The posted public route remains available."}

## SAGA CHECK
No check required.

## STATE UPDATE
${revised ? "The independently accessible public guarantor register is established as a lead; no agreement, money, XP, approval or equipment changes." : "No persistent change. No XP, credits, approval or item gained."}

## PLAYER OPTIONS
A. Investigate the public passage records for evidence.
B. Walk to the open public corridor.
C. Ask about the required guarantor.
<!--STATE:${JSON.stringify(revised?discovered:{})}-->`;
}
function setup(){
 db=accounts.accountStore(openStorage(":memory:"));
 vi.spyOn(accounts,"accountStore").mockReturnValue(db);
 const actor:Account={id:"rival-test",username:"rival-integration@invalid.test",displayName:"Rivalry fixture",role:"player"};
 db.prepare("INSERT INTO accounts VALUES (?, ?, ?, ?, '', '')").run(actor.id,actor.username,actor.displayName,actor.role);
 saveAuthoritativeDatapad(actor,null,0,{
  character:{name:"Rivalry Test Traveler",species:"Human",level:1,experience:0,health:24,maxHitPoints:24},
  gameState:{location:room,credits:500,health:24,campaignTimeMinutes:100,
   scene:{location:room,summary:"Captain Vell stands at the liaison desk, ready to receive a request."},
   sceneNpcs:[{id:"scene-captain-vell",name:"Captain Vell",role:"Imperial officer",location:room}],
   relationships:[{name:"Captain Vell",role:"officer",disposition:"hostile",status:"active"}],
   turnEvents:[],inventory:[],objectives:[],contacts:[],
  },
  messages:[],comms:[],settings:{},
 },db);
 const gmPrompts:string[]=[];
 provider.mockImplementation(async(request:NvidiaRequest)=>{
  if(!request.sourceQuery){
   const last=String(request.messages.at(-1)?.content||"");
   const declaration=last.split("\n\nPLAYER DECLARATION:\n")[1]||"I negotiate terms with Captain Vell.";
   return {provider:"nvidia",model:"intent-fixture",finishReason:"stop",
    content:JSON.stringify({intent:"dialogue",canonicalAction:declaration,declaredSpan:declaration,
     checkNeeded:false,skill:null,travelTarget:null,rationale:"Existing NPC hears proposed terms."})};
  }
  gmPrompts.push(String(request.system||""));
  return {provider:"nvidia",model:"npc-fixture",finishReason:"stop",content:response(gmPrompts.length)};
 });
 return {actor,gmPrompts};
}
describe("GM integrates witnessed rivalry only after an authoritative save",()=>{
 it("preserves observed negotiation and exact turn id through an idempotent save reload",async()=>{
  const {actor,gmPrompts}=setup();
  const action="I negotiate with Captain Vell for safe passage under the published terms.";
  const first=await runGmTurn(actor,{revision:1,turnId:"rival-merchant-001",action});
  expect(first.revision).toBe(2);
  expect(first.snapshot.gameState.rivalIntelligence).toMatchObject({
   version:1,memories:[{name:"Captain Vell",observations:[{
    turnId:"rival-merchant-001",style:"negotiation",source:"witnessed-scene",
   }]}],
  });
  expect(first.snapshot.gameState.credits).toBe(500);
  expect(first.snapshot.character?.experience).toBe(0);
  const replay=await runGmTurn(actor,{revision:1,turnId:"rival-merchant-001",action});
  expect(replay).toEqual(first);
  const reload=readDatapad(actor,null,db!);
  expect(reload.snapshot?.gameState.rivalIntelligence).toEqual(first.snapshot.gameState.rivalIntelligence);
  expect(gmPrompts[0]).not.toContain("GM-PRIVATE WITNESSED NPC INTELLIGENCE");
  const nextAction="I propose revised guarantees and negotiate terms with Captain Vell.";
  const second=await runGmTurn(actor,{revision:2,turnId:"rival-merchant-002",action:nextAction});
  expect(second.revision).toBe(3);
  expect(second.snapshot.gameState.rivalIntelligence).toMatchObject({
   memories:[{observations:[{turnId:"rival-merchant-001"},{turnId:"rival-merchant-002"}]}],
  });
  expect(gmPrompts.some(x=>x.includes("GM-PRIVATE WITNESSED NPC INTELLIGENCE"))).toBe(true);
 });
});
