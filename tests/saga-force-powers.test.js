import { describe, expect, it } from "vitest";
import { FORCE_POWER_CATALOG, forcePowerById, forcePowerKnown, forcePowerSelectionsForCharacter } from "../original/lib/sagaForcePowers";

describe("earned Saga Force suites", () => {
  it("offers only the executable catalog and resolves canonical names", () => {
    expect(FORCE_POWER_CATALOG.map(power => power.id)).toEqual(["battle-strike", "force-grip", "force-lightning", "force-slam", "force-stun", "force-thrust", "move-object", "negate-energy", "surge"]);
    expect(forcePowerById("Force Lightning")).toMatchObject({ id: "force-lightning", descriptors: ["dark-side"] });
    expect(forcePowerById("invented power")).toBeNull();
    expect(forcePowerById("Surge").action).toBe("free");
  });

  it("preserves separate suite uses without duplicating a structured display string", () => {
    const character = { forcePowerSelections: [{ id: "surge", name: "Surge", selectionId: "earned:1" }, { id: "surge", name: "Surge", selectionId: "earned:2" }], forcePowers: "Surge, Surge, Battle Strike, Farseeing" };
    const suite = forcePowerSelectionsForCharacter(character);
    expect(suite.map(power => power.id)).toEqual(["surge", "surge", "battle-strike", "farseeing"]);
    expect(suite.map(power => power.selectionId)).toEqual(["earned:1", "earned:2", "legacy-name:battle-strike:1", "legacy-name:farseeing:1"]);
    expect(forcePowerKnown(character, "surge")).toBe(true);
    expect(forcePowerKnown(character, "force-slam")).toBe(false);
  });

  it("retains names from legacy arrays and ignores absent powers", () => {
    expect(forcePowerSelectionsForCharacter({ forcePowers: ["Surge", "Force Grip", "Ancient recorded power"] }).map(power => power.name)).toEqual(["Surge", "Force Grip", "Ancient recorded power"]);
    expect(forcePowerSelectionsForCharacter({ forcePowers: "None known" })).toEqual([]);
  });
});
