import { expect, it } from "vitest";
import { applyResidenceRest } from "./saga-recovery";
import type { DatapadSnapshot } from "./datapad-save";
const save = () => ({character:{name:"Test",level:2,experience:1000,classLevels:{soldier:2},maxHitPoints:40},gameState:{health:30,conditionTrack:2,campaignTimeMinutes:0,location:"Unit A",properties:[{id:"home-a",name:"Unit A",type:"lease",location:"Unit A"}]},messages:[],comms:[],settings:{}}) as DatapadSnapshot;
it("heals level HP once per 24 hours and clears only nonpersistent conditions", () => {
 const first=applyResidenceRest(save(),"home-a"); expect(first.snapshot.gameState.health).toBe(32); expect(first.snapshot.gameState.conditionTrack).toBe(0);
 const second=applyResidenceRest(first.snapshot,"home-a"); expect(second.healed).toBe(0);
 const third=applyResidenceRest(second.snapshot,"home-a"); expect(third.healed).toBe(0);
 const fourth=applyResidenceRest(third.snapshot,"home-a"); expect(fourth.healed).toBe(2);
});
it("never treats persistent causes or grants facilities", () => {
 const current=save(); current.gameState.persistentCondition=true;
 const result=applyResidenceRest(current,"home-a"); expect(result.healed).toBe(0); expect(result.snapshot.gameState.conditionTrack).toBe(2); expect(result.snapshot.gameState.properties).toEqual(current.gameState.properties);
});
it("requires the saved location and blocks active combat and pending advancement", () => {
 const current=save(); current.gameState.location="Away"; expect(()=>applyResidenceRest(current,"home-a")).toThrow(/residence/);
 current.gameState.location="Unit A"; current.gameState.combat={status:"active"}; expect(()=>applyResidenceRest(current,"home-a")).toThrow(/threat/);
 current.character!.experience=3000; expect(()=>applyResidenceRest(current,"home-a")).toThrow(/advancement|level/i);
});
