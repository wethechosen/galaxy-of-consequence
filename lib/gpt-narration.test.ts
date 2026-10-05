import { describe, expect, it, vi } from "vitest";
import { anchorNarrationLocation, replayedPlayerAction } from "./gpt-narration";

const { hostedGet, runGmTurn, saveHostedResult } = vi.hoisted(() => ({ hostedGet: vi.fn(), runGmTurn: vi.fn(), saveHostedResult: vi.fn() }));
vi.mock("./hosted-bridge", () => ({ hostedGet, saveHostedResult, hostedPersistenceEnabled: () => true, hydrateHostedSave: vi.fn() }));
vi.mock("./gpt-action", () => ({
  GptActionError: class extends Error { constructor(message: string, public status = 401) { super(message); } },
  authenticateGptAction: () => ({ id: "test-account", username: "test-player", role: "player" }),
  readGptActionBody: (request: Request) => request.json(),
}));
vi.mock("./gm", () => ({
  runGmTurn,
  GmTurnError: class extends Error { constructor(message: string, public status = 400) { super(message); } },
  normalizeTurnAction: (value: string) => value.replace(/^\s*(?:continue with a specific declared action\.?\s*)+/i, "").trim(),
}));

describe("Custom GPT narration location", () => {
  const scene = "D'mir stands beneath an amber lamp. The ventilation rattles above the sealed hatch.";
  const narration = `LOCATION\nOld transit route\n\nSCENE\n${scene}\n\nGM ADJUDICATION\nNo check required.\n\nGAMEPLAY RESULT\nThe hatch remains shut.\n\nSAGA CHECK\nNo roll.\n\nSTATE UPDATE\nNo change.\n\nPLAYER OPTIONS\nA. Listen.\nB. Wait.`;

  it("anchors the seven-section LOCATION without duplicating it inside SCENE", () => {
    const anchored = anchorNarrationLocation(narration, "Coruscant — foundation bulkhead");
    expect(anchored).toBe(narration.replace("Old transit route", "Coruscant — foundation bulkhead"));
    expect(anchored).not.toContain("**Location:**");
    expect(anchored).toContain(`SCENE\n${scene}`);
  });

  it("handles markdown headings and preserves the entire scene/result", () => {
    const markdown = narration.replace(/^([A-Z ]+)$/gm, "## $1");
    expect(anchorNarrationLocation(markdown, "Coruscant — foundation bulkhead")).toBe(markdown.replace("Old transit route", "Coruscant — foundation bulkhead"));
  });

  it("is idempotent when the seven-section location is already authoritative", () => {
    expect(anchorNarrationLocation(narration, "Old transit route")).toBe(narration);
  });

  it("retains the inline-location behavior for legacy four-section narration", () => {
    const legacy = `SCENE\n${scene}\nGM RESOLUTION\nNo check.\nSTATE UPDATE\nNo change.\nPLAYER OPTIONS\nA. Listen.\nB. Wait.`;
    const anchored = anchorNarrationLocation(legacy, "Foundation bulkhead");
    expect(anchored).toBe(legacy.replace("SCENE\n", "SCENE\n**Location:** Foundation bulkhead\n"));
    expect(anchorNarrationLocation(anchored, "Foundation bulkhead")).toBe(anchored);
  });

  it("does not rewrite narration when location or supported headings are absent", () => {
    expect(anchorNarrationLocation(narration, "")).toBe(narration);
    expect(anchorNarrationLocation("A lamp flickers.", "Foundation bulkhead")).toBe("A lamp flickers.");
  });
});

describe("Custom GPT hosted retry action binding", () => {
  const turnId = "turn-retry-123";

  it("uses the authoritative event to distinguish same-action retries from different actions", () => {
    const snapshot = { gameState: { turnEvents: [{ turnId, action: "I inspect the hatch" }] } };
    expect(replayedPlayerAction(snapshot, turnId)).toBe("I inspect the hatch");
    expect(replayedPlayerAction(snapshot, turnId)).not.toBe("I open the hatch");
  });

  it("binds a legacy turn to its preceding user declaration while ignoring roll messages", () => {
    const snapshot = { messages: [
      { role: "user", content: "I inspect the hatch" },
      { role: "roll", content: "Perception: 12" },
      { role: "assistant", turnId, content: "The hatch is sealed." },
      { role: "user", content: "I open the hatch" },
    ] };
    expect(replayedPlayerAction(snapshot, turnId)).toBe("I inspect the hatch");
  });

  it("does not borrow another turn's declaration when the original action is unavailable", () => {
    const snapshot = { messages: [
      { role: "user", content: "I inspect the hatch" },
      { role: "assistant", turnId: "prior-turn-123", content: "The hatch is sealed." },
      { role: "assistant", turnId, content: "A fresh view of the room." },
    ] };
    expect(replayedPlayerAction(snapshot, turnId)).toBeNull();
    expect(replayedPlayerAction(snapshot, "missing-turn")).toBeNull();
  });
});

describe("Custom GPT hosted retry route", () => {
  const turnId = "turn-retry-123";
  const request = (action: string) => new Request("https://example.test/api/gpt/turn", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ revision: 4, turnId, action }),
  });
  const setupSavedTurn = () => {
    vi.clearAllMocks();
    hostedGet.mockResolvedValue({ revision: 5, snapshot: {
      character: { level: 1, experience: 0 },
      gameState: { location: "Foundation bulkhead", turnEvents: [{ turnId, action: "I inspect the hatch" }] },
      messages: [{ role: "assistant", turnId, content: "The hatch remains sealed." }],
    } });
  };

  it("replays the same action without calling the engine or committing again", async () => {
    setupSavedTurn();
    const { POST } = await import("../app/api/gpt/turn/route");
    const response = await POST(request("I inspect the hatch"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ revision: 5, turnId, provider: "hosted-replay", narration: "The hatch remains sealed." });
    expect(runGmTurn).not.toHaveBeenCalled();
    expect(saveHostedResult).not.toHaveBeenCalled();
  });

  it("rejects a reused identifier for a different action without returning stale narration", async () => {
    setupSavedTurn();
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { POST } = await import("../app/api/gpt/turn/route");
      const response = await POST(request("I open the hatch"));
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ error: "This turn identifier was already used for a different action." });
      expect(runGmTurn).not.toHaveBeenCalled();
      expect(saveHostedResult).not.toHaveBeenCalled();
    } finally { errorLog.mockRestore(); }
  });
});
