import { afterEach, describe, expect, it, vi } from "vitest";
import * as auth from "./gpt-action";
import * as hosted from "./hosted-bridge";
import { GET } from "@/app/api/gpt/state/route";

afterEach(() => vi.restoreAllMocks());
describe("shared GPT campaign reads", () => {
  it("returns the confirmed current scene and complete economic state without mutating the campaign", async () => {
    const location = "Coruscant — upper-city transit spine, Level 512";
    const content = `## LOCATION\n${location}\n## SCENE\nJax turns the displayed lease toward you. Commuters pass the concourse window.\n## GAMEPLAY RESULT\nThe contract waits for your decision. No payment has been made.\n## STATE UPDATE\nNo persistent change.`;
    const saved: any = { revision: 314, snapshot: { character: { name: "D'mir Holloran", level: 1, experience: 1050 },
      gameState: { location, credits: 1199996506, bankCredits: 200, properties: [], ships: [], investments: [], tradeOffers: [{ id: "quote" }], tradeReceipts: [], health: 26 },
      messages: [{ role: "user", content: "I review the lease.", turnId: "confirmed" }, { role: "assistant", content, turnId: "confirmed", provider: "nvidia" },
        { role: "user", content: "I pay.", turnId: "failed" }, { role: "assistant", content: "Your action meets the immediate world and stops.", turnId: "failed", provider: "local-safe-fallback" }], comms: [], settings: {} } };
    const before = JSON.stringify(saved);
    vi.spyOn(auth, "authenticateGptAction").mockReturnValue({ id: "dmir", username: "dmir@galaxy.local", displayName: "D'mir", role: "player" });
    vi.spyOn(hosted, "hostedPersistenceEnabled").mockReturnValue(true);
    vi.spyOn(hosted, "hostedGet").mockResolvedValue(saved);
    const response = await GET(new Request("https://galaxy-local.vercel.app/api/gpt/state"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.revision).toBe(314);
    expect(body.lastNarration).toBe(content);
    expect(body.currentScene.description).toContain("Jax turns");
    expect(body.storyThusFar.lastSavedTurn).toBe("confirmed");
    expect(body.world.bankCredits).toBe(200);
    expect(body.world.tradeOffers).toEqual([{ id: "quote" }]);
    expect(body.world.properties).toEqual([]);
    expect(JSON.stringify(saved)).toBe(before);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("does not leak campaign data when controller authentication fails", async () => {
    vi.spyOn(auth, "authenticateGptAction").mockImplementation(() => { throw new auth.GptActionError("Unauthorized", 401); });
    const read = vi.spyOn(hosted, "hostedGet");
    const response = await GET(new Request("https://galaxy-local.vercel.app/api/gpt/state"));
    expect(response.status).toBe(401);
    expect(read).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });
});
