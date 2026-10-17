import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as accounts from "./accounts";
import type {Account} from "./accounts";
import { openStorage } from "./storage";
import { readDatapad, saveAuthoritativeDatapad } from "./datapad-save";
import { runGmTurn } from "./gm";

const provider=vi.hoisted(()=>vi.fn());
vi.mock("./original-provider",async(importOriginal)=>({
  ...await importOriginal<typeof import("./original-provider")>(),invokeNvidia:provider,
}));
let root:string|undefined;
let db:ReturnType<typeof openStorage>|undefined;
afterEach(()=>{
  vi.restoreAllMocks(); provider.mockReset(); vi.unstubAllEnvs();
  db?.close(); db=undefined;
  if(root){rmSync(root,{recursive:true,force:true});root=undefined;}
});
const rear="Bonadan — Nuvorren Design House, rear workroom";
const front="Bonadan — Nuvorren Design House, front counter";
function failDrafts(){
  provider.mockImplementation(async(request:{sourceQuery?:string;messages:Array<{content:string}>})=>{
    if(!request.sourceQuery){
      const declaration=request.messages.at(-1)?.content.split("\n\nPLAYER DECLARATION:\n")[1] || "";
      const movement=/return|walk|go to/i.test(declaration);
      return {provider:"nvidia",model:"isolated-intent",finishReason:"stop",
        content:JSON.stringify({intent:movement?"travel":"dialogue",canonicalAction:declaration,
          declaredSpan:declaration,checkNeeded:false,skill:null,travelTarget:movement?"front counter":null,
          rationale:"The player asks an ordinary question or moves within a public shop."})};
    }
    // Deliberately malformed renderer: each turn MUST fail forward only by the
    // authoritative state-safe policy, not invent a model-generated booking.
    return {provider:"nvidia",model:"malformed-gm",finishReason:"stop",
      content:"The worker is unable to help. Return to the same clerk. No further options."};
  });
}
describe("isolated multi-turn sandbox survival with actual SQLite reload",()=>{
  it("persists a safe appointment lead, moves to the counter, and survives process reload",async()=>{
    root=mkdtempSync(join(tmpdir(),"goc-assert-"));
    const database=join(root,"isolated.sqlite");
    vi.stubEnv("DATABASE_URL","");
    vi.stubEnv("VERCEL","");
    vi.stubEnv("GOC_USE_CLOUD_RAG","0");
    db=accounts.accountStore(openStorage(database));
    vi.spyOn(accounts,"accountStore").mockImplementation(()=>db!);
    const actor:Account={id:"fixture-not-a-live-account",username:"gm-audit@invalid.test",displayName:"Isolated gameplay audit",role:"player"};
    db.prepare("INSERT INTO accounts VALUES (?, ?, ?, ?, '', '')").run(actor.id,actor.username,actor.displayName,actor.role);
    saveAuthoritativeDatapad(actor,null,0,{
      character:{name:"D'mir Holloran",level:3,experience:4050,age:16,
        sagaStats:"STR 12 | DEX 14 | CON 10 | INT 12 | WIS 10 | CHA 11",forcePowers:"None"},
      gameState:{location:rear,credits:628650006,health:41,inventory:[],contacts:[],discoveries:[],
        scene:{location:rear,summary:"In the rear workroom; the worker doesn't book commissions."}},
      messages:[],comms:[],settings:{},
    },db);
    failDrafts();
    const firstAction="gm how do i get an appointment here?";
    const first=await runGmTurn(actor,{revision:1,turnId:"audit-commission-001",action:firstAction});
    expect(first.revision).toBe(2);
    expect(first.snapshot.gameState.location).toBe(rear);
    expect(first.snapshot.gameState.credits).toBe(628650006);
    expect(first.snapshot.gameState.discoveries).toEqual(expect.arrayContaining([
      expect.objectContaining({title:"Nuvorren bespoke commission intake"})
    ]));
    expect(String(first.snapshot.messages.at(-1)?.content || '')).not.toMatch(/appointment (?:is|has been) booked|deposit paid/i);
    const move="I return to the front counter and speak directly with the clerk about commissions.";
    const second=await runGmTurn(actor,{revision:2,turnId:"audit-return-counter-002",action:move});
    expect(second.revision).toBe(3);
    expect(second.snapshot.gameState.location).toBe(front);
    expect(second.snapshot.gameState.credits).toBe(628650006);
    expect(second.snapshot.gameState.health).toBe(41);
    expect(await runGmTurn(actor,{revision:2,turnId:"audit-return-counter-002",action:move})).toEqual(second);
    // Close and reopen the real *isolated* SQLite file, not the player's save.
    db.close();
    db=openStorage(database);
    const reloaded=readDatapad(actor,null,db);
    expect(reloaded.revision).toBe(3);
    // A successful database read must return an actual saved character;
    // this assertion narrows the nullable type without modifying the save.
    expect(reloaded.snapshot).not.toBeNull();
    const restored=reloaded.snapshot!;
    expect(restored.gameState.location).toBe(front);
    expect(restored.gameState.credits).toBe(628650006);
    expect(restored.gameState.discoveries).toEqual(second.snapshot.gameState.discoveries);
    expect(restored.gameState.inventory).toEqual([]);
  });
});
