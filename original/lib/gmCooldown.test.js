import { describe, it, expect } from "vitest";
import { nextTurnRetry, parsePendingTurn, turnStorageKey } from "./gmCooldown";
describe("recoverable GM cooldown", () => {
  it("uses provider Retry-After and delays the exact pending action", () => {
    expect(nextTurnRetry(429, {retryAfterSeconds:23}, new Headers({"Retry-After":"23"}),0,1000)).toMatchObject({retryAt:24000,seconds:23});
  });
  it("labels locally estimated provider cooldowns rather than asserting an exact reset", () => {
    const retry = nextTurnRetry(429, {retryAfterSeconds:60,retryAfterEstimated:true}, new Headers({"Retry-After":"60","X-GOC-Retry-Estimated":"true"}),0,1000);
    expect(retry).toMatchObject({seconds:60,estimated:true});
  });
  it("retries transient faults with bounded backoff, but not unsafe failures", () => {
    expect(nextTurnRetry(503, {}, new Headers(), 3,1000)?.seconds).toBe(40);
    expect(nextTurnRetry(400,{},new Headers())).toBeNull();
    expect(nextTurnRetry(409,{},new Headers())).toBeNull();
  });
  it("preserves original turn identity and refuses stale revision", () => {
    const value=JSON.stringify({turnId:"fixed-turn-123",action:"Ask the tailor",revision:7,retryAt:1234});
    expect(parsePendingTurn(value,7,[])).toMatchObject({action:"Ask the tailor",turnId:"fixed-turn-123",changed:false});
    expect(parsePendingTurn(value,8,[]).changed).toBe(true);
    expect(parsePendingTurn(value,7,[{role:"assistant",turnId:"fixed-turn-123"}])).toEqual({committed:true});
    expect(turnStorageKey("fixture")).toBe("gc_pending_turn:fixture");
  });
});
