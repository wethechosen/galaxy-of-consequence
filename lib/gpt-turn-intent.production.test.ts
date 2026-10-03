import { describe, expect, it } from "vitest";
import { isExplicitAttackDeclaration, isFreeMovementDeclaration } from "./gpt-turn-intent";

describe("GPT turn intent — production regressions", () => {
  it("does not treat meditation or stillness as combat or movement", () => {
    const actions = [
      "D'mir sits beside the sealed access point and meditates, focusing on the dark side—not to attack or move anything, but to steady his breathing.",
      "I sit and meditate on the dark side.",
      "D'mir does not move. He takes the unresolved item out and inspects it, remaining exactly in place.",
      "I remain in place and examine the surroundings.",
      "I stay still and watch the corridor.",
    ];

    for (const action of actions) {
      expect(isExplicitAttackDeclaration(action)).toBe(false);
      expect(isFreeMovementDeclaration(action)).toBe(false);
    }
  });

  it("does not flag negated attacks or movement as valid action", () => {
    const actions = [
      "D'mir does not attack anyone.",
      "I do not attack the guard.",
      "I don't punch anyone.",
      "I do not shoot and do not move.",
      "I do not move and do not attack anyone.",
      "Without attempting to move, I open the hatch.",
      "No movement, no attacks. I analyze the controls.",
    ];

    for (const action of actions) {
      expect(isExplicitAttackDeclaration(action)).toBe(false);
      expect(isFreeMovementDeclaration(action)).toBe(false);
    }
  });

  it("still catches affirmative actions after a negated clause", () => {
    expect(isExplicitAttackDeclaration("I do not shoot the first guard; I attack the second guard with a punch.")).toBe(true);
    expect(isFreeMovementDeclaration("I do not leave through the hatch; I move down the corridor instead.")).toBe(true);
  });

  it("does not mistake inspection, access, or objective cleanup for movement", () => {
    const actions = [
      "I access the terminal.",
      "I search the room.",
      "I examine the maintenance hatch.",
      "I inspect the immediate surroundings.",
      "D'mir formally closes out the obsolete prison objectives and does nothing else.",
      "I mark the mission as complete and wait.",
    ];

    for (const action of actions) {
      expect(isExplicitAttackDeclaration(action)).toBe(false);
      expect(isFreeMovementDeclaration(action)).toBe(false);
    }
  });

  it("flags explicit travel and explicit attacks", () => {
    expect(isFreeMovementDeclaration("Continue moving in the same general direction.")).toBe(true);
    expect(isFreeMovementDeclaration("D'mir descends deeper along the service route.")).toBe(true);
    expect(isFreeMovementDeclaration("I walk down the corridor.")).toBe(true);
    expect(isFreeMovementDeclaration("I follow the call until it leads somewhere ancient.")).toBe(true);
    expect(isExplicitAttackDeclaration("I attack the guard with a punch.")).toBe(true);
    expect(isExplicitAttackDeclaration("I shoot the droid.")).toBe(true);
  });

  it("ignores non-mechanical conversational language", () => {
    const actions = [
      "I think about the situation.",
      "I consider my options.",
      "I contemplate the Force.",
      "I breathe deeply.",
      "D'mir stands at the entrance.",
      "The conversation moves to the war effort.",
    ];

    for (const action of actions) {
      expect(isFreeMovementDeclaration(action)).toBe(false);
      expect(isExplicitAttackDeclaration(action)).toBe(false);
    }
  });
});
