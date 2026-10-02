import { describe, expect, it } from "vitest";
import { ensureCampaignScaffold } from "./campaignState";

describe("campaign dossier scaffold", () => {
  it("adds D'mir's long-term objectives and inaccessible Kelvek legacy without liquid credits", () => {
    const before = { character: { name: "D'mir Holloran" }, gameState: { credits: 500, inventory: [] }, messages: [], comms: [], settings: {} };
    const after = ensureCampaignScaffold(before);
    expect(after.gameState.credits).toBe(500);
    expect(after.gameState.legacyAssets).toEqual(expect.arrayContaining([expect.objectContaining({ name: "Kelvek legacy network", status: "suspected" })]));
    expect(after.gameState.objectives.map((item) => item.title)).toEqual(expect.arrayContaining(["Escape Level 1313 detention", "Leave Coruscant"]));
    expect(after.gameState.storyDirectives).toEqual([]);
    expect(after.gameState.campaignExceptions).toContainEqual(expect.objectContaining({ id: "dmir-kelvek-inheritance-1-2b", scope: "dmir-primary-campaign-only" }));
    expect(after.gameState.creatorCanon).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "dmir-xiii-chronology" }),
      expect.objectContaining({ id: "dmir-parents-bunker" }),
    ]));
    expect(after.gameState.combat).toBeNull();
    expect(before.gameState).toEqual({ credits: 500, inventory: [] });
  });

  it("preserves established dossier entries without duplicating them", () => {
    const snapshot = { character: { name: "D'mir Holloran" }, gameState: { objectives: [{ title: "Leave Coruscant", status: "completed" }], relationships: [], legacyAssets: [] } };
    const after = ensureCampaignScaffold(snapshot);
    expect(after.gameState.objectives.filter((item) => item.title === "Leave Coruscant")).toHaveLength(1);
    expect(after.gameState.objectives.find((item) => item.title === "Leave Coruscant").status).toBe("completed");
  });

  it("does not apply D'mir's historical exception to another player character", () => {
    const result = ensureCampaignScaffold({ character: { name: "Other Hero" }, gameState: { credits: 500 }, messages: [], comms: [], settings: {} });
    expect(result.gameState.campaignExceptions).toEqual([]);
  });
});
