import { afterEach, expect, it, vi } from "vitest";
import * as auth from "./gpt-controller-auth";
import * as bridge from "./datapad-bridge";
import { GET } from "@/app/api/gpt/hud/route";

afterEach(() => vi.restoreAllMocks());
it("reports the same earned-level pause in the GPT HUD without changing the saved state", async () => {
  vi.spyOn(auth, "requireGptController").mockReturnValue(null);
  const saved = { revision: 314, snapshot: { character: { level: 1, experience: 1050 }, gameState: { credits: 100, bankCredits: 200, health: 26, properties: [{id:"home"}] } } };
  vi.spyOn(bridge, "bridgeGet").mockResolvedValue(saved);
  const before = JSON.stringify(saved);
  const response = await GET(new Request("https://galaxy-local.vercel.app/api/gpt/hud"));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ revision:314, character: saved.snapshot.character, hud: { credits:100, bankCredits:200, properties:[{id:"home"}] }, advancement: { blocked: true, earnedLevel: 2, dossierUrl: "https://galaxy-local.vercel.app/character#advancement" } });
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(JSON.stringify(saved)).toBe(before);
});
