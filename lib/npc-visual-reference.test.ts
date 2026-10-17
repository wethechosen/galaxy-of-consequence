import {describe,it,expect} from "vitest";
import {NPC_TEST_ROSTER} from "./npc-test-roster";
import {CAMPAIGN_NPCS_150_ABY} from "./npc-canon-roster";
import {DMIR_STORY_NPCS} from "./dmir-story-npcs";
import {NPC_VISUAL_REFERENCES,npcVisualReference} from "./npc-visual-reference";

describe("character-specific visual guides",()=>{
  it("covers each of the 35 playable cast members and 13 primary-story NPCs",()=>{
    const all=[
      ...NPC_TEST_ROSTER.map(n=>({id:n.id,species:n.species,role:n.role,name:n.name})),
      ...CAMPAIGN_NPCS_150_ABY.map(n=>({id:n.id,species:n.species,role:n.role150,name:n.name})),
      ...DMIR_STORY_NPCS.map(n=>({id:n.id,species:n.species,role:n.role,name:n.name})),
    ];
    expect(NPC_TEST_ROSTER).toHaveLength(10);
    expect(CAMPAIGN_NPCS_150_ABY).toHaveLength(25);
    expect(DMIR_STORY_NPCS).toHaveLength(13);
    for(const n of all){
      const guide=npcVisualReference(n.id,"",n.role,n.species);
      expect(guide.length, n.name).toBeGreaterThan(100);
      expect(guide,n.name).not.toMatch(/at a private workplace or approved administrative post/i);
      expect(NPC_VISUAL_REFERENCES[n.id], n.name).toBeDefined();
    }
    expect(new Set(all.map(n=>n.id)).size).toBe(47); // Kelvek appears in both eras
  });
  it("retains explicit visual uncertainty for unconfirmed identities",()=>{
    expect(NPC_VISUAL_REFERENCES.jax).toMatch(/unconfirmed/i);
    expect(NPC_VISUAL_REFERENCES["darth-korvalis"]).not.toMatch(/apex immunity/i);
    expect(NPC_VISUAL_REFERENCES["aliyah-fel"]).toMatch(/not an empress crown/i);
  });
});
