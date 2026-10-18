import { describe, expect, it } from "vitest";
import { GM_ONLY_FIELDS, GPT_MODULES, WEB_ENHANCEMENTS, playerVisualContract } from "./gpt-visual-contract";

describe("preserve existing datapad / visual interface contract", () => {
  it("offers the complete GPT HUD but only five targeted web enhancements", () => {
    expect(GPT_MODULES).toContain("characterHud");
    expect(GPT_MODULES).toContain("scene");
    expect([...WEB_ENHANCEMENTS]).toEqual(["galaxyNavigation", "factionIntelligence", "banking", "equipment", "chronology"]);
    expect(playerVisualContract("D'mir Holloràn").design).toBe("existing-datapad");
  });
  it("exposes a correctly scoped D'mir portrait and no fabricated portraits for other characters", () => {
    expect(playerVisualContract("D’mir Holloràn").portrait?.url).toBe("/images/dmir-headshot.svg");
    expect(playerVisualContract("Another Character").portrait).toBeNull();
  });
  it("leaves player stat controls read-only", () => {
    const contract = playerVisualContract("D'mir");
    expect(contract.statAuthority.mode).toBe("gm-controller-only");
    for (const key of ["hitPoints", "vitality", "conditionTrack", "experience", "credits", "inventory"]) {
      expect(GM_ONLY_FIELDS).toContain(key);
      expect(contract.statAuthority.readOnlyForPlayer).toContain(key as (typeof GM_ONLY_FIELDS)[number]);
    }
  });
});
