import { randomInt, randomUUID } from "node:crypto";
import type { RollRecord } from "./types";

export function rollD20(input: { modifier: number; target?: number; reason: string }): RollRecord {
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

type ProvisionalCheck = { modifier: number; target: number; reason: string; label: string } | null;

export function inferProvisionalCheck(action: string): ProvisionalCheck {
  const normalized = action.toLowerCase();
  if (/shoot|fire|attack|strike|blaster/.test(normalized)) {
    return { modifier: 5, target: 15, reason: "Provisional ranged attack resolution", label: "Attack" };
  }
  if (/sneak|hide|infiltrat|slip past/.test(normalized)) {
    return { modifier: 7, target: 15, reason: "Provisional Stealth resolution", label: "Stealth" };
  }
  if (/negotiate|persuade|convince|bargain/.test(normalized)) {
    return { modifier: 6, target: 15, reason: "Provisional Persuasion resolution", label: "Persuasion" };
  }
  if (/search|inspect|investigat|scan/.test(normalized)) {
    return { modifier: 5, target: 15, reason: "Provisional Perception resolution", label: "Perception" };
  }
  return null;
}
