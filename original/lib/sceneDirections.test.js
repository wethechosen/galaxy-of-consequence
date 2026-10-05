import { describe, expect, it } from "vitest";
import { genericDirections, sceneDirections, sceneAtmosphere } from "./sceneDirections";

describe("scene-grounded player approaches", () => {
  it("changes suggestions between transit, bunker and terminal scenes", () => {
    const route = sceneDirections({ state: { location: "Coruscant — deeper lower-city substructure — transit route" } });
    expect(route.join(" ")).toContain("route");
    expect(route.join(" ")).not.toMatch(/Force|XIII|Kelvek|credits|attack/);
    expect(sceneDirections({ state: { location: "Parents' bunker" } })).not.toEqual(route);
    expect(sceneDirections({ scene: "The terminal display is lit." }).join(" ")).toContain("terminal");
  });
  it("does not offer absent interactables or untrained Force techniques", () => {
    expect(sceneDirections({ scene: "No terminal or door is visible." }).join(" ")).not.toMatch(/terminal|entrance|Force/);
    expect(sceneDirections({ character: { trainedSkills: ["Use the Force"] } }).join(" ")).toContain("Use the Force");
  });
  it("uses combat availability and does not invent equipment", () => {
    const state = { combat: { status: "active", activeSide: "player", playerActions: { standard: 0, move: 0 }, combatants: [{ side: "opposition", hp: 5, name: "Guard" }] } };
    expect(sceneDirections({ state }).join(" ")).not.toMatch(/attack|Reposition/);
    expect(sceneDirections({ state }).join(" ")).toContain("End my turn");
    expect(sceneAtmosphere("Coruscant — lower-city substructure")).toContain("durasteel");
  });
  it("uses visible scene boundaries instead of the same transit menu", () => {
    const junction = sceneDirections({ state: { location: "Transit route" }, scene: "You stop at a junction where two branches face a sealed service door." });
    expect(junction.join(" ")).toMatch(/Compare the visible branches|junction/);
    expect(junction.join(" ")).toContain("visible entrance");
    expect(genericDirections(["A. Examine the immediate route.", "B. Continue moving through the route.", "C. Stop and listen before moving."])).toBe(true);
    expect(genericDirections(["A. Compare the visible branches.", "B. Inspect the sealed service door."])).toBe(false);
  });
  it("frames scene-specific moral approaches without choosing for the player", () => {
    const directions = sceneDirections({
      state: { location: "Coruscant — foundations beneath the Jedi Temple" },
      scene: "A cold dark-side pressure gathers beyond a sealed foundation threshold.",
      action: "I search for the ancient Sith vergence.",
      result: "The route reaches the sealed threshold.",
    });
    expect(directions.join(" ")).toMatch(/\[Restraint\]/);
    expect(directions.join(" ")).toMatch(/\[Dark-side temptation\]/);
    expect(directions.join(" ")).toMatch(/\[Pragmatic\]/);
    expect(directions.join(" ")).not.toMatch(/You choose|you must|the vergence is yours/i);
  });
  it("suggests a different method after failure instead of repeating the blocked action", () => {
    const directions = sceneDirections({
      scene: "A sealed bulkhead blocks the descending route.",
      action: "I try to open the bulkhead.",
      result: "The check failed; the bulkhead remains sealed.",
    });
    expect(directions[0]).toMatch(/Change my method/);
  });
});
