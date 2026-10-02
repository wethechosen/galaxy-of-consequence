import { expect, it } from "vitest";
import { abilityModifier, evaluatePointBuy, POINT_BUY_COSTS } from "./point-buy";
it("uses the visually verified Saga 25-point budget and nonlinear costs", () => {
  expect(evaluatePointBuy({ strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 })).toMatchObject({ spent: 25, remaining: 0, withinBudget: true });
  expect(POINT_BUY_COSTS[18]).toBe(16);
  expect(POINT_BUY_COSTS[17]).toBe(13);
  expect(abilityModifier(9)).toBe(-1);
  expect(abilityModifier(18)).toBe(4);
});
it("does not accept malformed scores or silently approve overspending", () => {
  expect(() => evaluatePointBuy({ strength: 18 })).toThrow();
  expect(evaluatePointBuy({ strength: 18, dexterity: 18, constitution: 18, intelligence: 18, wisdom: 18, charisma: 18 }).withinBudget).toBe(false);
});
