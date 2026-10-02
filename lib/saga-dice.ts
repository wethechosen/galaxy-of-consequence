import { randomInt, randomUUID } from "node:crypto";

export const SAGA_CHECK_KINDS = ["skill", "ability", "attack", "initiative", "opposed"] as const;
export type SagaCheckKind = (typeof SAGA_CHECK_KINDS)[number];

export interface SagaCheckPlan {
  needed: true;
  actor: "player" | "npc";
  kind: SagaCheckKind;
  label: string;
  modifier: number;
  target: number;
  targetLabel: string;
  targetVisible: boolean;
  reason: string;
  stakes: string;
  provisional?: boolean;
  damage?: { count: number; sides: number; modifier: number; type?: string } | null;
}

const text = (value: unknown, field: string, max = 180) => {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`Invalid ${field}`);
  return value.trim();
};

const integer = (value: unknown, field: string, low: number, high: number) => {
  if (!Number.isSafeInteger(value) || Number(value) < low || Number(value) > high) throw new Error(`Invalid ${field}`);
  return Number(value);
};

export function validateSagaCheckPlan(value: unknown): SagaCheckPlan {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid check plan");
  const input = value as Record<string, unknown>;
  if (input.needed !== true) throw new Error("A roll plan must require a check");
  if (!SAGA_CHECK_KINDS.includes(input.kind as SagaCheckKind)) throw new Error("Invalid check kind");
  if (!['player', 'npc'].includes(String(input.actor))) throw new Error("Invalid check actor");
  let damage: SagaCheckPlan["damage"] = null;
  if (input.damage != null) {
    if (typeof input.damage !== "object" || Array.isArray(input.damage)) throw new Error("Invalid damage dice");
    const dice = input.damage as Record<string, unknown>;
    damage = {
      count: integer(dice.count, "damage count", 1, 20),
      sides: integer(dice.sides, "damage sides", 2, 100),
      modifier: integer(dice.modifier ?? 0, "damage modifier", -100, 100),
      type: typeof dice.type === "string" ? dice.type.trim().slice(0, 40) : "",
    };
  }
  return {
    needed: true,
    actor: input.actor as "player" | "npc",
    kind: input.kind as SagaCheckKind,
    label: text(input.label, "check label", 80),
    modifier: integer(input.modifier, "check modifier", -30, 60),
    target: integer(input.target, "check target", 1, 60),
    targetLabel: text(input.targetLabel, "target label", 80),
    targetVisible: input.targetVisible === true,
    reason: text(input.reason, "check reason"),
    stakes: text(input.stakes, "check stakes", 240),
    provisional: input.provisional === true,
    damage,
  };
}

export function rollSagaCheck(value: unknown, roller: (min: number, max: number) => number = randomInt) {
  const plan = validateSagaCheckPlan(value);
  const raw = roller(1, 21);
  const total = raw + plan.modifier;
  const automaticSuccess = plan.kind === "attack" && raw === 20;
  const automaticFailure = plan.kind === "attack" && raw === 1;
  const outcome = automaticFailure ? "failure" : automaticSuccess || total >= plan.target ? "success" : "failure";
  const critical = plan.kind === "attack" && raw === 20;
  let damage = null;
  if (outcome === "success" && plan.damage) {
    const rawDice = Array.from({ length: plan.damage.count }, () => roller(1, plan.damage!.sides + 1));
    const subtotal = rawDice.reduce((sum, die) => sum + die, 0) + plan.damage.modifier;
    damage = {
      ...plan.damage,
      formula: `${plan.damage.count}d${plan.damage.sides}${plan.damage.modifier >= 0 ? "+" : ""}${plan.damage.modifier}`,
      raw: rawDice,
      total: critical ? subtotal * 2 : subtotal,
      critical,
    };
  }
  return {
    id: randomUUID(),
    ...plan,
    formula: `1d20${plan.modifier >= 0 ? "+" : ""}${plan.modifier}`,
    raw,
    total,
    outcome,
    critical,
    damage,
    createdAt: new Date().toISOString(),
  };
}
