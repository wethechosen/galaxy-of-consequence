import { afterEach, describe, expect, it, vi } from "vitest";
import * as accounts from "./accounts";
import type { Account } from "./accounts";
import { openStorage } from "./storage";
import { readDatapad, saveAuthoritativeDatapad } from "./datapad-save";
import { runGmTurn } from "./gm";

const provider = vi.hoisted(() => vi.fn());
vi.mock("./original-provider", async (importOriginal) => ({
  ...await importOriginal<typeof import("./original-provider")>(), invokeNvidia: provider,
}));

vi.mock("./saga-dice", async (importOriginal) => ({
  ...await importOriginal<typeof import("./saga-dice")>(),
  rollSagaCheck: (plan: Record<string, unknown>) => ({
    ...plan, id: "fixed-success", formula: "1d20+1", raw: 20, total: 21,
    outcome: "success", critical: false, damage: null, createdAt: "2026-10-14T00:00:00.000Z",
  }),
}));

let database: ReturnType<typeof openStorage> | null = null;
afterEach(() => {
  vi.restoreAllMocks();
  provider.mockReset();
  database?.close();
  database = null;
});

describe("commercial gameplay progress recovery", () => {
  it("turns three broken successful-pilot drafts into one idempotent Saga-valid contact receipt", async () => {
    database = accounts.accountStore(openStorage(":memory:"));
    vi.spyOn(accounts, "accountStore").mockReturnValue(database);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const actor: Account = { id: "dmir-pilot-test", username: "dmir@galaxy.local", displayName: "D'mir", role: "player" };
    database.prepare("INSERT INTO accounts VALUES (?, ?, ?, ?, '', '')").run(actor.id, actor.username, actor.displayName, actor.role);
    const location = "Taris — Shipyards, Level C";
    saveAuthoritativeDatapad(actor, null, 0, {
      character: { name: "D'mir Holloran", level: 2, experience: 2550, sagaStats: "STR 12 | DEX 14 | CON 10 | INT 12 | WIS 10 | CHA 12", trainedSkills: [], feats: "Adept Negotiator" },
      gameState: { location, credits: 628_650_006, creditsCriminal: 50_000, inventory: [{ name: "Physical credit chips (50,000)", qty: 1, tag: "currency" }], objectives: [], contacts: [], discoveries: [], turnEvents: [] },
      messages: [{ role: "assistant", provider: "nvidia", content: `## LOCATION\n${location}\n## SCENE\nThe yard is busy.\n## GAMEPLAY RESULT\nThe prior clerk gives no lead and sends you back into the same yard.` }],
      comms: [], settings: {},
    }, database);

    const action = "Find me a pilot willing to take the trip and work for me";
    provider.mockImplementation(async (request: { sourceQuery?: string; messages: Array<{ content: string }> }) => {
      if (!request.sourceQuery) return { provider: "nvidia", model: "intent", finishReason: "stop", content: JSON.stringify({
        intent: "social", canonicalAction: action, declaredSpan: action, checkNeeded: true, skill: "Persuasion",
        rationale: "A specific pilot must agree to employment.", travelTarget: null, acceptedOfferId: null,
      }) };
      return { provider: "nvidia", model: "broken", finishReason: "stop", content: `## LOCATION\n${location}\n\n## SCENE\nTwo pilots return to their workstations while welders flash across the same repair bay.\n\n## GM ADJUDICATION\nThe successful Persuasion check seeks a willing pilot.\n\n## GAMEPLAY RESULT\nThe exchange ends without commitment, leaving you without a lead and no closer to a willing captain.\n\n## SAGA CHECK\nPersuasion: 1d20+1 = 21 vs DC 15\nRESULT: SUCCESS\n\n## STATE UPDATE\nNo persistent change.\n\n## PLAYER OPTIONS\nA. Ask another pilot.\nB. Return to the clerk.\nYou may declare another action.\n<!--STATE:{}-->` };
    });

    const result = await runGmTurn(actor, { revision: 1, turnId: "pilot-recovery-01", action });
    expect(result.revision).toBe(2);
    expect(result.provider).toBe("local-safe-fallback");
    expect(result.model).toBe("commercial-progress-receipt");
    expect(result.fallbackReason).toBe("validation");
    expect(result.snapshot.gameState.credits).toBe(628_650_006);
    expect(result.snapshot.gameState.contacts).toEqual([expect.objectContaining({
      name: "Sera Noll", role: "independent charter pilot",
      sagaBuild: expect.objectContaining({ ruleset: "Star Wars Saga Edition", classLevels: { nonheroic: 1 }, heroicLevel: 0, role: "skilled" }),
    })]);
    expect(result.snapshot.gameState.discoveries).toEqual([expect.objectContaining({ title: "Independent charter pilot at Bay 7" })]);
    expect(provider).toHaveBeenCalledTimes(4);
    expect(await runGmTurn(actor, { revision: 1, turnId: "pilot-recovery-01", action })).toEqual(result);
    expect(readDatapad(actor, null, database).revision).toBe(2);
  });

  it("replaces three repeated Jax referrals with one persistent alternative lead at the saved location", async () => {
    database = accounts.accountStore(openStorage(":memory:"));
    vi.spyOn(accounts, "accountStore").mockReturnValue(database);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const actor: Account = { id: "dmir-alternative-test", username: "dmir@galaxy.local", displayName: "D'mir", role: "player" };
    database.prepare("INSERT INTO accounts VALUES (?, ?, ?, ?, '', '')").run(actor.id, actor.username, actor.displayName, actor.role);
    const location = "Taris — Market District (inside the cantina)";
    saveAuthoritativeDatapad(actor, null, 0, {
      character: { name: "D'mir Holloran", level: 2, experience: 2550, sagaStats: "STR 12 | DEX 14 | CON 10 | INT 12 | WIS 10 | CHA 12", trainedSkills: [], feats: "Adept Negotiator" },
      gameState: { location, credits: 628_650_006, creditsCriminal: 50_000, inventory: [], objectives: [], contacts: [], discoveries: [], turnEvents: [] },
      messages: [{ role: "assistant", provider: "nvidia", content: `## LOCATION\n${location}\n## SCENE\nThe waitress stands across the cantina bar.\n## GAMEPLAY RESULT\nThe waitress says independent runs are rare and advises asking Jax at Docking Bay 94 because he handles quiet contracts.` }],
      comms: [], settings: {},
    }, database);

    const action = "Ask the waitress whether she knows any captains other than Jax who are currently accepting private passengers.";
    provider.mockImplementation(async (request: { sourceQuery?: string }) => {
      if (!request.sourceQuery) return { provider: "nvidia", model: "intent", finishReason: "stop", content: JSON.stringify({
        intent: "dialogue", canonicalAction: action, declaredSpan: action, checkNeeded: false, skill: null,
        rationale: "A routine request for public information.", travelTarget: null, acceptedOfferId: null,
      }) };
      return { provider: "nvidia", model: "broken", finishReason: "stop", content: `## LOCATION\n${location}\n\n## SCENE\nThe waitress pauses across the bar while pilots talk beneath flickering panels and glasses clink near the service hatch. She wipes the counter, then gives the same measured answer.\n\n## GM ADJUDICATION\nThis routine public inquiry needs no check.\n\n## GAMEPLAY RESULT\nThe waitress advises arranging discreet passage through Jax at Docking Bay 94 because he handles quiet contracts. No alternative captain is identified.\n\n## SAGA CHECK\nNo check required.\n\n## STATE UPDATE\nNo persistent change.\n\n## PLAYER OPTIONS\nA. Ask Jax about passage.\nB. Leave the cantina.\nYou may declare another action.\n<!--STATE:{}-->` };
    });

    const result = await runGmTurn(actor, { revision: 1, turnId: "alternative-captain-recovery-01", action });
    expect(result.revision).toBe(2);
    expect(result.provider).toBe("local-safe-fallback");
    expect(result.model).toBe("commercial-progress-receipt");
    expect(result.snapshot.gameState.location).toBe(location);
    expect(result.narration).not.toMatch(/shipyard's public registry signage/i);
    expect(result.narration).not.toMatch(/through Jax|ask Jax|return to Jax/i);
    expect(result.snapshot.gameState.discoveries).toEqual([expect.objectContaining({ title: "Local public charter and vessel registry" })]);
    expect(result.snapshot.gameState.credits).toBe(628_650_006);
    expect(provider).toHaveBeenCalledTimes(4);
    expect(await runGmTurn(actor, { revision: 1, turnId: "alternative-captain-recovery-01", action })).toEqual(result);
  });
});
