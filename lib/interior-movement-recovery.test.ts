import {describe,expect,it} from "vitest";
import {planInteriorMovement,recoverInteriorMovement} from "./interior-movement-recovery";
import {parseEngineResponse} from "@/original/lib/engineState";
import {assertCampaignResponseStructure,assertNoProgressLoop,assertNarratedLocation,assertMovementSceneProgress,assertMaterialAuthority,assertNarrativeLedgerConsistency} from "./gm";

const here="Bonadan — Nuvorren Design House, rear workroom";
const action="A. Return to the front counter and speak directly with the clerk about commissions.";

describe("GM interior movement fallback",()=>{
  it("recovers the actual stranded Bonadan declaration without altering the player intent",()=>{
    const plan=planInteriorMovement(action,here);
    expect(plan).toMatchObject({location:"Bonadan — Nuvorren Design House, front counter",destination:"front counter",discussesCommission:true});
    const r=recoverInteriorMovement(plan!);
    const parsed=parseEngineResponse(r.content,{requireState:true});
    const delta=parsed.delta as unknown as Record<string,unknown>;
    expect(delta.location).toBe(plan!.location);
    expect(delta.discoveryAdd).toEqual([expect.objectContaining({title:"Nuvorren commission intake"})]);
    expect(parsed.clean).not.toMatch(/has been booked|payment complete|security bypassed/i);
    expect(()=>assertCampaignResponseStructure(parsed.clean)).not.toThrow();
    expect(()=>assertNarratedLocation(parsed.clean,delta,here)).not.toThrow();
    expect(()=>assertNoProgressLoop(parsed.clean,action,delta,here,"The clerk refused again.")).not.toThrow();
    expect(()=>assertMovementSceneProgress(parsed.clean,action,null,delta,here)).not.toThrow();
    expect(()=>assertMaterialAuthority(delta,action,null,{credits:628650006})).not.toThrow();
    expect(()=>assertNarrativeLedgerConsistency(parsed.clean,delta,action)).not.toThrow();
  });
  it("does not invent a consultation when only movement is declared",()=>{
    const plan=planInteriorMovement("I walk from the rear workroom to the showroom",here);
    expect(plan?.discussesCommission).toBe(false);
    const r=recoverInteriorMovement(plan!);
    expect(r.delta).toEqual({location:"Bonadan — Nuvorren Design House, showroom"});
    expect(r.content).toContain("accessible interior movement is complete");
  });
  it("will not bypass boundaries, act on negated movement or teleport between places",()=>{
    expect(planInteriorMovement("I do not return to the front counter",here)).toBe(null);
    expect(planInteriorMovement("I return to the front counter", "Bonadan — Nuvorren Design House, front counter")).toBe(null);
    expect(planInteriorMovement("I break into the locked rear workroom", "Bonadan — Nuvorren Design House, front counter")).toBe(null);
    expect(planInteriorMovement("I head to the front counter", "Bonadan — secured vault")).toBe(null);
    expect(planInteriorMovement("I leave for Coruscant",here)).toBe(null);
    expect(planInteriorMovement("I ask the clerk to return to the front counter",here)).toBe(null);
  });
});
