import {describe,expect,it} from "vitest";
import {GOC_FACTIONS_150_ABY,GOC_FACTION_BY_ID,GOC_FACTION_MEMBERS,GOC_HIDDEN_FACTION_LINKS,publicFactionAtlas} from "./faction-canon-150aby";
import {GOC_NPC_INDEX_150_ABY} from "./npc-canonical-index";
import {factionPlanPreview,factionStrategicOverview,factionGmContext} from "./faction-strategy-150aby";
describe("GOC power blocs in 150 ABY",()=>{
 it("establishes 27 internally coherent distinct institutions and 54 role-appropriate people",()=>{
   expect(GOC_FACTIONS_150_ABY).toHaveLength(27);
   expect(new Set(GOC_FACTIONS_150_ABY.map(f=>f.id)).size).toBe(27);
   expect(GOC_FACTION_MEMBERS).toHaveLength(54);
   expect(new Set(GOC_FACTION_MEMBERS.map(m=>m.personId))).toEqual(new Set(GOC_NPC_INDEX_150_ABY.map(n=>n.id)));
   for(const f of GOC_FACTIONS_150_ABY){
     expect(f.mandate.length,f.id).toBeGreaterThan(25);
     expect(f.institutionalBranches.length,f.id).toBeGreaterThan(0);
     expect(f.objectives.length,f.id).toBeGreaterThan(0);
     expect(f.world).toBe("150 ABY");
     expect(f.leaderRule.length,f.id).toBeGreaterThan(12);
     expect(f.strengths).toEqual(expect.objectContaining({military:expect.any(Number),economic:expect.any(Number)}));
     if(f.parentId)expect(GOC_FACTION_BY_ID.has(f.parentId),f.id).toBe(true);
     for(const r of f.relations){
       expect(GOC_FACTION_BY_ID.has(r.id),f.id+" -> "+r.id).toBe(true);
       expect(r.id).not.toBe(f.id);
     }
     for(const g of f.objectives){
       expect(g.durationMinutes,f.id+":"+g.id).toBeGreaterThan(0);
       expect(f.strengths[g.requiredCapacity],f.id).toBeGreaterThan(0);
       expect(g.stakes.length).toBeGreaterThan(5);
     }
   }
 });
 it("preserves the 138 ABY Triumvirate, independent Knights and an unappointed Hapan successor",()=>{
   expect(GOC_FACTION_BY_ID.get("galactic-triumvirate")?.historicalFoundation).toMatch(/138 ABY/);
   expect(GOC_FACTION_BY_ID.get("imperial-knights")?.securityDoctrine).toMatch(/Saga/);
   expect(GOC_FACTION_BY_ID.get("fel-empire")?.leaderRule).toMatch(/succession/);
   expect(GOC_FACTION_BY_ID.get("hapes-consortium")?.leaderRule).toMatch(/Queen Mother/);
   expect(GOC_FACTION_BY_ID.get("sith-traditionalists")?.mandate).toMatch(/Sith/);
   expect(GOC_FACTION_MEMBERS.find(x=>x.personId==="jaed-sultar")?.factionId).toBe("imperial-knights");
   expect(GOC_FACTION_MEMBERS.find(x=>x.personId==="korvalis")).toBeUndefined();
   expect(GOC_FACTION_MEMBERS.find(x=>x.personId==="darth-korvalis")?.factionId).toBe("sith-traditionalists");
   expect(GOC_FACTION_MEMBERS.find(x=>x.personId==="maera-holloran")?.standing).toBe("historic");
   expect(GOC_HIDDEN_FACTION_LINKS).toContainEqual(expect.objectContaining({personId:"seralyth-vhaelor",factionId:"sith-traditionalists"}));
 });
 it("public atlas excludes secret factions, internal pressure, secret appointments and hidden links",()=>{
   const publicView=publicFactionAtlas();
   expect(publicView.length).toBeLessThan(27);
   const exposed=JSON.stringify(publicView).toLowerCase();
   for(const name of ["xiii","korvalis","seralyth","kelvek","maera","murkhana","secret apprentice","private training","house vhaelor"])
     expect(exposed,name).not.toContain(name);
   expect(publicView.some(f=>f.id==="fel-empire")).toBe(true);
   expect(publicView.some(f=>f.id==="hapes-consortium")).toBe(true);
   expect(publicView.some(f=>f.id==="black-sun")).toBe(true);
   expect(publicView.some(f=>f.id==="sith-traditionalists")).toBe(false);
   expect(JSON.stringify(publicView)).not.toContain("internalPressure");
   expect(JSON.stringify(publicView)).not.toContain("confidential");
 });
 it("faction planning advances on authoritative fictional time without producing outcomes",()=>{
   const f=GOC_FACTION_BY_ID.get("hapes-consortium")!;
   const t1=factionPlanPreview(f,123);
   const t2=factionPlanPreview(f,3000);
   const future=factionPlanPreview(f,10500);
   expect(t1.id).toBe(t2.id);
   expect(future.id).not.toBe(t1.id);
   expect(t1.resolution).toBe("unadjudicated");
   expect(t1.phase).toBe("preparing");
   expect(t2.phase).toBe("preparing");
   expect(future.scenarioCycle).toBe(1);
   const original=Object.freeze({gameState:{campaignTimeMinutes:15000,location:"Bonadan",turnEvents:[]}});
   expect(factionStrategicOverview(original)).toHaveLength(27);
   expect(original.gameState.turnEvents).toEqual([]);
 });
 it("never pulls a secret faction into an unrelated shop enquiry; GM context is scoped",()=>{
   const snapshot={gameState:{campaignTimeMinutes:1440,location:"Bonadan",turnEvents:[],contacts:[],relationships:[],sceneNpcs:[]}};
   const unrelated=factionGmContext(snapshot,"I ask the tailor whether the shop opens tomorrow");
   expect(unrelated.factions).toEqual([]);
   expect(unrelated.proposals).toEqual([]);
   const knight=factionGmContext(snapshot,"What is the current training discipline of the Imperial Knights?");
   expect(knight.factions.some(x=>x.id==="imperial-knights")).toBe(true);
   const secret=factionGmContext(snapshot,"What does XIII have to do with IGFED?");
   expect(secret.factions.some(x=>x.id==="xiii")).toBe(true);
   expect(secret.contract).toMatch(/never introduce XIII/i);
   expect(snapshot.gameState.turnEvents).toHaveLength(0);
 });
});
