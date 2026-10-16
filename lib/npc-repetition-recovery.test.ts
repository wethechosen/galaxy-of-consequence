import {it,expect} from "vitest";
import {npcRepetitionRecovery} from "./npc-repetition-recovery";
it("moves Orlan to the documented authorization annex instead of an identical clerk question",()=>{
 const actions=[
  "I ask the clerk for emergency ration logs.",
  "I ask the clerk if the logs can be accessed.",
  "I request the clerk tell me the required clearance.",
  "I ask the provisioning clerk which form to use.",
 ];
 const gm="The clerk says the Auditor's Annex, Tier-2, bay seven, will sponsor Form 7-B.";
 const action="I ask the clerk again how I can review the emergency ration requisition logs.";
 const fixed=npcRepetitionRecovery("orlan-vale",actions,gm,action);
 expect(fixed?.action).toMatch(/Auditor's Annex/);
 expect(fixed?.action).toMatch(/^I /);
 expect(fixed?.action).not.toMatch(/succeed|approved|obtained/);
});
it("redirects repeated crystal-rack examination only after a documented clue",()=>{
 const actions=["I inspect the empty crystal rack.","I search the crystal rack and slot again."];
 const gm="Bootprints lead to a misaligned maintenance access panel behind the rack.";
 const action="I inspect the rack again for traces.";
 const fixed=npcRepetitionRecovery("rena-salvek",actions,gm,action);
 expect(fixed?.action).toMatch(/training master/);
 expect(fixed?.action).toMatch(/request permission/);
});
it("does not invent access or leads when no source supports a rescue",()=>{
 expect(npcRepetitionRecovery("orlan-vale",["I ask the clerk", "I ask the clerk","I ask the clerk"],
   "She declines with no location.", "I ask the clerk again.")).toBeNull();
 expect(npcRepetitionRecovery("jena-lorr",[], "", "I review the tariffs.")).toBeNull();
});