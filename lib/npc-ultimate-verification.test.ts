import {describe,it,expect} from "vitest";
import {hasAuditedNpcUltimateCompletion,npcUltimateEvidenceDigest} from "./npc-ultimate-verification";

const goal="Have the dangerous public shelter wayfinding fault fixed or made safely inaccessible, and verify civilians can reach the shelter without entering restricted hangars.";
const id="npc-real-bren-varo-t007";
const base={
  gameState:{
    objectives:[{title:goal,status:"completed"}],
    turnEvents:[{turnId:id,action:"I follow the public shelter route",changes:{objectiveComplete:[goal]}}],
  },
  messages:[{role:"assistant",turnId:id,content:"## GAMEPLAY RESULT\nThe repaired civilian path leads to the shelter without entering Hangar 7-B."}],
};
const digest=npcUltimateEvidenceDigest(base,[id]);
const audit={status:"verified",goal,evidenceTurnIds:[id],evidenceDigest:digest,reviewer:"independent-review-v1"};
describe("long-term NPC goal completion audit",()=>{
  it("rejects GM premature completed flag without separate audit",()=>{
    expect(hasAuditedNpcUltimateCompletion(base,goal)).toBe(false);
  });
  it("rejects evidence IDs that are not committed or narrator text missing",()=>{
    expect(hasAuditedNpcUltimateCompletion({...base,gameState:{...base.gameState,npcUltimateAudit:{...audit,evidenceTurnIds:["npc-real-bren-varo-t999"]}}},goal)).toBe(false);
    expect(hasAuditedNpcUltimateCompletion({...base,messages:[],gameState:{...base.gameState,npcUltimateAudit:audit}},goal)).toBe(false);
  });
  it("accepts linked authoritative receipts only after a reviewed content-digest is saved",()=>{
    const verified={...base,gameState:{...base.gameState,npcUltimateAudit:audit}};
    expect(hasAuditedNpcUltimateCompletion(verified,goal)).toBe(true);
    expect(hasAuditedNpcUltimateCompletion(verified,"Another goal")).toBe(false);
    expect(hasAuditedNpcUltimateCompletion({...verified,messages:[{role:"assistant",turnId:id,content:"different result"}]},goal)).toBe(false);
  });
  it("rejects an unreviewed or unhashed ending",()=>{
    const withoutReviewer={...audit,reviewer:""};
    expect(hasAuditedNpcUltimateCompletion({...base,gameState:{...base.gameState,npcUltimateAudit:withoutReviewer}},goal)).toBe(false);
    expect(hasAuditedNpcUltimateCompletion({...base,gameState:{...base.gameState,npcUltimateAudit:{...audit,evidenceDigest:"pretend"}}},goal)).toBe(false);
  });
});
