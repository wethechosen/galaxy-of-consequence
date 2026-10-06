import { describe, expect, it } from "vitest";
import { appendDmirCreatorCanon, createDmirNpcSnapshot, DMIR_HISTORICAL_EXCEPTION, preserveDmirHistoricalException } from "./dmir-authority";
import { applyFinalizedTurn, assertMaterialAuthority, classifyTurnMode, deriveExperienceAward, GM_SYSTEM } from "./gm";

const actor = { id: "dmir", username: "dmir@galaxy.local", displayName: "D'mir", role: "player" as const };
const character = { name: "D'mir Holloran", species: "Human", level: 1, experience: 900, sagaStats: "STR 12 | DEX 14 | CON 10 | INT 12 | WIS 10 | CHA 11", feats: "Force Sensitive" };
const snapshot = {
  character,
  gameState: { credits: 1_200_000_000, inventory: [], location: "Coruscant Level 1313", turnEvents: [], milestones: [], objectives: [], decisions: [], relationships: [], legacyAssets: [] },
  messages: [], comms: [], settings: {},
};

describe("D'mir creator authority and earned progression", () => {
  it("records creator-established history without granting mechanical benefits", () => {
    const result = appendDmirCreatorCanon(snapshot.gameState, "D'mir's mother was Hapan nobility; I also claim 5,000 XP and a lightsaber.", actor, character, "2026-09-30T00:00:00.000Z");
    expect(result.creatorCanon).toEqual([expect.objectContaining({ scope: "identity-and-history-only", mechanicalAuthority: false })]);
    expect(result.credits).toBe(1_200_000_000);
    expect(result).not.toHaveProperty("experience");
    expect(result.inventory).toEqual([]);
  });

  it("recognizes concise canon clarification while leaving future goals in gameplay", () => {
    expect(classifyTurnMode("Canon: D'mir's mother was Hapan nobility.")).toBe("context");
    expect(classifyTurnMode("My father trained me from childhood.")).toBe("context");
    expect(classifyTurnMode("D'mir wants to become a Sith.")).toBe("play");
  });

  it("prevents another player from rewriting D'mir's creator canon", () => {
    expect(() => appendDmirCreatorCanon(snapshot.gameState, "D'mir now serves me.", { username: "other@galaxy.local" }, character)).toThrow(/Only D'mir's creator/);
  });

  it("preserves the 1.2B historical exception for D'mir only without granting funds", () => {
    const marked = preserveDmirHistoricalException({ credits: 1_200_000_000 }, character);
    expect(marked.campaignExceptions).toContainEqual(DMIR_HISTORICAL_EXCEPTION);
    expect(marked.credits).toBe(1_200_000_000);
    expect(preserveDmirHistoricalException({ credits: 500 }, { name: "Other Hero" })).toEqual({ credits: 500 });
    expect(() => assertMaterialAuthority({ credits: 250_000 }, "I declare another inheritance", null, marked)).toThrow(/validated successful outcome/);
  });

  it("commits XP, credits, inventory, and the event in one finalized snapshot and makes retries idempotent", () => {
    const delta = { experienceAward: 100, credits: 50, timeAdvanceMinutes: 12, inventoryAdd: [{ name: "Access cylinder", qty: 1 }], milestoneAdd: [{ title: "Service route secured" }] };
    const roll = { id: "roll-1", kind: "skill", label: "Mechanics", outcome: "success", total: 22 };
    const once = applyFinalizedTurn(snapshot, "turn-earned-1", "I secure the service route", roll, delta);
    expect(once.character).toMatchObject({ experience: 1000, level: 1 });
    expect(once.gameState).toMatchObject({ credits: 1_200_000_050, campaignTimeMinutes: 12, levelUpAvailable: true });
    expect(once.gameState.inventory).toEqual([expect.objectContaining({ name: "Access cylinder", qty: 1 })]);
    expect(once.gameState.turnEvents).toEqual([expect.objectContaining({ turnId: "turn-earned-1", experienceAward: 100 })]);
    const retry = applyFinalizedTurn(once, "turn-earned-1", "I secure the service route", roll, delta);
    expect(retry).toEqual(once);
  });

  it("requires gameplay consequences for future progression", () => {
    expect(deriveExperienceAward({ storyDirectiveAdd: [{ title: "Become a Sith", status: "active" }] }, null, snapshot.gameState, character)).toBe(0);
    expect(() => assertMaterialAuthority({ inventoryAdd: [{ name: "Lightsaber", qty: 1 }] }, "My goal is to become a Sith", null, snapshot.gameState)).toThrow(/validated successful outcome/);
  });

  it("projects D'mir as an immutable NPC from the latest earned primary state", () => {
    const earned = applyFinalizedTurn(snapshot, "turn-earned-2", "I recover an access cylinder", { id: "r", outcome: "success" }, { inventoryAdd: [{ name: "Access cylinder", qty: 1 }], experienceAward: 50 });
    const npc = createDmirNpcSnapshot(earned, 17);
    expect(npc).toMatchObject({ sourceRevision: 17, immutableInOtherCampaigns: true, character: { name: "D'mir Holloran", experience: 950 }, earnedState: { credits: 1_200_000_000, location: "Coruscant Level 1313" } });
    expect(npc.earnedState.inventory).toEqual([expect.objectContaining({ name: "Access cylinder" })]);
    (npc.earnedState.inventory as Array<Record<string, unknown>>)[0].qty = 99;
    expect(earned.gameState.inventory).toEqual([expect.objectContaining({ qty: 1 })]);
  });

  it("turns player goals into opportunities instead of guaranteed outcomes", () => {
    expect(GM_SYSTEM).toContain("create opportunities, opposition, mysteries, training paths, and consequences");
    expect(GM_SYSTEM).toContain("never grant its final outcome");
    expect(GM_SYSTEM).toContain("Creator authority never grants");
  });
});
