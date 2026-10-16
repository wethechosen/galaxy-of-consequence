/**
 * GOC NPC campaign-origin stories and GM proposed Saga ratings.
 * Source dossiers were originally authored for 200 ABY; this file establishes
 * BACKSTORIES AND BOUNDARIES for 150 ABY only, except Kelvek in 147 ABY.
 *
 * These are proposed starting CL/heroic levels and ability ratings, not
 * committed Saga builds. Never copy numerical levels, Force powers, feats,
 * wealth or prestige into a save until the entire species foundation and
 * full advancement chain have been validated and saved atomically.
 */
export type AlienStoryRating={
 id:string; name:string; species:string; eraABY:147|150;
 level:number; heroicClass:"Jedi"|"Soldier"|"Scout"|"Noble"|"Scoundrel";
 allegiance:string; role:string; force:"trained"|"latent"|"none"|"unverified";
 strength:number; dexterity:number;constitution:number;intelligence:number;wisdom:number;charisma:number;
 speciesModifiers:Partial<Record<"strength"|"dexterity"|"constitution"|"intelligence"|"wisdom"|"charisma",number>>;
 speciesRules:"core"|"supplement"|"homebrew-unverified";
 specialTraits:string[]; skills:string[]; talentDirection:string; forcePowerDirection:string[];
 origin:string; firstAct:string; secondAct:string; longArc:string; flaw:string;
};
export const GOC_ALIEN_STORY_RATINGS:readonly AlienStoryRating[]=[
{
 id:"rena-salvek",name:"Rena Salvek",species:"Zeltron",eraABY:150,level:4,heroicClass:"Jedi",
 allegiance:"Fel Imperial Knights",role:"Imperial Knight trainee",force:"trained",
 strength:12,dexterity:14,constitution:12,intelligence:11,wisdom:12,charisma:16,
 speciesModifiers:{charisma:2,wisdom:-2},speciesRules:"supplement",
 specialTraits:["Empathy","Soothing pheromones (not Force powers)"],skills:["Use the Force","Perception","Persuasion","Initiative"],
 talentDirection:"Force Perception and disciplined defensive training",forcePowerDirection:["Move Object","Negate Energy"],
 origin:"Rena was recruited from Zeltros because she could sense distress long before her teachers explained the Force. Her empathy helped her protect the weak but made the rigid etiquette of Bastion's training halls especially difficult. A senior Knight taught her to distinguish compassionate judgment from surrendering discipline.",
 firstAct:"An Imperial Knight training crystal disappears from a secured rack. Rena volunteers to preserve the scene and investigate without accusing the cadets who envy her sensitivity.",
 secondAct:"The investigation tests whether she can remain loyal to Imperial procedure while fairly hearing a vulnerable trainee. Her private correspondence with a Jedi friend creates an apparent but unproven motive.",
 longArc:"Establish the crystal's fate, show an accountable chain of custody, protect the innocent, and earn a substantive Knight assignment through play; she is not yet a commissioned senior Knight.",
 flaw:"Seeks the approval of authority and may interpret another's fear as guilt."
},
{
 id:"loresh-kallun",name:"Loresh Kallun",species:"Duros",eraABY:150,level:9,heroicClass:"Soldier",
 allegiance:"Fel Imperial Navy",role:"Veteran frigate captain",force:"none",
 strength:10,dexterity:16,constitution:11,intelligence:16,wisdom:14,charisma:12,
 speciesModifiers:{dexterity:2,intelligence:2,constitution:-2},speciesRules:"core",
 specialTraits:["Expert Pilot"],skills:["Pilot","Knowledge (tactics)","Use Computer","Perception"],
 talentDirection:"Battle Analysis and disciplined fleet command",forcePowerDirection:[],
 origin:"Loresh started as a navigation officer under fire and learned that a captain's duty is to preserve the people aboard his vessel, not to decorate a service record. During the Sith-Imperial conflict he diverted an evacuation route to save refugees, a decision still buried in an old inquiry.",
 firstAct:"He must shepherd a civilian convoy past unstable patrol coordinates with a frigate too small to intimidate every threat.",
 secondAct:"Corporate escorts want speed, Imperial superiors demand obedience, and a crew member questions his old evacuation record. He must verify the danger rather than charge blindly.",
 longArc:"Bring the convoy through, account for losses and decisions, and prove he deserves a larger naval command. The future Imperial Virtue Star Destroyer remains unearned.",
 flaw:"Excessive caution sometimes lets a nimble opponent control the tempo."
},
{
 id:"ardis-nefar",name:"Ardis Nefar",species:"Zabrak",eraABY:150,level:7,heroicClass:"Soldier",
 allegiance:"Corporate Sector Authority / Espo",role:"Espo investigations lieutenant",force:"none",
 strength:15,dexterity:13,constitution:14,intelligence:12,wisdom:12,charisma:10,
 speciesModifiers:{},speciesRules:"core",
 specialTraits:["Heightened Awareness","Superior Defenses (+1 racial to Reflex, Fortitude and Will)"],
 skills:["Perception","Knowledge (tactics)","Persuasion","Use Computer"],
 talentDirection:"Commando and disciplined security tactics",forcePowerDirection:[],
 origin:"Ardis grew up among Iridonian traders who believed corporate order was better than chaos. He joined the Espo forces for stability and learned how quickly corporate procedure becomes an instrument of intimidation.",
 firstAct:"Cargo manifests implicate a falsified industrial shipment pattern. His superiors want a profitable answer immediately; Ardis must find real admissible evidence.",
 secondAct:"A promised off-ledger detention shortcut threatens the case, forcing him to choose between unquestioning promotion and credible due process.",
 longArc:"Expose or disprove the freight fraud and submit a case that survives review. A captaincy and broad command authority are future possibilities.",
 flaw:"Treats witnesses as subordinate employees and confuses coercion with certainty."
},
{
 id:"akkan-vuu",name:"Akkan Vuu",species:"Aqualish",eraABY:150,level:3,heroicClass:"Jedi",
 allegiance:"New Jedi Order",role:"Young novice Jedi repair apprentice",force:"trained",
 strength:14,dexterity:12,constitution:16,intelligence:12,wisdom:12,charisma:9,
 speciesModifiers:{constitution:2,wisdom:-2,charisma:-2},speciesRules:"core",
 specialTraits:["Amphibious biology","Species Toughness (verify before granting extra feat)"],
 skills:["Use the Force","Perception","Knowledge (life sciences)","Mechanics"],
 talentDirection:"Awareness and control before combat prowess",forcePowerDirection:["Move Object"],
 origin:"Akkan was raised among marine workers on Ando, where neglected equipment could cost a family its livelihood. A Jedi relief team recognized his sensitivity after he stayed to repair a flooded life-support system rather than flee.",
 firstAct:"At Ossus he wants to learn repairs under supervision. His curiosity outruns his training, especially around devices with restricted access.",
 secondAct:"A damaged public water-filtration mechanism forces him to request permission, follow safety procedure, and work alongside people who distrust an Aqualish initiate.",
 longArc:"Complete his supervised training and demonstrate safe mastery of a real repair without claiming access to Sith vaults or Jedi Knight powers.",
 flaw:"Curiosity leads him to touch a mechanism before seeking authorization."
},
{
 id:"tarvyn-dree",name:"Tarvyn Dree",species:"Mirialan",eraABY:150,level:8,heroicClass:"Jedi",
 allegiance:"New Jedi Order (strained)",role:"Independent Jedi relic investigator",force:"trained",
 strength:11,dexterity:16,constitution:12,intelligence:14,wisdom:15,charisma:11,
 speciesModifiers:{dexterity:2},speciesRules:"homebrew-unverified",
 specialTraits:["Mirialan cultural tattoos; no homebrew racial mechanics enabled"],
 skills:["Use the Force","Perception","Stealth","Knowledge (galactic lore)"],
 talentDirection:"Force Perception and measured inquiry",forcePowerDirection:["Move Object","Negate Energy","Force Stun"],
 origin:"Tarvyn survived years of rumors about Sith infiltration and now sees patterns of corruption almost everywhere. He was trained to investigate relics, not to issue private death sentences, yet the fear of another purge has become his defining weakness.",
 firstAct:"A Sith-era artifact arrives at the Ossus public records portico with an incomplete provenance trail.",
 secondAct:"He must interview collectors and test documents without coercion. One witness has a useful lead and a perfectly ordinary reason to fear a Jedi investigator.",
 longArc:"Secure a verifiable lawful chain of custody and protected archive transfer; he cannot assume the rank of Jedi Shadow or execute suspected Sith without real adjudication.",
 flaw:"Interprets uncertainty as a concealed hostile plot."
},
{
 id:"vesla-kreel",name:"Vesla Kreel",species:"Twi'lek",eraABY:150,level:4,heroicClass:"Jedi",
 allegiance:"Murkhana-associated covert sect",role:"Early Sith acolyte",force:"trained",
 strength:10,dexterity:14,constitution:12,intelligence:12,wisdom:12,charisma:16,
 speciesModifiers:{charisma:2,wisdom:-2},speciesRules:"core",
 specialTraits:["Twi'lek species traits (individual effects require engine implementation)"],
 skills:["Use the Force","Deception","Stealth","Perception"],
 talentDirection:"Force Sense and restraint under pressure",forcePowerDirection:["Force Grip"],
 origin:"Vesla escaped work gangs on Ryloth only to become indebted to collectors who claimed they could secure freedom for her sibling. Her early Force instruction made her dangerous enough to be useful, not powerful enough to be free.",
 firstAct:"Sent to a Bonadan broker to trace a relic courier, she realizes the sect is treating her sibling as leverage.",
 secondAct:"She has to decide what evidence would actually free the captive without surrendering more secrets to handlers.",
 longArc:"Resolve her sibling's captivity and negotiate or fight her way out of coercive obligations through playable choices. A Sith Apprentice prestige class and mentoring relationship with Korvalis are not yet established.",
 flaw:"Her terror of abandonment can override caution; combat training is narrow."
},
{
 id:"alar-marisk",name:"Alar Mar'Isk",species:"Chiss-raised Kiffar",eraABY:150,level:5,heroicClass:"Noble",
 allegiance:"Independent Sith cult recruiter",role:"Kiffar interpreter and cult agent",force:"latent",
 strength:10,dexterity:12,constitution:12,intelligence:14,wisdom:11,charisma:16,
 speciesModifiers:{},speciesRules:"homebrew-unverified",
 specialTraits:["Kiffar is biological ancestry; Chiss is upbringing, not a hybrid racial bonus","No psychometry without a verified power"],
 skills:["Persuasion","Deception","Knowledge (galactic lore)","Use Computer"],
 talentDirection:"Negotiation and influence rather than unearned Sith talents",forcePowerDirection:[],
 origin:"Raised among the disciplined traders of Chiss frontier space, Alar adopted their cautious use of information but never possessed their ancestry. A secretive Sith broker rewarded his skill at recruiting skilled civilians.",
 firstAct:"He needs a slicer who can translate a mundane public map index without learning the purpose of the cult's hidden shipping route.",
 secondAct:"The slicer wants a verifiable contract, while Alar holds a relic fragment he has not reported to his handlers.",
 longArc:"Build his independent network and decide who owns the fragment without claiming Korvalis's trust or automatic Force psychometry.",
 flaw:"His rhetorical skill makes him overestimate his ability to control better informed patrons."
},
{
 id:"siathra-velle",name:"Sia'thra Velle",species:"Falleen",eraABY:150,level:8,heroicClass:"Noble",
 allegiance:"Hapan diplomatic delegation",role:"Senior trade adviser",force:"none",
 strength:10,dexterity:12,constitution:12,intelligence:16,wisdom:10,charisma:18,
 speciesModifiers:{charisma:2,wisdom:-2},speciesRules:"supplement",
 specialTraits:["Falleen pheromones are physiological (requires Fortitude/condition rules, not Force)","Hold Breath"],
 skills:["Persuasion","Deception","Knowledge (bureaucracy)","Knowledge (social sciences)"],
 talentDirection:"Lineage, educated diplomacy, hard negotiation",forcePowerDirection:[],
 origin:"Sia'thra left Falleen court traditions to study the mismatch between Hapan sovereignty and the Corporate Sector's appetite for favorable contracts. A Hapan minister hired her because she could see the cost hidden inside ceremonial language.",
 firstAct:"She must negotiate an initial review of commercial passage rights on Bonadan without signing away future concessions.",
 secondAct:"A sealed annex might expose a conflict of interest, but she cannot treat access to a letter as ownership of its contents.",
 longArc:"Produce an authorized preliminary agreement that protects Hapan trade autonomy. Baroness and ambassador are not automatically her 150 ABY titles.",
 flaw:"Disdains visible emotion and underestimates people who refuse to be flattered."
},
{
 id:"kora-veil",name:"Ko'ra Veil",species:"Rodian",eraABY:150,level:5,heroicClass:"Scout",
 allegiance:"Independent freetraders",role:"Owner-operator freighter captain",force:"none",
 strength:11,dexterity:16,constitution:12,intelligence:14,wisdom:10,charisma:10,
 speciesModifiers:{dexterity:2,wisdom:-2,charisma:-2},speciesRules:"core",
 specialTraits:["Rodian tracker's instinct (GM must validate reroll conditions)"],
 skills:["Pilot","Perception","Survival","Use Computer"],
 talentDirection:"Acute Senses and navigator's judgment",forcePowerDirection:[],
 origin:"Ko'ra grew up in Nar Shaddaa freighter service bays and watched Hutt brokers convert every loan into lifelong dependency. She swore her future crew would owe their loyalty to a fair charter rather than a syndicate.",
 firstAct:"At the freighter pier she negotiates for one difficult but legal passage.",
 secondAct:"An older captain's concealed records suggest the available cargo has a disputed history. She must establish its legitimacy before risking her crew.",
 longArc:"Win and complete a lawful voyage with an independent crew. The later Veiled Corsairs fleet and pirate crown do not yet exist.",
 flaw:"Pride pushes her to refuse useful assistance from established guilds."
},
{
 id:"taric-zelra",name:"Taric Zelra",species:"Sullustan",eraABY:150,level:5,heroicClass:"Scoundrel",
 allegiance:"Independent biomedical engineering",role:"Certified prosthetics repair technician",force:"none",
 strength:9,dexterity:16,constitution:11,intelligence:17,wisdom:13,charisma:11,
 speciesModifiers:{dexterity:2,constitution:-2},speciesRules:"core",
 specialTraits:["Darkvision","Heightened Awareness","Expert Climber"],
 skills:["Mechanics","Use Computer","Knowledge (technology)","Perception"],
 talentDirection:"Knack and technical skill specializations",forcePowerDirection:[],
 origin:"Taric repaired mining respirators in Sullust's subterranean workshops until a poor aftermarket part nearly killed a worker. Since then he has insisted that every implanted device have an auditable safety record.",
 firstAct:"An inexpensive prosthetic has arrived with a medical certificate whose issuing authority is unclear.",
 secondAct:"He must test the certificate with licensed technicians without touching a recipient's body or exporting private medical records.",
 longArc:"Find the real safety defect if present, secure a documented disposition, and preserve the recipient's agency; he has not invented future dark-side-linked prosthetics.",
 flaw:"Treats people like troublesome interfaces in a technical process."
},
{
 id:"chhal-vidar",name:"Ch'hal Vidar",species:"Chiss",eraABY:150,level:5,heroicClass:"Scout",
 allegiance:"Independent frontier surveyor with Chiss heritage",role:"Navigation cartographer",force:"unverified",
 strength:10,dexterity:15,constitution:12,intelligence:18,wisdom:13,charisma:10,
 speciesModifiers:{intelligence:2},speciesRules:"supplement",
 specialTraits:["Bonus Trained Skill","Low-Light Vision","No Force precognition without earned confirmation"],
 skills:["Pilot","Use Computer","Knowledge (galactic lore)","Perception"],
 talentDirection:"Navigation and Awareness",forcePowerDirection:[],
 origin:"Born near the Chiss Ascendancy's peripheral charting lanes, Ch'hal learned that a wrong beacon could kill a thousand spacers. He walked away from a bureaucratic survey order rather than sell a navigational secret to untrusted outsiders.",
 firstAct:"At a lonely waystation, the public marker conflicts with the civilian reference map.",
 secondAct:"A maintenance panel offers a plausible diagnostic source but its access and condition must be established by play.",
 longArc:"Correct or safely quarantine the false guidance while guarding genuine Chiss state secrets. His ambiguous dreams are not a confirmed Force talent or Celestial artifact.",
 flaw:"His guarded secrecy makes even allies suspect withheld facts."
},
{
 id:"kara-murson",name:"Kara Murson",species:"Togruta",eraABY:150,level:5,heroicClass:"Scout",
 allegiance:"Independent Lothal tracker",role:"Licensed missing-person searcher",force:"none",
 strength:12,dexterity:17,constitution:12,intelligence:13,wisdom:13,charisma:10,
 speciesModifiers:{dexterity:2,constitution:-2},speciesRules:"supplement",
 specialTraits:["Spatial Awareness","Pack Hunter","Sneaky (reroll conditions need validation)"],
 skills:["Survival","Perception","Stealth","Knowledge (bureaucracy)"],
 talentDirection:"Awareness and survival tracking",forcePowerDirection:[],
 origin:"Kara grew up with a human adoptive family on Lothal, learning to hunt for missing livestock before accepting cases involving people. She sends part of every job payment to her younger siblings.",
 firstAct:"She reviews the legal requirements for finding a missing Twi'lek worker.",
 secondAct:"The last known location lies between legitimate labor transport records and a recruiter with a frightening reputation.",
 longArc:"Identify the missing worker's true fate through legal evidence, protect family members and make a documented report. Togruta ancestry does not mean she is a Human-Togruta genetic hybrid.",
 flaw:"Family obligations can tempt her to accept a case before understanding the jurisdiction."
},
{
 id:"keelo-greel",name:"Keelo Greel",species:"Nikto",eraABY:150,level:8,heroicClass:"Soldier",
 allegiance:"Corporate Sector Authority / Espo",role:"Senior security operations officer",force:"none",
 strength:16,dexterity:12,constitution:15,intelligence:11,wisdom:14,charisma:10,
 speciesModifiers:{strength:2,intelligence:-2,charisma:-2},speciesRules:"supplement",
 specialTraits:["Natural Armor (+2 Reflex)","Great Fortitude (+2 Fortitude)","Survival Instinct"],
 skills:["Knowledge (tactics)","Perception","Endurance","Persuasion"],
 talentDirection:"Commando, Armored Defense and Battle Analysis",forcePowerDirection:[],
 origin:"Keelo learned security work in dangerous refinery corridors, where shortcuts caused explosive accidents. Corporate officials rewarded his ability to impose procedure, and he quietly built files on the officers they preferred not to investigate.",
 firstAct:"He reviews an Espo transport-security manual after equipment discrepancies.",
 secondAct:"A logistics officer demands a sweeping lockdown. Keelo has to establish an actual vulnerability before making that call.",
 longArc:"Propose and carry out a proportional safety reform. He is not yet a CSA Viceprex or commander of a sector fleet.",
 flaw:"Equates dissent with insubordination and lacks patience with civilian oversight."
},
{
 id:"kala-morrin",name:"Kala Morrin",species:"Bothan",eraABY:150,level:9,heroicClass:"Jedi",
 allegiance:"New Jedi Order",role:"Experienced Jedi scholar",force:"trained",
 strength:10,dexterity:16,constitution:11,intelligence:16,wisdom:16,charisma:13,
 speciesModifiers:{dexterity:2,constitution:-2},speciesRules:"core",
 specialTraits:["Iron Will (+2 Will)","Conditional Skill Focus (Gather Information) only if trained"],
 skills:["Use the Force","Knowledge (galactic lore)","Perception","Persuasion"],
 talentDirection:"Force Perception, Control and patient investigation",forcePowerDirection:["Move Object","Negate Energy","Force Stun"],
 origin:"Kala Morrin grew up among Bothan archives and learned to listen before asking whom an allegation might benefit. Years of Jedi study turned that skepticism into respect for firsthand evidence.",
 firstAct:"An Ossus archive index is missing its provenance entry, and two witnesses give inconsistent dates.",
 secondAct:"Kala must mediate between guardians of protected records and civilian scholars who have a legitimate historical interest.",
 longArc:"Create a verified and safely releasable public reference. She cannot claim the future Ossus headship or retroactively become a massacre survivor without a valid age record.",
 flaw:"Delays decisions by demanding more evidence even when risk is already evident."
},
{
 id:"shado-liang",name:"Shado Liang",species:"Ithorian",eraABY:150,level:8,heroicClass:"Jedi",
 allegiance:"New Jedi Order",role:"Jedi healer and agricultural adviser",force:"trained",
 strength:10,dexterity:11,constitution:14,intelligence:14,wisdom:18,charisma:15,
 speciesModifiers:{wisdom:2,charisma:2,dexterity:-2},speciesRules:"core",
 specialTraits:["Ithorian physiology and environmental knowledge (exact special attack requires resolver)"],
 skills:["Use the Force","Treat Injury","Knowledge (life sciences)","Persuasion"],
 talentDirection:"Equilibrium and Force Control; medical skills",forcePowerDirection:["Move Object","Negate Energy"],
 origin:"Shado was raised on Felucia by Ithorian seed conservators and came to the Jedi after an epidemic ruined food crops. Their first loyalty is to the patients and farmers whose lives depend on lasting, practical relief.",
 firstAct:"A Dantooine relief council needs to select a viable crop without wasting the settlements' limited irrigation supplies.",
 secondAct:"Local growers distrust outsiders and have good reasons to challenge Shado's laboratory assumptions.",
 longArc:"Earn consent, demonstrate a sustainable crop trial, and show improved access to food. Shado is not yet Keeper of the later enclave and cannot use unimplemented healing or plant-manipulation powers.",
 flaw:"Compassion can make Shado promise relief that the available resources cannot yet deliver."
},
{
 id:"darth-xeran",name:"Darth Xeran",species:"Chiss",eraABY:150,level:9,heroicClass:"Jedi",
 allegiance:"House Murkhana, privately aligned",role:"Dark-side relic scholar",force:"trained",
 strength:10,dexterity:15,constitution:12,intelligence:18,wisdom:15,charisma:13,
 speciesModifiers:{intelligence:2},speciesRules:"supplement",
 specialTraits:["Bonus Trained Skill","Low-Light Vision","Sith title implies no automatic invulnerability"],
 skills:["Use the Force","Knowledge (galactic lore)","Use Computer","Perception"],
 talentDirection:"Force Sense, Telekinetic Power and analytical research",forcePowerDirection:["Force Grip","Move Object","Force Lightning"],
 origin:"A Chiss scientist trained to distrust prophecy, Xeran lost colleagues while chasing unverified ruins and gradually accepted Sith patrons who offered forbidden instruments. His studies are detailed, but the leaps in his conclusions often exceed the evidence.",
 firstAct:"He has a fractured mineral sample and a location claim that may point toward an ancient relic.",
 secondAct:"A rival researcher offers confirmation at a price; Xeran must distinguish real material evidence from planted Sith symbolism.",
 longArc:"Authenticate the artifact and choose its custody through encounters. His apprentice relationships, Rakatan powers and relic bonuses are not automatically his at campaign start.",
 flaw:"Obsessive pursuit of a discovery makes him vulnerable to deliberately fabricated proof."
},
{
 id:"kelvek",name:"Kelvek",species:"Muun",eraABY:147,level:8,heroicClass:"Noble",
 allegiance:"Former IGBC, detained independent archivist",role:"Imprisoned former finance executive and mentor",force:"none",
 strength:9,dexterity:10,constitution:11,intelligence:19,wisdom:15,charisma:14,
 speciesModifiers:{strength:-2,intelligence:4},speciesRules:"supplement",
 specialTraits:["Impose Order","Iron Will (+2 Will)","No Sith Force powers"],
 skills:["Knowledge (bureaucracy)","Knowledge (social sciences)","Use Computer","Persuasion"],
 talentDirection:"Educated and commercial negotiation",forcePowerDirection:[],
 origin:"On Muunilinst, Kelvek once helped manage structured credit arrangements for influential firms until he found that debt instruments were being used to capture public offices. A quiet refusal to erase an audit trail ended his career. He was imprisoned, then assigned to maintain the detention complex's library.",
 firstAct:"In the prison library in 147 ABY, he protects access to lawful study materials and teaches an unusually attentive young detainee how ownership and stewardship differ.",
 secondAct:"Outside agents try to exploit Kelvek's former contacts. Every lesson he shares must avoid exposing people whose lives depend on confidential records.",
 longArc:"Preserve the library and pass on disciplined financial thinking before his established later death; this is a past-tense flashback, not a living 150 ABY participant. D'mir's memories of Kelvek remain the authority for their personal history.",
 flaw:"His pride in intellectual control makes him slow to acknowledge what others learn from pain rather than books."
}
] as const;

