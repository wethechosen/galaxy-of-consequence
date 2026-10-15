import { describe, expect, it } from "vitest";
import { advanceTurnLifecycle, beginTurnLifecycle, commitTurnLifecycle, failTurnLifecycle, recordDraftFailure, turnLifecycleFromError } from "./turn-lifecycle";

describe("turn lifecycle receipts", () => {
  it("retains each draft failure without transmitting endpoints or credentials", () => {
    const receipt = beginTurnLifecycle("test-12345678", 508);
    recordDraftFailure(receipt, 1, "validation", new Error("Missing saved destination"));
    recordDraftFailure(receipt, 2, "provider", new Error("Failed https://example.test?key=secret Bearer secret-token"));
    const failed = failTurnLifecycle(receipt, "drafting-exhausted", "Retry preserved action", 503);
    expect(failed.draftFailures).toHaveLength(2);
    expect(failed.draftFailures?.[0].reason).toBe("Missing saved destination");
    expect(JSON.stringify(failed.draftFailures)).not.toContain("secret");
    expect(failed.gameplayAdvanced).toBe(false);
  });
  it("produces an exact committed receipt", () => {
    const receipt = beginTurnLifecycle("turn-12345678", 410, "2026-10-12T10:00:00.000Z");
    advanceTurnLifecycle(receipt, "validate-draft", 2);
    expect(commitTurnLifecycle(receipt, 411, "2026-10-12T10:00:05.000Z")).toEqual({
      turnId: "turn-12345678",
      baseRevision: 410,
      status: "committed",
      phase: "committed",
      draftAttempts: 2,
      startedAt: "2026-10-12T10:00:00.000Z",
      completedAt: "2026-10-12T10:00:05.000Z",
      committedRevision: 411,
      gameplayAdvanced: true,
      retriable: false,
    });
  });

  it("marks server failures as safe to retry without claiming advancement", () => {
    const receipt = beginTurnLifecycle("turn-12345678", 410, "2026-10-12T10:00:00.000Z");
    const failed = failTurnLifecycle(receipt, "drafting-exhausted", "provider failed", 503, "2026-10-12T10:00:05.000Z");
    const error = Object.assign(new Error("provider failed"), { turnLifecycle: failed });
    expect(turnLifecycleFromError(error)).toMatchObject({
      status: "failed",
      phase: "drafting-exhausted",
      gameplayAdvanced: false,
      retriable: true,
      reason: "provider failed",
    });
  });
});
