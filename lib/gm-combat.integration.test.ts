import { afterEach, describe, expect, it, vi } from "vitest";
import * as accounts from "./accounts";
import type { Account } from "./accounts";
import { openStorage } from "./storage";
import { saveAuthoritativeDatapad, type DatapadSnapshot } from "./datapad-save";
import { runGmTurn } from "./gm";

const provider = vi.hoisted(() => vi.fn());
vi.mock("./original-provider", async (importOriginal) => ({
  ...await importOriginal<typeof import("./original-provider")>(), invokeNvidia: provider,
}));

const databases: ReturnType<typeof openStorage>[] = [];
afterEach(() => { vi.restoreAllMocks(); provider.mockReset(); databases.splice(0).forEach(db => db.close()); });

function setup() {
  const db = accounts.accountStore(openStorage(":memory:"));
  databases.push(db);
  const actor: Account = { id: "dmir-combat", username: "dmir@galaxy.local", displayName: "D'mir", role: "player" };
  db.prepare("INSERT INTO accounts VALUES (?, ?, ?, ?, '', '')").run(actor.id, actor.username, actor.displayName, actor.role);
  vi.spyOn(accounts, "accountStore").mockReturnValue(db);
  const location = "Coruscant — deeper lower-city substructure — transit route";
  const combat = {
    status: "active", round: 2, activeSide: "player",
    initiativeOrder: ["pc-dmir", "npc-debris"],
    playerActions: { standard: 1, move: 1, swift: 1, reaction: 1 },
    combatants: [
      { id: "pc-dmir", name: "D'mir Holloran", side: "player", level: 1, hp: 26, maxHp: 26, reflex: 12, fortitude: 12, will: 11, damageThreshold: 12, conditionTrack: 0, initiative: 18, attackModifier: 2, damage: { count: 1, sides: 4, modifier: 1, type: "kinetic" } },
      { id: "npc-debris", name: "Collapsed debris", side: "opposition", level: 1, hp: 12, maxHp: 12, reflex: 15, fortitude: 12, will: 10, damageThreshold: 12, conditionTrack: 0, initiative: 5, attackModifier: 0, damage: { count: 1, sides: 4, modifier: 0, type: "environment" } },
    ], log: [], startedAt: new Date().toISOString(),
  };
  const initial: DatapadSnapshot = {
    character: { name: "D'mir Holloran", level: 1, experience: 450, maxHitPoints: 26, trainedSkills: [], sagaStats: "STR 12 | DEX 14 | CON 10 | INT 12 | WIS 10 | CHA 11", forcePowers: "None" },
    gameState: { location, health: 26, credits: 1_199_998_506, inventory: [{ id: "pistol", name: "Blaster pistol", qty: 1 }], combat, scene: { summary: "D'mir is at the debris route." } },
    messages: [], comms: [], settings: {},
  };
  saveAuthoritativeDatapad(actor, null, 0, initial, db);
  return { actor, initial };
}

describe("authoritative combat travel escape", () => {
  it("ends a stale scenery encounter when the player declares a concrete route away", async () => {
    const { actor } = setup();
    provider.mockImplementation(async ({ sourceQuery, messages }: { sourceQuery?: string; messages: Array<{ content: string }> }) => {
      if (!sourceQuery) {
        const declaration = messages.at(-1)?.content.split("\n\nPLAYER DECLARATION:\n")[1] || "";
        return { provider: "nvidia", model: "intent-test", finishReason: "stop", content: JSON.stringify({
          intent: "travel", canonicalAction: declaration, declaredSpan: declaration, checkNeeded: false, skill: null,
          rationale: "The player is leaving the encounter along an observable route.", travelTarget: "nearest market",
        }) };
      }
      return { provider: "nvidia", model: "gm-test", finishReason: "stop", content: `LOCATION\nCoruscant — lower-city local market\n\nSCENE\nYou turn from the collapsed route and climb through a service artery. Amber maintenance strips slide across your prison-worn clothing while the distant traffic vibration grows louder; after fifteen minutes the passage opens into a crowded market cavern, where stalls and a guesthouse placard give you concrete places to go.\n\nGM ADJUDICATION\nThe declared withdrawal follows an observable route beyond the immediate debris encounter. The withdrawal breaks contact without granting victory.\n\nGAMEPLAY RESULT\nYou reach the nearest local market. The encounter is no longer active, and the market now presents clothing, food, information, and paid shelter as visible possibilities.\n\nSAGA CHECK\nNo check required.\n\nSTATE UPDATE\nThe location changes to the local market and the encounter is escaped. No XP is awarded for retreat.\n\nPLAYER OPTIONS\nA. Inspect the clothing stall.\nB. Ask about paid lodging.\nC. Read the market's visible signs.\nD. Keep moving through the crowd.\nYou may declare another action.\n<!--STATE:{"location":"Coruscant — lower-city local market","timeAdvanceMinutes":15}-->` };
    });

    const result = await runGmTurn(actor, { revision: 1, turnId: "combat-escape-01", action: "I turn around and head upward toward the nearest market." });
    expect(result.snapshot.gameState.location).toBe("Coruscant — lower-city local market");
    expect(result.snapshot.gameState.combat).toMatchObject({ status: "escaped", activeSide: "none" });
    expect(result.snapshot.character?.experience).toBe(450);
    expect(result.narration).toContain("breaks contact");
  });
});
