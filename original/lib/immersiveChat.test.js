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

  it("parses the immersive seven-section turn contract in player-facing order", () => {
    const parsed = parseImmersiveMessage(`LOCATION
Coruscant — Temple foundations

SCENE
D'mir stands beneath amber service light while the pressure trembles through the deck.

GM ADJUDICATION
The search is a valid Perception attempt.

GAMEPLAY RESULT
The route reaches a sealed foundation bulkhead.

SAGA CHECK
Perception: 1d20 = 9 + 0 = 9 vs DC 15.
RESULT: FAILURE

STATE UPDATE
Time advances 5 minutes.

PLAYER OPTIONS
A. Inspect the bulkhead.
B. Compare the side passages.
You may declare another action.`);
    expect(parsed.location).toContain("Temple foundations");
    expect(parsed.scene).toContain("amber service light");
    expect(parsed.adjudication).toContain("valid Perception");
    expect(parsed.gameplay).toContain("foundation bulkhead");
    expect(parsed.dice).toContain("RESULT: FAILURE");
    expect(parsed.consequences).toEqual(["Time advances 5 minutes."]);
    expect(parsed.options).toHaveLength(2);
  });

  it("extracts an inline legacy location without leaving markdown in the scene", () => {
    const parsed = parseImmersiveMessage("SCENE\n**Location:** Coruscant — Level 1313\n\nA service lamp flickers.\nGM RESOLUTION\nNo check.\nSTATE UPDATE\nNo change.\nPLAYER OPTIONS\nA. Wait.\nB. Listen.");
    expect(parsed.location).toBe("Coruscant — Level 1313");
    expect(parsed.scene).toBe("A service lamp flickers.");
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
