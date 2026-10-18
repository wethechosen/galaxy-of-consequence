import type { DatapadSnapshot } from "./datapad-save";
import { applySagaFoundation, applySagaAdvancement, availableClassSkills, foundationRequirements, SAGA_LANGUAGE_OPTIONS, advancementRequirements, availableFeats, availableTalents, forcePowerChoiceRequirements, experienceForLevel, progressionStatus } from "@/original/lib/sagaAdvancement";
import type { NpcTestSubject } from "./npc-test-roster";
import { sagaSpecies } from "@/original/lib/sagaSpecies";
import { GOC_ALIEN_STORY_RATINGS } from "./npc-alien-story-ratings";

type Heroic = "jedi"|"noble"|"soldier"|"scoundrel"|"scout";
type Tier = {level:number;classId:Heroic;reason:string};
export const NPC_HISTORICAL_TIERS:Readonly<Record<string,Tier>> = {
  "darth-korvalis":{level:12,classId:"jedi",reason:"Hidden Sith master, canonical NPC challenge-level 12 baseline"},
  "nir-varek":{level:11,classId:"jedi",reason:"Trained House Murkhana Sith claimant"},
  "jaed-sultar":{level:9,classId:"jedi",reason:"Veteran Imperial Knight commander"},
  "aliyah-fel":{level:8,classId:"jedi",reason:"Experienced Fel dynast trained with Imperial Knights"},
  "kor-vess":{level:8,classId:"soldier",reason:"Established Mandalorian clan commander"},
  "calen-vardex":{level:8,classId:"noble",reason:"Experienced Imperial sector governor"},
  "tavia-kuat-ardos":{level:7,classId:"noble",reason:"Experienced Kuat/CSA industrial negotiator"},
  "airi-djo":{level:7,classId:"noble",reason:"Hapan royal court negotiator, not a trained Jedi"},
  "orlan-vale":{level:6,classId:"soldier",reason:"Former garrison supply sergeant"},
  "tesa-norr":{level:5,classId:"soldier",reason:"Former defensive fleet quartermaster"},
  "sorin-pell":{level:5,classId:"noble",reason:"Established archive conservator"},
  "jena-lorr":{level:4,classId:"noble",reason:"Established corporate compliance auditor"},
  "lenna-fen":{level:4,classId:"noble",reason:"Medcenter procurement specialist"},
  "mirren-sol":{level:4,classId:"scout",reason:"Experienced frontier survey specialist"},
  "ari-vess":{level:3,classId:"scoundrel",reason:"Taris salvage registry runner"},
  "torin-kade":{level:3,classId:"scoundrel",reason:"Corellian shipyard claims technician"},
  "bren-varo":{level:3,classId:"scout",reason:"Socorro route guide"},
};
const choose=(options:Array<{id:string}>,priority:string[])=>priority.find(id=>options.some(x=>x.id===id))||
  options.find(x=>!["linguist","skill-training","skill-focus","force-training"].includes(x.id))?.id||options[0]?.id||"";
