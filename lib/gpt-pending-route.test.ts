import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NvidiaProviderError } from "./nvidia-errors";

const mocks = vi.hoisted(() => ({ get: vi.fn(), gm: vi.fn(), save: vi.fn(), hydrate: vi.fn() }));
vi.mock("./hosted-bridge", () => ({
  hostedGet: mocks.get, hostedPersistenceEnabled: () => true,
  saveHostedResult: mocks.save, hydrateHostedSave: mocks.hydrate,
}));
vi.mock("./gpt-action", () => ({
  GptActionError: class extends Error { constructor(message: string, public status = 401) { super(message); } },
  authenticateGptAction: () => ({ id: "fixture-account-id", username: "fixture-account", role: "player" }),
  readGptActionBody: (request: Request) => request.json(),
}));
vi.mock("./gm", () => ({
  GmTurnError: class extends Error { constructor(message: string, public status = 400) { super(message); } },
  normalizeTurnAction: (value: string) => value.trim(),
  runGmTurn: mocks.gm,
}));
const action = "I ask the master tailor about an appointment.";
const turnId = "appointment-2026-01";
const saved = () => ({
  account_username: "fixture-account", account_id: "fixture-account-id",
  revision: 7, updated_at: "2026-10-17T22:00:00Z",
  snapshot: {
    character: { name: "Test player", level: 3, experience: 3700 },
    gameState: { location: "Bonadan — atelier", credits: 120000, inventory: [], turnEvents: [] },
    messages: [], comms: [], settings: {},
  },
});
function request(path: string, body: object) {
  return new Request("https://example.test/api/gpt/" + path, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-17T22:00:00.000Z"));
  vi.stubEnv("GOC_GPT_ACTION_KEY", "test-only-0123456789abcdef0123456789abcdef");
  vi.clearAllMocks(); mocks.get.mockResolvedValue(saved());
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("Custom GPT frozen turn identity and read-only cooldown", () => {
  it("returns an encrypted ticket, status countdown, and exact-once resumption", async () => {
    const { POST: submit } = await import("../app/api/gpt/turn/route");
    const { POST: status } = await import("../app/api/gpt/pending/route");
    mocks.gm.mockRejectedValueOnce(new NvidiaProviderError("Upstream cooling down", 429, 30, 429, true));
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const first = await submit(request("turn", { action, turnId, revision: 7 }));
    expect(first.status).toBe(429);
    const firstData = await first.json();
    const retryTicket = firstData.retry.retryTicket;
    expect(typeof retryTicket).toBe("string");
    expect(firstData).not.toHaveProperty("narration");
    expect(firstData.retry).toMatchObject({ baseRevision: 7, turnId, estimated: true, gameplayAdvanced: false });
    expect(mocks.save).not.toHaveBeenCalled();

    const checking = await status(request("pending", { retryTicket }));
    expect(checking.status).toBe(200);
    expect(await checking.json()).toMatchObject({ status: "cooldown", secondsRemaining: 30, canSubmit: false, gameplayAdvanced: false });
    expect(mocks.gm).toHaveBeenCalledTimes(1);

    const early = await submit(request("turn", { retryTicket }));
    expect(early.status).toBe(429);
    expect(await early.json()).toMatchObject({ retry: { status: "awaiting_retry", turnId, gameplayAdvanced: false }, turnId, gameplayAdvanced: false });
    expect(mocks.gm).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(31000);
    const ready = await status(request("pending", { retryTicket }));
    expect(await ready.json()).toMatchObject({ status: "ready", secondsRemaining: 0, canSubmit: true, gameplayAdvanced: false });
    const complete = {
      revision: 8, turnId, narration: "## LOCATION\nOutdated place\n\n## SCENE\nThe tailor discusses appointment slots.",
      roll: null, provider: "nvidia",
      receipt: { status: "committed", gameplayAdvanced: true },
      snapshot: {
        ...saved().snapshot,
        gameState: { ...saved().snapshot.gameState, credits: 120000, npcOffscreen: { private: true } },
        messages: [{ role: "user", content: action }, { role: "assistant", turnId, content: "Before" }],
      },
    };
    mocks.gm.mockResolvedValueOnce(complete);
    const resumed = await submit(request("turn", { retryTicket }));
    expect(resumed.status).toBe(200);
    const result = await resumed.json();
    expect(result).toMatchObject({ revision: 8, turnId, narration: expect.stringContaining("Bonadan — atelier"), state: { credits: 120000 }, receipt: { status: "committed" }, gameplayAdvanced: true });
    expect(result.snapshot.gameState.npcOffscreen).toBeUndefined();
    expect(mocks.gm).toHaveBeenCalledTimes(2);
    expect(mocks.gm.mock.calls[1][1]).toMatchObject({ accountId: "fixture-account-id", revision: 7, action, turnId });
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(mocks.save.mock.calls[0][2].gameState.npcOffscreen).toEqual({ private: true });
    expect(mocks.save.mock.calls[0][2].messages[1].content).toBe(result.narration);
    errorLog.mockRestore();
  });

  it("a completed turn is returned from the saved record without calling GM again", async () => {
    const { POST: status } = await import("../app/api/gpt/pending/route");
    const { issuePendingTurnTicket } = await import("./gpt-pending-turn");
    const retryTicket = issuePendingTurnTicket({ username: "fixture-account", revision: 7, action, turnId, retryAtMs: Date.now() - 500, estimated: true });
    const completed = saved();
    completed.revision = 8;
    completed.snapshot.gameState.turnEvents = [{ turnId, action }] as never[];
    completed.snapshot.messages = [
      { role: "user", content: action },
      { role: "assistant", turnId, content: "The tailor schedules a meeting." },
    ] as never[];
    mocks.get.mockResolvedValue(completed);
    const response = await status(request("pending", { retryTicket }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ revision: 8, turnId, narration: "The tailor schedules a meeting.", gameplayAdvanced: true, replayed: true });
    expect(mocks.gm).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("rejects a cross-account or changed revision ticket without changing the save", async () => {
    const { POST: status } = await import("../app/api/gpt/pending/route");
    const { issuePendingTurnTicket } = await import("./gpt-pending-turn");
    const crossAccount = issuePendingTurnTicket({ username: "other-user", revision: 7, action, turnId, retryAtMs: Date.now() + 1000, estimated: true });
    expect((await status(request("pending", { retryTicket: crossAccount }))).status).toBe(400);
    const retryTicket = issuePendingTurnTicket({ username: "fixture-account", revision: 6, action, turnId, retryAtMs: Date.now() + 1000, estimated: true });
    const conflict = await status(request("pending", { retryTicket }));
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toMatchObject({ error: "campaign_changed", revision: 7, gameplayAdvanced: false });
    expect(mocks.gm).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
