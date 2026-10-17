import { beforeEach, describe, expect, it, vi } from "vitest";
import { stableGptTurnId } from "./gpt-turn-identity";
import { NvidiaProviderError } from "./nvidia-errors";
const mock = vi.hoisted(() => ({ get: vi.fn(), run: vi.fn(), save: vi.fn() }));
vi.mock("./hosted-bridge", () => ({
  hostedGet: mock.get, hostedPersistenceEnabled: () => true,
  hydrateHostedSave: vi.fn(), saveHostedResult: mock.save,
}));
vi.mock("./gpt-action", () => ({
  GptActionError: class extends Error { constructor(message: string, public status = 401) { super(message); } },
  authenticateGptAction: () => ({id:"isolated-gpt-actor",username:"isolated@invalid.test",role:"player"}),
  readGptActionBody: (request: Request) => request.json(),
}));
vi.mock("./gm", () => ({
  runGmTurn:mock.run,
  GmTurnError:class extends Error { constructor(message: string,public status=400){ super(message); } },
}));
const actorId="isolated-gpt-actor";
const action="I ask the steward which access permits are required.";
function request(actionText=action,turnId?:string) {
  return new Request("https://fixture.invalid/api/gpt/turn",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({revision:4,action:actionText,...(turnId?{turnId}:{})}),
  });
}
beforeEach(()=>{
  vi.clearAllMocks();
  mock.get.mockResolvedValue({revision:4,snapshot:{
    character:{name:"Isolated fixture",level:1},
    gameState:{location:"Public office",credits:1000,turnEvents:[]},
    messages:[],comms:[],settings:{},
  }});
});
describe("Custom GPT missing turnId recovery",()=>{
  it("derives an id stable for one identical player action and revision",()=>{
    const id=stableGptTurnId(actorId,4,action);
    expect(id).toMatch(/^gpt-[a-f0-9]{40}$/);
    expect(stableGptTurnId(actorId,4,action)).toBe(id);
    expect(stableGptTurnId(actorId,5,action)).not.toBe(id);
    expect(stableGptTurnId("another-account",4,action)).not.toBe(id);
    expect(stableGptTurnId(actorId,4,"Ask about a different permit.")).not.toBe(id);
  });
  it("returns the same original turn ID and 429 countdown for repeated uncommitted calls",async()=>{
    mock.run.mockRejectedValue(new NvidiaProviderError("Cooldown",429,23,429,false));
    const log=vi.spyOn(console,"error").mockImplementation(()=>{});
    try{
      const {POST}=await import("../app/api/gpt/turn/route");
      const r1=await POST(request()),r2=await POST(request());
      expect(r1.status).toBe(429);expect(r2.status).toBe(429);
      const a=await r1.json(),b=await r2.json();
      expect(r1.headers.get("Retry-After")).toBe("23");
      expect(a.retry).toMatchObject({
        status:"awaiting_retry",turnId:stableGptTurnId(actorId,4,action),
        baseRevision:4,retryAfterSeconds:23,estimated:false,gameplayAdvanced:false,
      });
      expect(a.retry.turnId).toBe(b.retry.turnId);
      expect(Date.parse(a.retry.retryAt)).toBeGreaterThan(Date.now());
      expect(a).not.toHaveProperty("narration");
      expect(mock.run).toHaveBeenCalledTimes(2);
      expect(mock.run).toHaveBeenCalledWith(expect.anything(),
        expect.objectContaining({action,turnId:a.retry.turnId,revision:4}));
      expect(mock.save).not.toHaveBeenCalled();
    }finally{log.mockRestore();}
  });
  it("preserves explicit caller turnId and the same original revision",async()=>{
    mock.run.mockRejectedValue(new NvidiaProviderError("Cooldown",429,11,429,true));
    const log=vi.spyOn(console,"error").mockImplementation(()=>{});
    try{
      const {POST}=await import("../app/api/gpt/turn/route");
      const r=await POST(request(action,"explicit-turn-782"));
      expect((await r.json()).retry).toMatchObject({turnId:"explicit-turn-782",baseRevision:4,estimated:true});
      expect(mock.save).not.toHaveBeenCalled();
    }finally{log.mockRestore();}
  });
});
