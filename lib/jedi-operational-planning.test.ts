import {describe,it,expect} from "vitest";
import {jediMissionReviewAtMinute,jediInstitutionWorkload} from "./jedi-operational-planning";
describe("Jedi faction work without invented success",()=>{
 it("creates bounded proposals for six independent missions",()=>{
   const missions=jediMissionReviewAtMinute(200);
   expect(missions).toHaveLength(6);
   expect(new Set(missions.map(m=>m.id)).size).toBe(6);
   for(const m of missions){
    expect(m.status).toBe("awaiting-authorized-staffing");
    expect(m.effectsCommitted).toBe(false);
    expect(m.playerAware).toBe(false);
    expect(m.preconditions.length).toBeGreaterThan(3);
    expect(m.candidateStaff.every(x=>["kala-morrin","tarvyn-dree","shado-liang","akkan-vuu"].includes(x))).toBe(true);
    expect(m.site).not.toBe("taivas");
   }
 });
 it("derives review windows solely from the committed game clock",()=>{
   expect(jediMissionReviewAtMinute(0)).toEqual(jediMissionReviewAtMinute(300));
   expect(jediMissionReviewAtMinute(10080)[0].window).toBe(1);
   expect(jediMissionReviewAtMinute(-20)[0].window).toBe(0);
   expect(jediMissionReviewAtMinute(NaN)[0].window).toBe(0);
 });
 it("does not silently appoint a council, confer a rank or commit any operation",()=>{
   const report=jediInstitutionWorkload(123);
   expect(report.councilSeats).toHaveLength(7);
   expect(report.councilSeats.every(x=>x.leader===null)).toBe(true);
   expect(JSON.stringify(report)).not.toMatch(/completed-success|mission accomplished|deployed-victory/i);
 });
});
