import { randomInt, randomUUID } from "node:crypto";
import type { RollRecord } from "./types";

export function rollD20(input: { modifier: number; target?: number; reason: string }): RollRecord {
  if (!Number.isSafeInteger(input.modifier) || Math.abs(input.modifier) > 100000 || (input.target !== undefined && !Number.isSafeInteger(input.target))) throw new Error("Invalid roll parameters");
  const raw = randomInt(1, 21);
  const total = raw + input.modifier;
  const outcome = input.target === undefined ? "unresolved" : total >= input.target ? "success" : "failure";

  return {
    id: randomUUID(),
    formula: `1d20 ${input.modifier >= 0 ? "+" : ""}${input.modifier}`,
    raw,
    modifier: input.modifier,
    total,
    target: input.target,
    outcome,
    reason: input.reason,
    createdAt: new Date().toISOString(),
  };
}

// Generic primitive; Saga-specific authorization belongs to reviewed rule handlers.
export function rollDice(count: number, sides: number, modifier = 0) {
  if (!Number.isSafeInteger(count) || count < 1 || count > 100 || !Number.isSafeInteger(sides) || sides < 2 || sides > 1000 || !Number.isSafeInteger(modifier) || Math.abs(modifier) > 100000) throw new Error("Invalid dice parameters");
  const raw = Array.from({ length: count }, () => randomInt(1, sides + 1));
  return { formula: `${count}d${sides}${modifier >= 0 ? "+" : ""}${modifier}`, raw, modifier, total: raw.reduce((a, b) => a + b, modifier) };
}
