import {describe,expect,it} from "vitest";
import {SERALYTH_GM_DOSSIER,SERALYTH_HAPES_OPENING,SERALYTH_ID,SERALYTH_SAGA_SHEET} from "./seralyth-vhaelor";
import {DMIR_STORY_NPCS,findDmirStoryNpc} from "./dmir-story-npcs";
import {publicDmirNpcDossiers,dmirSceneNpcContext,updateDmirNpcContinuity} from "./dmir-npc-memory";

describe("Lady Seralyth Vhaelor — D'mir canon, GM control and Saga accounting",()=>{
  const s=SERALYTH_SAGA_SHEET;
  it("is GM-only, an unmet sixteen-year-old Hapan Human, not a playable character",()=>{
    expect(s.id).toBe(SERALYTH_ID);
    expect(s.controller).toBe("ai-gm");
    expect(s.species).toBe("Human (Hapan)");
    expect(s.age).toBe(16);
    expect(s.homeworld).toBe("Hapes");
    expect(s.eraABY).toBe(150);
    expect(s.classes.reduce((n,r)=>n+r.levels,0)).toBe(s.level);
    expect(findDmirStoryNpc("Lady Seralyth Vhaelor")).toMatchObject({
      relationship:"unmet",firstKnownEncounter:"proposed",locationHint:expect.stringContaining("Hapes"),
    });
    expect(DMIR_STORY_NPCS.filter(n=>n.id===SERALYTH_ID)).toHaveLength(1);
  });
  it("accounts for legal heroic class talents, feats, progression, HP and defenses",()=>{
    expect(s.level).toBe(8);
    expect(s.baseAttackBonus).toBe(7);
    expect(s.talents.filter(x=>x.class==="Jedi").map(x=>x.name)).toEqual(["Block","Deflect","Clear Mind","Force Haze"]);
    expect(s.talents.filter(x=>x.class==="Scoundrel").map(x=>x.name)).toEqual(["Fool's Luck"]);
    expect(s.generalFeats.map(x=>x.level)).toEqual([1,3,6]);
    expect(s.jediBonusFeats.map(x=>x.classLevel)).toEqual([2,4,6]);
    expect(s.humanBonusFeat).toBe("Force Sensitivity");
    expect(s.multiclassFeat).toBe("Weapon Proficiency (lightsabers)");
    const pointCost=(v:number)=>v<=13?v-8:{14:6,15:8,16:10,17:13,18:16}[v as 14|15|16|17|18]||99;
    expect(Object.values(s.abilityBuild.pointBuy25).reduce((n,v)=>n+pointCost(v),0)).toBe(25);
    expect(s.maxHitPoints).toBe(s.hitPointBreakdown.firstLevelScoundrel+
      s.hitPointBreakdown.jediRolls.reduce((n,v)=>n+v,0)+s.hitPointBreakdown.constitutionBonusSevenJediLevels);
    expect(s.reflexDefense).toBe(10+s.level+4+2);
    expect(s.fortitudeDefense).toBe(10+s.level+1+1);
    expect(s.willDefense).toBe(10+s.level+2+1);
    expect(s.attacks[0].modifier).toBe(s.baseAttackBonus+4+1);
    expect(s.forcePowerSuite).toHaveLength(3*(1+2));
    expect(s.skills["Use the Force"]).toBe(Math.floor(s.level/2)+2+5+5);
    expect(s.training.trainedSkills).toHaveLength(6);
  });
  it("does not invent Soresu prestige talent, Force cloak immunity or future outcomes",()=>{
    expect(s.form.name).toMatch(/Soresu/);
    expect(s.talents.some(t=>String(t.name)==="Soresu")).toBe(false);
    expect(s.classes.every(c=>!["Jedi Knight","Sith Apprentice"].includes(c.name))).toBe(true);
    expect(s.concealmentRules.optical).toContain("does not by itself mask the Force");
    expect(s.limitations.length).toBeGreaterThan(0);
    expect(SERALYTH_HAPES_OPENING.status).toBe("prepared-not-played");
    expect(SERALYTH_GM_DOSSIER.relationalPotential.meeting).toMatch(/Neither D'mir nor Seralyth has met/);
  });
  it("preserves corrected Kelvek history and keeps Sith secret from public roster",()=>{
    const kelvek=findDmirStoryNpc("Kelvek")!;
    expect(kelvek.background).toMatch(/STAFF LIBRARIAN/);
    expect(kelvek.background).toMatch(/never a prisoner/);
    expect(kelvek.privateKnowledge).toMatch(/really had skimmed/);
    expect(SERALYTH_GM_DOSSIER.prisonGangConnection.fact).toMatch(/same Sith Lord/);
    expect(SERALYTH_GM_DOSSIER.prisonGangConnection.currentKnowledge).toMatch(/no knowledge/);
    const publicText=JSON.stringify(publicDmirNpcDossiers());
    for(const secret of ["Soresu","red lightsaber","Sith Lord","prison gang","Kelvek","Force-sensitive"]){
      if(secret==="Kelvek")continue; // Historic Kelvek is a legitimate known contact
      expect(publicText).not.toContain(secret);
    }
    expect(dmirSceneNpcContext("I enter the Bonadan market",{location:"Bonadan"}).some(n=>n.id===SERALYTH_ID)).toBe(false);
    const existing={location:"Bonadan",credits:5,npcContinuity:{}};
    expect(updateDmirNpcContinuity(existing,null,"t-123","No action")).toBe(existing);
  });
});
