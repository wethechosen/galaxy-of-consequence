import { describe, expect, it } from "vitest";
import { isArrivalWaitDeclaration, pendingTransitArrival, transitArrivalFailure } from "./transit-progression";

const inFlight = {
  location: "Coruscant — Docking Bay 94, Level B, slip 14",
  campaignTimeMinutes: 557,
  scene: { summary: "You remain aboard the YT-1300 freighter. Its hyperdrive hums steadily in hyperspace." },
  objectives: [{ title: "Reach Taris", status: "active" }],
};

describe("transport arrival", () => {
  it("recognizes a standing wait for arrival", () => {
    for (const action of ["Wait", "I wait.", "Continue waiting", "Resolve arrival", "Attempt arrival at Taris again", "They arrival again"]) {
      expect(isArrivalWaitDeclaration(action)).toBe(true);
      expect(pendingTransitArrival(inFlight, action)).toEqual({ destination: "Taris", objectiveTitle: "Reach Taris" });
    }
  });

  it("preserves unrelated dialogue and forbids arrival without a confirmed trip", () => {
    expect(pendingTransitArrival(inFlight, "Ask Jax about Sith space")).toBeNull();
    expect(pendingTransitArrival({ ...inFlight, scene: { summary: "Docked at bay 94" } }, "Wait")).toBeNull();
    expect(pendingTransitArrival({ ...inFlight, objectives: [] }, "Wait")).toBeNull();
    expect(pendingTransitArrival({ ...inFlight, location: "Taris — Orbital approach" }, "Wait")).toBeNull();
  });

  it("requires a location and elapsed campaign time", () => {
    const trip = pendingTransitArrival(inFlight, "Wait")!;
    expect(transitArrivalFailure(trip, "The ship arrives.", {})).not.toBeNull();
    expect(transitArrivalFailure(trip, "The ship arrives.", { location: "Taris" })).not.toBeNull();
  });

  it("allows arrival only when narration and saved fields agree", () => {
    const trip = pendingTransitArrival(inFlight, "Resolve arrival")!;
    const result = { location: "Taris — Orbital approach", timeAdvanceMinutes: 90 };
    expect(transitArrivalFailure(trip, "The ship remains in hyperspace.", result)).not.toBeNull();
    expect(transitArrivalFailure(trip, "The ship arrives at Taris.", result)).toBeNull();
  });
});
