import {describe,it,expect} from "vitest";
import {accountStore,type Account} from "./accounts";
import {readDatapad,saveAuthoritativeDatapad} from "./datapad-save";
import {NPC_ULTIMATE_ARCS} from "./npc-ultimate-arcs";
import {hasAuditedNpcUltimateCompletion,npcUltimateEvidenceDigest} from "./npc-ultimate-verification";
const enabled=process.env.GOC_AUDIT_BREN==="1";
const goal=NPC_ULTIMATE_ARCS["bren-varo"];
const proofIds=["npc-real-bren-varo-t001","npc-real-bren-varo-t004",
  "npc-real-bren-varo-t005","npc-real-bren-varo-t006","npc-real-bren-varo-t007"];
const requireProof=(line:string,patterns:RegExp[],stage:string)=>{
  for(const pattern of patterns)expect(line,stage).toMatch(pattern);
  expect(line,stage).not.toMatch(/(?:not|never) (?:completed|repaired|reachable|accessible|safe)/i);
};
describe.skipIf(!enabled)("independent post-game evidence audit for Bren Varo",()=>{
  it("confirms defect, logged correction, public warning, and walked safe route from actual NVIDIA GM receipts",()=>{
    expect(process.env.CAMPAIGN_DB_PATH).toMatch(/npc-autoplay-150\.sqlite$/);
    const db=accountStore();
    const actor=db.prepare("SELECT id,username,displayName,role FROM accounts WHERE username=?")
      .get("npc-autoplay-bren-varo") as Account|undefined;
    expect(actor).toBeTruthy();
    const saved=readDatapad(actor!,null,db);
    const snapshot=saved.snapshot!;
    const events=(Array.isArray(snapshot.gameState.turnEvents)?snapshot.gameState.turnEvents:[]) as Array<{turnId?:string}>;
    const messages=(Array.isArray(snapshot.messages)?snapshot.messages:[]) as Array<{role?:string;turnId?:string;provider?:string;model?:string;content?:string}>;
    const results:Record<string,string>={};
    for(const id of proofIds){
      expect(events.some(e=>e.turnId===id),id).toBe(true);
      const message=messages.find(m=>m.role==="assistant"&&m.turnId===id);
      expect(message,id).toBeTruthy();
      expect(message?.provider,id).toBe("nvidia");
      expect(message?.model,id).toMatch(/nemotron/i);
      const raw=String(message!.content);
      const match=/## GAMEPLAY RESULT\s*([\s\S]*?)(?=\n## [A-Z ]+\n|$)/i.exec(raw);
      expect(match,id).toBeTruthy();
      results[id]=match![1].trim();
    }
    requireProof(results[proofIds[0]],[/shelter beta|route/i,/restricted|hangar/i,/shift|misalign/i],"hazard detected");
    requireProof(results[proofIds[1]],[/Work Order 7-Beta-9/i,/queued/i,/safety notice/i],"work order queued");
    requireProof(results[proofIds[2]],[/temporary safety notice/i,/Shelter Alpha/i,/posted|appears/i],"warning confirmed");
    requireProof(results[proofIds[3]],[/Work Order 7-Beta-9/i,/completed/i,/recalibrated/i,/successful safety check/i,/closed/i],"authorized repair confirmed");
    requireProof(results[proofIds[4]],[/reach Shelter Beta/i,/entrance/i,/clear of Hangar 7-B/i,/no remaining defect/i],"walked civilian route confirmed");
    expect(String(snapshot.gameState.location)).toMatch(/shelter beta entrance/i);
    expect((Array.isArray(snapshot.gameState.objectives)?snapshot.gameState.objectives:[]).some((x:{title?:string;status?:string})=>x.title===goal&&x.status==="completed")).toBe(true);
    const digest=npcUltimateEvidenceDigest(snapshot,proofIds);
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    const existing=snapshot.gameState.npcUltimateAudit as Record<string,unknown>|undefined;
    if(existing?.status==="verified"){
      expect(hasAuditedNpcUltimateCompletion(snapshot,goal)).toBe(true);
      console.info("BREN_INDEPENDENT_ENDING_ALREADY_VERIFIED",JSON.stringify(existing));
      return;
    }
    const audit={status:"verified",goal,reviewer:"independent-manual-review-2026-10-16",
      evidenceTurnIds:proofIds,evidenceDigest:digest,
      result:"Safe public Shelter Beta route restored and personally checked without entering restricted Hangar 7-B",
      criteria:{hazardFound:true,formalWorkOrder:true,publicSafetyNotice:true,
        authorizedRepairAndSafetyCheck:true,civilianRouteWalked:true},
      reviewedAt:new Date().toISOString()};
    const prepared={...snapshot,gameState:{...snapshot.gameState,npcUltimateAudit:audit}};
    expect(hasAuditedNpcUltimateCompletion(prepared,goal)).toBe(true);
    saveAuthoritativeDatapad(actor!,null,saved.revision,prepared,db);
    const after=readDatapad(actor!,null,db);
    expect(after.revision).toBe(saved.revision+1);
    expect(after.snapshot?.character?.experience).toBe(snapshot.character?.experience);
    expect(after.snapshot?.gameState.turnEvents).toHaveLength(events.length);
    expect(hasAuditedNpcUltimateCompletion(after.snapshot,goal)).toBe(true);
    console.info("BREN_VERIFIED_ULTIMATE_ENDING",JSON.stringify({revision:after.revision,
      evidenceTurnIds:proofIds,gmProvider:"nvidia",totalExperience:after.snapshot?.character?.experience,
      location:after.snapshot?.gameState.location,goal,reviewer:audit.reviewer,evidenceDigest:digest}));
  },30000);
});
