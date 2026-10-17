import { describe, expect, it } from "vitest";
import { NvidiaProviderError } from "./nvidia-errors";
import { gptTurnRetryPlan } from "./gpt-turn-retry";

describe("Custom GPT provider retry receipt", () => {
  it("returns original turn id, base revision and a trusted timestamp", () => {
    const p=gptTurnRetryPlan(new NvidiaProviderError("Cooling down",429,23,429,false),429,"test-turn-123",7,null,1000);
    expect(p).toMatchObject({turnId:"test-turn-123",baseRevision:7,retryAfterSeconds:23,estimated:false,gameplayAdvanced:false,status:"awaiting_retry"});
    expect(p?.retryAt).toBe("1970-01-01T00:00:24.000Z");
  });
  it("does not pretend an unspecified provider reset is exact", () => {
    const p=gptTurnRetryPlan(new NvidiaProviderError("Rate budget",429,60,429,true),429,"test-turn-456",2,null,1000);
    expect(p?.estimated).toBe(true);
  });
  it("never retries 409s, authorization failures or irreversible receipts", () => {
    const error=new Error("Conflict");
    expect(gptTurnRetryPlan(error,409,"test-turn-123",1,null)).toBeNull();
    expect(gptTurnRetryPlan(error,401,"test-turn-123",1,null)).toBeNull();
    expect(gptTurnRetryPlan(error,503,"test-turn-123",1,{gameplayAdvanced:true,retriable:true})).toBeNull();
    expect(gptTurnRetryPlan(error,503,"test-turn-123",1,{gameplayAdvanced:false,retriable:false})).toBeNull();
    expect(gptTurnRetryPlan(error,503,"test-turn-123",1,{gameplayAdvanced:false,retriable:true},1000)).toMatchObject({retryAfterSeconds:15,estimated:true});
  });
});
