import { describe, expect, it } from "vitest";
import { cleanPlayerMessage, immersiveTurnError, parseImmersiveMessage, summarizeStateUpdate } from "./immersiveChat";

describe("immersive chat presentation", () => {
  it("removes internal context and hidden state from player-visible prose", () => {
    expect(cleanPlayerMessage("[PRIOR NARRATION: internal]\nA door opens.\n<!--STATE:{\"x\":1}-->")).toBe("A door opens.");
  });

  it("separates story, outcome, consequences, and choices", () => {
    const parsed = parseImmersiveMessage(`SCENE\nThe hatch sighs open.\n\nGM RESOLUTION\nNo check is required.\n\nSTATE UPDATE\n{\"location\":\"Level 1313\",\"experienceAward\":100}\n\nPLAYER OPTIONS\nA. Search the room\nB. Listen at the hatch\nC. Leave quietly\nD. Declare another action`);
    expect(parsed.scene).toContain("hatch");
    expect(parsed.resolution).toContain("No check");
    expect(parsed.consequences).toEqual(["Experience +100", "Location: Level 1313"]);
    expect(parsed.options).toHaveLength(4);
    expect(parsed.options[0]).toEqual({ label: "A", text: "Search the room" });
  });

  it("summarizes ledger data without exposing JSON", () => {
    const summary = summarizeStateUpdate('{"credits":250,"inventoryAdd":["Encrypted comlink"]}');
    expect(summary).toEqual(["Credits +250", "Acquired: Encrypted comlink"]);
    expect(summary.join(" ")).not.toContain("{");
  });

  it("describes movement toward zero on the condition track as improvement", () => {
    expect(summarizeStateUpdate('{"conditionTrack":-1}')).toEqual(["Condition improved 1 step"]);
  });

  it("preserves an in-world prose update but removes the instruction footer", () => {
    const parsed = parseImmersiveMessage("SCENE\nThe room settles.\nGM RESOLUTION\nNo check.\nSTATE UPDATE\nNo lasting change.\nPLAYER OPTIONS\nA. Wait\nB. Leave\nYou may declare another action.");
    expect(parsed.consequences).toEqual(["No lasting change."]);
    expect(parsed.options).toHaveLength(2);
  });

  it("never exposes provider or validation diagnostics", () => {
    expect(immersiveTurnError("nvidia returned HTTP 410")).not.toMatch(/nvidia|410/i);
    expect(immersiveTurnError("The GM omitted the required world-state ledger")).not.toMatch(/ledger/i);
  });
});