const languages=(c:Record<string,unknown>,required:number)=>{
  const automatic=sagaSpecies(c.species)?.languages||[];
  const existing=new Set([...automatic,...String(c.languages||"").split(",")].map(v=>v.trim().toLowerCase()));
  return SAGA_LANGUAGE_OPTIONS.filter((v:{id:string;name:string})=>v.id!=="basic"&&!existing.has(v.name.toLowerCase()))
    .slice(0,required).map((v:{id:string})=>v.id);
};
function initialAbilities(cl:Heroic) {
  if(cl==="jedi")return {strength:14,dexterity:13,constitution:13,intelligence:12,wisdom:14,charisma:13};
  if(cl==="soldier")return {strength:13,dexterity:12,constitution:14,intelligence:13,wisdom:12,charisma:10};
  if(cl==="noble")return {strength:10,dexterity:12,constitution:12,intelligence:14,wisdom:12,charisma:13};
  if(cl==="scout")return {strength:11,dexterity:13,constitution:13,intelligence:12,wisdom:14,charisma:10};
  return {strength:10,dexterity:14,constitution:12,intelligence:13,wisdom:12,charisma:13};
}
function foundation(previous:DatapadSnapshot,id:string,tier:Tier):DatapadSnapshot {
  const profile = sagaSpecies(previous.character?.species);
  const base = initialAbilities(tier.classId);
  const char={...previous.character,abilityScores:Object.fromEntries(Object.entries(base).map(([key,value])=>[key,value+Number(profile?.adjustments[key]||0)])),level:1,experience:0,
    forceSensitive:"Unknown"} as Record<string,unknown>;
  for(const key of ["heroicClass","classLevels","featSelections","talentSelections","forcePowerSelections",
    "feats","talents","forcePowers","trainedSkills","languages","hitPointHistory","maxHitPoints",
    "defenses","damageThreshold","baseAttackBonus","sagaStats","mechanicsPending"])delete char[key];
  const gameState={...previous.gameState,advancementHistory:[],levelUpAvailable:false,forcePoints:5};
  const seed={...previous,character:char,gameState} as DatapadSnapshot;
  const available=availableClassSkills(char,tier.classId);
  const preferred=tier.classId==="jedi"?["use-the-force","perception","knowledge-galactic-lore","initiative"]:
    tier.classId==="noble"?["persuasion","use-computer","knowledge-bureaucracy","perception"]:
    tier.classId==="soldier"?["knowledge-tactics","perception","use-computer","endurance"]:
    ["perception","survival","mechanics","use-computer"];
  const skills=[...new Set([...preferred,...available.map((x:{id:string})=>x.id)])]
    .filter(id=>available.some((x:{id:string})=>x.id===id))
    .slice(0,Number(foundationRequirements(char,tier.classId).trainedSkillCount));
  const choices={advancementId:"npc-origin-"+id,classId:tier.classId,
    trainedSkillIds:skills,generalFeatId:"improved-defenses",humanBonusFeatId:profile?.name==="Human"?"toughness":undefined,
    talentId:tier.classId==="jedi"?"force-perception":tier.classId==="soldier"?"armored-defense":
      tier.classId==="scout"?"acute-senses":tier.classId==="noble"?"educated":"knack",
    languageIds:languages(char,Number(foundationRequirements(char,tier.classId).bonusLanguageCount))};
  return applySagaFoundation(seed,choices,"2026-10-16T00:00:00.000Z") as DatapadSnapshot;
}
function advance(current:DatapadSnapshot,id:string,tier:Tier):DatapadSnapshot {
  const char=current.character as Record<string,unknown>;
  const next=Number(char.level)+1;
  const req=advancementRequirements(char,tier.classId) as {
    classBonusFeatRequired?:boolean;generalFeatRequired?:boolean;
    talentRequired?:boolean;bonusLanguageCount?:number;
  };
  const choices:Record<string,unknown>={advancementId:"npc-origin-"+id+"-level-"+next,
    classId:tier.classId,abilityIncreases:next%4===0?
      tier.classId==="jedi"?["wisdom","constitution"]:["constitution","dexterity"]:[],
    trainedSkillIds:[],languageIds:[],forcePowerIds:[]};
  if(req.classBonusFeatRequired)
    choices.classBonusFeatId=choose(availableFeats(char,tier.classId,true),
      ["combat-reflexes","quick-draw","running-attack","weapon-focus-lightsabers",
       "dodge","armor-proficiency-heavy","point-blank-shot","toughness"]);
  if(req.generalFeatRequired){
    const preferred=tier.classId==="jedi"?
      next<=9?"force-training":"force-boon":
      next%2===0?"improved-damage-threshold":"combat-reflexes";
    choices.generalFeatId=choose(availableFeats(char,tier.classId,false),
      [preferred,"dodge","combat-reflexes","strong-in-force","quick-draw","improved-damage-threshold","martial-arts-1","toughness"]);
  }
  if(req.talentRequired){
    const choicesList=availableTalents(char,tier.classId,current.gameState)
      .flatMap((t:{talents:Array<{id:string}>})=>t.talents);
    choices.talentId=choose(choicesList,tier.classId==="jedi"?
      ["telekinetic-power","force-focus","equilibrium","foresight","telekinetic-savant"]:
      tier.classId==="noble"?["wealth","educated","inspire-confidence"]:
      tier.classId==="soldier"?["improved-armored-defense","battle-analysis","indomitable","melee-smash"]:
      ["improved-initiative","evasion","expert-tracker","jury-rigger"]);
  }
  const forceCount=Number(forcePowerChoiceRequirements(char,choices).forcePowerCount||0);
  const dark=["darth-korvalis","nir-varek"].includes(id);
  const spells=dark?["force-grip","force-lightning","move-object","negate-energy","force-slam","surge"]:
    ["move-object","negate-energy","force-thrust","force-stun","surge","battle-strike"];
  choices.forcePowerIds=Array.from({length:forceCount},(_,i)=>spells[i%spells.length]);
  // Linguist can be awarded by a class-bonus feat chosen above. Recalculate
  // requirements with all selections rather than using the pre-selection count.
  choices.languageIds=languages(char,Number((advancementRequirements(char,tier.classId,choices) as {bonusLanguageCount?:number}).bonusLanguageCount||0));
  return applySagaAdvancement(current,choices,()=>5,"2026-10-16T00:00:00.000Z") as DatapadSnapshot;
}
/** Spend only genuinely earned XP through the same validated Saga level-up path. */
export function advanceNpcEarnedXp(snapshot:DatapadSnapshot,npc:NpcTestSubject):DatapadSnapshot {
  const profile=NPC_HISTORICAL_TIERS[npc.id];
  if(!profile||npc.species!=="Human")return snapshot;
  let result=snapshot;
  for(let next=0;next<20;next++){
    const progress=progressionStatus(result.character||{});
    if(!progress.advancementAvailable)return result;
    result=advance(result,npc.id,profile);
  }
  throw Error("Exceeded maximum player advancement rounds");
}
/** Preserves completed story/ledger turns. Starting XP is audited separately from XP earned during tests. */
export function reconstructCoreNpc(snapshot:DatapadSnapshot,npc:NpcTestSubject,explicitTier?:Tier):DatapadSnapshot{
  const alien = GOC_ALIEN_STORY_RATINGS.find(entry=>entry.id===npc.id);
  const tier=explicitTier || NPC_HISTORICAL_TIERS[npc.id] || (alien && sagaSpecies(npc.species) ? {level:alien.level,classId:alien.heroicClass.toLowerCase() as Heroic,reason:"GM-designed 150 ABY alien prior career with verified Saga Core species foundation"}:null);
  if(!tier)return snapshot;
  if(!snapshot.character)throw Error("NPC has no saved character");
  if(!sagaSpecies(npc.species))throw Error("Nonhuman racial traits require species rules validation");
  if((snapshot.character as Record<string,unknown>).npcHistoricalBaselineId==="150aby-"+npc.id)return snapshot;
  if(Number(snapshot.character.level)!==1)throw Error("Manual review: existing character advanced beyond level one");
  const xpEarned=Math.max(0,Number(snapshot.character.experience)||0);
  const targetXp=experienceForLevel(tier.level);
  let updated=foundation(snapshot,npc.id,tier);
  updated={...updated,character:{...updated.character,experience:xpEarned+targetXp}} as DatapadSnapshot;
  for(let level=2;level<=tier.level;level++)updated=advance(updated,npc.id,tier);
  if(progressionStatus(updated.character||{}).pendingLevels!==0)
    throw Error("The Saga builder left unallocated advancement choices");
  if(JSON.stringify(updated.gameState.turnEvents||[])!==JSON.stringify(snapshot.gameState.turnEvents||[]))
    throw Error("Backstory build changed authoritative saved events");
  const originalHp=Number(snapshot.gameState.health)||0;
  const previousMax=Number(snapshot.character?.maxHitPoints||originalHp);
  const newMax=Number(updated.character?.maxHitPoints);
  return {...updated,
    character:{...updated.character,npcHistoricalBaselineId:"150aby-"+npc.id,
      npcStartingLevel:tier.level,npcStartingXp:targetXp,npcEarnedTestXp:xpEarned,
      npcHistoricalReason:tier.reason,npcPrestigeClass:"Not asserted without prerequisites"},
    gameState:{...updated.gameState,health:Math.min(newMax,Math.max(0,originalHp+newMax-previousMax)),
      npcCareerAudit:[...((snapshot.gameState.npcCareerAudit as unknown[])||[]),
        {id:"150aby-"+npc.id,fromLevel:1,toLevel:tier.level,
          historicalXp:targetXp,previouslyEarnedXp:xpEarned,reason:tier.reason,
          source:"GM 150 ABY prior-career reconstruction using validated Saga heroic choices"}]},
  } as DatapadSnapshot;
}
export function reconstructHumanNpc(snapshot:DatapadSnapshot,npc:NpcTestSubject):DatapadSnapshot{
  if(npc.species!=="Human")throw Error("Use the verified species foundation for a nonhuman character.");
  return reconstructCoreNpc(snapshot,npc);
}
