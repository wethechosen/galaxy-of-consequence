import { describe, expect, it } from "vitest";
import { initialPublicLocation, STARTER_WORLDS } from "../original/lib/startingWorld";
describe("character creation initial world / earned-access boundary", () => {
  it("creates a named public starting location rather than the legacy Unknown corridor", () => {
    expect(STARTER_WORLDS).toContain("Bonadan");
    expect(initialPublicLocation("Bonadan")).toBe("Bonadan — public arrival concourse");
    expect(initialPublicLocation("Coruscant")).toBe("Coruscant — public arrival concourse");
  });
  it("blocks unrestricted, secret or invented start sites", () => {
    expect(initialPublicLocation("Korriban")).toBeNull();
    expect(initialPublicLocation("Byss")).toBeNull();
    expect(initialPublicLocation("Bonadan — forbidden Sith vault")).toBeNull();
    expect(initialPublicLocation("")).toBeNull();
    expect(new Set(STARTER_WORLDS).size).toBe(STARTER_WORLDS.length);
  });
});
