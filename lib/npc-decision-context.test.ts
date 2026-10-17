import {describe,it,expect} from "vitest";
import {npcDecisionHistory,npcGameplayResult,npcAdministrativeLoopHint} from "./npc-decision-context";
const gm=[
"## LOCATION\nOssus archive",
"## SCENE\n"+("The receptionist examines the request without issuing credentials. ".repeat(28)),
"## GM ADJUDICATION\nThe applicant does not possess restricted access.",
"## GAMEPLAY RESULT\nThe clerk refuses archive access and directs the investigator to the public research desk on Level Two.",
"## SAGA CHECK\nNo check required.",
"## STATE UPDATE\nNo authorization, XP, or inventory change.",
"## PLAYER OPTIONS\nA. Follow the public desk lead.\nB. Leave.",
].join("\n\n");
describe("NPC decision grounding from authoritative GM receipts",()=>{
 it("extracts the actual result even when it begins after character 1100",()=>{
   expect(gm.indexOf("GAMEPLAY RESULT")).toBeGreaterThan(1100);
   expect(npcGameplayResult(gm)).toContain("public research desk on Level Two");
   const history=npcDecisionHistory([{role:"user",content:"I ask for access."},{role:"assistant",content:gm}]);
   expect(history[1].content).toContain("ACTUAL GM GAMEPLAY RESULT");
   expect(history[1].content).toContain("refuses archive access");
   expect(history[1].content).toContain("No authorization, XP, or inventory change");
   expect(history[1].content).not.toContain("The receptionist examines");
 });
 it("flags three administrative inquiries without inventing an outcome",()=>{
   const actions=["I ask the clerk for access.","I request the form at the desk.","I ask the administrator for approval."];
   const hint=npcAdministrativeLoopHint(actions,gm);
   expect(hint).toContain("LOOP WARNING");
   expect(hint).toContain("public research desk on Level Two");
   expect(hint).toContain("Do not assume authorization");
 });
 it("does not flag legitimate distinct exploration or empty history",()=>{
   expect(npcAdministrativeLoopHint(["I explore the canyon.","I defend the settlers.","I question the scout."],gm)).toBeNull();
   expect(npcDecisionHistory([])).toEqual([]);
   expect(npcGameplayResult("No structured outcome")).toBe("");
 });
});
