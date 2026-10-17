import {expect,it} from "vitest";
import {npcMechanics} from "./npc-mechanics";
import {resolveSpeciesReroll,sagaSpecies} from "@/original/lib/sagaSpecies";
it("builds supported alien careers without Human bonus feats and with native languages",()=>{
  for(const name of ["Loresh Kallun","Ardis Nefar","Vesla Kreel","Ko'ra Veil","Taric Zelra","Kala Morrin"]){
    const build=npcMechanics(name);
    expect(build.status,name+": "+build.reason).toBe("validated-core-build");
    const sheet=build.character!;
    expect((sheet.featSelections as any[]).some(feat=>feat.source==="human-bonus-feat")).toBe(false);
    for(const language of sagaSpecies(sheet.species)!.languages)expect(sheet.languages).toContain(language);
    expect(sheet.speciesTraitsApplied).toBeTruthy();
  }
});
it("uses the second species reroll even when worse and rejects repeated or ineligible rerolls",()=>{
  const previous={kind:"skill",label:"Perception",raw:18,modifier:4,target:15,outcome:"success"};
  const next=resolveSpeciesReroll({species:"Rodian"},previous,()=>2);
  expect(next).toMatchObject({raw:2,total:6,outcome:"failure",speciesRerolled:true});
  expect(()=>resolveSpeciesReroll({species:"Rodian"},next,()=>20)).toThrow();
  expect(()=>resolveSpeciesReroll({species:"Duros"},previous,()=>20)).toThrow();
});
it("does not confer fictional homebrew traits or Force powers through species",()=>{
  expect(npcMechanics("Alar Mar'Isk").status).toBe("pending-validation");
  expect(npcMechanics("Rena Salvek").status).toBe("pending-validation");
  expect(sagaSpecies("Chiss-raised Kiffar")).toBeNull();
});
