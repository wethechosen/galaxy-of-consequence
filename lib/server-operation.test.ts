import { afterEach, describe, expect, it, vi } from "vitest";
import * as accounts from "./accounts";
import { campaignTarget, committedOperation, operationIdentity } from "./server-operation";

afterEach(() => vi.restoreAllMocks());
describe("durable operation identity and campaign ownership", () => {
  const actor = { id: "player-a", username: "a", displayName: "A", role: "player" as const };
  it("authorizes the target before any hosted lookup, including an admin's selected character", () => {
    const list = vi.spyOn(accounts, "listAccounts").mockReturnValue([actor]);
    expect(campaignTarget(actor, null)).toEqual(actor);
    expect(() => campaignTarget(actor, "player-b")).toThrow(/own campaign/);
    expect(list).not.toHaveBeenCalled();
    expect(campaignTarget({ ...actor, id: "operator", role: "admin" }, actor.id)).toEqual(actor);
  });
  it.each(["marketTransactions", "advancementHistory"] as const)("replays %s before revision validation but rejects changed choices", field => {
    const identity = operationIdentity("stable-request-1", "advancement", { classId: "scoundrel", trainedSkillIds: ["stealth"] });
    const reordered = operationIdentity("stable-request-1", "advancement", { trainedSkillIds: ["stealth"], classId: "scoundrel" });
    expect(reordered).toEqual(identity);
    const snapshot = { character: {}, gameState: { [field]: [{ advancementId: identity.id, requestFingerprint: identity.fingerprint }] }, messages: [], comms: [], settings: {} };
    expect(committedOperation(snapshot, field, identity)).toBe(true);
    expect(committedOperation(snapshot, field, operationIdentity("different-id", "advancement", {}))).toBe(false);
    expect(() => committedOperation(snapshot, field, operationIdentity(identity.id, "foundation", { classId: "soldier" }))).toThrow(/different choices/);
  });
  it("rejects missing IDs rather than applying an unrepeatable transaction", () => {
    expect(() => operationIdentity(undefined, "market", {})).toThrow(/identifier/);
  });
});
