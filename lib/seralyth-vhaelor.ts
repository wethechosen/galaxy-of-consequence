/**
 * GOC original character — Lady Seralyth Vhaelor (150 ABY).
 * GM authority only. Never instantiate as a player, award her turns, or expose
 * this private module in a public API or client bundle.
 * Character fiction belongs to D'mir continuity; future outcomes are NOT canon.
 */
export const SERALYTH_ID = "seralyth-vhaelor" as const;

export const SERALYTH_SAGA_SHEET = {
  id:SERALYTH_ID, name:"Lady Seralyth Vhaelor", ruleset:"Star Wars Saga Edition" as const,
  controller:"ai-gm" as const, species:"Human (Hapan)", sex:"female", age:16,
  homeworld:"Hapes", eraABY:150, size:"Medium", speedSquares:6,
  heroicLevel:8, level:8, classes:[{name:"Scoundrel",levels:1},{name:"Jedi",levels:7}],
  baseAttackBonus:7, darkSideScore:5, darkSideMaximum:14,
  abilities:{str:9,dex:18,con:10,int:10,wis:14,cha:14},
  abilityBuild:{
    pointBuy25:{str:9,dex:16,con:10,int:10,wis:14,cha:12},
    level4:{dex:1,cha:1}, level8:{dex:1,cha:1},
  },
  maxHitPoints:56, hitPointBreakdown:{
    firstLevelScoundrel:18, jediRolls:[5,6,5,6,5,6,5], constitutionBonusSevenJediLevels:0,
  },
  reflexDefense:24, fortitudeDefense:19, willDefense:21,
  damageThreshold:19, grappleModifier:6, initiativeModifier:13,
  forcePoints:9, destinyPoints:0, conditionTrack:0,
  attacks:[{
    name:"concealed single red lightsaber", modifier:12, damage:"2d8+3 energy",
    accounting:"BAB +7, Weapon Finesse DEX +4, Weapon Focus +1; damage adds 1/2 heroic level and STR -1",
    visibleOnlyWhenDrawn:true,
  }],
  skills:{
    "Use the Force":16,"Acrobatics":8,"Deception":11,
    "Initiative":13,"Perception":11,"Stealth":13,
  },
  training:{
    firstClass:"Scoundrel", intModifierAtFirstLevel:0,
    humanExtraTrainedSkill:1,
    trainedSkills:["Use the Force","Deception","Initiative","Perception","Stealth"],
    note:"Force Sensitivity is the human bonus feat chosen at creation, making Use the Force a class skill.",
  },
  startingFeats:["Point Blank Shot","Weapon Proficiency (pistols)","Weapon Proficiency (simple weapons)"],
  multiclassFeat:"Weapon Proficiency (lightsabers)",
  generalFeats:[{level:1,name:"Force Training"},{level:3,name:"Force Training"},{level:6,name:"Force Training"}],
  humanBonusFeat:"Force Sensitivity",
  jediBonusFeats:[{classLevel:2,name:"Weapon Finesse"},{classLevel:4,name:"Skill Focus (Use the Force)"},{classLevel:6,name:"Weapon Focus (lightsabers)"}],
  talents:[
    {class:"Scoundrel",classLevel:1,name:"Fool's Luck"},
    {class:"Jedi",classLevel:1,name:"Block"},
    {class:"Jedi",classLevel:3,name:"Deflect"},
    {class:"Jedi",classLevel:5,name:"Clear Mind"},
    {class:"Jedi",classLevel:7,name:"Force Haze"},
  ],
  forcePowerSuite:[
    "Cloak","Cloak","Mind Trick","Mind Trick","Move Object",
    "Surge","Negate Energy","Force Grip","Force Thrust",
  ],
  form:{
    name:"Form III: Soresu",
    mastery:"Exceptionally accomplished defensive form at sixteen; described as master-class technique by her private tutors.",
    rulesNote:"No Soresu prestige-class talent: she is not a Jedi Knight, does not meet that tradition prerequisite, and does not gain a free reroll. Block and Deflect use the normal checks and cumulative penalties.",
  },
  concealmentRules:{
    optical:"Cloak is the Clone Wars Campaign Guide Force power; action, UtF DC and duration apply. It does not by itself mask the Force.",
    perceptual:"Force Haze follows the Clear Mind prerequisite, costs a Force Point and is broken by an attack.",
    forceIdentity:"Concealing her affiliation and Force signature is practiced discipline and opposed adjudication, NOT unconditional immunity to Sense Force or detection.",
  },
  equipment:["Concealable lightsaber with red blade (not publicly drawn)","Hapan court attire","quiet reinforced high boots","coded noble seal","concealed comlink"],
  limitations:[
    "No Sith Apprentice prestige class: current Dark Side Score does not satisfy its Wisdom-score prerequisite.",
    "No Jedi Knight prestige class or Soresu prestige-class talent.",
    "Not omniscient, immune to detection or able to force trust, romance, victory or advancement.",
    "The AI GM makes all decisions through actual narrated scenes and adjudicated rolls.",
  ],
} as const;

