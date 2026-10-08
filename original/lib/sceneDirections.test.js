import { describe, expect, it } from "vitest";
import { currentPlayerOptions, genericDirections, sceneDirections, sceneAtmosphere } from "./sceneDirections";

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
  it("keeps monthly lodging suggestions at a guesthouse within a broad market location", () => {
    const directions = sceneDirections({
      state: { location: "Coruscant — lower-city market" },
      scene: "The guesthouse clerk waits behind the desk with the lodging rates posted beside her.",
      action: "How much for full month?",
      result: "The clerk quotes the monthly lodging rate and the required deposit.",
    });
    expect(directions.join(" ")).toMatch(/monthly rate.*deposit/);
    expect(directions.join(" ")).not.toMatch(/clothing|robe|tunic|merchant|stall/i);
  });
  it("does not invent a guesthouse desk or seller from a player's request", () => {
    const directions = sceneDirections({
      state: { location: "Lower-city market" },
      scene: "No merchant, guesthouse desk, or clothing stall is visible.",
      action: "I look for a place to rent for a full month.",
    });
    expect(directions.join(" ")).toContain("Look for posted lodging rates");
    expect(directions.join(" ")).not.toMatch(/Ask|clothing|robe|merchant|seller|desk/i);
    expect(sceneDirections({ state: { location: "Market" }, scene: "No merchant is present." }).join(" ")).not.toMatch(/Ask.*(?:merchant|seller|goods)/i);
  });
  it("offers clothing approaches only when a clothing seller is established", () => {
    const directions = sceneDirections({ scene: "A clothing vendor displays tunics beside a rack of robes." });
    expect(directions.join(" ")).toContain("displayed clothing");
    expect(directions.join(" ")).not.toMatch(/thick black robe|another stall|You (?:buy|receive|acquire)/i);
    expect(sceneDirections({ scene: "A merchant has several power cells on display." }).join(" ")).not.toMatch(/clothing|robe|tunic/);
  });
});

describe("current player option selection", () => {
  it("preserves the GM's specific suggestions instead of replacing them with a keyword menu", () => {
    const options = [
      { label: "A", text: "Ask whether the quoted 600 credits includes utilities for the full month." },
      { label: "B", text: "Ask the clerk to show the room's lock before considering the deposit." },
    ];
    expect(currentPlayerOptions({ options, state: { location: "Lower-city market" }, scene: "The guesthouse clerk waits for your answer." })).toBe(options);
  });
  it("keeps specific choices even when another option is generic", () => {
    const options = [{ label: "A", text: "Examine the immediate surroundings." }, { label: "B", text: "Ask the guesthouse clerk about the monthly deposit." }];
    expect(genericDirections(options)).toBe(false);
    expect(currentPlayerOptions({ options })).toBe(options);
  });
  it("uses a grounded fallback for missing or wholly generic suggestions", () => {
    const context = { scene: "The terminal display is lit." };
    const missing = currentPlayerOptions(context);
    expect(missing[0]).toEqual({ label: "A", text: "Read the visible terminal display without changing its settings." });
    expect(currentPlayerOptions({ ...context, options: [{ label: "A", text: "Examine the immediate surroundings." }] })).toEqual(missing);
  });
  it("refreshes combat suggestions when saved actions or targets make authored choices unavailable", () => {
    const options = [{ label: "A", text: "Attack the guard." }];
    const state = { combat: { status: "active", activeSide: "player", playerActions: { standard: 0, move: 0, swift: 0 }, combatants: [{ side: "opposition", name: "Guard", hp: 0 }] } };
    const selected = currentPlayerOptions({ options, state });
    expect(selected.map((option) => option.text).join(" ")).not.toMatch(/attack|Reposition|Aim|withdraw/);
    expect(selected.map((option) => option.text).join(" ")).toContain("End my turn.");
  });
  it("keeps ending the turn available and does not aim with only one swift action", () => {
    const state = { combat: { status: "active", activeSide: "player", playerActions: { standard: 0, move: 0, swift: 1 }, combatants: [{ side: "opposition", name: "Guard", hp: 5 }] } };
    expect(currentPlayerOptions({ state }).map((option) => option.text).join(" ")).not.toMatch(/Aim|attack|withdraw/i);
    state.combat.playerActions = { standard: 1, move: 1, swift: 1 };
    expect(currentPlayerOptions({ state }).at(-1).text).toBe("End my turn.");
  });
  it("does not suggest attacking from total defense or a target behind total cover", () => {
    const player = { id: "player", side: "player", hp: 10, conditionTrack: 0, defenseBonus: 5 };
    const opponent = { side: "opposition", name: "Guard", hp: 5 };
    const state = { combat: { status: "active", activeSide: "player", playerActions: { standard: 1, move: 1, swift: 1 }, combatants: [player, opponent] } };
    expect(currentPlayerOptions({ state }).map((option) => option.text).join(" ")).not.toContain("Attempt an attack");
    player.defenseBonus = 0;
    opponent.cover = "total";
    expect(currentPlayerOptions({ state }).map((option) => option.text).join(" ")).not.toContain("Attempt an attack");
  });
});
