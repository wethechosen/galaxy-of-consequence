import {describe,it,expect} from "vitest";
import {GOC_NPC_INDEX_150_ABY,GOC_NPC_INDEX_BY_ID,GOC_NPC_INDEX_SUMMARY,GOC_FEL_LEGENDS_BASELINE} from "./npc-canonical-index";
import {experienceForLevel} from "@/original/lib/sagaAdvancement";

describe("GOC 150 ABY canonical population and Saga authority",()=>{
  it("reconciles every authored identity exactly once, including repeated Korvalis",()=>{
    expect(GOC_NPC_INDEX_SUMMARY).toMatchObject({total:54,core:25,personal:13,simulations:9,relatives:2,pendingSourcebook:5});
    expect(new Set(GOC_NPC_INDEX_150_ABY.map(x=>x.id)).size).toBe(54);
    expect(new Set(GOC_NPC_INDEX_150_ABY.map(x=>x.name.toLowerCase())).size).toBe(54);
    expect(GOC_NPC_INDEX_150_ABY.filter(x=>x.name==="Darth Korvalis")).toHaveLength(1);
    expect(GOC_NPC_INDEX_150_ABY.every(x=>x.eraABY===150)).toBe(true);
  });
  it("preserves independent Fel military and political command with Legends historical anchors",()=>{
    for(const id of ["aliyah-fel","jaed-sultar","rena-salvek","calen-vardex","loresh-kallun"]){
      expect(GOC_NPC_INDEX_BY_ID.has(id),id).toBe(true);
      expect(GOC_NPC_INDEX_BY_ID.get(id)?.faction).toMatch(/Fel|Imperial/);
    }
    expect(GOC_FEL_LEGENDS_BASELINE.empireRestoredABY).toBe(138);
    expect(GOC_FEL_LEGENDS_BASELINE.marasiahFel).toMatch(/Roan/);
    expect(GOC_NPC_INDEX_BY_ID.get("aliyah-fel")?.role.toLowerCase()).not.toContain("empress");
  });
  it("keeps historic deaths and proposed sourcebook NPCs out of active present-day scenes",()=>{
    for(const id of ["maera-holloran","daren-holloran","kelvek"]){
      expect(GOC_NPC_INDEX_BY_ID.get(id)?.lifeStatus).toBe("deceased");
      expect(GOC_NPC_INDEX_BY_ID.get(id)?.worldState).toBe("historical-only");
    }
    const proposals=GOC_NPC_INDEX_150_ABY.filter(x=>x.sourceClass==="sourcebook-candidate");
    expect(proposals).toHaveLength(5);
    expect(proposals.every(x=>x.worldState==="unintroduced-proposal")).toBe(true);
  });
  it("separates published Saga-generated mechanics from editorial numbers and earned XP",()=>{
    const knight=GOC_NPC_INDEX_BY_ID.get("jaed-sultar")!;
    expect(knight.design.level).toBe(9);
    expect(knight.design.priorCareerXp).toBe(experienceForLevel(9));
    expect(knight.design.experienceAuthority).toBe("historical-origin-not-earned-in-play");
    const seralyth=GOC_NPC_INDEX_BY_ID.get("seralyth-vhaelor")!;
    expect(seralyth.design.mechanicalAuthority).toBe("authored-saga-sheet");
    expect(seralyth.design.level).toBe(8);
    expect(seralyth.design.forcePowerDirection).toContain("Cloak");
    const alien=GOC_NPC_INDEX_BY_ID.get("rena-salvek")!;
    expect(alien.design.mechanicalAuthority).toBe("editorial-rating-only");
    expect(alien.design.abilityScores?.charisma).toBe(16);
    expect(GOC_NPC_INDEX_BY_ID.get("jax")?.design.level).toBeNull();
    expect(GOC_NPC_INDEX_BY_ID.get("jax")?.design.mechanicalAuthority).toBe("unresolved");
    expect(GOC_NPC_INDEX_BY_ID.get("darth-korvalis")?.biography).toMatch(/XIII/);
  });
});
