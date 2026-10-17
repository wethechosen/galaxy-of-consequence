import {describe,it,expect} from "vitest";
import {SERALYTH_VHAELOR_GM as s} from "./seralyth-vhaelor-gm";
import {DMIR_STORY_NPCS} from "./dmir-story-npcs";
import {dmirSceneNpcContext,publicDmirNpcDossiers} from "./dmir-npc-memory";

describe("Seralyth Vhaelor — GM-only Saga and Dmir canon",()=>{
  const mod=(score:number)=>Math.floor((score-10)/2);
  it("exists only as an independent, not-yet-met GM-controlled Hapan actor",()=>{
    const identity=DMIR_STORY_NPCS.find(n=>n.id===s.id);
    expect(identity).toMatchObject({status:"living",relationship:"unmet",age:16,firstKnownEncounter:"proposed"});
    expect(s.controller).toBe("ai-gm-only");
    expect(s.introduction.status).toBe("unplayed-gm-scene-seed");
    expect(s.introduction.encounterWithDmir).toBe(false);
    expect(dmirSceneNpcContext("I ask Jax about Taris",{location:"YT-1300"}).some(n=>n.id===s.id)).toBe(false);
  });
  it("has the exact four-class-talent prerequisite chain without unsupported Sith prestige",()=>{
    const levels=s.saga.levelHistory;
    expect(levels.map(l=>l.characterLevel)).toEqual([1,2,3,4,5,6,7]);
    expect(s.saga.heroicClassLevels.scoundrel+s.saga.heroicClassLevels.jedi).toBe(s.saga.level);
    expect(s.saga.talents).toEqual(["Knack","Block","Deflect","Soresu"]);
    expect(levels.some(l=>"talent" in l && l.characterLevel===6 && l.talent==="Soresu")).toBe(true);
    expect(levels.some(l=>"talent" in l && l.characterLevel===4 && l.talent==="Deflect")).toBe(true);
    expect(s.saga.forcePowerSuite).toHaveLength((1+mod(s.saga.abilities.wis))*s.saga.forceTrainingFeatCount);
    expect(s.saga.forcePowerSuite).toContain("Cloak");
    expect(s.saga.talents).not.toContain("Buried Presence");
  });
  it("reconciles ability increases, trained skills, attacks, hit points and defenses",()=>{
    const a=s.saga.abilities;const m=s.saga.modifiers;const lvl=s.saga.level;
    expect(a.dex).toBe(s.saga.startingAbilityScores.dex+1);
    expect(a.cha).toBe(s.saga.startingAbilityScores.cha+1);
    expect(s.saga.trainedSkills).toHaveLength(4+m.int+1); // Scoundrel starting skills + Human
    expect(s.saga.hitPoints.maximum).toBe(s.saga.hitPoints.scoundrelFirstLevel+s.saga.hitPoints.additionalJediHitDice.reduce((n,x)=>n+x+m.con,0));
    expect(s.saga.defenses).toEqual({reflex:10+lvl+m.dex+2,fortitude:10+lvl+m.con+1,will:10+lvl+m.wis+1,damageThreshold:10+lvl+m.con+1});
    expect(s.saga.attacks.lightsaber.attackBonus).toBe(s.saga.baseAttackBonus+m.dex+1);
    expect(s.saga.skills["Use the Force"]).toBe(Math.floor(lvl/2)+m.cha+5+5);
    expect(s.saga.skills["Stealth"]).toBe(Math.floor(lvl/2)+m.dex+5+5);
    expect(s.saga.darkSideScore).toBe(0);
  });
  it("does not disclose the master's shared Kelvek plot through the public dossier projection",()=>{
    const text=JSON.stringify(publicDmirNpcDossiers());
    expect(text).toContain("seralyth-vhaelor");
    expect(text).not.toContain("Sith Lord led");
    expect(text).not.toContain("prison-gang link");
    expect(text).not.toContain("red lightsaber");
    expect(text).not.toContain("Force-cloak tutelage");
    expect(s.privateDossier.kelvek).toContain("skimmed IGBC orders");
  });
  it("keeps her introduction a private unplayed scene, not Dmir's location or an earned kill",()=>{
    expect(s.introduction.location).toMatch(/Hapes/);
    expect(s.introduction.prose).toContain("Lady Tazielle");
    expect(s.introduction.noAutomaticConsequences).toMatch(/No kills/);
    expect(s.saga.restrictions.some(x=>x.includes("AI GM"))).toBe(true);
  });
});
