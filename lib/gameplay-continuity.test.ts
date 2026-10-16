import { describe, expect, it } from "vitest";
import { classifyTurnMode, withSceneFrame, assertNarratedLocation, assertNoProgressLoop, safeMessages } from "./gm";
import { eventWaitFailure, isEventWait } from "./event-wait";
import type { DatapadSnapshot } from "./datapad-save";

describe("revision 562 gameplay regression", () => {
  it("routes the player's correction outside the fiction", () => {
    expect(classifyTurnMode("are you broken? we were on Taris, Jax is taking me to CSA space to bonadan.")).toBe("ooc");
    expect(classifyTurnMode('I ask Jax, "Are you broken?"')).toBe("play");
  });
  it("does not erase until-arrival intent or silently discard elapsed time", () => {
    const action = "i sleep until we arrive";
    expect(isEventWait(action)).toBe(true);
    expect(eventWaitFailure(action, "You sleep until arrival. When you wake, the freighter is still docked, departure imminent.", {})).toMatch(/elapsed/);
    expect(eventWaitFailure(action, "You wake as the ship docks at Bonadan.", { location: "Bonadan — Port", timeAdvanceMinutes: 240 })).toBeNull();
    expect(eventWaitFailure(action, "A distress call interrupts the journey after ten minutes.", { timeAdvanceMinutes: 10 })).toBeNull();
    expect(isEventWait("I ask Jax whether we can sleep until arrival")).toBe(false);
    expect(isEventWait("I don't wait until arrival")).toBe(false);
    expect(eventWaitFailure(action, "The ship cannot depart because its departure clearance requires the captain's signature.", {})).toBeNull();
  });
  it("stores the end of the action rather than resetting to its opening", () => {
    const snapshot = { gameState: { location: "Bonadan — Port" }, messages: [] } as unknown as DatapadSnapshot;
    const next = withSceneFrame(snapshot, "## SCENE\nYou sit in the hold while the ship remains in hyperspace.\n## GAMEPLAY RESULT\nYou arrive at Bonadan and disembark at the port.", "I wait until arrival", null);
    expect((next.gameState.scene as { summary: string }).summary).toBe("You arrive at Bonadan and disembark at the port.");
  });
  it("retains planetary context for a local dock move", () => {
    expect(() => assertNarratedLocation("## LOCATION\nDocking Bay 94", { location: "Docking Bay 94" }, "Taris — Market District")).toThrow(/planetary context/);
    expect(() => assertNarratedLocation("## LOCATION\nTaris — Docking Bay 94", { location: "Taris — Docking Bay 94" }, "Taris — Market District")).not.toThrow();
  });
  it("rejects a repeated outcome even when it avoids the old refusal keywords", () => {
    const result = "You rest without incident. The freighter's engines deepen in tone as clearance is confirmed, and the vessel begins to pull away from Docking Bay 94. Your rest proceeds unimpeded until the jump to lightspeed approaches.";
    expect(() => assertNoProgressLoop(`## GAMEPLAY RESULT\n${result}`, "Continue resting and monitor the journey", {}, "Taris — Port", result)).toThrow(/repeated the preceding outcome/);
  });
  it("keeps the archive while excluding superseded context after an audited repair", () => {
    const messages = [{ role: "user", content: "sleep until arrival" }, { role: "assistant", content: "## GAMEPLAY RESULT\nDeparture to Taris remains imminent." }];
    const snapshot = { messages, gameState: { continuityMessageOffset: 2 } } as unknown as DatapadSnapshot;
    expect(safeMessages(snapshot)).toEqual([]);
    expect(snapshot.messages).toHaveLength(2);
  });
});
