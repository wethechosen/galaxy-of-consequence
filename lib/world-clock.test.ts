import { describe, expect, it } from "vitest";
import { advanceWorldClock, newWorldClock } from "./world-clock";

describe("offline world clock", () => {
  it("catches up the full absence at seven times real time without replay", () => {
    const result = advanceWorldClock(newWorldClock(0), 86400000 * 30, true);
    expect(result.advancedMs).toBe(86400000 * 210);
    expect(advanceWorldClock(result.clock, 86400000 * 30, true).advancedMs).toBe(0);
    expect(advanceWorldClock(result.clock, 10, true).clock.lastRealAtMs).toBe(86400000 * 30);
  });
  it("does not accumulate setup time", () => {
    const paused = advanceWorldClock(newWorldClock(0), 1000, false);
    expect(paused.advancedMs).toBe(0);
    expect(advanceWorldClock(paused.clock, 1001, true).advancedMs).toBe(7);
  });
  it("holds danger and dependent events but lets unrelated events become due", () => {
    const clock = newWorldClock(0);
    clock.events = [
      { id: "danger", dueAtMs: 1, summary: "Ambush", kind: "personal_danger", dependsOn: [], status: "scheduled" },
      { id: "dependent", dueAtMs: 2, summary: "After ambush", kind: "routine", dependsOn: ["danger"], status: "scheduled" },
      { id: "unrelated", dueAtMs: 3, summary: "Other region", kind: "routine", dependsOn: [], status: "scheduled" },
    ];
    const result = advanceWorldClock(clock, 100, true);
    expect(result.newlyDue.map(e => e.id)).toEqual(["danger", "unrelated"]);
    expect(result.clock.events[1].status).toBe("scheduled");
    expect(advanceWorldClock(result.clock, 200, true).newlyDue).toEqual([]);
    expect(clock.events[0].status).toBe("scheduled");
  });
});
