import { describe, expect, it } from "vitest";
import { canIntroduceFact } from "./lore";
import { rollDice, rollD20 } from "./rules";

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

  it("logs every die and rejects invalid dice requests", () => {
    const roll = rollDice(3, 6, 2);
    expect(roll.raw).toHaveLength(3);
    expect(roll.total).toBe(roll.raw.reduce((a, b) => a + b, 2));
    expect(() => rollDice(0, 20)).toThrow();
    expect(() => rollDice(1, NaN)).toThrow();
  });
});

describe("lore guard", () => {
  it("does not admit unverified facts as established lore", () => {
    expect(canIntroduceFact({ classification: "established_lore", verified: false })).toBe(false);
    expect(canIntroduceFact({ classification: "compatible_adaptation", verified: false })).toBe(true);
  });
});
