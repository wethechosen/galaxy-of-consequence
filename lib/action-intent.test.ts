import { describe, expect, it } from "vitest";
import { isAttackDeclaration, isCombatMovementDeclaration } from "./saga-combat";
import { planSagaAction } from "./saga-planner";
import { assertLocationIntent, assertSceneRefreshDelta, ensurePlayerOptions } from "./gm";
import { permitsLocationChange } from "./action-intent";

describe("declared intent and current scene", () => {
  it("does not turn a negated attack into combat", () => {
    expect(isAttackDeclaration("I do not attack anyone")).toBe(false);
    expect(isAttackDeclaration("I meditate and do not attack anyone")).toBe(false);
    expect(planSagaAction("I do not attack anyone", {}, {})).toBeNull();
    expect(isAttackDeclaration("I do not attack the guard, but I shoot the droid")).toBe(true);
    expect(isCombatMovementDeclaration("D'mir does not move into melee range")).toBe(false);
  });
  it("allows scene refreshes only without mechanical consequences", () => {
    expect(() => assertSceneRefreshDelta({})).not.toThrow();
    expect(() => assertSceneRefreshDelta({ timeAdvanceMinutes: 0 })).not.toThrow();
    expect(() => assertSceneRefreshDelta({ timeAdvanceMinutes: 5 })).toThrow();
    expect(() => assertSceneRefreshDelta({ credits: 500 })).toThrow();
    expect(() => assertSceneRefreshDelta({ location: "Different room" })).toThrow();
  });
  it("does not move meditation or terminal interaction", () => {
    expect(planSagaAction("I meditate without moving", {}, {})).toBeNull();
    expect(() => assertLocationIntent({ location: "Other room" }, "I meditate without moving")).toThrow();
    expect(() => assertLocationIntent({ location: "Other room" }, "I access the terminal")).toThrow();
    expect(() => assertLocationIntent({ location: "Lower corridor" }, "I follow the route lower")).not.toThrow();
  });
  it("recognizes common movement conjugations without treating negated movement as travel", () => {
    for (const action of ["D'mir follows the pressure", "I trace the conduit", "I seek a lower route", "I pursue the signal", "I track the vibration"]) {
      expect(permitsLocationChange(action), action).toBe(true);
    }
    expect(permitsLocationChange("I do not follow the pressure; I remain here")).toBe(false);
  });
  it("authorizes only player travel, not moving an object or an NPC", () => {
    expect(permitsLocationChange("I move down the corridor toward the hatch.")).toBe(true);
    expect(permitsLocationChange("D'mir moves into cover.")).toBe(true);
    expect(permitsLocationChange("I move the datapad from my pocket and inspect it.")).toBe(false);
    expect(permitsLocationChange("D'mir moves the crate away from the door.")).toBe(false);
    expect(permitsLocationChange("The guard moves toward me.")).toBe(false);
    expect(permitsLocationChange("I drive the speeder toward the lift concourse.")).toBe(true);
  });
  it("preserves a later affirmative movement after a comma or then clause", () => {
    expect(permitsLocationChange("I do not attack the guard, I move down the corridor instead.")).toBe(true);
    expect(permitsLocationChange("Without moving the crate, I walk to the hatch.")).toBe(true);
    expect(permitsLocationChange("I do not shoot, then I run back toward cover.")).toBe(true);
    expect(permitsLocationChange("I remain still, then I walk to the service door.")).toBe(true);
    expect(permitsLocationChange("I move the datapad aside and then walk to the service door.")).toBe(true);
  });
  it("repairs missing or generic options using the actual scene", () => {
    const body = "SCENE\nThe console display glows.\nGM RESOLUTION\nNo check.\nSTATE UPDATE\nNone.";
    const fixed = ensurePlayerOptions(body, { location: "Control room" }, {});
    expect(fixed).toContain("A. Read the visible terminal");
    expect(fixed).not.toContain("specific declared action");
    expect(ensurePlayerOptions(`${body}\nPLAYER OPTIONS\nA. Ask the clerk about the display.\nB. Step away.\nYou may declare another action.`)).toContain("Ask the clerk");
  });
});
