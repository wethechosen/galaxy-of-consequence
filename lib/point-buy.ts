// Visually verified against the supplied Saga Core Rulebook:
// printed page 18, PDF page 19, "Planned Generation" and Table 1-1.
// Organic characters only. Species modifiers are applied AFTER allocation.
export const POINT_BUY_SOURCE = { book: "Saga Edition Core Rulebook", printedPage: 18, pdfPage: 19, reviewed: true } as const;
export const ABILITIES = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"] as const;
export type Ability = typeof ABILITIES[number];
export const POINT_BUY_BUDGET = 25;
export const POINT_BUY_COSTS: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 6, 15: 8, 16: 10, 17: 13, 18: 16 };
export function evaluatePointBuy(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Six ability scores required");
  const scores = value as Record<string, unknown>;
  if (Object.keys(scores).length !== 6 || Object.keys(scores).some(key => !ABILITIES.includes(key as Ability))) throw new Error("Exactly six ability scores required");
  let spent = 0;
  for (const ability of ABILITIES) {
    const score = scores[ability];
    if (typeof score !== "number" || !Number.isInteger(score) || score < 8 || score > 18) throw new Error("Base scores must be integers from 8 to 18");
    spent += POINT_BUY_COSTS[score];
  }
  return { spent, remaining: POINT_BUY_BUDGET - spent, withinBudget: spent <= POINT_BUY_BUDGET, source: POINT_BUY_SOURCE };
}
export function abilityModifier(score: number) {
  if (!Number.isSafeInteger(score) || score < 1) throw new Error("Positive integer ability score required");
  return Math.floor((score - 10) / 2);
}
