import {describe,it,expect} from "vitest";
import {JEDI_LEGENDS_HISTORY,JEDI_LEGENDS_PEOPLE,JEDI_OFFICES_150,JEDI_SITES_150,JEDI_FIELD_MANDATES_150,JEDI_EXISTING_GOC_PEOPLE,jediInstitution150,publicJediInstitution150} from "./jedi-order-150aby";
import {GOC_FACTION_BY_ID,GOC_FACTION_MEMBERS} from "./faction-canon-150aby";
import {factionGmContext,factionPlanPreview} from "./faction-strategy-150aby";
describe("post-Krayt Jedi Order 150 ABY continuity",()=>{
 it("fixes historical Jedi restoration, casualty, and Triumvirate facts",()=>{
   expect(JEDI_LEGENDS_HISTORY).toHaveLength(6);
   const events=JEDI_LEGENDS_HISTORY.map(e=>e.event).join(" ");
   expect(events).toMatch(/Ossus/i);
   expect(events).toMatch(/Taivas/i);
   expect(events).toMatch(/Coruscant/i);
   expect(events).toMatch(/Triumvirate/i);
   expect(events).toMatch(/Wredd/i);
   expect(JEDI_LEGENDS_HISTORY.every(e=>e.yearABY<=139)).toBe(true);
   const dead=JEDI_LEGENDS_PEOPLE.filter(n=>n.status150==="historical-deceased");
   expect(dead.map(n=>n.name)).toEqual(expect.arrayContaining(["T'ra Saa","Wolf Sazen","Kol Skywalker"]));
   expect(JEDI_LEGENDS_PEOPLE.find(n=>n.name==="K'Kruhk")?.status150).toBe("last-seen-unknown");
   expect(JEDI_LEGENDS_PEOPLE.find(n=>n.name==="Cade Skywalker")?.status150).toBe("independent-last-seen");
 });
 it("treats Jedi as restored cofounder and NOT a vassal of the Fel Empire",()=>{
   const o=GOC_FACTION_BY_ID.get("new-jedi-order")!;
   expect(o.parentId).toBeNull();
   expect(o.government).toMatch(/High Council/);
   expect(o.historicalFoundation).toMatch(/138 ABY/);
   expect(o.historicalFoundation).toMatch(/reclaimed/i);
   expect(o.publicStanding).toMatch(/restored/i);
   expect(o.headquarters).toMatch(/Coruscant/);
   expect(o.relations.some(r=>r.id==="galactic-triumvirate")).toBe(true);
 });
 it("provides durable Council branches, archives, hospitals and instruction without inventing leadership",()=>{
   const x=jediInstitution150();
   expect(x.grandMaster150).toBeNull();
   expect(x.certifiedOrderSize150).toBeNull();
   expect(JEDI_OFFICES_150).toHaveLength(7);
   expect(JEDI_SITES_150).toHaveLength(4);
   expect(JEDI_FIELD_MANDATES_150).toHaveLength(6);
   expect(JEDI_OFFICES_150.every(o=>o.leaderId===null)).toBe(true);
   expect(JEDI_FIELD_MANDATES_150.every(m=>m.durationMinutes>0&&m.ethicalBoundary.length>20&&m.sourceRequirements.length>1)).toBe(true);
   const temple=JEDI_SITES_150.find(s=>s.id==="coruscant")!;
   expect(temple.state150).toBe("reclaimed");
   expect(temple.authority).toBe("legends-established");
   expect(JEDI_SITES_150.find(s=>s.id==="ossus")?.state150).toBe("recovering");
   expect(JEDI_SITES_150.find(s=>s.id==="dantooine")?.state150).toBe("liaison-only");
   expect(JEDI_SITES_150.find(s=>s.id==="taivas")?.state150).toBe("destroyed-historical");
 });
 it("retains original four NPCs with no invented Council title or new Force power",()=>{
   expect(JEDI_EXISTING_GOC_PEOPLE.map(x=>x.id).sort()).toEqual(["akkan-vuu","kala-morrin","shado-liang","tarvyn-dree"].sort());
   for(const n of JEDI_EXISTING_GOC_PEOPLE){
      expect(GOC_FACTION_MEMBERS.find(m=>m.personId===n.id)?.factionId).toBe("new-jedi-order");
      expect(n.status150).toBe("active-goc");
      expect(n.notes.length).toBeGreaterThan(25);
   }
   const projection=factionPlanPreview(GOC_FACTION_BY_ID.get("new-jedi-order")!,25920);
   expect(projection.resolution).toBe("unadjudicated");
 });
 it("does not leak GM mandates or make the Jedi omniscient to unrelated actions",()=>{
   const publicView=publicJediInstitution150();
   const serialized=JSON.stringify(publicView).toLowerCase();
   expect(serialized).not.toContain("korvalis");
   expect(serialized).not.toContain("xiii");
   expect(serialized).not.toContain("d'mir");
   expect(publicView).not.toHaveProperty("security");
   expect(publicView).not.toHaveProperty("grandMaster150");
   expect(publicView.sites.find(s=>s.id==="coruscant")?.state150).toBe("reclaimed");
   const snapshot={gameState:{campaignTimeMinutes:4320,location:"Nuvorren",turnEvents:[],sceneNpcs:[]}};
   expect(factionGmContext(snapshot,"When can I arrange an appointment with the tailor?").jediRecovery).toBeNull();
   const relevant=factionGmContext(snapshot,"Who governs the New Jedi Order?",2);
   expect(relevant.factions.some(f=>f.id==="new-jedi-order")).toBe(true);
   expect(relevant.jediRecovery?.departmentMandates.length).toBe(7);
   expect(snapshot.gameState.turnEvents).toHaveLength(0);
 });
 it("records the Imperial Knights' 139 ABY reform direction without treating announcement as fully enacted",()=>{
   const knights=GOC_FACTION_BY_ID.get("imperial-knights")!;
   expect(knights.historicalFoundation).toMatch(/139 ABY/);
   expect(knights.historicalFoundation).toMatch(/announced/);
   expect(knights.leaderRule).toMatch(/150 ABY/);
   expect(knights.securityDoctrine).toMatch(/light.side/i);
 });
});
