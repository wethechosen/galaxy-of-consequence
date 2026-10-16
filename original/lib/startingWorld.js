import { GALAXY_LOCATIONS } from "./galaxyLocations";

/**
 * The character wizard can only place new campaigns at a public arrival site.
 * These are initial world seeds, never earned transit/access credentials.
 * A GM-directed flashback needs its own explicitly verified scene setup.
 */
export const STARTER_WORLDS = Object.freeze(
  ["Coruscant", "Bonadan", "Taris", "Corellia", "Nar Shaddaa", "Tatooine"]
    .filter(name => GALAXY_LOCATIONS.some(place => place.name === name && place.access?.tier === "open"))
);

export function initialPublicLocation(selectedWorld) {
  const world = STARTER_WORLDS.find(name => name.toLowerCase() === String(selectedWorld || "").trim().toLowerCase());
  return world ? `${world} — public arrival concourse` : null;
}
