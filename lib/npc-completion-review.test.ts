import {describe,it,expect} from "vitest";
import {npcUltimateReviewCandidate,npcDeathReviewCandidate,npcIsAuditedDeath} from "./npc-completion-review";
import {npcUltimateEvidenceDigest} from "./npc-ultimate-verification";
const goal="Secure a lawful cargo charter and deliver the freighter to its verified destination.";
const t="npc-real-captain-test-t001";
const narr="## GAMEPLAY RESULT\nThe crew signs the contract and completes the documented passage.\n## SAGA CHECK\nNo roll required.";
const base={character:{name:"Test pilot",species:"Human",level:3},gameState:{objectives:[{title:goal,status:"completed"}],turnEvents:[{turnId:t,action:"I complete the voyage."}]},messages:[{role:"assistant",provider:"nvidia",model:"nemotron-gm",turnId:t,content:narr}]};
describe("independent evidence packets are not fake wins",()=>{
 it("queues a completed claimed goal with authentic committed NVIDIA receipts for review",()=>{
  const c=npcUltimateReviewCandidate(base,goal);
  expect(c?.status).toBe("independent_review_required");
  expect(c?.canReview).toBe(true);
  expect(c?.evidenceTurnIds).toEqual([t]);
  expect(c?.evidenceDigest).toBe(npcUltimateEvidenceDigest(base,[t]));
 });
 it("never treats an active goal or missing receipt as independently verified",()=>{
  expect(npcUltimateReviewCandidate({...base,gameState:{...base.gameState,objectives:[{title:goal,status:"active"}]}},goal)).toBeNull();
  const without={...base,messages:[{role:"assistant",provider:"local",turnId:t,content:narr}]};
  expect(npcUltimateReviewCandidate(without,goal)?.canReview).toBe(false);
 });
 it("recognizes a previously audited completion and does not duplicate the work",()=>{
  const audit={status:"verified",goal,reviewer:"independent-human-auditor",
   evidenceTurnIds:[t],evidenceDigest:npcUltimateEvidenceDigest(base,[t])};
  expect(npcUltimateReviewCandidate({...base,gameState:{...base.gameState,npcUltimateAudit:audit}},goal)).toBeNull();
 });
 it("rejects zero HP as a confirmed death and merely flags unsupported death claims",()=>{
  expect(npcDeathReviewCandidate({...base,gameState:{...base.gameState,health:0}})).toBeNull();
  const death=npcDeathReviewCandidate({...base,gameState:{...base.gameState,lifeStatus:"dead"}});
  expect(death?.status).toBe("death_review_required");
  expect(death?.confirmedDeathEvidence).toBe(false);
  expect(npcIsAuditedDeath({...base,gameState:{...base.gameState,lifeStatus:"dead"}})).toBe(false);
 });
 it("requires a real committed GM death ruling plus separate authenticated review",()=>{
  const deathText="## GAMEPLAY RESULT\nThe character dies from the final injury and is confirmed dead.\n## SAGA CHECK\nThe death is resolved.";
  const deceased={...base,gameState:{...base.gameState,lifeStatus:"dead"},messages:[{role:"assistant",provider:"nvidia",model:"nemotron-gm",turnId:t,content:deathText}]};
  const audit={status:"verified",reviewer:"independent-death-auditor",evidenceTurnIds:[t],evidenceDigest:npcUltimateEvidenceDigest(deceased,[t])};
  expect(npcIsAuditedDeath({...deceased,gameState:{...deceased.gameState,npcDeathAudit:audit}})).toBe(true);
  const falsified={...base,gameState:{...base.gameState,lifeStatus:"dead",npcDeathAudit:{...audit,evidenceDigest:npcUltimateEvidenceDigest(base,[t])}}};
  expect(npcIsAuditedDeath(falsified)).toBe(false);
 });
});
