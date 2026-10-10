import { describe, expect, it } from "vitest";
import { planSagaAction } from "./saga-planner";

const dmir = { level: 1, sagaStats: "STR 12 | DEX 14 | CON 10 | INT 12 | WIS 10 | CHA 11", skills: "Haruun Kal martial arts, high finance" };

describe("planSagaAction", () => {
  it("does not roll ordinary dialogue", () => expect(planSagaAction("I ask the guard his name", dmir, {})).toBeNull());
  it("plans a prison lock Mechanics check before narration", () => expect(planSagaAction("I try to pick the infirmary lock", dmir, { location: "Imperial prison" })).toMatchObject({ label: "Mechanics", modifier: 1, target: 20, provisional: true }));
  it("starts initiative before resolving an opening attack", () => expect(planSagaAction("I punch the guard", dmir, {})).toMatchObject({ kind: "initiative", modifier: 2, targetVisible: false, damage: null }));
  it("resolves an unattended object attack without creating initiative", () => expect(planSagaAction("I shoot at the debris with my blaster pistol", dmir, {})).toMatchObject({ kind: "attack", label: "Ranged object attack", target: 5, targetVisible: true, damage: { count: 3, sides: 6 } }));
  it("uses the production attack parser for conjugated declarations", () => {
    expect(planSagaAction("D'mir punches the guard", dmir, {})).toMatchObject({ kind: "initiative", modifier: 2, targetVisible: false });
    expect(planSagaAction("He shoots the droid", dmir, {})).toMatchObject({ kind: "initiative", modifier: 2, targetVisible: false });
    expect(planSagaAction("D'mir attacks the trooper", dmir, {})).toMatchObject({ kind: "initiative", modifier: 2, targetVisible: false });
  });
  it("plans an attack against hidden Reflex Defense during active combat", () => {
    const combat = { status: "active", combatants: [{ side: "opposition", hp: 12, reflex: 13 }] };
    expect(planSagaAction("I punch the guard", dmir, { combat })).toMatchObject({ kind: "attack", modifier: 1, target: 13, targetVisible: false, damage: { count: 1, sides: 4, modifier: 1 } });
    expect(planSagaAction("D'mir punches the guard", dmir, { combat })).toMatchObject({ kind: "attack", modifier: 1, target: 13, targetVisible: false });
  });
  it("does not turn movement or cred chits into an attack", () => {
    expect(planSagaAction("I charge toward Kelvek's old office; the cred chits would be there", dmir, {})).toBeNull();
  });
  it("uses Stealth for cautious movement through an observed hostile area", () => {
    expect(planSagaAction("I attempt to enter with caution", dmir, { location: "Black Sun-controlled apartment bloc service shaft" })).toMatchObject({ label: "Stealth", modifier: 2, target: 20 });
  });
  it("does not roll for ordinary movement", () => {
    expect(planSagaAction("I enter the apartment", dmir, {})).toBeNull();
  });
  it("does not invent Constitution checks from vague attempt phrasing", () => {
    expect(planSagaAction("I attempt to understand the symbol", dmir, {})).toBeNull();
  });
  it("retains explicit physical ability checks", () => {
    expect(planSagaAction("I try to lift the jammed grate", dmir, {})).toMatchObject({ kind: "ability", label: "Strength check", modifier: 1 });
  });
  it("does not turn scene description into a Strength check", () => {
    expect(planSagaAction("Footsteps break my memory as I see the gang in the hall", dmir, {})).toBeNull();
  });
  it("requires Mechanics for an attempted console withdrawal", () => {
    expect(planSagaAction("I rush to his computer console and withdraw all available credits", dmir, { location: "Level 1313 detention library" })).toMatchObject({ label: "Mechanics", target: 20 });
  });
  it("does not grant untrained Use the Force", () => expect(planSagaAction("I use the Force to open it", dmir, {})).toBeNull());
  it("adjudicates pursuit of the suspected vergence without blocking an untrained Force-sensitive character", () => {
    expect(planSagaAction("I follow the pressure toward the ancient Sith vergence beneath the Jedi Temple", { ...dmir, forceSensitive: "Yes" }, {})).toMatchObject({
      label: "Perception",
      target: 15,
      reason: expect.stringMatching(/involuntary intuition/i),
    });
  });
  it("uses trained Use the Force when the character has actually earned it", () => {
    expect(planSagaAction("I trace the dark-side pull toward its source", { ...dmir, trainedSkills: ["Use the Force"] }, {})).toMatchObject({
      label: "Use the Force",
      modifier: 5,
      target: 15,
    });
  });
  it("plans a Treat Injury check when the player uses a medpac", () => expect(planSagaAction("I use a medpac", dmir, {})).toMatchObject({ label: "Treat Injury", kind: "skill", target: 15 }));
  it("uses recorded training, Skill Focus, level and condition in ordinary checks", () => {
    const focused = { ...dmir, level: 2, trainedSkills: ["Mechanics"], featSelections: [{ id: "skill-focus-mechanics", featId: "skill-focus", skillId: "mechanics", name: "Skill Focus (Mechanics)" }] };
    expect(planSagaAction("I bypass the lock", focused, { conditionTrack: 1 })).toMatchObject({ label: "Mechanics", modifier: 11 });
  });
  it("applies an equipped armor penalty until light-armor proficiency is recorded", () => {
    const armored = { ...dmir, equipArmor: "Armored spacer's flight suit" };
    expect(planSagaAction("I move cautiously past the guard", armored, {})).toMatchObject({ label: "Stealth", modifier: 0 });
    expect(planSagaAction("I shoot the debris", armored, {})).toMatchObject({ kind: "attack", modifier: 0 });
    const proficient = { ...armored, featSelections: [{ id: "armor-proficiency-light", name: "Armor Proficiency (light)" }] };
    expect(planSagaAction("I move cautiously past the guard", proficient, {})).toMatchObject({ label: "Stealth", modifier: 2 });
    expect(planSagaAction("I shoot the debris", proficient, {})).toMatchObject({ kind: "attack", modifier: 2 });
  });
  it("does not turn backstory narration into a mechanical check", () => {
    const background = "My background: I was born on Coruscant. My father trained me when I was young, and my mother came from Hapes. I remember prison and the people who mentored me, but I am explaining history rather than attempting an action.";
    expect(planSagaAction(background, dmir, {})).toBeNull();
  });
});