export function alienRatingById(id:string){
 return GOC_ALIEN_STORY_RATINGS.find(n=>n.id===id)||null;
}
export function alienRatingByName(name:string){
 const normalized=(v:string)=>v.toLowerCase().replace(/[^a-z0-9]+/g,"");
 return GOC_ALIEN_STORY_RATINGS.find(n=>normalized(n.name)===normalized(name))||null;
}
export function npcAlienGmContinuity(name:string,yearABY:number) {
 const npc=alienRatingByName(name);
 if(!npc || yearABY!==npc.eraABY)return null;
 return {
  identity:{name:npc.name,species:npc.species,yearABY:npc.eraABY,allegiance:npc.allegiance,role:npc.role},
  story:{origin:npc.origin,firstAct:npc.firstAct,secondAct:npc.secondAct,longArc:npc.longArc,flaw:npc.flaw},
  proposedRatings:{level:npc.level,class:npc.heroicClass,abilityScores:{
   strength:npc.strength,dexterity:npc.dexterity,constitution:npc.constitution,
   intelligence:npc.intelligence,wisdom:npc.wisdom,charisma:npc.charisma,
  },trainedSkillFocus:npc.skills,talentDirection:npc.talentDirection,
    proposedForcePowers:npc.forcePowerDirection,speciesTraits:npc.specialTraits,
    speciesRuleReliability:npc.speciesRules},
  restriction:"GM editorial background and PROPOSED starting career ratings only. The authoritative saved character sheet wins. Do not transfer any proposed power, higher level, feat, skill, species modifier, trait, weapon, wealth, XP, allegiance change, completion, or title into gameplay without a validated species foundation and atomic lawful character advancement.",
 };
}