export const SERALYTH_GM_DOSSIER = {
  access:"gm-only" as const,
  id:SERALYTH_ID, status:"living" as const, currentLocation:"Hapes, Vhaelor estate",
  publicIdentity:"Lady Seralyth Vhaelor, sixteen-year-old daughter of a prominent Hapan house, educated in court protocol, languages and private self-defense.",
  appearance:"Very tall, nearly D'mir's height; long-limbed and poised. Deep dark-brown flawless skin, dark amber-brown eyes and an exceptionally full, long, softly defined curly afro with the volume of a classic Diana Ross silhouette. Her striking beauty is neither a supernatural charm effect nor a mechanical bonus. Her fashion is Hapan high-court elegance with immaculate high boots built for movement.",
  publicAttire:"Structured deep plum or cream court silks with goldwork, fitted shoulders, rich flowing fabric and dark high boots. No conspicuous Sith motifs, no open lightsaber.",
  privateAttire:"A dark violet close-fitted training tunic, flexible armored lining without a game-stat armor bonus, practical high boots; red-bladed single lightsaber brought out only behind guarded doors.",
  parents:{
    mother:"Lady Tazielle Vhaelor, influential Hapan noblewoman in the political circle close to the expected successor; not herself declared heir.",
    father:"Lord-Commander Rethan Vhaelor, senior figure in private Hapan security and military circles.",
  },
  core:"A proud, exacting, brutal and deliberately feminine covert assassin-in-training. She favors elegant manners, patient defense, precise violence and sovereign control over her own future.",
  secrecy:"Only a tightly controlled inner court circle knows of her Force sensitivity. Her family understands an extraordinary security program exists, but does not recognize the outside Sith Lord behind her deepest instruction.",
  education:"Dueling discipline, ceremonial conduct, counterintelligence, languages, poisons as threat recognition, covert movement and assassination ethics imposed by the handlers. She is a formidable student, not a galaxy-level Sith master.",
  ambitions:"Earn private autonomy without abandoning Hapes. Protect her house without becoming another person's property.",
  doubts:"Suspicious of gaps in her instructor's explanations, but still obedient and materially dependent on his training network.",
  prisonGangConnection:{
    classification:"ABSOLUTE GM SECRET",
    fact:"The hidden Sith teacher directing her is the same Sith Lord who led the dark-side prison gang connected to Kelvek in the Coruscant juvenile detention center.",
    kelvekTruth:"Kelvek skimmed funds from IGBC transactions and held tens of billions in accumulated wealth and associated infrastructure; D'mir inherited approximately 1.2 billion across accounts and has the datapad that accesses remaining infrastructure. Kelvek served as STAFF LIBRARIAN, never an inmate. Korvalis pursued Kelvek for the money, not out of friendship or former mentorship.",
    intelligence:"Someone who knew Kelvek after his IGBC career had reason to suspect real secret wealth. Information reached the Sith Lord, who persuaded the prison gang that Kelvek was a valuable target. The identity of the informant, chain of custody and exact amounts are unresolved; it was not an invented fortune.",
    currentKnowledge:"Seralyth has no knowledge of Kelvek, D'mir or the prison gang's finances. D'mir does not know Seralyth or Korvalis's involvement. GM private information is never automatically character knowledge.",
    identities:"The creator established that this hidden lifelong Sith instructor is Darth Korvalis; this is GM-only history, not player knowledge.",
  },
  relationalPotential:{
    classification:"GM-ONLY FUTURE SEEDS, NOT EVENTS",
    meeting:"Neither D'mir nor Seralyth has met the other. An introduction must arise from accessible routes and live events.",
    trust:"The intended long-term possibility is a rare, eventually profound trust; emotional or romantic developments are not automatic.",
    training:"She may eventually teach D'mir the fundamentals of optical Cloak and deeper presence concealment, requiring rules-valid progression. He may someday become extraordinary; no future Palpatine-surpassing mastery is pre-awarded.",
    sharedMaster:"D'mir may uncover the Sith Lord's prison-gang involvement; he may persuade Seralyth to break with him. A joint victory remains a scenario for play, not a predetermined success or death.",
  },
  encounterPolicy:"The AI GM alone controls her. She begins on Hapes in a separate ongoing story thread. No player selection, auto-spawn near D'mir, forced knowledge, encounter, teleport, relationship award, combat outcome or unsaved live-state mutation.",
} as const;

export const SERALYTH_HAPES_OPENING = {
  id:"hapes-seralyth-opening-150aby",
  status:"prepared-not-played" as const,
  location:"Vhaelor estate, Hapes, 150 ABY",
  participants:["Lady Seralyth Vhaelor","Lady Tazielle Vhaelor","Hapan household security"],
  privateScene:true,
  opening:`Morning comes through the tall windows of the Vhaelor estate in sheets of pale gold. Beyond the upper terraces, Hapes glitters with water and the distant movement of diplomatic traffic. Seralyth stands alone before an old mirror, fastening the cuffs of a plum-colored court coat. Its embroidered hem brushes the tops of her high black boots. Her long dark curls fall loose and magnificent around her shoulders. There is no weapon in sight.

On the table rests a sealed court invitation. Under it is a second envelope, without crest or address, delivered through the household security office. Its paper is utterly ordinary. Its timing is not.

A quiet knock precedes her mother's entrance. Lady Tazielle surveys her daughter—not her outfit—and pauses at the unmarked envelope. "There are people at court," she says, "who mistake discretion for obedience. Remember the difference."

The chamber door closes. Seralyth has time to read one message before the morning's public audience, or to leave both unread. Somewhere below, a training chime sounds once and stops.`,
  availableGmBranches:[
    "Seralyth opens the unsigned envelope and decides whether to verify its origin.",
    "Seralyth attends court beside Tazielle, seeking leverage and information rather than bloodshed.",
    "Seralyth goes to the private training chamber and challenges the next defensive exercise.",
    "Seralyth questions a household security officer about the envelope's route.",
  ],
  adjudication:"These are available choices for the AI GM to resolve through actual mechanics, motives and consequences. None is an accomplished scene, a forced command from her master, or contact with D'mir.",
} as const;
