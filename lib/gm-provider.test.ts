import { expect, it, vi } from "vitest";
import { previewTurn, validateProposal } from "./gm-provider";
it("previews without network calls or approving sources", async () => {
  const spy = vi.spyOn(globalThis, "fetch");
  try { const preview = await previewTurn("I look around"); expect(preview.narration).toContain("TEST SCENE"); expect(preview.citedFactIds).toEqual([]); expect(spy).not.toHaveBeenCalled(); }
  finally { spy.mockRestore(); }
});
it("rejects arbitrary model state patches and forged citations", () => {
  const proposal = { narration: "Test", suggestions: [], requiresRules: false, citedFactIds: [] };
  expect(() => validateProposal({ ...proposal, credits: 100000 }, new Set())).toThrow();
  expect(() => validateProposal({ ...proposal, citedFactIds: ["invented"] }, new Set())).toThrow();
});
