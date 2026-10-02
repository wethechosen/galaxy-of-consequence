import { expect, it } from "vitest";
import { playerView } from "./player-view";
import { emptyWorld } from "./world";
import type { CampaignState } from "./types";
it("keeps secret NPCs, agendas, DCs and hidden world events out of player responses", () => {
  const world = emptyWorld();
  world.contacts = [{ id: "npc", name: "Known", description: "A contact", observedAttitude: "Reserved", knownObligations: [], companion: false, playerKnown: true, privateGoal: "SECRET_AGENDA", knowledge: ["SECRET_KNOWLEDGE"], memories: [] }, { id: "hidden", name: "SECRET_NPC", description: "", observedAttitude: "", knownObligations: [], companion: false, playerKnown: false, privateGoal: "", knowledge: [], memories: [] }];
  const state = { id: "test", title: "Test", era: "150 ABY", continuity: "Legends-first", currentLocation: "", currentScene: "", rulesStatus: "provisional_until_saga_core_is_indexed", character: null, objectives: [], loreFacts: [], rolls: [{ id: "roll", raw: 1, modifier: 0, total: 1, formula: "1d20", target: 90, outcome: "failure", reason: "Test", createdAt: "now" }], events: [{ id: "hidden", kind: "scene", playerVisible: false, summary: "SECRET_EVENT", createdAt: "now" }], checkpoints: [], world } as CampaignState;
  const visible = playerView(state);
  expect(JSON.stringify(visible)).not.toContain("SECRET_");
  expect(visible.rolls[0].target).toBeUndefined();
  expect(visible.world?.contacts).toHaveLength(1);
  expect(state.world?.contacts[0].privateGoal).toBe("SECRET_AGENDA");
  Object.assign(state.world!, { futureSecretField: "SECRET_FUTURE" });
  Object.assign(state.rolls[0], { hiddenNpcStats: "SECRET_STATS" });
  expect(JSON.stringify(playerView(state))).not.toContain("SECRET_");
});
