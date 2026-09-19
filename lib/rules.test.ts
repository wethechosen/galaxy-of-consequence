import { describe, expect, it } from "vitest";
import { canIntroduceFact } from "./lore";
import { inferProvisionalCheck, rollD20 } from "./rules";

describe("secure dice resolution", () => {
  it("produces a d20 result in the legal range and preserves the arithmetic", () => {
    for (let index = 0; index < 250; index += 1) {
      const roll = rollD20({ modifier: 7, target: 15, reason: "test" });
      expect(roll.raw).toBeGreaterThanOrEqual(1);
      expect(roll.raw).toBeLessThanOrEqual(20);
      expect(roll.total).toBe(roll.raw + roll.modifier);
      expect(["success", "failure"]).toContain(roll.outcome);
    }
  });

  it("only creates automatic checks for recognised consequential intents", () => {
    expect(inferProvisionalCheck("I sneak through the cargo bay")?.label).toBe("Stealth");
    expect(inferProvisionalCheck("I ask the droid about its shift")).toBeNull();
  });
});

describe("lore guard", () => {
  it("does not admit unverified facts as established lore", () => {
    expect(canIntroduceFact({ classification: "established_lore", verified: false })).toBe(false);
    expect(canIntroduceFact({ classification: "compatible_adaptation", verified: false })).toBe(true);
  });
});
