/** Isolated deterministic stress certification. Never touches a user account or hosted DB. */
import {afterEach,describe,expect,it,vi} from "vitest";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import * as accounts from "./accounts";
import type {Account} from "./accounts";
import {openStorage} from "./storage";
import {readDatapad,saveAuthoritativeDatapad} from "./datapad-save";
import {runGmTurn} from "./gm";
import type {NvidiaRequest} from "./original-provider";

const invoke=vi.hoisted(()=>vi.fn());
vi.mock("./original-provider",async(original)=>({
  ...await original<typeof import("./original-provider")>(),invokeNvidia:invoke,
}));
const room="Bastion — public transit liaison office";
let db:ReturnType<typeof openStorage>|null=null;
let folder:string|null=null;
afterEach(()=>{
  vi.restoreAllMocks();vi.unstubAllEnvs();invoke.mockReset();
  db?.close();db=null;
  if(folder){rmSync(folder,{recursive:true,force:true});folder=null;}
});
function fixture(){
  folder=mkdtempSync(join(tmpdir(),"goc-100-turn-"));
  const file=join(folder,"isolated-campaign.sqlite");
  vi.stubEnv("DATABASE_URL","");
  vi.stubEnv("VERCEL","");
  vi.stubEnv("GOC_USE_CLOUD_RAG","0");
  db=accounts.accountStore(openStorage(file));
  vi.spyOn(accounts,"accountStore").mockImplementation(()=>db!);
  const actor:Account={id:"cert-fixture-100",username:"cert-fixture@invalid.test",displayName:"Sandbox certification",role:"player"};
  db.prepare("INSERT INTO accounts VALUES (?, ?, ?, ?, '', '')").run(actor.id,actor.username,actor.displayName,actor.role);
  saveAuthoritativeDatapad(actor,null,0,{
    character:{name:"Transit Certification Traveler",species:"Human",level:3,experience:3800,health:34,maxHitPoints:34},
    gameState:{location:room,credits:87342,health:34,campaignTimeMinutes:150*525600,
      scene:{location:room,summary:"Captain Vell is at a staffed public transit liaison desk."},
      sceneNpcs:[{id:"captain-vell",name:"Captain Vell",role:"Transit officer",location:room}],
      relationships:[{name:"Captain Vell",role:"transit officer",disposition:"neutral",status:"active"}],
      inventory:[{id:"datapad",name:"Personal datapad",qty:1,tag:"equipment"}],
      discoveries:[],turnEvents:[],contacts:[],objectives:[{title:"Survey lawful transit procedures",status:"active"}]},
    messages:[],comms:[],settings:{tone:"grounded"},
  },db);
  return {actor,file};
}
function narration(step:number){
  const scene=`Inside the public transit liaison office, Captain Vell stands behind a worn metal counter under a posted timetable. Uniformed staff carry datapads between the open public service windows. The traveler checks the displayed registry number ${step}; the officer responds about this specific public procedure without making any binding commercial or security promises.`;
  const detail=`Captain Vell names public registry procedure ${step}, explains that an ordinary visitor may file a documented inquiry with the staffed reception clerk, and points toward the posted request channel. No permit, contract, money, weapon, access credential, or guaranteed approval is offered. The traveler remains in the public liaison office.`;
  const delta={discoveryAdd:[{title:`Bastion transit public procedure ${step}`,detail:`The officer confirms that procedure ${step} may be investigated through a normal recorded public inquiry.`,source:"Captain Vell"}]};
  return `## LOCATION
${room}

## SCENE
${scene}

## GM ADJUDICATION
This is an ordinary public procedure inquiry. No skill check is needed; the officer has not agreed to a contract or granted any restricted access.

## GAMEPLAY RESULT
${detail}

## SAGA CHECK
No check required.

## STATE UPDATE
Only the newly identified public procedure is recorded. Credits, XP, health, property, item ownership, and contractual status remain unchanged.

## PLAYER OPTIONS
A. Inspect another posted public procedure.
B. Submit a written request through the visitor registry.
C. Ask about the next lawful visitor step.
You may declare another action.
<!--STATE:${JSON.stringify(delta)}-->`;
}

