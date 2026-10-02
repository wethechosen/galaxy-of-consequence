import { describe, expect, it } from "vitest";
import { GALAXY_LOCATIONS, getTravelAccess, getTravelCost } from "./galaxyLocations";

const state = { location: "Coruscant — Level 1313", credits: 100000, travelAccess: [] };
const character = { level: 10 };

describe("travel access", () => {
  it("allows an affordable public route", () => {
    expect(getTravelAccess(GALAXY_LOCATIONS.find((place) => place.id === "corellia"), state, character).allowed).toBe(true);
  });
  it("treats named districts on the same world as local transit", () => {
    const coruscant = GALAXY_LOCATIONS.find((place) => place.id === "coruscant");
    expect(getTravelCost(coruscant, "Coruscant, Level 1313")).toBe(0);
  });
  it("does not let a confined character buy a passenger ticket out of custody", () => {
    const result = getTravelAccess(GALAXY_LOCATIONS.find((place) => place.id === "corellia"), { ...state, location: "Coruscant — Level 1313 detention infirmary" }, character);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/Confinement/);
  });
  it("does not sell access to Korriban for credits alone", () => {
    const result = getTravelAccess(GALAXY_LOCATIONS.find((place) => place.id === "korriban"), state, character);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/Credits are not access/);
  });
  it("allows an earned restricted route when level and fare are sufficient", () => {
    const result = getTravelAccess(GALAXY_LOCATIONS.find((place) => place.id === "korriban"), { ...state, travelAccess: ["korriban"] }, character);
    expect(result.allowed).toBe(true);
  });
});
