import { describe, expect, it } from "vitest";
import { rollSagaCheck, validateSagaCheckPlan } from "./saga-dice";

const plan = { needed: true, actor: "player", kind: "skill", label: "Perception", modifier: 3, target: 15, targetLabel: "routine security sweep", targetVisible: true, reason: "Listen for a guard patrol", stakes: "Success locates the patrol; failure costs time.", provisional: false, damage: null } as const;

describe("Saga Edition dice authority", () => {
  it("fixes the plan before rolling and resolves total against the target", () => {
    const result = rollSagaCheck(plan, () => 12);
    expect(result.raw).toBe(12);
    expect(result.total).toBe(15);
    expect(result.outcome).toBe("success");
    expect(result.formula).toBe("1d20+3");
  });

  it("applies attack-only natural 20 and natural 1 rules", () => {
    const attack = { ...plan, kind: "attack" as const, target: 50, damage: { count: 1, sides: 4, modifier: 1, type: "kinetic" } };
    const critical = rollSagaCheck(attack, (_min, max) => max === 21 ? 20 : 2);
    expect(critical.outcome).toBe("success");
    expect(critical.critical).toBe(true);
    expect(critical.damage?.total).toBe(6);
    const miss = rollSagaCheck({ ...attack, modifier: 60, target: 1 }, () => 1);
    expect(miss.outcome).toBe("failure");
  });

  it("rejects client plans outside the bounded Saga check schema", () => {
    expect(() => validateSagaCheckPlan({ ...plan, modifier: 999 })).toThrow();
    expect(() => validateSagaCheckPlan({ ...plan, target: 0 })).toThrow();
    expect(() => validateSagaCheckPlan({ ...plan, damage: { count: 1000, sides: 6, modifier: 0 } })).toThrow();
  });
});
