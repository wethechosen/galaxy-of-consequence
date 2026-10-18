/**
 * GOC 150 ABY unified GM identity register.
 * Old 200 ABY sourcebooks are editorial inputs for the SAME 150 ABY campaign,
 * not a future population whose biographies or ranks can be pre-awarded.
 * Published Legends history through 138 ABY is the chronological foundation.
 *
 * IMPORTANT: editorial level/ability/Force directions below are not committed
 * Saga mechanics. npcMechanics() is the authoritative validated-sheet gateway.
 * A deceased character is never instantiated in a present-day scene by this file.
 */
import { CAMPAIGN_NPCS_150_ABY } from "./npc-canon-roster";
import { DMIR_STORY_NPCS } from "./dmir-story-npcs";
import { NPC_TEST_ROSTER } from "./npc-test-roster";
import { GOC_ALIEN_STORY_RATINGS } from "./npc-alien-story-ratings";
import { NPC_HISTORICAL_TIERS } from "./npc-historical-baselines";
import { SERALYTH_SAGA_SHEET } from "./seralyth-vhaelor";
import { experienceForLevel } from "@/original/lib/sagaAdvancement";

export type NpcSourceClass = "core-cast"|"personal-story"|"independent-simulation"|"documented-relative"|"sourcebook-candidate";
export type NpcLifeStatus = "living"|"deceased"|"unknown"|"not-established";
export type NpcMechanicalAuthority = "validated-career-candidate"|"authored-saga-sheet"|"editorial-rating-only"|"unresolved";
type Attributes = Readonly<{strength:number;dexterity:number;constitution:number;intelligence:number;wisdom:number;charisma:number}>;
export type GocNpcIndexEntry = Readonly<{
  id:string; name:string; eraABY:150; sourceClass:NpcSourceClass;
  species:string; homeworld:string; faction:string; role:string;
  biography:string; objective:string; privateKnowledge:string;
  lifeStatus:NpcLifeStatus; worldState:"active-candidate"|"historical-only"|"unintroduced-proposal";
  identitySource:string;
  design:Readonly<{
    level:number|null; priorCareerXp:number|null; experienceAuthority:"historical-origin-not-earned-in-play"|"unknown";
    abilityScores:Attributes|null; talentDirection:string|null;
    forcePowerDirection:readonly string[]; feats:"validator-owned"|"not-established";
    mechanicalAuthority:NpcMechanicalAuthority; caveat:string;
  }>;
}>;

