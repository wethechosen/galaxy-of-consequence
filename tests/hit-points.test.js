import { describe, expect, it } from "vitest";
import { hitPointDisplay } from "../original/lib/hitPoints";

describe("Saga hit point display", () => {
  it("uses the confirmed character maximum instead of a 100-point meter", () => {
    expect(hitPointDisplay({ maxHitPoints: 200 }, { health: 150 })).toEqual({ current: 150, maximum: 200, percent: 75, label: "150/200 HP" });
    expect(hitPointDisplay({ maxHitPoints: 26 }, { health: 26 }).percent).toBe(100);
  });
  it("does not invent a maximum or wound severity for legacy characters", () => {
    expect(hitPointDisplay({}, { health: 26 })).toEqual({ current: 26, maximum: null, percent: null, label: "26 HP" });
    for (const maxHitPoints of [null, "", undefined, 0, "unknown"]) expect(hitPointDisplay({ maxHitPoints }, { health: 26 }).maximum).toBeNull();
  });
});
