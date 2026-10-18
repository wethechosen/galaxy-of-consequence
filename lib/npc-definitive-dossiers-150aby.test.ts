import {expect,it,describe} from "vitest";
import {allNpcDefinitiveDossiers150ABY,npcDefinitiveDossier150ABY} from "./npc-definitive-dossiers-150aby";
import {GOC_NPC_INDEX_150_ABY} from "./npc-canonical-index";
import {GOC_ORIGINS_150_ABY} from "./npc-origin-records-150aby";
import {experienceForLevel} from "@/original/lib/sagaAdvancement";
describe("every GOC 150 ABY character has a validated lifetime profile",()=>{
 it("covers all 54 unique person IDs with individually authored personal histories",()=>{
   const characters=allNpcDefinitiveDossiers150ABY();
   expect(characters).toHaveLength(54);
   expect(GOC_NPC_INDEX_150_ABY).toHaveLength(54);
   expect(GOC_ORIGINS_150_ABY).toHaveLength(54);
   expect(new Set(characters.map(x=>x.id)).size).toBe(54);
   for(const c of characters){
     expect(c.biography.length,c.id).toBeGreaterThan(110);
     expect(c.appearance.length,c.id).toBeGreaterThan(15);
     expect(c.personality.length,c.id).toBeGreaterThan(15);
     expect(c.importantRelationships.length,c.id).toBeGreaterThan(10);
     expect(c.flaw.length,c.id).toBeGreaterThan(12);
     expect(c.birthplace.length,c.id).toBeGreaterThan(2);
     expect(c.ageIn150,c.id).toBeGreaterThan(13);
     expect(c.ageIn150,c.id).toBeLessThan(100);
     expect(c.equipment.neverGrantAutomatically,c.id).toBe(true);
     expect(c.equipment.baselineLoadout.length,c.id).toBeGreaterThan(1);
   }
 });
 it("constructs all 54 mechanically full Saga Edition sheets without unearned XP",()=>{
   for(const c of allNpcDefinitiveDossiers150ABY()){
     const a=c.combat;
     expect(a.level,c.id).toBeGreaterThan(0);
     expect(a.level,c.id).toBeLessThanOrEqual(20);
     expect(a.careerXp,c.id).toBe(experienceForLevel(a.level));
     expect(a.originXpNotEarnedInPlay,c.id).toBe(true);
     expect(Object.values(a.classLevels).reduce((x,y)=>x+y,0),c.id).toBe(a.level);
     expect(a.maxHitPoints,c.id).toBeGreaterThan(0);
     expect(a.damageThreshold,c.id).toBeGreaterThan(0);
     expect(a.defenses.reflex,c.id).toBeGreaterThan(9);
     expect(a.defenses.fortitude,c.id).toBeGreaterThan(9);
     expect(a.defenses.will,c.id).toBeGreaterThan(9);
     expect(Object.keys(a.abilities),c.id).toHaveLength(6);
     expect(Object.values(a.abilities).every(x=>Number.isInteger(x)&&x>=1&&x<=30),c.id).toBe(true);
     expect(a.feats.length,c.id).toBeGreaterThan(0);
     expect(a.talents.length,c.id).toBeGreaterThan(0);
     expect(a.trainedSkills.length,c.id).toBeGreaterThan(0);
     expect(a.languages.length,c.id).toBeGreaterThan(0);
     expect(a.speciesTraits,c.id).toBeTruthy();
     expect(a.sourceCitation.length,c.id).toBeGreaterThan(8);
   }
 });
 it("preserves historical and sourcebook people without spawning or awarding equipment",()=>{
   for(const id of ["maera-holloran","daren-holloran","kelvek"])
     expect(npcDefinitiveDossier150ABY(id).worldPresence).toBe("deceased-historical");
   for(const id of ["shad-matik","sienna-dray","orin-baq","graccus-obaran","nyriss-kala"])
     expect(npcDefinitiveDossier150ABY(id).worldPresence).toBe("sourcebook-origin-unintroduced");
   const s=npcDefinitiveDossier150ABY("seralyth-vhaelor");
   expect(s.combat.certification).toBe("original-authored-saga-multiclass");
   expect(s.combat.classLevels).toEqual({scoundrel:1,jedi:7});
   expect(s.combat.forcePowers).toHaveLength(9);
   expect(npcDefinitiveDossier150ABY("jax").combat.level).toBeGreaterThan(1);
   expect(npcDefinitiveDossier150ABY("darth-korvalis").objective).toMatch(/XIII/i);
 });
});
