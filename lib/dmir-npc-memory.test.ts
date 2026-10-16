import { describe, expect, it } from "vitest";
import { DMIR_STORY_NPCS, findDmirStoryNpc } from "./dmir-story-npcs";
import { dmirSceneNpcContext, updateDmirNpcContinuity, publicDmirNpcDossiers } from "./dmir-npc-memory";

describe("Dmir homebrew NPCs, personal plots and persistence", () => {
  it("keeps deceased parents and Kelvek in history, not alive at 150 ABY", () => {
    expect(DMIR_STORY_NPCS).toHaveLength(13);
    for(const id of ["maera-holloran","daren-holloran","kelvek"]){
      const npc=DMIR_STORY_NPCS.find(n=>n.id===id)!;
      expect(npc.status).toBe("dead");
      expect(npc.allowedEncounter).toMatch(/Flashback|Historical|recordings/i);
    }
    expect(findDmirStoryNpc("Jax")?.firstKnownEncounter).toBe("established");
    expect(DMIR_STORY_NPCS.every(n=>Boolean(n.objective&&n.arc&&n.allowedEncounter))).toBe(true);
  });
  it("does not produce live encounters or grant secret knowledge merely by defining a cast", () => {
    expect(dmirSceneNpcContext("I ask about the weather", {location:"Bonadan"})).toEqual([]);
    const context=dmirSceneNpcContext("I ask Jax about the charter", {location:"YT-1300"});
    expect(context).toHaveLength(1);
    expect(context[0].name).toBe("Jax");
    expect(context[0].authoritativeMoments).toBeNull();
  });
  it("loads plausible in-room actors for a GM encounter without granting a meeting",()=>{
    const entries=dmirSceneNpcContext("I enter the atelier showroom",{location:"Bonadan — Nuvorren Design House"});
    expect(entries.map(n=>n.id)).toContain("alix-renn");
    expect(entries.map(n=>n.id)).toContain("corren-tel");
    expect(entries.every(n=>n.authoritativeMoments===null)).toBe(true);
    expect(dmirSceneNpcContext("I walk alone",{location:"Bonadan — empty shuttle stop"})).toEqual([]);
  });
  it("persists only confirmed, named relationship events and deduplicates saved turn receipts", () => {
    const initial={location:"Bonadan",credits:999,inventory:[],npcContinuity:{}};
    expect(updateDmirNpcContinuity(initial,null,"t12345678","I speak to Jax")).toBe(initial);
    expect(updateDmirNpcContinuity(initial,{note:"I mentioned Jax"},"t12345678","I speak")).toBe(initial);
    const verified={relationshipUpdate:[{name:"Jax",status:"trust-improved",detail:"Negotiation progressed"}]};
    const updated=updateDmirNpcContinuity(initial,verified,"turn123456","I negotiate with Jax");
    expect(updated.credits).toBe(999);
    expect(updated.inventory).toEqual([]);
    const ledger=updated.npcContinuity as Record<string,any>;
    expect(ledger.jax.encountered).toBe(true);
    expect(ledger.jax.moments).toHaveLength(1);
    expect(updateDmirNpcContinuity(updated,verified,"turn123456","I negotiate with Jax")).toEqual(updated);
  });
  it("keeps GM-only plot secrets out of the public roster",()=>{
    const text=JSON.stringify(publicDmirNpcDossiers());
    expect(text).not.toContain("privateKnowledge");
    expect(text).not.toContain("sealed testimony");
    expect(text).not.toContain("riot\u0027s instigator");
    expect(publicDmirNpcDossiers()).toHaveLength(13);
  });
});
