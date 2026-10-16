import {describe,it,expect} from "vitest";
import {ALL_NPC_TEST_ROSTER} from "./npc-test-roster";
import {CAMPAIGN_NPCS_150_ABY} from "./npc-canon-roster";
import {GOC_ALIEN_STORY_RATINGS,alienRatingByName,npcAlienGmContinuity} from "./npc-alien-story-ratings";
import {gmSystemForCharacter} from "./gm";
describe("Era-correct non-Human backstories and proposed Saga power ratings",()=>{
 it("covers exactly 16 active 150 ABY aliens and Kelvek's 147 ABY historical flashback",()=>{
   expect(GOC_ALIEN_STORY_RATINGS).toHaveLength(17);
   expect(new Set(GOC_ALIEN_STORY_RATINGS.map(n=>n.id)).size).toBe(17);
   const active=ALL_NPC_TEST_ROSTER.filter(n=>n.id!=="kelvek"&&n.species!=="Human");
   expect(active).toHaveLength(16);
   for(const npc of active){
     const r=GOC_ALIEN_STORY_RATINGS.find(r=>r.id===npc.id);
     expect(r).toBeTruthy();
     expect(r?.species).toBe(npc.species);
     expect(r?.eraABY).toBe(150);
     const canon=CAMPAIGN_NPCS_150_ABY.find(entry=>entry.id===npc.id);
     expect(r?.allegiance).toBeTruthy();
     expect(canon).toBeTruthy();
   }
   expect(alienRatingByName("Kelvek")?.eraABY).toBe(147);
   expect(alienRatingByName("Kelvek")?.level).toBeGreaterThan(1);
 });
 it("creates playable future arcs without backdating 200 ABY ranks or giving every NPC Jedi powers",()=>{
   for(const r of GOC_ALIEN_STORY_RATINGS){
     expect(r.level).toBeGreaterThan(1);
     expect(r.level).toBeLessThanOrEqual(20);
     expect(r.origin.length).toBeGreaterThan(120);
     expect(r.firstAct.length).toBeGreaterThan(50);
     expect(r.secondAct.length).toBeGreaterThan(60);
     expect(r.longArc.length).toBeGreaterThan(80);
     expect(r.flaw.length).toBeGreaterThan(25);
     for(const key of ["strength","dexterity","constitution","intelligence","wisdom","charisma"] as const){
       expect(r[key]).toBeGreaterThanOrEqual(3);
       expect(r[key]).toBeLessThanOrEqual(25);
       const base=r[key]-(r.speciesModifiers[key]||0);
       expect(base).toBeGreaterThanOrEqual(3);
       expect(base).toBeLessThanOrEqual(19);
     }
     expect(r.skills.length).toBeGreaterThanOrEqual(4);
     if(r.force!=="trained")expect(r.forcePowerDirection).toEqual([]);
     expect(r.origin+r.firstAct+r.secondAct).not.toMatch(/now rules the entire Fel Empire|already leads the Veiled Corsairs/i);
   }
 });
 it("keeps Mirialan and Kiffar fan-created traits explicitly unverified",()=>{
   expect(alienRatingByName("Tarvyn Dree")?.speciesRules).toBe("homebrew-unverified");
   expect(alienRatingByName("Alar Mar'Isk")?.speciesRules).toBe("homebrew-unverified");
   expect(alienRatingByName("Alar Mar'Isk")?.forcePowerDirection).toEqual([]);
   expect(alienRatingByName("Sia'thra Velle")?.force).toBe("none");
   expect(alienRatingByName("Ch'hal Vidar")?.force).toBe("unverified");
 });
 it("does not inject a proposed alien career outside that character's own timeline",()=>{
   expect(npcAlienGmContinuity("Kelvek",150)).toBeNull();
   expect(npcAlienGmContinuity("Kelvek",147)?.identity.yearABY).toBe(147);
   expect(npcAlienGmContinuity("Rena Salvek",150)?.proposedRatings.level).toBe(4);
   expect(npcAlienGmContinuity("Rena Salvek",147)).toBeNull();
   expect(npcAlienGmContinuity("D'mir Holloran",150)).toBeNull();
   const system=gmSystemForCharacter({name:"Kala Morrin",species:"Bothan",level:1},{campaignYearABY:150});
   expect(system).toContain("PRIVATE NPC ORIGIN AND STORY-RATING REFERENCE");
   expect(system).toContain("The proposed ratings are editorial design targets, not automatic engine state");
   expect(system).toContain("Kal");
   expect(gmSystemForCharacter({name:"Kelvek",species:"Muun",level:1},{campaignYearABY:150}))
     .not.toContain("PRIVATE NPC ORIGIN AND STORY-RATING REFERENCE");
 });
});
