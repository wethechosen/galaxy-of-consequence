import { expect, it } from "vitest";
import { GALAXY_LOCATIONS, getTravelAccess } from "./galaxyLocations";
it("explains destroyed worlds, Force wounds, and surviving settlements without merging incompatible histories", () => {
  const world = id => GALAXY_LOCATIONS.find(place => place.id === id);
  expect(world("byss").worldStatus.reason).toContain("11 ABY");
  expect(world("alderaan").worldStatus.condition).toBe("Destroyed");
  expect(world("malachor-v").worldStatus.condition).toContain("Force wound");
  expect(world("taris").worldStatus.condition).toContain("inhabited");
  expect(world("bonadan").region).toBe("Corporate Sector");
  expect(world("commenor").region).toBe("Colonies");
  expect(getTravelAccess(world("alderaan"),{location:"Taris",credits:1e9},{level:20}).allowed).toBe(false);
  for (const place of GALAXY_LOCATIONS) expect(place.worldStatus.reason.length).toBeGreaterThan(40);
});
