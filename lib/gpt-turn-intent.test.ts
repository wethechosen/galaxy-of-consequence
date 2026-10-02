import { describe, expect, it } from "vitest";
import { isExplicitAttackDeclaration, isFreeMovementDeclaration } from "./gpt-turn-intent";

describe("GPT turn intent parsing", () => {
  it("does not turn meditation negations into combat or movement", () => {
    const action = "D'mir sits beside the sealed access point and meditates, focusing on the dark side—not to attack or move anything, but to steady his breathing.";
    expect(isExplicitAttackDeclaration(action)).toBe(false);
    expect(isFreeMovementDeclaration(action)).toBe(false);
  });

  it("does not move the player when the declaration explicitly says not to move", () => {
    const action = "D'mir does not move. He takes the unresolved item out and inspects it, remaining exactly in place.";
    expect(isFreeMovementDeclaration(action)).toBe(false);
  });

  it("does not treat observation or objective cleanup as movement", () => {
    expect(isFreeMovementDeclaration("D'mir remains in place and examines the immediate surroundings.")).toBe(false);
    expect(isFreeMovementDeclaration("D'mir formally closes out the obsolete prison objectives and does nothing else.")).toBe(false);
  });

  it("recognizes explicit travel and explicit attacks", () => {
    expect(isFreeMovementDeclaration("Continue moving in the same general direction.")).toBe(true);
    expect(isFreeMovementDeclaration("D'mir descends deeper along the service route.")).toBe(true);
    expect(isExplicitAttackDeclaration("I attack the guard with a punch.")).toBe(true);
  });

  it("can still detect a later affirmative action after a negated one", () => {
    expect(isExplicitAttackDeclaration("I do not shoot the first guard; I attack the second guard with a punch.")).toBe(true);
    expect(isFreeMovementDeclaration("I do not leave through the hatch; I move down the corridor instead.")).toBe(true);
  });
});
