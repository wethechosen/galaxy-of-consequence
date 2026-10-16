import {beforeEach,expect,it,vi} from "vitest";
vi.mock("@/lib/accounts",()=>({requireAccount:vi.fn(),listAccounts:vi.fn()}));
vi.mock("@/lib/local-http",()=>({assertLocalRequest:vi.fn()}));
vi.mock("@/lib/datapad-save",()=>({readDatapad:vi.fn()}));
vi.mock("@/lib/hosted-bridge",()=>({hostedPersistenceEnabled:vi.fn(),hostedGet:vi.fn()}));
vi.mock("@/lib/neon-db",()=>({neonQuery:vi.fn()}));
import {requireAccount,listAccounts} from "@/lib/accounts";
import {readDatapad} from "@/lib/datapad-save";
import {hostedPersistenceEnabled} from "@/lib/hosted-bridge";
import {GET} from "@/app/api/player/roster/route";
const viewer={id:"one",username:"first@galaxy.local",displayName:"First",role:"player"} as const;
const other={id:"two",username:"second@galaxy.local",displayName:"Second",role:"player"} as const;
beforeEach(()=>{
  vi.clearAllMocks();
  vi.mocked(hostedPersistenceEnabled).mockReturnValue(false);
  vi.mocked(requireAccount).mockReturnValue(viewer);
  vi.mocked(listAccounts).mockReturnValue([viewer,other]);
  vi.mocked(readDatapad).mockImplementation((actor:any)=>({
    revision:2,snapshot:{
      character:{
        name:actor.id==="one"?"First":"Second",species:"Human",level:3,feats:"Toughness",
        background:"Private biography",publicBio:"Trained navigator",credits:12345,
        inventory:[{name:"Secret distress beacon"}],goal:"Private hidden goal"},
      gameState:actor.id==="one"?{
        location:"Bonadan — Nuvorren showroom",
        sceneNpcs:[{name:"Tremel",role:"clerk",location:"Bonadan — Nuvorren showroom"},
          {name:"Jax",role:"captain",location:"Taris Docking Bay"}],
      }:{location:"Taris",sceneNpcs:[{name:"Secret agent",role:"spy",location:"Taris"}]},
      messages:[],comms:[],settings:{},
    },
  }) as any);
});
it("shows publicly safe PC sheets, and only NPCs present in the requesting player's room",async()=>{
  const resp=await GET(new Request("http://localhost/api/player/roster"));
  expect(resp.status).toBe(200);
  const body=await resp.json();
  expect(body.players.map((p:any)=>p.name)).toEqual(["First","Second"]);
  expect(body.npcPlayers.map((n:any)=>n.name)).toEqual(["Tremel"]);
  const otherPlayer=body.players.find((p:any)=>p.name==="Second");
  expect(otherPlayer.background).toBe("Trained navigator");
  expect(otherPlayer).not.toHaveProperty("credits");
  expect(otherPlayer).not.toHaveProperty("inventory");
  expect(otherPlayer).not.toHaveProperty("goal");
  expect(JSON.stringify(body)).not.toContain("Secret agent");
});
it("rejects roster access for unauthenticated visitors",async()=>{
  vi.mocked(requireAccount).mockImplementation(()=>{throw Error("Sign in to open datapad");});
  const resp=await GET(new Request("http://localhost/api/player/roster"));
  expect(resp.status).toBe(401);
});
