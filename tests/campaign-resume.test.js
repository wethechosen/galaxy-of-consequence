import { describe, expect, it } from "vitest";
import { buildCampaignRecap, campaignTranscript, shouldShowReturnRecap } from "../original/lib/campaignResume";

const reply = (turnId, scene = "You stand beside the lodging desk.", location = "Coruscant — local market") => ({ role: "assistant", turnId, content: `LOCATION\n${location}\nSCENE\n${scene}\nGAMEPLAY RESULT\nThe clerk quotes a room at 40 credits per night.\nPLAYER OPTIONS\nA. Ask about the room.` });
describe("saved campaign return experience", () => {
  it("retains completed server receipts when narration was unavailable", () => {
    const receipt = { ...reply("paid"), provider: "local-safe-fallback", model: "resolved-saga-receipt", fallbackReason: "validation" };
    const result = campaignTranscript([{ role: "user", content: "Charge it." }, receipt]);
    expect(result.latest).toMatchObject({ turnId: "paid" });
    expect(result.archived).toEqual([]);
    const recap = buildCampaignRecap({ messages: [receipt], gameState: { location: "Coruscant — local market", turnEvents: [{ turnId: "paid", changes: { credits: -126000 } }] } });
    expect(recap.timeline[0].summary).toContain("126,000");
  });
  it("archives failed turns and internal chatter without deleting saved history", () => {
    const input = [{ role: "user", turnId: "bad", content: "I follow the directions" }, { ...reply("bad"), provider: "local-safe-fallback" }, { role: "user", turnId: "good", content: "I ask about the room" }, reply("good"), { role: "system", content: "[CURRENT AUTHORITATIVE CAMPAIGN STATE]" }];
    const original = JSON.stringify(input);
    const result = campaignTranscript(input);
    expect(result.confirmed.map((item) => item.turnId)).toEqual(["good", "good"]);
    expect(result.archived).toHaveLength(3);
    expect(result.latest.turnId).toBe("good");
    expect(JSON.stringify(input)).toBe(original);
  });
  it("keeps pending player input visible without treating it as an accomplished action", () => {
    const result = campaignTranscript([reply("a"), { role: "user", content: "I pay the clerk" }]);
    expect(result.pending).toHaveLength(1);
    expect(result.latestExchange).toHaveLength(1);
    const recap = buildCampaignRecap({ messages: [reply("a"), { role: "user", content: "I pay the clerk" }] });
    expect(recap.lastAction).toBe("");
  });
  it("orders confirmed consequences chronologically and excludes fallback rewards", () => {
    const recap = buildCampaignRecap({ messages: [reply("a"), { ...reply("bad"), fallbackReason: "validation" }], gameState: { location: "Coruscant — local market", turnEvents: [
      { turnId: "b", resolvedAt: "2026-10-07T02:00:00Z", changes: { inventoryAdd: [{ name: "Flight suit" }], credits: -1500 } },
      { turnId: "bad", resolvedAt: "2026-10-07T03:00:00Z", experienceAward: 50, changes: { location: "Imaginary junction" } },
      { turnId: "a", resolvedAt: "2026-10-07T01:00:00Z", changes: { location: "Coruscant — local market" } },
      { turnId: "a", resolvedAt: "2026-10-07T04:00:00Z", changes: { credits: -1500 } },
    ] } });
    expect(recap.timeline.map((event) => event.id)).toEqual(["a", "b"]);
    expect(recap.timeline[1].summary).toContain("1,500 credits");
    expect(JSON.stringify(recap)).not.toContain("Imaginary junction");
  });
  it("never presents an older location's scene as the current scene", () => {
    const recap = buildCampaignRecap({ messages: [reply("old", "You lie in a prison infirmary.", "Coruscant — prison")], gameState: { location: "Coruscant — local market", scene: { summary: "Your action meets the immediate world and stops." } } });
    expect(recap.scene).toBe("");
    expect(recap.lastOutcome).toBe("");
    expect(recap.location).toContain("local market");
  });
  it("does not fabricate galaxy news or expose hidden dispatches", () => {
    expect(buildCampaignRecap().news).toEqual([]);
    expect(buildCampaignRecap({ gameState: { publicNews: [{ headline: "Secret Sith operation", visibility: "hidden" }, { headline: "Transit reopened", source: "CNN", body: "The port announced new service." }] } }).news).toEqual([{ title: "Transit reopened", source: "CNN", detail: "The port announced new service." }]);
  });
  it("returns to recap on a first visit or after half an hour away, not each re-render", () => {
    expect(shouldShowReturnRecap(null, 1_000_000)).toBe(true);
    expect(shouldShowReturnRecap(1_000_000, 1_000_050)).toBe(false);
    expect(shouldShowReturnRecap(1_000_000, 2_800_000)).toBe(true);
  });
});
