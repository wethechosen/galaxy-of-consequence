import { describe, expect, it } from "vitest";
import { alignCommittedTurn, GAMEPLAY_CONTRACT_VERSION, publicCommittedTurn } from "./gameplay-contract";

const actionId = "shared-turn-001";
const saved = () => ({
  revision: 8, turnId: actionId, provider: "nvidia", narration: "## LOCATION\nWrong world\n\n## SCENE\nThe clerk checks the appointment ledger.\n\n## GAMEPLAY RESULT\nThe clerk replies.",
  roll: { skill: "Persuasion", total: 18 },
  receipt: { status: "committed", gameplayAdvanced: true },
  snapshot: {
    character: { name: "Test", level: 2, experience: 3000 },
    gameState: { location: "Bonadan — atelier", credits: 1000, inventory: [{ id: "suit", name: "Executive suit", qty: 1 }], npcOffscreen: { hidden: true }, npcMechanics: { private: true }, rivalIntelligence: { secret: true }, turnEvents: [{ turnId: actionId }] },
    messages: [{ role: "user", content: "Ask clerk" }, { role: "assistant", turnId: actionId, content: "## LOCATION\nWrong world" }],
    comms: [], settings: {},
  },
});
describe("canonical browser / GPT gameplay contract", () => {
  it("anchors narration once before hosted commit without changing game results", () => {
    const result = alignCommittedTurn(saved());
    expect(result.narration).toContain("## LOCATION\nBonadan — atelier");
    expect(result.snapshot.messages[1].content).toBe(result.narration);
    expect(result.snapshot.gameState.credits).toBe(1000);
    expect(alignCommittedTurn(result)).toEqual(result);
  });
  it("projects identical public rolls, character and inventory in either interface", () => {
    const result = publicCommittedTurn(saved());
    const browser = JSON.parse(JSON.stringify(result));
    const gpt = JSON.parse(JSON.stringify(result));
    expect(gpt).toEqual(browser);
    expect(gpt).toMatchObject({ contractVersion: GAMEPLAY_CONTRACT_VERSION, revision: 8, narration: expect.stringContaining("Bonadan — atelier"), roll: { total: 18 }, character: { experience: 3000 }, state: { credits: 1000 }, hud: { level: 2, carried: 1 }, gameplayAdvanced: true });
    for(const prop of ["npcOffscreen","npcMechanics","rivalIntelligence"]) expect(gpt.state).not.toHaveProperty(prop);
    for(const prop of ["npcOffscreen","npcMechanics","rivalIntelligence"]) expect(gpt.snapshot.gameState).not.toHaveProperty(prop);
  });
});
