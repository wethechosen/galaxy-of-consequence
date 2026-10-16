import {describe,it,expect} from "vitest";
import {CHARACTER_REFERENCE_SHEETS} from "./character-reference-sheets";
import {CHARACTER_VISUAL_DOSSIERS} from "./character-visual-dossiers";
import {sagaNpcBuildErrors} from "./saga-npc";
describe("ten character dossier references",()=>{
  it("has ten unique established characters, no Kelvek",()=>{
    expect(CHARACTER_REFERENCE_SHEETS).toHaveLength(10);
    expect(new Set(CHARACTER_REFERENCE_SHEETS.map(n=>n.id)).size).toBe(10);
    expect(CHARACTER_REFERENCE_SHEETS.some(n=>n.id==="kelvek")).toBe(false);
  });
  it("has distinct descriptions, headshots and full-body specifications",()=>{
    for(const npc of CHARACTER_REFERENCE_SHEETS){
      expect(npc.description.length).toBeGreaterThan(80);
      expect(npc.personality.length).toBeGreaterThan(60);
      expect(npc.visual.headshotPrompt).toContain(npc.description);
      expect(npc.visual.fullBodyPrompt).toContain(npc.description);
      expect(CHARACTER_VISUAL_DOSSIERS[npc.id]).toBeDefined();
    }
  });
  it("all reference builds pass the existing Saga nonheroic validator",()=>{
    for(const npc of CHARACTER_REFERENCE_SHEETS){
      expect(sagaNpcBuildErrors(npc.referenceRules)).toEqual([]);
      expect(npc.rulesStatus).toBe("validated-nonheroic-rehearsal");
      expect(npc.assetStatus).toBe("prompts-only");
      expect(npc.playthroughStatus).toBe("unverified");
    }
  });
});
