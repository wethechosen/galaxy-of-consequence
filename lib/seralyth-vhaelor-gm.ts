/**
 * GM-ONLY 150 ABY campaign packet. Seralyth is an AI GM actor, NEVER a playable character.
 * Jedi is a Saga Edition rules class: she has no Jedi Order allegiance.
 * Scene is an unplayed seed, not a committed action or knowledge in D'mir's save.
 */
export const SERALYTH_VHAELOR_GM = {
  id:"seralyth-vhaelor", name:"Lady Seralyth Vhaelor", species:"Human (Hapan)",
  age:16, yearABY:150, faction:"House Vhaelor, Hapes Consortium",
  controller:"ai-gm-only", firstMeetingWithDmir:"not-established",
  appearance:{
    complexion:"flawless deep dark-brown skin with warm undertones",
    features:"strikingly beautiful, dignified teenage face, dark amber-brown eyes, composed expression",
    hair:"long voluminous natural curly afro, Diana Ross-inspired silhouette",
    physique:"tall and athletic, nearly D'mir's height, graceful and balanced",
    courtWear:"tailored Hapan jewel-tone court ensemble over practical riding boots; refined rather than armored",
    privateTrainingWear:"concealed movement-ready formal attire, without exposed Sith insignia",
    weapon:"one single-bladed red lightsaber, not displayed publicly",
    headshotBrief:"Hapan sixteen-year-old noblewoman, dark-brown flawless skin, amber-brown eyes, long expansive curly afro, youthful face and restrained regal expression; no Sith markers in public portrait.",
    fullBodyBrief:"Tall athletic Hapan noble teenager, Hapan court tailoring with high practical boots, long curly afro, movement-friendly concealed seams; private-training variant carries one single red lightsaber, never shown in court."
  },
  saga:{
    ruleset:"Star Wars Saga Edition",
    role:"GM-owned heroic NPC; not player-selectable",
    level:7, xpBenchmark:21000, heroicClassLevels:{scoundrel:1,jedi:6},
    note:"Jedi indicates trained Force/lightsaber mechanics, not membership in the Jedi Order.",
    pointBuy:30, // exceptional GM character, not standard 25-point player creation
    startingAbilityScores:{str:8,dex:15,con:12,int:12,wis:14,cha:15},
    level4AbilityIncreases:["dex","cha"],
    abilities:{str:8,dex:16,con:12,int:12,wis:14,cha:16},
    modifiers:{str:-1,dex:3,con:1,int:1,wis:2,cha:3},
    size:"Medium", speedSquares:6, baseAttackBonus:6, grappleModifier:5,
    hitPoints:{maximum:61,scoundrelFirstLevel:19,additionalJediHitDice:[6,6,6,6,6,6],conBonusPerLevel:1},
    defenses:{reflex:22,fortitude:19,will:20,damageThreshold:19},
    initiativeModifier:11,
    trainedSkills:["Acrobatics","Deception","Initiative","Perception","Stealth","Use the Force"],
    skills:{"Acrobatics":11,"Deception":11,"Initiative":11,"Perception":10,"Stealth":16,"Use the Force":16},
    levelHistory:[
      {characterLevel:1,career:"Scoundrel 1",humanBonusFeat:"Force Sensitivity",generalFeat:"Force Training",talent:"Knack",startingFeats:["Point Blank Shot","Weapon Proficiency (pistols)","Weapon Proficiency (simple weapons)"]},
      {characterLevel:2,career:"Jedi 1",newClassStartingFeat:"Weapon Proficiency (lightsabers)",talent:"Block"},
      {characterLevel:3,career:"Jedi 2",generalFeat:"Force Training",classBonusFeat:"Weapon Finesse"},
      {characterLevel:4,career:"Jedi 3",talent:"Deflect",abilityIncreases:["Dexterity","Charisma"]},
      {characterLevel:5,career:"Jedi 4",classBonusFeat:"Weapon Focus (lightsabers)"},
      {characterLevel:6,career:"Jedi 5",talent:"Lightsaber Defense",generalFeat:"Skill Focus (Use the Force)"},
      {characterLevel:7,career:"Jedi 6",classBonusFeat:"Skill Focus (Stealth)"}
    ],
    talents:["Knack","Block","Deflect","Lightsaber Defense"],
    feats:["Point Blank Shot","Weapon Proficiency (pistols)","Weapon Proficiency (simple weapons)","Force Sensitivity","Force Training","Weapon Proficiency (lightsabers)","Weapon Finesse","Weapon Focus (lightsabers)","Skill Focus (Use the Force)","Skill Focus (Stealth)"],
    forcePowerSuite:["Cloak","Cloak","Circle of Shelter","Mind Trick","Move Object","Surge"],
    forceTrainingFeatCount:2, forcePowerCapacity:6,
    forcePoints:8, destinyPoints:0, darkSideScore:0,
    attacks:{lightsaber:{name:"single standard red lightsaber",attackBonus:10,damage:"2d8+3 energy",critical:"natural 20"},unarmed:{attackBonus:5,damage:"1d4-1 kinetic"}},
    defensesInPlay:{
      block:"Reaction; opposed Use the Force vs qualifying melee attack roll, -5 cumulative per previous Block/Deflect since last turn.",
      deflect:"Reaction; opposed Use the Force vs qualifying ranged attack roll, same cumulative penalty.",
      soresuPractice:"Exceptional Form III Soresu technique: Block, Deflect and Lightsaber Defense plus Circle of Shelter. The Jedi Knight-only Soresu reroll talent has not been earned.",,
      forceSignature:"Conceal a Force signature by an opposed Use the Force check against Sense Force; no permanent immunity.",
      cloak:"Cloak Force power bends visible light; must be activated, checked and spent according to its power rules. Different from masking one's Force signature.",
      knack:"Limited Scoundrel skill-check reroll under the published talent rules."
    },
    gear:["single concealed red lightsaber","Hapan ceremonial clothing","practical court boots","secured comlink"],
    restrictions:["No Sith Lord rank or prestige-class abilities.","No automatic assassinations or unverified kills.","No limitless Cloak, infinite Force points or unwarranted invisibility.","No Buried Presence talent; it belongs to a different Force tradition.","No Soresu prestige talent before legal Jedi Knight class access; mastery here is in-world training, not an automatic reroll.","All NPC actions are chosen and resolved by the AI GM.","No rewards, encounters or XP without an authoritative gameplay receipt."]
  },
  mother:"Lady Tazielle Vhaelor, Hapan noble with close access to the succession circle; not an established heir herself.",
  father:"Lord-Commander Rethan Vhaelor, senior Hapan security and military family officer.",
  privateDossier:{
    program:"A secret, disputed court-security initiative cultivates Hapan Force-sensitive talent as a counterweight to outside Force dynasties and prejudices; not an openly declared Queen Mother policy.",
    security:"Only a tightly controlled inner circle knows she is Force-sensitive. Red blade and Sith allegiance are hidden even from court acquaintances.",
    sithMaster:"A concealed Sith agent has infiltrated her instruction without Hapan officials knowing his actual identity or agenda. She is loyal but suspicious; no confirmed Sith identity should be attached without evidence.",
    kelvek:"The SAME Sith Lord directed the juvenile-detention dark-side gang that targeted Kelvek. It was credible intelligence, not an invented rumor: Kelvek had skimmed IGBC orders before Muun displacement, secretly amassed wealth, and later worked as an employed staff librarian at Coruscant juvenile detention, not as a prisoner. The leak's source is still a mystery.",
    knowledgeBarrier:"Seralyth does not yet know Kelvek, D'mir, the prison-gang connection or her instructor's full history. D'mir likewise knows nothing about her private program.",
    possibleFuture:"Only gameplay can establish that they meet, build mutual trust, become intimate allies or more, that she teaches him Force concealment, or that they discover, betray and jointly kill her master. These are story opportunities, not scripted outcomes.",
    dmirForceCloakFuture:"D'mir someday exceeding Palpatine in concealment is a distant user-authored ambition, never an awarded current power.",
    lethality:"Extraordinary teenage prodigy, lethal versus ordinary foes but not invincible; social and combat errors can have lasting consequences."
  },
  introduction:{
    title:"The Hall Without Windows", location:"Hapes, House Vhaelor court-security annex",
    eraABY:150, status:"unplayed-gm-scene-seed", audience:"GM only",
    encounterWithDmir:false,
    prose:`One bell sounded in the pale gallery of House Vhaelor. Attendants carried away the last of the court invitations, leaving the reflecting pool to catch the warm glow of the screened lamps. Seralyth remained motionless in a court gown cut to accommodate riding boots. Her long curls brushed the top of her shoulders as she looked toward three silent training emitters.

The first machine fired a padded dart. Seralyth moved only enough to let it pass. The second fired twice, faster. She neither flinched nor reached for the weapon she was forbidden to show. When the third emitter began its sequence, she felt the old temptation to answer with anger. Instead she let it empty itself against the practice screen.

“Again,” said a voice from beyond the privacy wall. “This time give the observer nothing at all.”

She breathed until the heat inside her dulled. A visitor would see a young noblewoman rehearsing poise. No weapon. No teacher. No suggestion of how close the test had come to violence.

An aide entered with Lady Tazielle's sealed summons: the west salon, before nightfall. His eyes lingered a moment on the silent training equipment, then withdrew.

“I'll attend,” Seralyth replied.

After his footsteps faded, she turned toward the wall. “If your orders conflict with my mother's, whom am I meant to obey?”

For the first time that evening, the unseen instructor had no immediate answer.`,
    gmChoices:["Attend her mother's salon and discover the legitimate purpose of the summons.","Stay and demand that her instructor explain whose authority he serves.","Ask the security archive for lawful provenance of the training order; do not grant records automatically."],
    noAutomaticConsequences:"No kills, rolls, revealed identities, relationship milestones, or campaign-state mutations until the AI GM actually plays and saves the scene."
  }
} as const;
