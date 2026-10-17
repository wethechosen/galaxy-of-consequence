import {describe,it,expect} from "vitest";
import {npcDecisionProgressGuard,npcGoalProgressPlan,npcAdjudicationMismatch,npcIsAdministrativeAction} from "./npc-progress-guard";
const gm="## LOCATION\nArchive\n## SCENE\nYou speak.\n## GAMEPLAY RESULT\nThe clerk denies access and directs you to the public research desk on Level Two.\n## SAGA CHECK\nNo check required.\n## STATE UPDATE\nNo change.";
describe("NPC long-goal play is not an endless forms queue",()=>{
 it("recognizes repeating the same clerk request after a refusal",()=>{
   const actions=["I ask the clerk for approval to access the archive.", "I request Form 7-B for clearance from the clerk.", "I ask the clerk for approval to access the archive.", "I request approval to access the records."];
   const s=npcDecisionProgressGuard(actions,gm,"I ask the clerk for approval to access the archive.");
   expect(s.administrativeLoop).toBe(true);
   expect(s.repeated).toBe(true);
   expect(s.mustRegenerate).toBe(true);
   expect(s.lastResolvedResult).toContain("public research desk on Level Two");
 });
 it("allows a consequential different choice after an obstruction",()=>{
   const actions=["I ask the clerk for archive access.","I ask the administrator for Form 7-B.", "I request official authorization from the desk."];
   const s=npcDecisionProgressGuard(actions,gm,"I follow the public path to the research desk on Level Two and study the accessible catalogue.");
   expect(s.administrativeLoop).toBe(false);
   expect(s.mustRegenerate).toBe(false);
   expect(npcIsAdministrativeAction("I climb to the shipboard navigation bridge.")).toBe(false);
 });
 it("classifies different full goals into actionable arcs without saying they are completed",()=>{
   const agreement=npcGoalProgressPlan("Reach a signed Hapan-CSA trade review",[{title:"Meet a negotiator",status:"completed"}]);
   expect(agreement.milestone).toBe("agreement");
   expect(agreement.nextStage).toContain("counteroffer");
   expect(agreement.completedSubgoals).toEqual(["Meet a negotiator"]);
   expect(agreement.winCondition).toContain("Reach a signed");
   expect(npcGoalProgressPlan("Secure a convoy and complete its voyage",[]).milestone).toBe("journey");
 });
 it("identifies the unrelated retail inspection receipts found in live NPC turns",()=>{
   const receipt="## GAMEPLAY RESULT\nYou examine the merchandise where it is offered, turning it under the available light to read its visible condition, seal, label, and expiration markings. It remains with its current owner.\n## STATE UPDATE\nNo changes.";
   expect(npcAdjudicationMismatch("I return to test plots at dawn to check germination, soil moisture, and seed condition.",receipt)).toMatch(/retail/);
   expect(npcAdjudicationMismatch("I access the public database on my datapad to check the prosthetic certificate number.",receipt)).toMatch(/retail/);
   expect(npcAdjudicationMismatch("I inspect the offered cargo container for damage.",receipt)).toBeNull();
 });
});
