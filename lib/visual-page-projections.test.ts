import { describe, expect, it } from "vitest";
import { playerKnownContacts, playerVisibleChronology, playerVisibleIntel } from "./visual-page-projections";

describe("existing-page projections are player-safe", () => {
  it("never exposes an NPC private agenda, memories, or undiscovered contacts", () => {
    const contacts = [
      { id:"a", name:"Known ally", description:"Spoken with", observedAttitude:"guarded", knownObligations:["favor owed"], companion:false, playerKnown:true, privateGoal:"secret", knowledge:["hidden"], memories:["restricted"] },
      { id:"b", name:"Unknown rival", description:"unknown", observedAttitude:"hostile", knownObligations:[], companion:false, playerKnown:false, privateGoal:"attack", knowledge:[], memories:[] },
    ];
    const result=playerKnownContacts(contacts);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Known ally");
    expect(JSON.stringify(result)).not.toMatch(/secret|attack|restricted/);
  });
  it("omits lore that is not yet visible to player", () => {
    const facts = [
      { id:"1", label:"Black Sun", detail:"Known encounter", playerVisible:true, source:"turn", classification:"campaign_event" as const, verified:true },
      { id:"2", label:"Black Sun", detail:"Hidden plan", playerVisible:false, source:"private", classification:"campaign_event" as const, verified:true },
    ];
    expect(playerVisibleIntel(facts,/black sun/i)).toHaveLength(1);
  });
  it("orders only committed player-visible history without mutating source", () => {
    const events = [
      { id:"1", kind:"scene" as const, summary:"Earlier", createdAt:"2026-10-01T00:00:00Z", playerVisible:true },
      { id:"2", kind:"state_update" as const, summary:"Private", createdAt:"2026-10-03T00:00:00Z", playerVisible:false },
      { id:"3", kind:"checkpoint" as const, summary:"Later", createdAt:"2026-10-02T00:00:00Z", playerVisible:true },
    ];
    expect(playerVisibleChronology(events).map(e=>e.id)).toEqual(["3","1"]);
    expect(events[0].id).toBe("1");
  });
});
