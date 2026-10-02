import { describe, expect, it } from "vitest";
import { parseEngineResponse, applyEngineDelta, applyCharacterDelta, applyExperienceAward, sagaLevelForExperience } from "../original/lib/engineState";

const ledger = () => ({ health: 18, notoriety: 32, forceAlignment: 12, credits: 500, creditsCriminal: 0, location: "Infirmary", factionRep: { empire: 0, rebellion: 0, csa: 0 }, inventory: [{ id: "one", name: "Medpac", qty: 2 }], properties: [], ships: [], investments: [], contacts: [], publicNews: [], flags: [], travelAccess: [] });
const response = (delta) => `The cell door opens.\n<!--STATE:${JSON.stringify(delta)}-->`;

describe("generated campaign ledger boundary", () => {
  it("coerces finite numeric strings and applies relative effects without mutating the old save", () => {
    const before = ledger();
    const { clean, delta } = parseEngineResponse(response({ credits: "-25", health: "200", inventoryRemove: [{ name: "medpac", qty: "1" }] }), { requireState: true });
    const after = applyEngineDelta(before, delta);
    expect(clean).toBe("The cell door opens.");
    expect(after.credits).toBe(475);
    expect(after.health).toBe(100);
    expect(after.inventory[0].qty).toBe(1);
    expect(before.inventory[0].qty).toBe(2);
    expect(before.credits).toBe(500);
  });

  it("rejects malformed, truncated, duplicate, omitted or nonobject required state", () => {
    expect(() => parseEngineResponse("Scene", { requireState: true })).toThrow(/omitted/);
    for (const raw of ["Scene <!--STATE:{bad}-->", "Scene <!--STATE:{}", "Scene <!--STATE:{}--><!--STATE:{}-->", "Scene <!--STATE:[]-->", "Scene <!--STATE:null-->"]) expect(() => parseEngineResponse(raw, { requireState: true })).toThrow();
    expect(parseEngineResponse("An out-of-character answer.").delta).toBeNull();
  });

  it("rejects invalid numeric and array fields before any effect can be applied", () => {
    const before = ledger();
    for (const patch of [{ credits: "NaN" }, { credits: true }, { health: "Infinity" }, { inventoryAdd: {} }, { inventoryRemove: [null] }, { inventoryRemove: [{ name: "Medpac", qty: -2 }] }, { inventoryAdd: [{ name: "Medpac", qty: 0.5 }] }, { credits: -20, shipAdd: [{ name: "Skiff", income: -50 }] }]) expect(() => applyEngineDelta(before, patch)).toThrow();
    expect(before).toEqual(ledger());
  });

  it("clamps depleted resources and removes exhausted inventory while zero quantities are no-ops", () => {
    const after = applyEngineDelta(ledger(), { credits: -9999, health: -100, inventoryRemove: [{ name: "Medpac", qty: 7 }], inventoryAdd: [{ name: "Blaster", qty: 0 }] });
    expect(after.credits).toBe(0);
    expect(after.health).toBe(0);
    expect(after.inventory).toEqual([]);
  });

  it("deduplicates assets, contacts, headlines and repeated additions by normalized names", () => {
    let id = 0;
    const delta = { propertyAdd: [{ name: "Safe  House" }, { name: " safe house " }], shipAdd: [{ name: "Skiff" }, { name: "skiff" }], investmentAdd: [{ name: "Cargo stake", amount: "50" }, { name: "cargo stake" }], contactAdd: [{ name: "Kara" }, { name: "kara" }], inventoryAdd: [{ name: "Medpac", qty: 1 }, { name: "medpac", qty: 1 }], publicNewsAdd: [{ headline: "Riot", facts: "Public security alert", location: "Coruscant" }, { headline: "riot", facts: "Public security alert", location: "Coruscant" }], note: "Met Kara." };
    const after = applyEngineDelta(ledger(), delta, () => String(++id));
    for (const field of ["properties", "ships", "investments", "contacts", "publicNews", "flags"]) expect(after[field]).toHaveLength(1);
    expect(after.inventory[0].qty).toBe(3);
    expect(after.investments[0].amount).toBe(50);
    expect(applyEngineDelta(after, { propertyAdd: [{ name: "safe house" }], note: "Met Kara." }).properties).toHaveLength(1);
  });

  it("keeps level and XP server-owned while accepting earned build fields", () => {
    const character = { name: "D'mir", level: 1, experience: 0, forceSensitive: "Unknown" };
    expect(applyCharacterDelta(character, { level: "2", experience: "1000", forcePowers: "None", name: "Intruder", forceSensitive: "Yes", admin: true })).toEqual({ ...character, forcePowers: "None" });
  });

  it("adds bounded XP and derives Saga level from cumulative experience", () => {
    const character = { name: "D'mir", level: 1, experience: 900, feats: "Force Sensitive", talents: "None selected" };
    expect(applyExperienceAward(character, 100)).toEqual({ ...character, experience: 1000, level: 2 });
    expect(applyExperienceAward({ ...character, experience: 2900 }, 100)).toMatchObject({ experience: 3000, level: 3 });
    expect(sagaLevelForExperience(6000)).toBe(4);
    expect(() => applyExperienceAward(character, 5001)).toThrow();
  });

  it("does not infer credits, inventory, or XP from narration alone", () => {
    const parsed = parseEngineResponse("D'mir finds a million credits and takes a medpac.\n<!--STATE:{}-->", { requireState: true });
    const after = applyEngineDelta(ledger(), parsed.delta);
    expect(after.credits).toBe(500);
    expect(after.inventory).toEqual(ledger().inventory);
    expect(parsed.delta.experienceAward).toBeUndefined();
  });

  it("records structured dossier outcomes while keeping legacy assets separate from liquid credits", () => {
    const after = applyEngineDelta(ledger(), {
      conditionTrack: 1,
      conditionAdd: [{ name: "Bruised ribs", severity: "moderate" }],
      decisionAdd: [{ title: "Refused the warden", detail: "Would not betray a prisoner", consequence: "Warden hostility" }],
      objectiveAdd: [{ title: "Reach the service lift", detail: "Find a route", status: "active" }],
      discoveryAdd: [{ title: "Guard rotation", detail: "Changes at midnight" }],
      milestoneAdd: [{ title: "Infirmary survived" }],
      storyDirectiveAdd: [{ title: "Seek a teacher", detail: "Pursue earned dark-side training", status: "active" }],
      relationshipUpdate: [{ name: "Kelvek", disposition: "trusted", status: "deceased" }],
      legacyAssetUpsert: [{ name: "Kelvek escrow", category: "account", status: "inaccessible", estimatedValue: 250000000, accessRequirements: "Proof of claim" }],
    });
    expect(after.conditionTrack).toBe(1);
    expect(after.conditions[0].name).toBe("Bruised ribs");
    expect(after.decisions[0].title).toBe("Refused the warden");
    expect(after.objectives[0].title).toBe("Reach the service lift");
    expect(after.discoveries[0].title).toBe("Guard rotation");
    expect(after.milestones[0].title).toBe("Infirmary survived");
    expect(after.storyDirectives[0]).toMatchObject({ title: "Seek a teacher", status: "active" });
    expect(after.relationships[0].name).toBe("Kelvek");
    expect(after.legacyAssets[0]).toMatchObject({ status: "inaccessible", estimatedValue: 250000000 });
    expect(after.credits).toBe(500);
    expect(() => applyEngineDelta(ledger(), { legacyAssetUpsert: [{ name: "False fortune", status: "spendable", estimatedValue: 250000000 }] })).toThrow(/legacyAssetUpsert.status/);
  });

  it("records earned restricted routes once", () => {
    const after = applyEngineDelta(ledger(), { travelAccessAdd: ["korriban", "korriban"] });
    expect(after.travelAccess).toEqual(["korriban"]);
  });
});
