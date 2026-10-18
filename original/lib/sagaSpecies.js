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

  // Supplemental species: sourcebook-aligned ability/defense traits.
  // Special actions remain subject to the named Saga resolver; descriptive
  // traits must never be used as unlimited automatic successes.
  aqualish:{name:"Aqualish",adjustments:{constitution:2,wisdom:-2,charisma:-2},languages:["Basic","Aqualish"],defenses:{},bonusFeat:"toughness",traits:["Toughness species bonus feat","Breathe underwater"],source:"Saga Edition Core Rulebook",pages:[26]},
  ithorian:{name:"Ithorian",adjustments:{wisdom:2,charisma:2,dexterity:-2},languages:["Basic","Ithorese"],defenses:{will:2},conditionalFocus:"knowledge-life-sciences",reroll:"Survival",traits:["Bellow: 6-square cone, heroic level vs Fortitude, 3d6 sonic, -1 condition step per use","Skill Focus (Knowledge (life sciences)) when trained","Iron Will","Survival reroll; accept the second result"],source:"Saga Edition Core Rulebook",pages:[29]},
  chiss:{name:"Chiss",adjustments:{intelligence:2},languages:["Cheunh"],defenses:{},bonusTrainedSkills:1,vision:"low-light",traits:["One additional trained class skill","Low-light vision"],source:"Legacy Era Campaign Guide",pages:[15]},
  zeltron:{name:"Zeltron",adjustments:{charisma:2,wisdom:-2},languages:["Basic"],defenses:{},traits:["Empathy: apply Charisma bonus to Perception to sense deception or influence","Soothing pheromones: +5 species to Persuasion to change attitude, except against Zeltrons"],source:"Legacy Era Campaign Guide",pages:[15]},
  falleen:{name:"Falleen",adjustments:{charisma:2,wisdom:-2},languages:["Basic","Falleen"],defenses:{},traits:["Hold breath: up to 25 times CON score rounds before Endurance","Pheromone attack is adjacent, standard action, level+CHA vs Fortitude; condition track only by actual attack roll","Fortitude +5 vs other Falleen pheromones"],source:"Saga Edition supplemental species reference"},
  weequay:{name:"Weequay",adjustments:{constitution:2,intelligence:-2,charisma:-2},languages:["Sriluurian"],defenses:{reflex:1},conditionalFocus:"endurance",traits:["Natural armor +1 Reflex","Pheromone communication with own tribe up to 20 squares","Skill Focus (Endurance) when trained"],source:"Legacy Era Campaign Guide"},
  nikto:{name:"Nikto",adjustments:{strength:2,intelligence:-2,charisma:-2},languages:["Nikto","Basic"],defenses:{reflex:2,fortitude:2},reroll:"Survival",traits:["Great Fortitude +2","Natural armor +2 Reflex","Survival reroll; accept the second result"],source:"Saga Edition supplemental species reference"},
  togruta:{name:"Togruta",adjustments:{dexterity:2,constitution:-2},languages:["Basic","Togruti"],defenses:{},traits:["Pack Hunter +2 melee damage against flanked target","Sneak-only Stealth reroll; accept second result","Spatial awareness: ignore cover/concealment for Perception noticing targets within 10 squares"],source:"Saga Edition supplemental species reference"},
  // Explicitly approved GOC variants: these rules were community-supplied,
  // not printed in an official Saga Edition racial stat block.
  mirialan:{name:"Mirialan",adjustments:{dexterity:2},languages:["Basic","Mirialan"],defenses:{},bonusTrainedSkills:1,traits:["GOC homebrew: one additional trained class skill","GOC homebrew: cannot take 10/20 on Deception, Gather Information, Perception or Survival"],source:"GOC homebrew (Mirialan adaptation, not official Saga racial mechanics)"},
  kiffar:{name:"Kiffar",adjustments:{},languages:["Basic"],defenses:{will:2},traits:["GOC homebrew: Iron Will +2","Psychometry requires an actual power/talent or Force Point adjudication; not an automatic clue"],source:"GOC homebrew (Kiffar adaptation, not official Saga racial mechanics)"},
  muun:{name:"Muun",adjustments:{intelligence:4,strength:-2},languages:["Basic","Muun"],defenses:{will:2},traits:["GOC homebrew: Impose Order swift action once per encounter, allies within 12 squares may reactively move up to half speed","Iron Will +2"],source:"GOC homebrew (Muun adaptation; published examples use similar traits)"},

};
/** Cultural upbringing is not ancestry: no Chiss racial abilities for a Kiffar raised by Chiss. */
export function sagaSpecies(name){
  const label=String(name||"").toLowerCase().trim();
  const explicitAliases={"chiss-raised kiffar":"kiffar","human (hapan)":"human","human (haruun kal)":"human","hapan human":"human","human (cybernetics)":"human"};
  const normalized=explicitAliases[label]||label.replace(/[^a-z]/g,"");
  return species[normalized]||null;
}
export function speciesTraitContext(character){
  const profile=sagaSpecies(character?.species);
  return profile?{...profile,ruleset:"Saga Edition",source:profile.source||"Saga Edition Core Rulebook",mechanicalBoundary:"Passive bonuses require a validated species foundation. Optional rerolls require an explicit choice and a server-owned original roll; never reroll silently. Culture and physiology do not determine individual personality or grant Force training."}:null;
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
