import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HostedSave } from "./hosted-bridge";
import { replayHostedTurn } from "./hosted-turn-replay";

const mocks = vi.hoisted(() => ({ get: vi.fn(), run: vi.fn(), save: vi.fn(), hydrate: vi.fn(), actor: vi.fn(), list: vi.fn() }));
vi.mock("./hosted-bridge", () => ({ hostedGet: mocks.get, hostedPersistenceEnabled: () => true, hydrateHostedSave: mocks.hydrate, saveHostedResult: mocks.save }));
vi.mock("./accounts", () => ({ requireAccount: mocks.actor, listAccounts: mocks.list }));
vi.mock("./gm", () => ({
  GmTurnError: class extends Error { constructor(message: string, public status = 400) { super(message); } },
  normalizeTurnAction: (action: string) => action.trim(), runGmTurn: mocks.run,
}));
vi.mock("./gpt-action", () => ({
  GptActionError: class extends Error { constructor(message: string, public status = 401) { super(message); } },
  authenticateGptAction: mocks.actor, readGptActionBody: (request: Request) => request.json(),
}));

const player = { id: "dmir", username: "dmir@galaxy.local", displayName: "D'mir", role: "player" };
const operator = { id: "operator", username: "gm@galaxy.local", displayName: "GM", role: "admin" };
const turnId = "purchase-retry-123";
const action = "I take the suit and tunic";
const roll = { label: "Persuasion", raw: 16, total: 16, outcome: "success" };
function saved(): HostedSave {
  return { account_username: player.username, account_id: player.id, revision: 12, updated_at: "2026-10-06T01:00:00Z", snapshot: {
    character: { level: 1, experience: 500 },
    gameState: { credits: 3500, health: 26, location: "Local market", inventory: [{ name: "Flight suit", qty: 1 }], turnEvents: [{ turnId, action, roll }] },
    messages: [{ role: "user", content: action }, { role: "roll", roll }, { role: "assistant", turnId, content: "The vendor hands over the suit and tunic." }],
    settings: {}, comms: [],
  } };
}
const request = (path: string, revision: number, declaration = action, accountId = player.id) => new Request(`http://localhost:3101/api/${path}`, {
  method: "POST", headers: { "Content-Type": "application/json", origin: "http://localhost:3101" },
  body: JSON.stringify({ revision, action: declaration, turnId, accountId }),
});
beforeEach(() => { vi.clearAllMocks(); mocks.actor.mockReturnValue(player); mocks.list.mockReturnValue([player, operator]); mocks.get.mockResolvedValue(saved()); });

describe("durable turn replay", () => {
  it("returns the saved roll and current HUD without applying the original purchase again", () => {
    const replay = replayHostedTurn(saved(), turnId, action);
    expect(replay).toMatchObject({
      replayed: true,
      revision: 12,
      roll,
      receipt: { status: "committed", phase: "committed", committedRevision: 12, gameplayAdvanced: true, replayed: true },
      state: { credits: 3500 },
      hud: { experience: 500, carried: 1 },
    });
    expect(replay?.snapshot).toEqual(saved().snapshot);
  });

  it("does not borrow a different turn's action when legacy metadata is missing", () => {
    const state = saved();
    state.snapshot.gameState.turnEvents = [];
    state.snapshot.messages = [{ role: "user", content: "I ask about prices" }, { role: "assistant", turnId: "different-turn", content: "Prices shown." }, { role: "assistant", turnId, content: "Read-only scene." }];
    expect(replayHostedTurn(state, turnId, action)).toBeNull();
  });

  it.each([11, 12])("web retry at revision %i recovers a committed result without another engine call or save", async revision => {
    const { POST } = await import("../app/api/gm/route");
    const response = await POST(request("gm", revision));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ revision: 12, replayed: true, provider: "hosted-replay", roll, snapshot: saved().snapshot });
    expect(mocks.run).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("GPT retry with a refreshed revision also replays instead of duplicating the reward", async () => {
    const { POST } = await import("../app/api/gpt/turn/route");
    const response = await POST(request("gpt/turn", 12));
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result).toMatchObject({ revision: 12, replayed: true, roll, state: { credits: 3500 } });
    expect(result.snapshot).toEqual(saved().snapshot);
    expect(result.contractVersion).toBe("goc-gameplay-v1");
    expect(mocks.run).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("website and GPT return precisely the same authoritative replay envelope", async () => {
    const { POST: WEB } = await import("../app/api/gm/route");
    const { POST: GPT } = await import("../app/api/gpt/turn/route");
    const browser = await (await WEB(request("gm", 12))).json();
    const chatgpt = await (await GPT(request("gpt/turn", 12))).json();
    expect(chatgpt).toEqual(browser);
    expect(chatgpt.roll).toEqual(roll);
    expect(chatgpt.snapshot.gameState.credits).toBe(3500);
    expect(mocks.run).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("browser and GPT format a freshly committed action identically, before persistence", async () => {
    const before = saved();
    before.revision = 11;
    before.snapshot.gameState.turnEvents = [];
    before.snapshot.messages = [];
    mocks.get.mockResolvedValue(before);
    const after = saved().snapshot;
    after.gameState.location = "Bonadan — atelier";
    after.gameState.npcOffscreen = { privatePlan: "unseen" };
    after.messages = [
      { role: "user", content: action },
      { role: "assistant", turnId, content: "## LOCATION\nStale locale\n\n## SCENE\nThe vendor confirms the purchase." },
    ];
    mocks.run.mockResolvedValue({
      revision: 12, turnId, snapshot: after,
      narration: "## LOCATION\nStale locale\n\n## SCENE\nThe vendor confirms the purchase.",
      roll, provider: "nvidia", receipt: { status: "committed", gameplayAdvanced: true },
    });
    const { POST: WEB } = await import("../app/api/gm/route");
    const { POST: GPT } = await import("../app/api/gpt/turn/route");
    const web = await (await WEB(request("gm", 11))).json();
    const gpt = await (await GPT(request("gpt/turn", 11))).json();
    expect(gpt).toEqual(web);
    expect(gpt.narration).toContain("Bonadan — atelier");
    expect(gpt.roll).toEqual(roll);
    expect(gpt.snapshot.gameState.npcOffscreen).toBeUndefined();
    expect(mocks.save).toHaveBeenCalledTimes(2);
    const webSaved = mocks.save.mock.calls[0][2];
    const gptSaved = mocks.save.mock.calls[1][2];
    expect(webSaved).toEqual(gptSaved);
    expect(webSaved.gameState.npcOffscreen).toEqual({ privatePlan: "unseen" });
    expect(webSaved.messages[1].content).toBe(gpt.narration);
  });

  it("a reused turn identifier with different prose fails before state changes", async () => {
    const { POST } = await import("../app/api/gm/route");
    const response = await POST(request("gm", 12, "I buy a lightsaber"));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "This turn identifier was already used for a different action." });
    expect(mocks.run).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("player target authorization is checked before replaying any other campaign", async () => {
    const { POST } = await import("../app/api/gm/route");
    const response = await POST(request("gm", 12, action, operator.id));
    expect(response.status).toBe(403);
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it("operator retry reads the selected player's durable campaign", async () => {
    mocks.actor.mockReturnValue(operator);
    const { POST } = await import("../app/api/gm/route");
    expect((await POST(request("gm", 11))).status).toBe(200);
    expect(mocks.get).toHaveBeenCalledWith(player.username);
    expect(mocks.run).not.toHaveBeenCalled();
  });
});
