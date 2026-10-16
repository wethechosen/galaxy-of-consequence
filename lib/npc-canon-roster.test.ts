import { describe, expect, it } from "vitest";
import { CAMPAIGN_NPCS_150_ABY, canonicalNpcContext, findCanonNpc } from "./npc-canon-roster";
import { ALL_NPC_TEST_ROSTER, NPC_TEST_ROSTER } from "./npc-test-roster";

describe("150 ABY supplemental cast registry", () => {
  it("has 25 unique source-book actors and ten separate test subjects", () => {
    expect(CAMPAIGN_NPCS_150_ABY).toHaveLength(25);
    expect(NPC_TEST_ROSTER).toHaveLength(10);
    expect(ALL_NPC_TEST_ROSTER).toHaveLength(35);
    expect(new Set(ALL_NPC_TEST_ROSTER.map(npc => npc.id)).size).toBe(35);
    expect(new Set(CAMPAIGN_NPCS_150_ABY.map(npc => npc.name)).size).toBe(25);
  });
  it("grounds only characters mentioned in the immediate turn", () => {
    expect(canonicalNpcContext("I approach Rena Salvek at the training desk.")).toEqual([
      expect.objectContaining({ name: "Rena Salvek", species: "Zeltron" }),
    ]);
    expect(canonicalNpcContext("I ask the clerk about a public manifest.")).toEqual([]);
    expect(findCanonNpc("Darth Korvalis")).toMatchObject({ force: "trained", location150: expect.any(String) });
    expect(findCanonNpc("Some Other Person")).toBeNull();
  });
  it("does not pre-award high office or cheat rules of Saga combat", () => {
    expect(findCanonNpc("Aliyah Fel")?.role150).not.toMatch(/Empress/);
    expect(findCanonNpc("Kor Vess")?.role150).not.toMatch(/^Mand'alor/);
    expect(findCanonNpc("Darth Korvalis")?.revision).toMatch(/No Apex Immunity/);
    expect(findCanonNpc("Darth Korvalis")?.revision).toMatch(/server rolls/);
  });
});