const proposed:Record<string,{level:number;attributes?:Attributes;talent?:string;powers?:string[]}> = {
  "merek-tan":{level:5,attributes:{strength:10,dexterity:12,constitution:11,intelligence:16,wisdom:14,charisma:11},talent:"Educated / forensic analysis"},
  "alix-renn":{level:2,attributes:{strength:10,dexterity:12,constitution:10,intelligence:12,wisdom:12,charisma:14},talent:"Negotiation and customer intake"},
  "corren-tel":{level:3,attributes:{strength:10,dexterity:14,constitution:10,intelligence:14,wisdom:12,charisma:10},talent:"Craft and meticulous appraisal"},
  "vask-mora":{level:5,attributes:{strength:14,dexterity:12,constitution:14,intelligence:11,wisdom:10,charisma:12},talent:"Underworld negotiation and leadership"},
  "nerin-voss":{level:4,attributes:{strength:10,dexterity:11,constitution:11,intelligence:16,wisdom:13,charisma:10},talent:"Educated account reconciliation"},
  "tavrek-soll":{level:3,attributes:{strength:13,dexterity:12,constitution:13,intelligence:14,wisdom:11,charisma:9},talent:"Repair and field engineering"},
  "eira-senn":{level:4,attributes:{strength:9,dexterity:11,constitution:10,intelligence:15,wisdom:13,charisma:14},talent:"Legal advocacy and persuasion"},
  "selis-vara":{level:5,attributes:{strength:9,dexterity:12,constitution:11,intelligence:16,wisdom:13,charisma:13},talent:"Diplomacy and financial analysis"},
  "drell-one":{level:5,attributes:{strength:10,dexterity:14,constitution:10,intelligence:15,wisdom:12,charisma:11},talent:"Customs investigation"},
  "tazielle-vhaelor":{level:7,attributes:{strength:9,dexterity:12,constitution:12,intelligence:15,wisdom:14,charisma:16},talent:"Court political authority"},
  "rethan-vhaelor":{level:9,attributes:{strength:15,dexterity:13,constitution:14,intelligence:13,wisdom:12,charisma:13},talent:"Military command and defensive planning"},
  "shad-matik":{level:5,attributes:{strength:9,dexterity:12,constitution:10,intelligence:14,wisdom:13,charisma:16},talent:"Media influence and deception"},
  "sienna-dray":{level:8,attributes:{strength:12,dexterity:15,constitution:12,intelligence:14,wisdom:13,charisma:15},talent:"Starship operations and resourceful leadership"},
  "orin-baq":{level:7,attributes:{strength:10,dexterity:10,constitution:12,intelligence:13,wisdom:17,charisma:13},talent:"Healing and mediation"},
  "graccus-obaran":{level:8,attributes:{strength:11,dexterity:11,constitution:13,intelligence:16,wisdom:14,charisma:12},talent:"Audit enforcement"},
  "nyriss-kala":{level:6,attributes:{strength:10,dexterity:15,constitution:11,intelligence:14,wisdom:13,charisma:13},talent:"Counterintelligence and infiltration"}
};
const extra = [
 {id:"tazielle-vhaelor",name:"Lady Tazielle Vhaelor",species:"Human (Hapan)",homeworld:"Hapes",faction:"Hapes Consortium",role:"Noblewoman; Seralyth's mother",biography:"Influential Hapan noblewoman close to court politics and the succession circle; mother of Lady Seralyth Vhaelor.",objective:"Protect her household's autonomy and its political position.",privateKnowledge:"Knows that an extraordinary private training program exists; the outside Sith instructor's identity and her own awareness must be adjudicated separately.",sourceClass:"documented-relative" as const},
 {id:"rethan-vhaelor",name:"Lord-Commander Rethan Vhaelor",species:"Human (Hapan)",homeworld:"Hapes",faction:"Hapan military and household security",role:"Senior military and security commander; Seralyth's father",biography:"Senior Hapan security figure and father of Lady Seralyth Vhaelor.",objective:"Defend his household and preserve military credibility.",privateKnowledge:"Knowledge of the daughter's private training is limited; do not grant awareness of Korvalis or the XIII automatically.",sourceClass:"documented-relative" as const}
];
const sourcebookOnly = [
 {id:"shad-matik",name:"Shad Matik",species:"Human",homeworld:"Unestablished",faction:"CSA-aligned HoloNet media",role:"Former reporter and propaganda professional",biography:"A former HoloNet reporter who prepares public-affairs messaging for corporate interests.",objective:"Shape the public narrative while managing private misgivings.",privateKnowledge:"Possible whistleblower motives are not accomplished facts."},
 {id:"sienna-dray",name:"Sienna Dray",species:"Human (cybernetics)",homeworld:"Unestablished",faction:"Outer Rim smugglers",role:"Independent smuggling leader",biography:"Cybernetically augmented smuggler who develops alliances among free traders and pirate crews.",objective:"Protect her crew and expand her independent operations.",privateKnowledge:"Sith-related intelligence is not automatically available."},
 {id:"orin-baq",name:"Master Orin Baq",species:"Ithorian",homeworld:"Ithor",faction:"Neutral relief network",role:"Monk and healer",biography:"An Ithorian medical relief worker operating a neutral station.",objective:"Preserve the station's neutrality and care for wounded visitors.",privateKnowledge:"Older sourcebook alleged past rebellion affiliations; unverified in 150 ABY."},
 {id:"graccus-obaran",name:"Graccus Obaran",species:"Unestablished",homeworld:"Unestablished",faction:"IGFED",role:"Financial enforcement official",biography:"An institutional enforcement specialist whose strict audit methods risk creating political opposition.",objective:"Pursue defensible inspections without unearned extraordinary powers.",privateKnowledge:"His 200 ABY executive title is not presumed in 150 ABY."},
 {id:"nyriss-kala",name:"Nyriss Kala",species:"Human (Hapan)",homeworld:"Hapes",faction:"Hapan intelligence service",role:"Intelligence field operative",biography:"A Hapan intelligence agent working to understand the Corporate Sector's power networks.",objective:"Balance the security of her service with private questions of loyalty.",privateKnowledge:"A possible Jedi defection is not a completed storyline."}
];
const normalizedSpecies = (x:string) => x.startsWith("Human (") || x==="Human (cybernetics)" ? "Human" : x;
const mkDesign=(id:string,species:string) => {
  const tier=NPC_HISTORICAL_TIERS[id];
  const rating=GOC_ALIEN_STORY_RATINGS.find(x=>x.id===id);
  const independent=proposed[id];
  const isSeralyth=id==="seralyth-vhaelor";
  const lev=isSeralyth?SERALYTH_SAGA_SHEET.level:(tier?.level??rating?.level??independent?.level??null);
  const abilities:Attributes|null= isSeralyth?{
    strength:SERALYTH_SAGA_SHEET.abilities.str,dexterity:SERALYTH_SAGA_SHEET.abilities.dex,
    constitution:SERALYTH_SAGA_SHEET.abilities.con,intelligence:SERALYTH_SAGA_SHEET.abilities.int,
    wisdom:SERALYTH_SAGA_SHEET.abilities.wis,charisma:SERALYTH_SAGA_SHEET.abilities.cha
  }:(rating?
    {strength:rating.strength,dexterity:rating.dexterity,constitution:rating.constitution,intelligence:rating.intelligence,wisdom:rating.wisdom,charisma:rating.charisma}:
    independent?.attributes||null);
  const authority:NpcMechanicalAuthority=isSeralyth?"authored-saga-sheet":
    tier?"validated-career-candidate":
    rating||independent?"editorial-rating-only":"unresolved";
  return {
    level:lev,priorCareerXp:lev!==null?experienceForLevel(lev):null,
    experienceAuthority:lev!==null?"historical-origin-not-earned-in-play" as const:"unknown" as const,
    abilityScores:abilities,talentDirection:rating?.talentDirection||independent?.talent||null,
    forcePowerDirection:isSeralyth?[...SERALYTH_SAGA_SHEET.forcePowerSuite]:rating?.forcePowerDirection||independent?.powers||[],
    feats:"validator-owned" as const,mechanicalAuthority:authority,
    caveat:isSeralyth?"Authored Saga sheet; validate against resolver before any automatic advancement.":
      tier?"Generate exact talents, feats, powers, defenses, HP and XP through the Saga advancement validator; never award this baseline as turn XP.":
      rating?"Editorial species-specific rating only. Resolve species rules, complete advancement and validate before use in gameplay.":
      independent?"Proposed NPC career and attributes are editorial until certified through Saga Edition validators.":
      "Identity established, but no approved numeric character sheet; do not fabricate stats."
  };
};
const rows:GocNpcIndexEntry[]=[];
for (const n of CAMPAIGN_NPCS_150_ABY) {
 rows.push({id:n.id,name:n.name,eraABY:150,sourceClass:"core-cast",species:n.species,homeworld:n.birthworld,faction:n.affiliation,role:n.role150,
   biography:n.biography,objective:n.objective,privateKnowledge:n.confidential,lifeStatus:"living",
   worldState:"active-candidate",identitySource:"lib/npc-canon-roster.ts (200 ABY authored concepts reconciled into 150 ABY)",
   design:mkDesign(n.id,n.species)});
}
for (const n of DMIR_STORY_NPCS) {
 const id=n.id==="korvalis"?"darth-korvalis":n.id;
 const existing=rows.find(x=>x.id===id);
 if(existing)continue; // Same person, never instantiate a second Korvalis.
 const historical=n.status==="dead";
 rows.push({id,name:n.name,eraABY:150,sourceClass:"personal-story",species:n.species,homeworld:n.locationHint,faction:
   n.relationship==="parent"?"Holloràn family":n.id==="kelvek"?"Independent former IGBC":
   n.id==="seralyth-vhaelor"?"Hapes Consortium":n.id==="vask-mora"||n.id==="nerin-voss"?"Black Sun":
   n.id==="selis-vara"?"Hapes Consortium":n.id==="drell-one"?"Corporate Sector Authority":"Independent",
   role:n.role,biography:n.background,objective:n.objective,privateKnowledge:n.privateKnowledge,
   lifeStatus:historical?"deceased":n.status==="unknown"?"unknown":"living",
   worldState:historical?"historical-only":n.firstKnownEncounter==="proposed"?"unintroduced-proposal":"active-candidate",
   identitySource:"lib/dmir-story-npcs.ts",design:mkDesign(id,n.species)});
}
for (const n of NPC_TEST_ROSTER.filter(n=>n.id!=="kelvek")) {
 if(rows.some(x=>x.id===n.id))continue;
 rows.push({id:n.id,name:n.name,eraABY:150,sourceClass:"independent-simulation",species:n.species,homeworld:n.homeworld,
   faction:n.allegiance,role:n.role,biography:n.background,objective:n.objective,privateKnowledge:"",
   lifeStatus:"living",worldState:"active-candidate",identitySource:"lib/npc-test-roster.ts (test fixture is NOT a committed world event)",
   design:mkDesign(n.id,n.species)});
}
for(const n of extra)rows.push({id:n.id,name:n.name,eraABY:150,sourceClass:n.sourceClass,species:n.species,
 homeworld:n.homeworld,faction:n.faction,role:n.role,biography:n.biography,objective:n.objective,
 privateKnowledge:n.privateKnowledge,lifeStatus:"living",worldState:"active-candidate",
 identitySource:"lib/seralyth-vhaelor.ts, parents section",design:mkDesign(n.id,n.species)});
