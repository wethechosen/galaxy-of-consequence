/**
 * Complete GM-side 150 ABY character dossiers, including historical-only people.
 * This read-only reconstruction never changes authoritative saves or reveals secrets
 * to players. Character creation and advancement use the ACTUAL Saga validators.
 */
import {GOC_NPC_INDEX_150_ABY, type GocNpcIndexEntry} from "./npc-canonical-index";
import {GOC_ORIGIN_BY_ID, type OriginRecord} from "./npc-origin-records-150aby";
import {npcMechanics} from "./npc-mechanics";
import {reconstructCoreNpc} from "./npc-historical-baselines";
import {SERALYTH_SAGA_SHEET} from "./seralyth-vhaelor";
import {sagaSpecies} from "@/original/lib/sagaSpecies";
import {experienceForLevel,progressionStatus} from "@/original/lib/sagaAdvancement";
import type {NpcTestSubject} from "./npc-test-roster";
import type {DatapadSnapshot} from "./datapad-save";
import {sagaSkillModifier} from "./saga-character";

const MOD=(score:number)=>Math.floor((score-10)/2);
const byId=new Map<string,DefinitiveNpcDossier>();
const SKILLS:Readonly<Record<string,string>>={Acrobatics:"dexterity",Climb:"strength",Deception:"charisma",
 Endurance:"constitution","Gather Information":"charisma",Initiative:"dexterity",Jump:"strength",Mechanics:"intelligence",
 Perception:"wisdom",Persuasion:"charisma",Pilot:"dexterity",Ride:"dexterity",Stealth:"dexterity",Survival:"wisdom",
 Swim:"strength","Treat Injury":"wisdom","Use Computer":"intelligence","Use the Force":"charisma"};
