import type { DatapadSnapshot } from "./datapad-save";
import { ALL_NPC_TEST_ROSTER, type NpcTestSubject } from "./npc-test-roster";
import { GOC_NPC_INDEX_150_ABY } from "./npc-canonical-index";
import { NPC_HISTORICAL_TIERS, reconstructCoreNpc } from "./npc-historical-baselines";
import { GOC_ALIEN_STORY_RATINGS } from "./npc-alien-story-ratings";
import { progressionStatus } from "@/original/lib/sagaAdvancement";
import { sagaSkillModifier } from "./saga-character";
import { sagaSpecies, speciesTraitContext } from "@/original/lib/sagaSpecies";

const key = (name: unknown) => String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const skills: Record<string, string> = { Acrobatics:"dexterity", Climb:"strength", Deception:"charisma", Endurance:"constitution", "Gather Information":"charisma", Initiative:"dexterity", Jump:"strength", Mechanics:"intelligence", Perception:"wisdom", Persuasion:"charisma", Pilot:"dexterity", "Ride":"dexterity", Stealth:"dexterity", Survival:"wisdom", Swim:"strength", "Treat Injury":"wisdom", "Use Computer":"intelligence", "Use the Force":"charisma" };
export type NpcMechanics = {
  id: string; name: string; status: "validated-core-build" | "pending-validation";
  provenance: string; reason?: string; character?: Record<string, unknown>;
  skillModifiers?: Record<string, number>; equipmentStatus: "unestablished";
  speciesTraits?: unknown; storyTraits?: unknown;
};
const templates = new Map<string, NpcMechanics>();

/** GM-only build, never a player reward or evidence of an NPC's presence. */
export function npcMechanics(name: string): NpcMechanics {
  const indexed=GOC_NPC_INDEX_150_ABY.find(n=>key(n.name)===key(name));
  const safeSpecies=indexed?.species.startsWith("Human (")?"Human":indexed?.species;
  const proposedRole=indexed?.role.toLowerCase()||"";
  const classId:NpcTestSubject["classId"]=/naval|fleet|military|commander|guard|trooper|security/i.test(proposedRole)?"soldier":
    /smuggl|trader|tailor|criminal|fixer|mechanic|technician|freight/i.test(proposedRole)?"scoundrel":"noble";
  const extraIdentity:NpcTestSubject|undefined=indexed&&indexed.worldState!=="historical-only"&&
    indexed.sourceClass!=="sourcebook-candidate"&&indexed.id!=="seralyth-vhaelor"&&safeSpecies?{
    id:indexed.id,name:indexed.name,species:safeSpecies,age:"Unknown",yearABY:150,
    homeworld:indexed.homeworld,background:indexed.biography,allegiance:indexed.faction,
    role:indexed.role,classId,appearance:"No established visual description",
    objective:indexed.objective,location:indexed.homeworld,destination:indexed.homeworld,
    subject:"Verified job records",contact:"No contact automatically established",talentId:"educated"
  }:undefined;
  const identity = ALL_NPC_TEST_ROSTER.find(npc => key(npc.name) === key(name))||extraIdentity;
  const rating = GOC_ALIEN_STORY_RATINGS.find(npc => key(npc.name) === key(name));
  const proposedTier=identity&&indexed&&indexed.design.level!==null&&!NPC_HISTORICAL_TIERS[identity.id]&&!rating?
    {level:indexed.design.level,classId:identity.classId,reason:"GM-designed GOC 150 ABY prior career; level and ability proposals do not constitute earned XP"}:undefined;
  const id = identity?.id || rating?.id || key(name);
  const cached = templates.get(id);
  if (cached) return structuredClone(cached);
  const pending: NpcMechanics = { id, name, status:"pending-validation", equipmentStatus:"unestablished",
    speciesTraits:speciesTraitContext({species:identity?.species||rating?.species}),
    storyTraits:rating?{traits:rating.specialTraits,flaw:rating.flaw,origin:rating.origin,mechanicalAuthority:false}:undefined,
    provenance:"GOC 150 ABY campaign design; proposed ratings are not committed mechanics",
    reason: identity?.species !== "Human" ? "Species foundation and full Saga advancement require validation. No Human traits or proposed powers are substituted." : "No validated prior-career build is registered." };
  if (!identity || !sagaSpecies(identity.species) || (!NPC_HISTORICAL_TIERS[id]&&!rating&&!proposedTier)) return pending;
  const seed: DatapadSnapshot = { character:{name:identity.name,species:identity.species,level:1,experience:0,maxHitPoints:1},
    gameState:{health:1,conditionTrack:0,inventory:[],turnEvents:[]}, messages:[],comms:[],settings:{} };
  try {
    const built = reconstructCoreNpc(seed, identity, proposedTier);
    const character = built.character!;
    const progress = progressionStatus(character);
    if (!progress.buildConsistent || progress.pendingLevels !== 0) return {...pending,reason:"The prior-career build has unresolved Saga choices."};
    const result: NpcMechanics = {...pending,id,name:identity.name,status:"validated-core-build",equipmentStatus:"unestablished",reason:undefined,
      provenance:"GM-designed 150 ABY prior career, validated by applySagaFoundation/applySagaAdvancement; not a sourcebook-published NPC or earned player XP",
      character,skillModifiers:Object.fromEntries(Object.entries(skills).map(([skill,ability])=>[skill,sagaSkillModifier(character,{conditionTrack:0},skill,ability)]))};
    templates.set(id,structuredClone(result));
    return result;
  } catch {
    return {...pending,reason:"Prior-career reconstruction failed validation; do not use proposed numerical ratings."};
  }
}

/** Freeze only actually present NPC builds; never overwrite a progressed or injured NPC. */
export function recordNpcMechanics(state: Record<string,unknown>, participants: Array<{name:string}>) {
  const existing = state.npcMechanics && typeof state.npcMechanics === "object" && !Array.isArray(state.npcMechanics)
    ? state.npcMechanics as Record<string,unknown> : {};
  const registry = {...existing};
  let changed = false;
  for (const person of participants) {
    const build = npcMechanics(person.name);
    if (build.status !== "validated-core-build" || registry[build.id]) continue;
    registry[build.id] = {...build,health:build.character?.maxHitPoints,conditionTrack:0};
    changed = true;
  }
  return changed ? {...state,npcMechanics:registry} : state;
}