describe("100-turn live-engine/isolated-SQLite stress certification",()=>{
  it("preserves 100 distinct decisions through interruptions, replay and five disk reopenings",async()=>{
    const {actor,file}=fixture();
    const total=100;
    let phase=0;
    let gmFailures=0;
    let recoveredOutage=false;
    const seenScenePrompts:string[]=[];
    invoke.mockImplementation(async(request:NvidiaRequest)=>{
      if(!request.sourceQuery){
        const declaration=String(request.messages.at(-1)?.content||"").split("\n\nPLAYER DECLARATION:\n")[1]||
          `I ask Captain Vell about public transit procedure ${phase}.`;
        return {provider:"nvidia",model:"fixture-intent",finishReason:"stop",content:JSON.stringify({
          intent:"dialogue",canonicalAction:declaration,declaredSpan:declaration,checkNeeded:false,
          skill:null,travelTarget:null,rationale:"Lawful question at a public service desk."})};
      }
      if(phase===37&&!recoveredOutage&&gmFailures++<3){
        throw new Error("STRESS_INJECTED_TEMPORARY_NIM_OUTAGE");
      }
      seenScenePrompts.push(String(request.system||""));
      return {provider:"nvidia",model:"deterministic-100-turn-narrator",finishReason:"stop",content:narration(phase)};
    });
    let revision=1;
    let recovered=0;
    for(let i=1;i<=total;i++){
      phase=i;
      const action=`I ask Captain Vell to identify public transit procedure ${i} and the lawful intake channel for an inquiry.`;
      const turnId=`isolate-long-run-${String(i).padStart(3,"0")}`;
      if(i===37){
        await expect(runGmTurn(actor,{revision,turnId,action})).rejects.toThrow();
        const before=readDatapad(actor,null,db!);
        expect(before.revision).toBe(revision);
        expect(before.snapshot?.gameState.credits).toBe(87342);
        recoveredOutage=true;
        recovered++;
      }
      const response=await runGmTurn(actor,{revision,turnId,action});
      expect(response.revision).toBe(revision+1);
      expect(response.snapshot.gameState.location).toBe(room);
      expect(response.snapshot.gameState.credits).toBe(87342);
      expect(response.snapshot.gameState.health).toBe(34);
      expect(response.snapshot.gameState.inventory).toEqual([{id:"datapad",name:"Personal datapad",qty:1,tag:"equipment"}]);
      expect(response.snapshot.character?.experience).toBe(3800);
      expect(response.snapshot.gameState.discoveries).toEqual(expect.arrayContaining([
        expect.objectContaining({title:`Bastion transit public procedure ${i}`}),
      ]));
      if(i%10===0){
        const replay=await runGmTurn(actor,{revision,turnId,action});
        expect(replay).toEqual(response);
        expect(readDatapad(actor,null,db!).revision).toBe(revision+1);
      }
      revision++;
      if(i%20===0){
        db!.close();
        db=null;
        db=openStorage(file);
        const loaded=readDatapad(actor,null,db);
        expect(loaded.revision).toBe(revision);
        expect(loaded.snapshot?.gameState.location).toBe(room);
        expect(loaded.snapshot?.gameState.credits).toBe(87342);
        expect(loaded.snapshot?.gameState.inventory).toEqual([{id:"datapad",name:"Personal datapad",qty:1,tag:"equipment"}]);
      }
    }
    const final=readDatapad(actor,null,db!);
    expect(final.revision).toBe(101);
    expect(final.snapshot?.gameState.credits).toBe(87342);
    expect(final.snapshot?.gameState.discoveries).toEqual(expect.arrayContaining([
      expect.objectContaining({title:"Bastion transit public procedure 100"}),
    ]));
    expect(recovered).toBe(1);
    expect(seenScenePrompts.length).toBeGreaterThanOrEqual(100);
    expect(final.snapshot?.gameState.sceneNpcs).toEqual(expect.arrayContaining([
      expect.objectContaining({name:"Captain Vell"}),
    ]));
    // Output is a count, never secrets or private saved user state.
    console.info("STRESS_CERTIFICATION",JSON.stringify({
      verifiedTurns:total,finalRevision:final.revision,replayedTurns:10,sqliteReopens:5,
      injectedProviderOutagesRecovered:recovered,errorsOutstanding:0,
      nvidiaMode:"mocked-controlled",saveIsolation:"temporary-local-SQLite",
    }));
  },300000);
});
