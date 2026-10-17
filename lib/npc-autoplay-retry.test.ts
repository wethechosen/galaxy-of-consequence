import {describe,it,expect} from "vitest";
import {npcAutoplayConcurrency,shouldDeferNpcAutoplayFailure} from "./npc-autoplay-retry";
describe("recoverable NPC autoplay runner failures",()=>{
  it("never requests more than two simultaneous NVIDIA calls",()=>{
    expect(npcAutoplayConcurrency(15)).toBe(2);
    expect(npcAutoplayConcurrency(2)).toBe(2);
    expect(npcAutoplayConcurrency(1)).toBe(1);
    expect(npcAutoplayConcurrency(0)).toBe(1);
  });
  it("defers rate limits and transient gateway errors for the next round",()=>{
    expect(shouldDeferNpcAutoplayFailure({status:429,message:"NVIDIA rate limit reached"})).toBe(true);
    expect(shouldDeferNpcAutoplayFailure({status:503,message:"server busy"})).toBe(true);
    expect(shouldDeferNpcAutoplayFailure(new Error("NVIDIA request budget is cooling down"))).toBe(true);
  });
  it("does not silently defer save-consistency or other permanent bugs",()=>{
    expect(shouldDeferNpcAutoplayFailure(new Error("Save consistency error"))).toBe(false);
    expect(shouldDeferNpcAutoplayFailure({status:403,message:"forbidden"})).toBe(false);
  });
});
