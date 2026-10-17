// Saga Core indexed PDF pp. 24-26, 31-34. Ability scores on a sheet are
// post-species values; never add these adjustments again on load or level-up.
const species = {
  human:{name:"Human",adjustments:{},languages:["Basic"],defenses:{},traits:["One additional trained class skill", "One bonus feat at level 1"],pages:[24]},
  bothan:{name:"Bothan",adjustments:{dexterity:2,constitution:-2},languages:["Basic","Bothese"],defenses:{will:2},conditionalFocus:"gather-information",traits:["Iron Will", "Skill Focus (Gather Information) only when trained"],pages:[24,25]},
  duros:{name:"Duros",adjustments:{dexterity:2,intelligence:2,constitution:-2},languages:["Basic","Durese"],defenses:{},reroll:"Pilot",traits:["Expert Pilot: optional Pilot reroll; accept the second result even if worse"],pages:[26]},
  rodian:{name:"Rodian",adjustments:{dexterity:2,wisdom:-2,charisma:-2},languages:["Basic","Rodese"],defenses:{},reroll:"Perception",conditionalFocus:"survival",vision:"low-light",traits:["Heightened Awareness: optional Perception reroll; accept the second result", "Skill Focus (Survival) only when trained", "Low-light vision does not defeat total concealment"],pages:[31]},
  sullustan:{name:"Sullustan",adjustments:{dexterity:2,constitution:-2},languages:["Basic","Sullustese"],defenses:{},reroll:"Perception",takeTen:"Climb",vision:"darkvision",traits:["Heightened Awareness: optional Perception reroll; accept the second result", "Expert Climber: take 10 on Climb even when threatened", "Darkvision; no color in total darkness"],pages:[31,32]},
  twilek:{name:"Twi'lek",adjustments:{charisma:2,wisdom:-2},languages:["Basic","Ryl"],defenses:{fortitude:2},reroll:"Deception",vision:"low-light",traits:["Deceptive: optional Deception reroll; accept the second result", "Great Fortitude", "Low-light vision does not defeat total concealment"],pages:[33]},
  zabrak:{name:"Zabrak",adjustments:{},languages:["Basic","Zabrak"],defenses:{reflex:1,fortitude:1,will:1},reroll:"Perception",traits:["Heightened Awareness: optional Perception reroll; accept the second result", "Superior Defenses"],pages:[34]},
};
export function sagaSpecies(name){return species[String(name||"").toLowerCase().replace(/[^a-z]/g,"")]||null;}
export function speciesTraitContext(character){
  const profile=sagaSpecies(character?.species);
  return profile?{...profile,ruleset:"Saga Edition",source:"Saga Edition Core Rulebook",mechanicalBoundary:"Passive bonuses require a validated species foundation. Optional rerolls require an explicit choice and a server-owned original roll; never reroll silently. Culture and physiology do not determine individual personality or grant Force training."}:null;
}
/** One optional species reroll, not advantage and never a new action's roll. */
export function resolveSpeciesReroll(character,previous,roller){
  const profile=sagaSpecies(character?.species);
  if(!profile?.reroll||previous?.kind!=="skill"||previous.label!==profile.reroll||previous.speciesRerolled)throw Error("This roll is not eligible for a species reroll.");
  const raw=roller(1,21);
  if(!Number.isInteger(raw)||raw<1||raw>20||!Number.isFinite(previous.modifier)||!Number.isFinite(previous.target))throw Error("A valid server-owned check is required.");
  const total=raw+previous.modifier;
  return {...previous,raw,total,outcome:total>=previous.target?"success":"failure",speciesRerolled:true,originalRaw:previous.raw};
}
