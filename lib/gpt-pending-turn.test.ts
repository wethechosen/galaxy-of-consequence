import { afterEach, describe, expect, it, vi } from "vitest";
import { issuePendingTurnTicket, readPendingTurnTicket, pendingTurnStatus } from "./gpt-pending-turn";

afterEach(() => vi.unstubAllEnvs());
describe("authenticated and encrypted GPT pending turn", () => {
  const turn = { username: "fixture-account", revision: 31, action: "How do I schedule a commission tomorrow?", turnId: "appt-turn-001", retryAtMs: 120000, estimated: true };
  function ticket(now = 1000) {
    vi.stubEnv("GOC_GPT_ACTION_KEY", "test-only-0123456789abcdef0123456789abcdef");
    return issuePendingTurnTicket(turn, now);
  }
  it("restores the identical original declaration, turn ID and revision without plaintext disclosure", () => {
    const value = ticket();
    expect(value).not.toContain("schedule");
    expect(readPendingTurnTicket(value, turn.username, 1500)).toEqual(turn);
  });
  it("rejects a different account, tampering, expired ticket or missing key", () => {
    const value = ticket();
    expect(() => readPendingTurnTicket(value, "another-account", 1500)).toThrow(/Invalid/);
    expect(() => readPendingTurnTicket(value.slice(0,-1) + (value.endsWith("x")?"a":"x"),turn.username,1500)).toThrow(/Invalid/);
    expect(() => readPendingTurnTicket(value,turn.username, 1000+7*24*60*60*1000)).toThrow(/Invalid/);
    vi.stubEnv("GOC_GPT_ACTION_KEY","");
    expect(() => readPendingTurnTicket(value,turn.username,1500)).toThrow(/Invalid/);
  });
  it("shows a countdown without treating the action as gameplay", () => {
    expect(pendingTurnStatus(turn,2000)).toEqual({ status:"cooldown",turnId:turn.turnId,baseRevision:31,retryAt:"1970-01-01T00:02:00.000Z",secondsRemaining:118,estimated:true,gameplayAdvanced:false,canSubmit:false });
    expect(pendingTurnStatus(turn,121000)).toMatchObject({status:"ready",secondsRemaining:0,canSubmit:true,gameplayAdvanced:false});
  });
});