export type DefinitiveNpcDossier={
 id:string;name:string;eraABY:150;ageIn150:number;bornABY:number;birthplace:string;
 species:string;affiliation:string;role:string;location:string;
 appearance:string;personality:string;flaw:string;importantRelationships:string;
 biography:string;objective:string;gmPrivateKnowledge:string;lifeStatus:string;
 canonProvenance:string;worldPresence:"living-established"|"living-unintroduced"|"deceased-historical"|"sourcebook-origin-unintroduced";
 combat:{certification:"saga-validated-prior-career"|"original-authored-saga-multiclass";
 level:number;careerXp:number;originXpNotEarnedInPlay:true;classLevels:Record<string,number>;
 baseAttackBonus:number;abilities:Record<string,number>;maxHitPoints:number;
 defenses:{reflex:number;fortitude:number;will:number};damageThreshold:number;
 meleeAttack:number;rangedAttack:number;skills:Record<string,number>;
 trainedSkills:readonly string[];feats:readonly string[];talents:readonly string[];
 forceSensitive:boolean;forcePowers:readonly string[];languages:readonly string[];
 speciesTraits:unknown;sourceCitation:string;
 };
 equipment:{baselineLoadout:readonly string[];authority:"noncommittal-GM-starting-loadout";neverGrantAutomatically:true};
};
function heroSnapshot(entry:GocNpcIndexEntry,origin:OriginRecord){
 const normalized=sagaSpecies(entry.species);
 if(!normalized)throw Error("No verified Saga species: "+entry.name+" / "+entry.species);
 const identity:NpcTestSubject={id:entry.id,name:entry.name,species:normalized.name,age:150-origin.birthABY,
  yearABY:150,homeworld:origin.birthplace,background:entry.biography,allegiance:entry.faction,
  role:entry.role,classId:(origin.careerClass==="jedi"?"scoundrel":origin.careerClass),
  appearance:origin.appearance,objective:entry.objective,location:entry.homeworld,
  destination:entry.homeworld,subject:"Private 150 ABY origin record",contact:"No free contacts",talentId:"educated"};
 const seed:DatapadSnapshot={character:{name:identity.name,species:normalized.name,level:1,experience:0,maxHitPoints:1},
  gameState:{health:1,conditionTrack:0,inventory:[],turnEvents:[]},messages:[],comms:[],settings:{}};
 let built:DatapadSnapshot;
 try {built=reconstructCoreNpc(seed,identity,
  {level:origin.careerLevel,classId:origin.careerClass,reason:"GM-authored 150 ABY private starting career; no player XP awarded"});
 } catch(error) {throw new Error(entry.id+": "+String((error as Error)?.message||error));}
 const character=built.character as Record<string,unknown>;
 if(!character||Number(character.level)!==origin.careerLevel||!progressionStatus(character).buildConsistent||
   progressionStatus(character).pendingLevels!==0)throw Error("Illegal Saga progression: "+entry.name);
 return character;
}
function charStringArray(value:unknown):string[]{
 if(Array.isArray(value))return value.map(x=>typeof x==="string"?x:(x as {name?:string})?.name||"").filter(Boolean);
 return String(value||"").split(",").map(s=>s.trim()).filter(Boolean);
}
function dossier(entry:GocNpcIndexEntry):DefinitiveNpcDossier{
 const origin=GOC_ORIGIN_BY_ID.get(entry.id);
 if(!origin)throw Error("Missing individualized 150 ABY origin "+entry.id);
 const authored=entry.id==="seralyth-vhaelor";
 const core=entry.sourceClass==="core-cast";
 const coreProfile=core?npcMechanics(entry.name):null;
 const char=authored?null:coreProfile?.status==="validated-core-build"?
   coreProfile.character as Record<string,unknown>:heroSnapshot(entry,origin);
 if(!authored&&!char)throw Error("No mechanical history "+entry.id);
 const s=SERALYTH_SAGA_SHEET;
 const level=authored?s.level:Number(char!.level);
 const ability=authored?{strength:s.abilities.str,dexterity:s.abilities.dex,constitution:s.abilities.con,
  intelligence:s.abilities.int,wisdom:s.abilities.wis,charisma:s.abilities.cha}:
  char!.abilityScores as Record<string,number>;
 const d=authored?{reflex:s.reflexDefense,fortitude:s.fortitudeDefense,will:s.willDefense}:
  char!.defenses as {reflex:number;fortitude:number;will:number};
 const bab=authored?s.baseAttackBonus:Number(char!.baseAttackBonus);
 const validSource=authored?"Existing authored Scoundrel 1/Jedi 7 Saga build, rule-checked in seralyth-vhaelor.test.ts":
  String((char!.speciesTraitsApplied as {source?:string})?.source||"Saga Foundation + Advancement");
 const feats=authored?[...s.startingFeats,s.multiclassFeat,s.humanBonusFeat,
  ...s.generalFeats.map(f=>f.name),...s.jediBonusFeats.map(f=>f.name)]:charStringArray(char!.featSelections);
 const talentList=authored?s.talents.map(t=>t.name):charStringArray(char!.talentSelections);
 const powers=authored?[...s.forcePowerSuite]:Array.isArray(char!.forcePowerSelections)?
  (char!.forcePowerSelections as Array<{name?:string;id?:string}>).map(x=>x.name||x.id||"").filter(Boolean):[];
 const skillBonuses=authored?{...s.skills}:Object.fromEntries(Object.entries(SKILLS).map(([skill,ab])=>
  [skill,sagaSkillModifier(char!,{conditionTrack:0},skill,ab)]));
 const cLevels=authored?Object.fromEntries(s.classes.map(c=>[c.name.toLowerCase(),c.levels])):char!.classLevels as Record<string,number>;
 const trained=authored?[...s.training.trainedSkills]:charStringArray(char!.trainedSkills);
 const baseTraits=authored?sagaSpecies("Human"):sagaSpecies(String(char!.species));
 const known=authored?true:(char!.forceSensitive==="Yes"||feats.some(f=>/force sensitivity/i.test(f))||
  powers.length>0);
 const dead=entry.lifeStatus==="deceased";
 return {
  id:entry.id,name:entry.name,eraABY:150,ageIn150:150-origin.birthABY,bornABY:origin.birthABY,
  birthplace:origin.birthplace,species:entry.species,affiliation:entry.faction,role:entry.role,
  location:entry.homeworld,appearance:origin.appearance,personality:origin.temperament,
  flaw:origin.liability,importantRelationships:origin.relationships,
  biography:origin.lifeHistory+" "+entry.biography,objective:entry.objective,
  gmPrivateKnowledge:entry.privateKnowledge,lifeStatus:entry.lifeStatus,
  canonProvenance:entry.identitySource+"; authored historical background in npc-origin-records-150aby.ts",
  worldPresence:dead?"deceased-historical":entry.sourceClass==="sourcebook-candidate"?"sourcebook-origin-unintroduced":
   entry.worldState==="unintroduced-proposal"?"living-unintroduced":"living-established",
  combat:{
   certification:authored?"original-authored-saga-multiclass":"saga-validated-prior-career",
   level,careerXp:experienceForLevel(level),originXpNotEarnedInPlay:true,
   classLevels:cLevels,baseAttackBonus:bab,abilities:ability,maxHitPoints:authored?s.maxHitPoints:Number(char!.maxHitPoints),
   defenses:d,damageThreshold:authored?s.damageThreshold:Number(char!.damageThreshold),
   meleeAttack:bab+MOD(ability.strength),rangedAttack:bab+MOD(ability.dexterity),
   skills:skillBonuses,trainedSkills:trained,feats,talents:talentList,
   forceSensitive:known,forcePowers:powers,
   languages:authored?["Basic","Hapan"]:charStringArray(char!.languages),
   speciesTraits:baseTraits,sourceCitation:validSource
  },
  equipment:{baselineLoadout:authored?[...s.equipment]:origin.assumedStartingEquipment,
   authority:"noncommittal-GM-starting-loadout",neverGrantAutomatically:true}
 };
}
export function npcDefinitiveDossier150ABY(idOrName:string):DefinitiveNpcDossier{
 const query=String(idOrName||"").toLowerCase();
 const actor=GOC_NPC_INDEX_150_ABY.find(x=>x.id===query||x.name.toLowerCase()===query);
 if(!actor)throw Error("No canonical GOC NPC: "+idOrName);
 const saved=byId.get(actor.id);
 if(saved)return structuredClone(saved);
 const result=dossier(actor);
 byId.set(actor.id,result);
 return structuredClone(result);
}
export function allNpcDefinitiveDossiers150ABY():DefinitiveNpcDossier[]{
 return GOC_NPC_INDEX_150_ABY.map(n=>npcDefinitiveDossier150ABY(n.id));
}