for(const n of sourcebookOnly)rows.push({id:n.id,name:n.name,eraABY:150,sourceClass:"sourcebook-candidate",
 species:n.species,homeworld:n.homeworld,faction:n.faction,role:n.role,biography:n.biography,objective:n.objective,
 privateKnowledge:n.privateKnowledge,lifeStatus:"not-established",worldState:"unintroduced-proposal",
 identitySource:"Galaxy_of_Consequence_Sourcebook, Additional NPCs; requires campaign approval",
 design:mkDesign(n.id,n.species)});
export const GOC_NPC_INDEX_150_ABY:readonly GocNpcIndexEntry[]=Object.freeze(rows);
export const GOC_NPC_INDEX_BY_ID:ReadonlyMap<string,GocNpcIndexEntry>=new Map(rows.map(n=>[n.id,n]));
export const GOC_NPC_INDEX_SUMMARY=Object.freeze({
 total:rows.length,core:rows.filter(n=>n.sourceClass==="core-cast").length,
 personal:rows.filter(n=>n.sourceClass==="personal-story").length,
 simulations:rows.filter(n=>n.sourceClass==="independent-simulation").length,
 relatives:rows.filter(n=>n.sourceClass==="documented-relative").length,
 pendingSourcebook:rows.filter(n=>n.sourceClass==="sourcebook-candidate").length
});
/** Historic Legends personalities are continuity anchors, not newly spawned 150 ABY NPCs. */
export const GOC_FEL_LEGENDS_BASELINE=Object.freeze({
 empireRestoredABY:138,imperialKnightsFoundedBeforeABY:130,
 roanFel:"Deceased after 138 ABY; not a living 150 ABY combatant.",
 marasiahFel:"Succeeded Roan Fel after the 138 ABY war; later fate is determined only by established GOC state.",
 jaggedFel:"Founder of the Fel dynastic Imperial lineage; historical only.",
 aliyahFel:"GOC-original Fel dynast; succession and title require actual recorded history.",
 knightDoctrine:"Imperial Knights reject the dark side; loyalty to a fallen sovereign does not override duty to resist their fall."
});
