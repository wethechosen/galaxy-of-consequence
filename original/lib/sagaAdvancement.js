const ABILITIES = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];
const ABILITY_LABELS = { strength: "STR", dexterity: "DEX", constitution: "CON", intelligence: "INT", wisdom: "WIS", charisma: "CHA" };

// Saga Edition Core Rulebook, Table 3-1: Experience and Level-Dependent Benefits.
export const SAGA_XP_THRESHOLDS = Object.freeze([
  0, 1_000, 3_000, 6_000, 10_000, 15_000, 21_000, 28_000, 36_000, 45_000,
  55_000, 66_000, 78_000, 91_000, 105_000, 120_000, 136_000, 153_000, 171_000, 190_000,
]);

const talent = (id, name, tree, extra = {}) => ({ id, name, tree, ...extra });
const feat = (id, name, extra = {}) => ({ id, name, ...extra });

export const TALENT_TREES = Object.freeze({
  jedi: [
    { id: "jedi-consular", name: "Jedi Consular", talents: [talent("adept-negotiator", "Adept Negotiator", "Jedi Consular"), talent("force-persuasion", "Force Persuasion", "Jedi Consular", { requires: ["adept-negotiator"] }), talent("master-negotiator", "Master Negotiator", "Jedi Consular", { requires: ["adept-negotiator"] })] },
    { id: "jedi-guardian", name: "Jedi Guardian", talents: [talent("acrobatic-recovery", "Acrobatic Recovery", "Jedi Guardian"), talent("battle-meditation", "Battle Meditation", "Jedi Guardian"), talent("elusive-target", "Elusive Target", "Jedi Guardian"), talent("resilience", "Resilience", "Jedi Guardian")] },
    { id: "jedi-sentinel", name: "Jedi Sentinel", talents: [talent("clear-mind", "Clear Mind", "Jedi Sentinel"), talent("dark-side-sense", "Dark Side Sense", "Jedi Sentinel"), talent("dark-side-scourge", "Dark Side Scourge", "Jedi Sentinel", { requires: ["dark-side-sense"] }), talent("force-haze", "Force Haze", "Jedi Sentinel", { requires: ["clear-mind"] }), talent("resist-dark-side", "Resist the Dark Side", "Jedi Sentinel", { requires: ["dark-side-sense"] })] },
    { id: "lightsaber-combat", name: "Lightsaber Combat", talents: [talent("block", "Block", "Lightsaber Combat"), talent("deflect", "Deflect", "Lightsaber Combat"), talent("lightsaber-defense", "Lightsaber Defense", "Lightsaber Combat", { repeatable: true, maximum: 3 }), talent("redirect-shot", "Redirect Shot", "Lightsaber Combat", { requires: ["deflect"], minimumBab: 5 }), talent("lightsaber-specialization", "Weapon Specialization (lightsabers)", "Lightsaber Combat", { requiresFeat: "weapon-focus-lightsabers" })] },
  ],
  noble: [
    { id: "influence", name: "Influence", talents: [talent("presence", "Presence", "Influence"), talent("demand-surrender", "Demand Surrender", "Influence", { requires: ["presence"] }), talent("weaken-resolve", "Weaken Resolve", "Influence", { requires: ["presence"] })] },
    { id: "inspiration", name: "Inspiration", talents: [talent("bolster-ally", "Bolster Ally", "Inspiration"), talent("ignite-fervor", "Ignite Fervor", "Inspiration", { requires: ["bolster-ally", "inspire-confidence"] }), talent("inspire-confidence", "Inspire Confidence", "Inspiration")] },
    { id: "leadership", name: "Leadership", talents: [talent("born-leader", "Born Leader", "Leadership"), talent("coordinate", "Coordinate", "Leadership", { repeatable: true, maximum: 5 }), talent("distant-command", "Distant Command", "Leadership", { requires: ["born-leader"] }), talent("trust", "Trust", "Leadership", { requires: ["born-leader", "coordinate"] })] },
    { id: "lineage", name: "Lineage", talents: [talent("connections", "Connections", "Lineage"), talent("educated", "Educated", "Lineage"), talent("spontaneous-skill", "Spontaneous Skill", "Lineage", { requires: ["educated"], repeatable: true }), talent("wealth", "Wealth", "Lineage")] },
  ],
  scoundrel: [
    { id: "fortune", name: "Fortune", talents: [talent("fools-luck", "Fool's Luck", "Fortune"), talent("fortune-favor", "Fortune's Favor", "Fortune"), talent("gambler", "Gambler", "Fortune", { repeatable: true }), talent("knack", "Knack", "Fortune", { repeatable: true }), talent("lucky-shot", "Lucky Shot", "Fortune", { requires: ["knack"], repeatable: true })] },
    { id: "misfortune", name: "Misfortune", talents: [talent("dastardly-strike", "Dastardly Strike", "Misfortune"), talent("disruptive", "Disruptive", "Misfortune"), talent("skirmisher", "Skirmisher", "Misfortune"), talent("sneak-attack", "Sneak Attack", "Misfortune", { repeatable: true, maximum: 10 })] },
    { id: "slicer", name: "Slicer", talents: [talent("gimmick", "Gimmick", "Slicer"), talent("master-slicer", "Master Slicer", "Slicer", { requires: ["gimmick"] }), talent("trace", "Trace", "Slicer")] },
    { id: "spacer", name: "Spacer", talents: [talent("hyperdriven", "Hyperdriven", "Spacer"), talent("spacehound", "Spacehound", "Spacer"), talent("starship-raider", "Starship Raider", "Spacer", { requires: ["spacehound"] })] },
  ],
  scout: [
    { id: "awareness", name: "Awareness", talents: [talent("acute-senses", "Acute Senses", "Awareness"), talent("expert-tracker", "Expert Tracker", "Awareness", { requires: ["acute-senses"] }), talent("improved-initiative", "Improved Initiative", "Awareness", { requires: ["acute-senses"] }), talent("uncanny-dodge-1", "Uncanny Dodge I", "Awareness", { requires: ["acute-senses", "improved-initiative"] }), talent("uncanny-dodge-2", "Uncanny Dodge II", "Awareness", { requires: ["acute-senses", "improved-initiative", "uncanny-dodge-1"] })] },
    { id: "camouflage", name: "Camouflage", talents: [talent("hidden-movement", "Hidden Movement", "Camouflage", { requires: ["improved-stealth"] }), talent("improved-stealth", "Improved Stealth", "Camouflage"), talent("total-concealment", "Total Concealment", "Camouflage", { requires: ["hidden-movement", "improved-stealth"] })] },
    { id: "fringer", name: "Fringer", talents: [talent("barter", "Barter", "Fringer"), talent("jury-rigger", "Jury-Rigger", "Fringer"), talent("long-stride", "Long Stride", "Fringer")] },
    { id: "survivor", name: "Survivor", talents: [talent("evasion", "Evasion", "Survivor"), talent("extreme-effort", "Extreme Effort", "Survivor"), talent("sprint", "Sprint", "Survivor"), talent("surefooted", "Surefooted", "Survivor")] },
  ],
  soldier: [
    { id: "armor-specialist", name: "Armor Specialist", talents: [talent("armored-defense", "Armored Defense", "Armor Specialist"), talent("improved-armored-defense", "Improved Armored Defense", "Armor Specialist", { requires: ["armored-defense"] }), talent("juggernaut", "Juggernaut", "Armor Specialist", { requires: ["armored-defense"] }), talent("second-skin", "Second Skin", "Armor Specialist", { requires: ["armored-defense"] })] },
    { id: "brawler", name: "Brawler", talents: [talent("expert-grappler", "Expert Grappler", "Brawler"), talent("gun-club", "Gun Club", "Brawler"), talent("melee-smash", "Melee Smash", "Brawler"), talent("stunning-strike", "Stunning Strike", "Brawler", { requires: ["melee-smash"] })] },
    { id: "commando", name: "Commando", talents: [talent("battle-analysis", "Battle Analysis", "Commando"), talent("cover-fire", "Cover Fire", "Commando", { requires: ["battle-analysis"] }), talent("demolitionist", "Demolitionist", "Commando", { repeatable: true }), talent("draw-fire", "Draw Fire", "Commando"), talent("indomitable", "Indomitable", "Commando", { repeatable: true })] },
    { id: "weapon-specialist", name: "Weapon Specialist", talents: [talent("devastating-attack", "Devastating Attack", "Weapon Specialist", { supported: false, unavailableReason: "A proficient weapon group must be selected and recorded." }), talent("penetrating-attack", "Penetrating Attack", "Weapon Specialist", { supported: false, unavailableReason: "A proficient weapon group must be selected and recorded." }), talent("weapon-specialization", "Weapon Specialization", "Weapon Specialist", { supported: false, unavailableReason: "A weapon group and its matching Weapon Focus feat must be recorded." })] },
  ],
});

export const FEAT_CATALOG = Object.freeze([
  feat("acrobatic-strike", "Acrobatic Strike", { trainedSkill: "acrobatics" }), feat("bantha-rush", "Bantha Rush", { minimumAbilities: { strength: 13 }, minimumBab: 1 }), feat("careful-shot", "Careful Shot", { requires: ["point-blank-shot"], minimumBab: 2 }),
  feat("cleave", "Cleave", { requires: ["power-attack"], minimumAbilities: { strength: 13 } }), feat("power-attack", "Power Attack", { minimumAbilities: { strength: 13 } }), feat("combat-reflexes", "Combat Reflexes"), feat("coordinated-attack", "Coordinated Attack", { minimumBab: 2 }),
  feat("dodge", "Dodge", { minimumAbilities: { dexterity: 13 } }), feat("force-boon", "Force Boon", { requires: ["force-sensitivity"] }), feat("force-sensitivity", "Force Sensitivity", { nonDroid: true }),
  feat("force-training", "Force Training", { requires: ["force-sensitivity"], trainedSkill: "use-the-force", supported: false, unavailableReason: "Force Training requires a complete player-selected power suite; its power-selection workflow is not yet implemented." }), feat("improved-damage-threshold", "Improved Damage Threshold", { repeatable: true }),
  feat("improved-defenses", "Improved Defenses"), feat("linguist", "Linguist", { minimumAbilities: { intelligence: 13 }, repeatable: true, languageChoices: true }), feat("martial-arts-1", "Martial Arts I"),
  feat("martial-arts-2", "Martial Arts II", { requires: ["martial-arts-1"], minimumBab: 3 }), feat("martial-arts-3", "Martial Arts III", { requires: ["martial-arts-1", "martial-arts-2"], minimumBab: 6 }),
  feat("mobility", "Mobility", { requires: ["dodge"], minimumAbilities: { dexterity: 13 } }), feat("point-blank-shot", "Point Blank Shot"),
  feat("precise-shot", "Precise Shot", { requires: ["point-blank-shot"] }), feat("quick-draw", "Quick Draw", { minimumBab: 1 }), feat("rapid-shot", "Rapid Shot", { minimumAbilities: { strength: 13 }, minimumBab: 1, requiresAnyProficiency: true }),
  feat("rapid-strike", "Rapid Strike", { minimumAbilities: { dexterity: 13 }, minimumBab: 1, requiresAnyProficiency: true }), feat("running-attack", "Running Attack", { minimumAbilities: { dexterity: 13 } }), feat("shake-it-off", "Shake It Off", { minimumAbilities: { constitution: 13 }, trainedSkill: "endurance" }),
  feat("skill-focus", "Skill Focus", { supported: false, unavailableReason: "Select and record a specific trained skill before applying Skill Focus." }), feat("skill-training", "Skill Training", { supported: false, unavailableReason: "Select and record a specific untrained class skill before applying Skill Training." }), feat("sniper", "Sniper", { requires: ["point-blank-shot", "precise-shot"], minimumBab: 4 }),
  feat("strong-in-force", "Strong in the Force"),
  feat("toughness", "Toughness"), feat("weapon-finesse", "Weapon Finesse", { minimumBab: 1 }), feat("weapon-focus-lightsabers", "Weapon Focus (lightsabers)", { requires: ["weapon-proficiency-lightsabers"] }),
  feat("weapon-focus-pistols", "Weapon Focus (pistols)", { requires: ["weapon-proficiency-pistols"] }), feat("weapon-focus-rifles", "Weapon Focus (rifles)", { requires: ["weapon-proficiency-rifles"] }), feat("weapon-focus-simple", "Weapon Focus (simple weapons)", { requires: ["weapon-proficiency-simple"] }),
  feat("armor-proficiency-light", "Armor Proficiency (light)"), feat("armor-proficiency-medium", "Armor Proficiency (medium)", { requires: ["armor-proficiency-light"] }), feat("armor-proficiency-heavy", "Armor Proficiency (heavy)", { requires: ["armor-proficiency-light", "armor-proficiency-medium"] }),
  ...["lightsabers", "pistols", "rifles", "simple", "advanced-melee", "heavy"].map(group => feat(`weapon-proficiency-${group}`, `Weapon Proficiency (${({ simple: "simple weapons", "advanced-melee": "advanced melee weapons", heavy: "heavy weapons" })[group] || group})`)),
]);

// These are the supported subset of each printed class's bonus-feat list,
// not a shared convenience list. Starting feats may also be chosen when
// advancing a multiclass character (Core, Multiclass Characters).
export const HEROIC_CLASSES = Object.freeze({
  jedi: { id: "jedi", name: "Jedi", hitDie: 10, trainedSkillBase: 2, bab: "full", defense: { reflex: 1, fortitude: 1, will: 1 }, startingFeats: ["force-sensitivity", "weapon-proficiency-lightsabers", "weapon-proficiency-simple"], bonusFeats: ["acrobatic-strike", "cleave", "combat-reflexes", "dodge", "martial-arts-1", "martial-arts-2", "martial-arts-3", "mobility", "quick-draw", "power-attack", "rapid-strike", "running-attack", "skill-focus", "skill-training", "strong-in-force", "weapon-finesse", "weapon-focus-lightsabers"] },
  noble: { id: "noble", name: "Noble", hitDie: 6, trainedSkillBase: 6, bab: "three-quarter", defense: { reflex: 1, fortitude: 0, will: 2 }, startingFeats: ["linguist", "weapon-proficiency-pistols", "weapon-proficiency-simple"], bonusFeats: ["armor-proficiency-light", "linguist", "skill-focus", "skill-training", "weapon-finesse", "weapon-proficiency-advanced-melee", "weapon-proficiency-rifles"] },
  scoundrel: { id: "scoundrel", name: "Scoundrel", hitDie: 6, trainedSkillBase: 4, bab: "three-quarter", defense: { reflex: 2, fortitude: 0, will: 1 }, startingFeats: ["point-blank-shot", "weapon-proficiency-pistols", "weapon-proficiency-simple"], bonusFeats: ["dodge", "mobility", "precise-shot", "quick-draw", "rapid-shot", "running-attack", "skill-focus", "skill-training", "weapon-proficiency-advanced-melee"] },
  scout: { id: "scout", name: "Scout", hitDie: 8, trainedSkillBase: 5, bab: "three-quarter", defense: { reflex: 2, fortitude: 1, will: 0 }, startingFeats: ["shake-it-off", "weapon-proficiency-pistols", "weapon-proficiency-rifles", "weapon-proficiency-simple"], bonusFeats: ["armor-proficiency-light", "armor-proficiency-medium", "armor-proficiency-heavy", "careful-shot", "dodge", "linguist", "mobility", "point-blank-shot", "precise-shot", "rapid-shot", "running-attack", "skill-focus", "skill-training", "sniper", "weapon-proficiency-advanced-melee"] },
  soldier: { id: "soldier", name: "Soldier", hitDie: 10, trainedSkillBase: 3, bab: "full", defense: { reflex: 1, fortitude: 2, will: 0 }, startingFeats: ["armor-proficiency-light", "armor-proficiency-medium", "weapon-proficiency-pistols", "weapon-proficiency-rifles", "weapon-proficiency-simple"], bonusFeats: ["armor-proficiency-heavy", "bantha-rush", "careful-shot", "cleave", "combat-reflexes", "coordinated-attack", "martial-arts-1", "martial-arts-2", "martial-arts-3", "point-blank-shot", "power-attack", "precise-shot", "quick-draw", "rapid-shot", "rapid-strike", "running-attack", "shake-it-off", "skill-focus", "skill-training", "sniper", "toughness", "weapon-focus-lightsabers", "weapon-focus-pistols", "weapon-focus-rifles", "weapon-focus-simple", "weapon-proficiency-advanced-melee", "weapon-proficiency-heavy"] },
});

const STARTING_FEAT_NAMES = Object.freeze({
  "armor-proficiency-light": "Armor Proficiency (light)", "armor-proficiency-medium": "Armor Proficiency (medium)",
  "weapon-proficiency-lightsabers": "Weapon Proficiency (lightsabers)", "weapon-proficiency-pistols": "Weapon Proficiency (pistols)",
  "weapon-proficiency-rifles": "Weapon Proficiency (rifles)", "weapon-proficiency-simple": "Weapon Proficiency (simple weapons)",
  "force-sensitivity": "Force Sensitivity", linguist: "Linguist", "point-blank-shot": "Point Blank Shot", "shake-it-off": "Shake It Off",
});

// Core printed pp. 100-101: these trees can replace a class talent for a
// character who has actually acquired Force Sensitivity.
export const FORCE_TALENT_TREES = Object.freeze([
  { id: "alter", name: "Alter", talents: [talent("disciplined-strike", "Disciplined Strike", "Alter"), talent("telekinetic-power", "Telekinetic Power", "Alter"), talent("telekinetic-savant", "Telekinetic Savant", "Alter", { repeatable: true })] },
  { id: "control", name: "Control", talents: [talent("damage-reduction-10", "Damage Reduction 10", "Control"), talent("equilibrium", "Equilibrium", "Control"), talent("force-focus", "Force Focus", "Control"), talent("force-recovery", "Force Recovery", "Control", { requires: ["equilibrium"] })] },
  { id: "dark-side", name: "Dark Side", minimumDarkSideScore: 1, talents: [talent("power-of-dark-side", "Power of the Dark Side", "Dark Side"), talent("dark-presence", "Dark Presence", "Dark Side", { requires: ["power-of-dark-side"], minimumAbilities: { charisma: 13 } }), talent("revenge", "Revenge", "Dark Side", { requires: ["power-of-dark-side", "dark-presence"] }), talent("swift-power", "Swift Power", "Dark Side", { requires: ["power-of-dark-side"] })] },
  { id: "sense", name: "Sense", talents: [talent("force-perception", "Force Perception", "Sense"), talent("force-pilot", "Force Pilot", "Sense"), talent("foresight", "Foresight", "Sense", { requires: ["force-perception"] }), talent("gauge-force-potential", "Gauge Force Potential", "Sense", { requires: ["force-perception"] }), talent("visions", "Visions", "Sense", { requires: ["force-perception"], requiresPower: "farseeing" })] },
]);

// Names and eligibility below are verified against the supplied Core PDF.
// Prestige classes, supplemental trees, and metadata-dependent feat choices
// remain outside this supported catalog; they must not grant implied benefits.
export const SAGA_ADVANCEMENT_LIMITATIONS = Object.freeze([
  "The catalog covers a supported subset of core heroic-class options; prestige classes and supplement options are not implemented.",
  "Skill Focus, Skill Training, Force Training, and weapon-group talents remain unavailable until their player-selected skill, power, or weapon metadata can be committed correctly.",
  "Conditional combat talent effects require adjudication when used; learning a talent does not activate it automatically.",
]);

const KNOWLEDGE_SKILLS = ["bureaucracy", "galactic-lore", "life-sciences", "physical-sciences", "social-sciences", "tactics", "technology"].map(id => ({ id: `knowledge-${id}`, name: `Knowledge (${id.replaceAll("-", " ")})` }));
const SKILL_NAMES = { acrobatics: "Acrobatics", climb: "Climb", deception: "Deception", endurance: "Endurance", "gather-information": "Gather Information", initiative: "Initiative", jump: "Jump", mechanics: "Mechanics", perception: "Perception", persuasion: "Persuasion", pilot: "Pilot", ride: "Ride", stealth: "Stealth", survival: "Survival", swim: "Swim", "treat-injury": "Treat Injury", "use-computer": "Use Computer", "use-the-force": "Use the Force" };
export const SAGA_SKILL_OPTIONS = Object.freeze([...Object.entries(SKILL_NAMES).map(([id, name]) => ({ id, name })), ...KNOWLEDGE_SKILLS]);
const knowledgeIds = KNOWLEDGE_SKILLS.map(item => item.id);
const CLASS_SKILL_IDS = Object.freeze({
  jedi: ["acrobatics", "endurance", ...knowledgeIds, "perception", "pilot", "use-the-force"],
  noble: ["deception", "gather-information", "initiative", ...knowledgeIds, "perception", "persuasion", "pilot", "ride", "treat-injury", "use-computer"],
  scoundrel: ["acrobatics", "deception", "gather-information", "initiative", ...knowledgeIds, "mechanics", "perception", "persuasion", "pilot", "stealth", "use-computer"],
  scout: ["climb", "endurance", "initiative", "jump", ...knowledgeIds, "mechanics", "perception", "pilot", "ride", "stealth", "survival", "swim"],
  soldier: ["climb", "endurance", "initiative", "jump", "knowledge-tactics", "mechanics", "perception", "pilot", "swim", "treat-injury", "use-computer"],
});
// Core printed p. 22, Common Languages. Language use still respects species'
// physical speech restrictions and what the current scene actually permits.
export const SAGA_LANGUAGE_OPTIONS = Object.freeze([
  ["basic", "Basic"], ["binary", "Binary"], ["bocce", "Bocce"], ["bothese", "Bothese"], ["cerean", "Cerean"], ["dosh", "Dosh"], ["durese", "Durese"], ["ewokese", "Ewokese"], ["gamorrean", "Gamorrean"], ["gunganese", "Gunganese"], ["high-galactic", "High Galactic"], ["huttese", "Huttese"], ["ithorese", "Ithorese"], ["jawa-trade-language", "Jawa Trade Language"], ["kel-dor", "Kel Dor"], ["mon-calamarian", "Mon Calamarian"], ["quarrenese", "Quarrenese"], ["rodese", "Rodese"], ["ryl", "Ryl"], ["shyriiwook", "Shyriiwook"], ["sullustese", "Sullustese"], ["zabrak", "Zabrak"],
].map(([id, name]) => ({ id, name })));

const cleanList = (value, emptyPattern = /^(?:none|none recorded|unestablished)$/i) => Array.isArray(value)
  ? value.filter(Boolean).map(String)
  : String(value || "").split(/[,;|]/).map(item => item.trim()).filter(item => item && !emptyPattern.test(item));
const idSet = (value) => new Set((Array.isArray(value) ? value : []).map(item => typeof item === "string" ? item : item?.id).filter(Boolean));
const selectionRecords = value => Array.isArray(value) ? value.filter(item => item && typeof item === "object" && !Array.isArray(item)) : [];
const abilityModifier = score => Math.floor((Number(score) - 10) / 2);
const knownNumber = value => value != null && value !== "" && Number.isFinite(Number(value));

function ownedFeatIds(character = {}) {
  const result = idSet(character.featSelections);
  for (const name of cleanList(character.feats)) {
    const entry = FEAT_CATALOG.find(item => item.name.toLowerCase() === name.toLowerCase());
    if (entry) result.add(entry.id);
  }
  return result;
}

function ownedTalentIds(character = {}) {
  const result = idSet(character.talentSelections);
  for (const name of cleanList(character.talents)) {
    const entry = [...Object.values(TALENT_TREES).flat(), ...FORCE_TALENT_TREES].flatMap(tree => tree.talents).find(item => item.name.toLowerCase() === name.toLowerCase());
    if (entry) result.add(entry.id);
  }
  return result;
}

function trainedSkillIds(character = {}) {
  return new Set(cleanList(character.trainedSkills).map(value => SAGA_SKILL_OPTIONS.find(item => item.id === value || item.name.toLowerCase() === value.toLowerCase())?.id).filter(Boolean));
}

export function availableClassSkills(character = {}, classId) {
  const classIds = new Set([classId, ...Object.keys(character.classLevels || {}).filter(id => Number(character.classLevels[id]) > 0)]);
  const ids = new Set([...classIds].flatMap(id => CLASS_SKILL_IDS[id] || []));
  if (ownedFeatIds(character).has("force-sensitivity") || classId === "jedi") ids.add("use-the-force");
  return SAGA_SKILL_OPTIONS.filter(item => ids.has(item.id));
}

export function sagaLevelForExperience(experience) {
  const xp = Math.max(0, Math.floor(Number(experience) || 0));
  let level = 1;
  while (level < SAGA_XP_THRESHOLDS.length && xp >= SAGA_XP_THRESHOLDS[level]) level += 1;
  return level;
}

export function experienceForLevel(level) {
  const safe = Math.max(1, Math.min(20, Math.floor(Number(level) || 1)));
  return SAGA_XP_THRESHOLDS[safe - 1];
}

export function nextLevelExperience(level) {
  const safe = Math.max(1, Math.floor(Number(level) || 1));
  return safe >= 20 ? null : SAGA_XP_THRESHOLDS[safe];
}

export function parseAbilityScores(character = {}) {
  const established = character.abilityScores && typeof character.abilityScores === "object" ? character.abilityScores : {};
  const result = {};
  for (const key of ABILITIES) {
    const direct = knownNumber(established[key]) ? Number(established[key]) : null;
    const match = String(character.sagaStats || "").match(new RegExp(`${ABILITY_LABELS[key]}\\s*(\\d+)`, "i"));
    result[key] = direct != null && Number.isSafeInteger(direct) && direct > 0 ? direct : match ? Number(match[1]) : null;
  }
  return result;
}

export function formatAbilityScores(scores) {
  return ABILITIES.map(key => `${ABILITY_LABELS[key]} ${scores[key] == null ? "unestablished" : Number(scores[key])}`).join(" | ");
}

export function progressionStatus(character = {}) {
  const level = Math.max(1, Math.min(20, Math.floor(Number(character.level) || 1)));
  const experience = Math.max(0, Math.floor(Number(character.experience) || 0));
  const earnedLevel = sagaLevelForExperience(experience);
  const classLevels = character.classLevels && typeof character.classLevels === "object" ? character.classLevels : {};
  const assignedClassLevels = Object.values(classLevels).reduce((sum, value) => sum + (Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : 0), 0);
  const invalidClasses = Object.entries(classLevels).some(([id, value]) => !HEROIC_CLASSES[id] || !Number.isSafeInteger(Number(value)) || Number(value) < 0);
  const validCharacterLevel = knownNumber(character.level) && Number.isSafeInteger(Number(character.level)) && Number(character.level) >= 1 && Number(character.level) <= 20;
  const buildConsistent = validCharacterLevel && !invalidClasses && (assignedClassLevels === level || assignedClassLevels === 0 && level === 1);
  const abilityScoresEstablished = Object.values(parseAbilityScores(character)).every(value => value != null);
  return { level, experience, earnedLevel, assignedClassLevels, buildConsistent, abilityScoresEstablished, foundationRequired: assignedClassLevels === 0, levelsAvailable: Math.max(0, earnedLevel - level), nextLevelXp: nextLevelExperience(level), advancementAvailable: earnedLevel > level };
}

export function foundationRequirements(character = {}, classId, choices = {}) {
  const heroic = HEROIC_CLASSES[classId];
  const scores = parseAbilityScores(character);
  const established = Object.values(scores).every(value => value != null);
  const human = /^human$/i.test(String(character.species || "").trim());
  const intelligenceModifier = established ? abilityModifier(scores.intelligence) : null;
  const startingLinguist = classId === "noble" && established && scores.intelligence >= 13 ? 1 : 0;
  const selectedLinguist = [choices.generalFeatId, choices.humanBonusFeatId].filter(id => id === "linguist").length;
  const languageTotal = established ? Math.max(0, intelligenceModifier) + (startingLinguist + selectedLinguist) * Math.max(1, 1 + intelligenceModifier) : 0;
  const existingLanguageIds = languageIdsForCharacter(character).filter(id => id !== "basic");
  return {
    validClass: Boolean(heroic), abilityScoresEstablished: established, human,
    trainedSkillCount: heroic && established ? Math.max(1, heroic.trainedSkillBase + intelligenceModifier + (human ? 1 : 0)) : null,
    bonusLanguageCount: Math.max(0, languageTotal - existingLanguageIds.length), languageTotal,
    startingLinguist: Boolean(startingLinguist),
  };
}

export function advancementRequirements(character = {}, classId, choices = {}) {
  const status = progressionStatus(character);
  const selectedClass = HEROIC_CLASSES[classId];
  if (!selectedClass) return { ...status, validClass: false };
  const classLevels = character.classLevels && typeof character.classLevels === "object" ? character.classLevels : {};
  const nextClassLevel = Math.max(0, Math.floor(Number(classLevels[classId]) || 0)) + 1;
  const scores = parseAbilityScores(character);
  const improvedScores = { ...scores };
  for (const id of choices.abilityIncreases || []) if (ABILITIES.includes(id) && improvedScores[id] != null) improvedScores[id] += 1;
  const intelligenceGain = scores.intelligence == null ? 0 : Math.max(0, abilityModifier(improvedScores.intelligence) - abilityModifier(scores.intelligence));
  const linguistChoices = [choices.startingFeatId, choices.classBonusFeatId, choices.generalFeatId].filter(id => id === "linguist").length;
  return {
    ...status, validClass: true, targetLevel: status.level + 1, classId, nextClassLevel,
    talentRequired: nextClassLevel % 2 === 1,
    classBonusFeatRequired: nextClassLevel % 2 === 0,
    generalFeatRequired: (status.level + 1) % 3 === 0,
    abilityIncreasesRequired: (status.level + 1) % 4 === 0 ? 2 : 0,
    multiclassStartingFeatRequired: nextClassLevel === 1 && status.level > 0 && availableStartingFeats({ ...character, abilityScores: improvedScores }, classId).length > 0,
    trainedSkillCount: intelligenceGain,
    bonusLanguageCount: intelligenceGain + linguistChoices * Math.max(1, 1 + abilityModifier(improvedScores.intelligence)),
  };
}

function hasPrerequisites(entry, character, talentIds = ownedTalentIds(character), featIds = ownedFeatIds(character)) {
  if (entry.supported === false) return false;
  if ((entry.requires || []).some(id => !talentIds.has(id) && !featIds.has(id))) return false;
  if (entry.requiresFeat && !featIds.has(entry.requiresFeat)) return false;
  const scores = parseAbilityScores(character);
  if (Object.entries(entry.minimumAbilities || {}).some(([ability, minimum]) => scores[ability] == null || scores[ability] < minimum)) return false;
  if (entry.minimumBab && (!knownNumber(character.baseAttackBonus) || Number(character.baseAttackBonus) < entry.minimumBab)) return false;
  if (entry.trainedSkill && !trainedSkillIds(character).has(entry.trainedSkill)) return false;
  if (entry.requiresAnyProficiency && ![...featIds].some(id => id.startsWith("weapon-proficiency-"))) return false;
  if (entry.nonDroid && /\bdroid\b/i.test(String(character.species || ""))) return false;
  if (entry.requiresPower && !cleanList(character.forcePowers).some(name => name.toLowerCase() === entry.requiresPower)) return false;
  return true;
}

export function availableTalents(character = {}, classId, gameState = {}) {
  const owned = ownedTalentIds(character);
  const feats = ownedFeatIds(character);
  const forceTrees = feats.has("force-sensitivity") ? FORCE_TALENT_TREES.filter(tree => !tree.minimumDarkSideScore || Number(gameState.darkSideScore ?? character.darkSideScore ?? 0) >= tree.minimumDarkSideScore) : [];
  return [...(TALENT_TREES[classId] || []), ...forceTrees].map(tree => ({ ...tree, talents: tree.talents.filter(item => {
    const recordedCount = selectionRecords(character.talentSelections).filter(selection => selection.id === item.id).length;
    const count = Math.max(recordedCount, owned.has(item.id) ? 1 : 0);
    return (!count || item.repeatable && (!item.maximum || count < item.maximum)) && hasPrerequisites(item, character, owned, feats);
  }) })).filter(tree => tree.talents.length);
}

export function availableFeats(character = {}, classId, bonusOnly = false) {
  const owned = ownedFeatIds(character);
  const multiclass = Object.keys(character.classLevels || {}).filter(id => Number(character.classLevels[id]) > 0).length > 1;
  const allowed = bonusOnly ? new Set([...(HEROIC_CLASSES[classId]?.bonusFeats || []), ...(multiclass ? HEROIC_CLASSES[classId]?.startingFeats || [] : [])]) : null;
  return FEAT_CATALOG.filter(item => (!owned.has(item.id) || item.repeatable) && (!allowed || allowed.has(item.id)) && hasPrerequisites(item, character, new Set(), owned));
}

export function availableStartingFeats(character = {}, classId) {
  const owned = ownedFeatIds(character);
  return (HEROIC_CLASSES[classId]?.startingFeats || []).map(id => FEAT_CATALOG.find(item => item.id === id)).filter(item => item && !owned.has(item.id) && hasPrerequisites(item, character, new Set(), owned));
}

function findTalent(character, classId, id, gameState) {
  return availableTalents(character, classId, gameState).flatMap(tree => tree.talents).find(item => item.id === id);
}
function findFeat(character, classId, id, bonusOnly) {
  return availableFeats(character, classId, bonusOnly).find(item => item.id === id);
}
function classLevelBab(classId, level) {
  return HEROIC_CLASSES[classId]?.bab === "full" ? level : Math.floor(level * 3 / 4);
}
function advancementError(message, status = 400) { const error = new Error(message); error.status = status; return error; }

function requireAbilityScores(character) {
  const scores = parseAbilityScores(character);
  if (Object.values(scores).some(value => value == null || !Number.isSafeInteger(value) || value <= 0)) throw advancementError("All six ability scores must be established before recording a Saga build or level.");
  return scores;
}

function requireSelectionRecords(character) {
  for (const key of ["featSelections", "talentSelections"]) {
    const value = character[key];
    if (value != null && (!Array.isArray(value) || value.some(item => !item || typeof item !== "object" || Array.isArray(item) || !item.id))) throw advancementError("The recorded feat and talent selections need reviewed reconstruction before another build choice can be committed.");
  }
}

function baseAttackBonusForClasses(classLevels) {
  return Object.entries(classLevels).reduce((sum, [id, level]) => sum + classLevelBab(id, Number(level)), 0);
}

export function advancementChoiceContext(character = {}, classId, choices = {}) {
  const foundation = progressionStatus(character).foundationRequired;
  const classLevels = foundation ? { [classId]: 1 } : { ...(character.classLevels || {}), [classId]: Number(character.classLevels?.[classId] || 0) + 1 };
  const scores = parseAbilityScores(character);
  for (const id of choices.abilityIncreases || []) if (ABILITIES.includes(id) && scores[id] != null) scores[id] += 1;
  const result = { ...character, classLevels, abilityScores: scores, baseAttackBonus: baseAttackBonusForClasses(classLevels), featSelections: [...selectionRecords(character.featSelections)] };
  if (foundation && HEROIC_CLASSES[classId]) {
    for (const id of HEROIC_CLASSES[classId].startingFeats) {
      const entry = FEAT_CATALOG.find(item => item.id === id);
      // Scout's conditional Shake It Off is tested after skills are chosen.
      if (entry && id !== "shake-it-off" && hasPrerequisites(entry, result)) result.featSelections.push({ id, name: entry.name });
    }
  }
  if (Array.isArray(choices.trainedSkillIds)) {
    const selections = choices.trainedSkillIds.map(id => SAGA_SKILL_OPTIONS.find(item => item.id === id)?.name || id);
    result.trainedSkills = foundation ? selections : [...new Set([...cleanList(character.trainedSkills), ...selections])];
  }
  for (const id of [choices.startingFeatId, choices.classBonusFeatId, choices.generalFeatId, choices.humanBonusFeatId]) {
    const entry = FEAT_CATALOG.find(item => item.id === id);
    if (entry && hasPrerequisites(entry, result)) result.featSelections.push({ id, name: entry.name });
  }
  return result;
}

function languageIdsForCharacter(character) {
  return cleanList(character.languages).map(value => SAGA_LANGUAGE_OPTIONS.find(item => item.id === value || item.name.toLowerCase() === value.toLowerCase())?.id).filter(Boolean);
}

function validateLanguageChoices(character, choices, count) {
  const selected = Array.isArray(choices.languageIds) ? choices.languageIds.map(String) : [];
  const existing = languageIdsForCharacter(character);
  if (cleanList(character.languages).length !== existing.length) throw advancementError("An existing language is outside the verified catalog; preserve it through a reviewed build reconstruction.");
  if (selected.length !== count || new Set(selected).size !== selected.length || selected.some(id => existing.includes(id) || !SAGA_LANGUAGE_OPTIONS.some(item => item.id === id))) throw advancementError(`Choose ${count} different new language${count === 1 ? "" : "s"} for this build or level.`);
  return [...new Set([...existing, ...selected])].map(id => SAGA_LANGUAGE_OPTIONS.find(item => item.id === id).name);
}

function highestClassDefenses(classLevels) {
  return Object.fromEntries(["reflex", "fortitude", "will"].map(key => [key, Math.max(0, ...Object.entries(classLevels).filter(([, level]) => Number(level) > 0).map(([id]) => HEROIC_CLASSES[id]?.defense[key] || 0))]));
}

function featCount(character, id) {
  return Math.max(selectionRecords(character.featSelections).filter(item => item.id === id).length, ownedFeatIds(character).has(id) ? 1 : 0);
}

function derivedDefenseChange(previous, next) {
  const oldScores = requireAbilityScores(previous);
  const scores = requireAbilityScores(next);
  const oldBonuses = highestClassDefenses(previous.classLevels || {});
  const bonuses = highestClassDefenses(next.classLevels || {});
  const ability = { reflex: "dexterity", fortitude: "constitution", will: "wisdom" };
  const improved = featCount(next, "improved-defenses") - featCount(previous, "improved-defenses");
  const martial = ["martial-arts-1", "martial-arts-2", "martial-arts-3"].reduce((sum, id) => sum + featCount(next, id) - featCount(previous, id), 0);
  const defenses = {};
  for (const key of Object.keys(ability)) {
    const passive = featCount(next, "improved-defenses") + (key === "reflex" ? ["martial-arts-1", "martial-arts-2", "martial-arts-3"].reduce((sum, id) => sum + featCount(next, id), 0) : 0);
    defenses[key] = knownNumber(previous.defenses?.[key])
      ? Number(previous.defenses[key]) + next.level - previous.level + bonuses[key] - oldBonuses[key] + abilityModifier(scores[ability[key]]) - abilityModifier(oldScores[ability[key]]) + improved + (key === "reflex" ? martial : 0)
      : 10 + next.level + bonuses[key] + abilityModifier(scores[ability[key]]) + passive;
  }
  const thresholdIncrease = 5 * (featCount(next, "improved-damage-threshold") - featCount(previous, "improved-damage-threshold"));
  const oldThreshold = knownNumber(previous.damageThreshold) ? Number(previous.damageThreshold) : null;
  return { defenses, damageThreshold: oldThreshold != null && knownNumber(previous.defenses?.fortitude) ? oldThreshold + defenses.fortitude - Number(previous.defenses.fortitude) + thresholdIncrease : defenses.fortitude + 5 * featCount(next, "improved-damage-threshold") };
}

export function ensureAdvancementScaffold(snapshot = {}) {
  const character = snapshot.character && typeof snapshot.character === "object" ? { ...snapshot.character } : snapshot.character;
  const gameState = snapshot.gameState && typeof snapshot.gameState === "object" ? { ...snapshot.gameState } : {};
  gameState.advancementHistory = selectionRecords(gameState.advancementHistory).map(item => ({ ...item }));
  gameState.levelUpAvailable = Boolean(character && progressionStatus(character).advancementAvailable);
  return { ...snapshot, character, gameState };
}

export function applySagaAdvancement(snapshot, choices = {}, roller = sides => 1 + Math.floor(Math.random() * sides), now = new Date().toISOString()) {
  const current = ensureAdvancementScaffold(snapshot);
  if (!current.character) throw advancementError("No player character is available for advancement.");
  const advancementId = String(choices.advancementId || "").trim();
  if (!advancementId || advancementId.length > 100) throw advancementError("A valid advancement identifier is required.");
  const priorCommit = current.gameState.advancementHistory.find(entry => entry.advancementId === advancementId);
  if (priorCommit) {
    if (priorCommit.kind === "level-1-foundation" || priorCommit.classId !== String(choices.classId || "").toLowerCase()) throw advancementError("That advancement identifier is already associated with a different choice.", 409);
    return current;
  }
  const status = progressionStatus(current.character);
  if (status.foundationRequired) throw advancementError("Establish the character's level-1 class, talent, and starting feats before adding another level.");
  if (!status.buildConsistent) throw advancementError("The recorded class levels must match the character level before advancement can be recorded.");
  if (!status.advancementAvailable) throw advancementError("This character has not earned the XP required for another level.");
  requireSelectionRecords(current.character);
  const previousScores = requireAbilityScores(current.character);
  if (!knownNumber(current.character.maxHitPoints) || Number(current.character.maxHitPoints) < 1) throw advancementError("Establish the character's maximum hit points before recording another level.");
  const classId = String(choices.classId || "").toLowerCase();
  const rules = advancementRequirements(current.character, classId);
  if (!rules.validClass) throw advancementError("Choose a valid heroic class for this level.");
  const abilityIncreases = Array.isArray(choices.abilityIncreases) ? choices.abilityIncreases.map(String) : [];
  if (abilityIncreases.length !== rules.abilityIncreasesRequired || new Set(abilityIncreases).size !== abilityIncreases.length || abilityIncreases.some(key => !ABILITIES.includes(key))) {
    throw advancementError(rules.abilityIncreasesRequired ? "Choose two different ability scores to increase." : "This level does not grant an ability-score increase.");
  }

  const character = { ...current.character };
  const classLevels = { ...(character.classLevels && typeof character.classLevels === "object" ? character.classLevels : {}) };
  classLevels[classId] = rules.nextClassLevel;
  const scores = parseAbilityScores(character);
  for (const key of abilityIncreases) scores[key] += 1;
  const talentSelections = [...selectionRecords(character.talentSelections)];
  const featSelections = [...selectionRecords(character.featSelections)];
  Object.assign(character, { level: rules.targetLevel, classLevels, abilityScores: scores, baseAttackBonus: baseAttackBonusForClasses(classLevels), talentSelections, featSelections });

  const intelligenceGain = Math.max(0, abilityModifier(scores.intelligence) - abilityModifier(previousScores.intelligence));
  const newSkillIds = Array.isArray(choices.trainedSkillIds) ? choices.trainedSkillIds.map(String) : [];
  const ownedSkills = trainedSkillIds(character);
  const classSkills = new Set(availableClassSkills(character, classId).map(item => item.id));
  if (newSkillIds.length !== intelligenceGain || new Set(newSkillIds).size !== newSkillIds.length || newSkillIds.some(id => ownedSkills.has(id) || !classSkills.has(id))) throw advancementError(`Choose ${intelligenceGain} new untrained class skill${intelligenceGain === 1 ? "" : "s"} from the Intelligence increase.`);
  character.trainedSkills = [...cleanList(character.trainedSkills), ...newSkillIds.map(id => SAGA_SKILL_OPTIONS.find(item => item.id === id).name)];

  const appendFeat = (entry, source) => { if (entry) featSelections.push({ id: entry.id, name: entry.name, source, classId, level: rules.targetLevel }); };
  const eligibleStarting = rules.nextClassLevel === 1 ? availableStartingFeats(character, classId) : [];
  const startingRequired = rules.nextClassLevel === 1 && eligibleStarting.length > 0;
  const startingFeat = startingRequired ? eligibleStarting.find(item => item.id === choices.startingFeatId) : null;
  if (startingRequired && !startingFeat) throw advancementError("Choose one eligible starting feat from the new class.");
  if (!startingRequired && choices.startingFeatId) throw advancementError("This level does not grant another starting feat.");
  appendFeat(startingFeat, "multiclass-starting-feat");
  const classFeat = rules.classBonusFeatRequired ? findFeat(character, classId, String(choices.classBonusFeatId || ""), true) : null;
  if (rules.classBonusFeatRequired && !classFeat) throw advancementError("Choose an eligible bonus feat for the selected class.");
  if (!rules.classBonusFeatRequired && choices.classBonusFeatId) throw advancementError("This class level does not grant a bonus feat.");
  appendFeat(classFeat, "class-bonus-feat");
  const generalFeat = rules.generalFeatRequired ? findFeat(character, classId, String(choices.generalFeatId || ""), false) : null;
  if (rules.generalFeatRequired && !generalFeat) throw advancementError("Choose an eligible character-level feat.");
  if (!rules.generalFeatRequired && choices.generalFeatId) throw advancementError("This character level does not grant a general feat.");
  appendFeat(generalFeat, "general-feat");
  const talentChoice = rules.talentRequired ? findTalent(character, classId, String(choices.talentId || ""), current.gameState) : null;
  if (rules.talentRequired && !talentChoice) throw advancementError("Choose an eligible talent from the selected class's talent trees.");
  if (!rules.talentRequired && choices.talentId) throw advancementError("This class level does not grant a talent.");
  if (talentChoice) talentSelections.push({ id: talentChoice.id, name: talentChoice.name, tree: talentChoice.tree, classId, level: rules.targetLevel });

  const linguistSelections = [startingFeat, classFeat, generalFeat].filter(item => item?.id === "linguist").length;
  const languageChoices = intelligenceGain + linguistSelections * Math.max(1, 1 + abilityModifier(scores.intelligence));
  character.languages = validateLanguageChoices(character, choices, languageChoices);
  const existingTraining = featCount(current.character, "force-training");
  if (existingTraining && abilityModifier(scores.wisdom) > abilityModifier(previousScores.wisdom)) throw advancementError("A Wisdom increase adds Force powers for existing Force Training feats; complete the power-suite choices before recording this level.");

  const hitDieRoll = Number(roller(HEROIC_CLASSES[classId].hitDie));
  if (!Number.isSafeInteger(hitDieRoll) || hitDieRoll < 1 || hitDieRoll > HEROIC_CLASSES[classId].hitDie) throw advancementError("The advancement hit-point roll was invalid.", 500);
  const newLevelHitPoints = Math.max(1, hitDieRoll + abilityModifier(scores.constitution));
  const constitutionDifference = abilityModifier(scores.constitution) - abilityModifier(previousScores.constitution);
  // Historical minimum-1 HP rolls cannot be reconstructed from max HP alone.
  // Require their audit records rather than adding an invented retroactive gain.
  const completeHitPointHistory = Array.isArray(character.hitPointHistory) && character.hitPointHistory.length === status.level && character.hitPointHistory.every((entry, index) => Number(entry.level) === index + 1 && Number.isSafeInteger(Number(entry.base)) && Number(entry.base) >= 1 && Number(entry.base) <= (index === 0 ? 30 : 10));
  if (constitutionDifference && abilityModifier(previousScores.constitution) < 0 && !completeHitPointHistory) throw advancementError("The Constitution increase requires the prior hit-point rolls to account for minimum hit-point gains.");
  const constitutionHitPoints = constitutionDifference && abilityModifier(previousScores.constitution) < 0
    ? character.hitPointHistory.reduce((sum, entry) => sum + Math.max(1, Number(entry.base) + abilityModifier(scores.constitution)) - Math.max(1, Number(entry.base) + abilityModifier(previousScores.constitution)), 0)
    : constitutionDifference * status.level;
  const toughnessHitPoints = featCount(character, "toughness") ? featCount(current.character, "toughness") ? 1 : rules.targetLevel : 0;
  const hitPointGain = newLevelHitPoints + constitutionHitPoints + toughnessHitPoints;
  const legacyTalents = cleanList(character.talents);
  const legacyFeats = cleanList(character.feats);
  const catalogTalents = [...Object.values(TALENT_TREES).flat(), ...FORCE_TALENT_TREES].flatMap(tree => tree.talents);
  const talentNames = [...new Set([...legacyTalents, ...talentSelections.map(item => item.name || catalogTalents.find(entry => entry.id === item.id)?.name || String(item.id))])];
  const featNames = [...new Set([...legacyFeats, ...featSelections.map(item => item.name || FEAT_CATALOG.find(entry => entry.id === item.id)?.name || String(item.id))])];
  const heroicClass = Object.entries(classLevels).filter(([, value]) => Number(value) > 0).map(([id, value]) => `${HEROIC_CLASSES[id]?.name || id} ${value}`).join(" / ");

  Object.assign(character, {
    level: rules.targetLevel, classLevels, heroicClass, abilityScores: scores, sagaStats: formatAbilityScores(scores),
    talentSelections, featSelections, talents: talentNames.length ? talentNames.join(", ") : "None recorded",
    feats: featNames.length ? featNames.join(", ") : "None recorded",
    maxHitPoints: Number(current.character.maxHitPoints) + hitPointGain,
  });
  character.hitPointHistory = [...(Array.isArray(character.hitPointHistory) ? character.hitPointHistory : []), { level: rules.targetLevel, base: hitDieRoll, constitutionModifier: abilityModifier(scores.constitution), hitPoints: newLevelHitPoints }];
  if (ownedFeatIds(character).has("force-sensitivity")) character.forceSensitive = "Yes";

  const gameState = { ...current.gameState };
  gameState.health = Math.min(character.maxHitPoints, Math.max(0, Number(gameState.health) || 0) + hitPointGain);
  gameState.forcePoints = 5 + Math.floor(rules.targetLevel / 2) + (ownedFeatIds(character).has("force-boon") ? 3 : 0);
  Object.assign(character, derivedDefenseChange(current.character, character));
  const wealthCreditGain = ownedTalentIds(character).has("wealth") ? 5_000 * Number(classLevels.noble || 0) : 0;
  if (wealthCreditGain) gameState.credits = Math.max(0, Number(gameState.credits) || 0) + wealthCreditGain;
  const record = { advancementId, fromLevel: status.level, toLevel: rules.targetLevel, classId, classLevel: rules.nextClassLevel, talent: talentChoice || null, classBonusFeat: classFeat || null, generalFeat: generalFeat || null, startingFeat: startingFeat || null, abilityIncreases, trainedSkillIds: newSkillIds, languageIds: choices.languageIds || [], wealthCreditGain, hitDie: `1d${HEROIC_CLASSES[classId].hitDie}`, hitDieRoll, constitutionModifier: abilityModifier(scores.constitution), newLevelHitPoints, constitutionHitPoints, toughnessHitPoints, hitPointGain, committedAt: now };
  gameState.advancementHistory = [...gameState.advancementHistory, record].slice(-100);
  gameState.levelUpAvailable = progressionStatus(character).advancementAvailable;
  gameState.flags = [...(Array.isArray(gameState.flags) ? gameState.flags : []), { note: `Advanced to level ${rules.targetLevel}: ${HEROIC_CLASSES[classId].name} ${rules.nextClassLevel}; gained ${hitPointGain} hit points.`, ts: Date.parse(now) || Date.now() }];
  return { ...current, character, gameState };
}

export const SAGA_ABILITY_OPTIONS = Object.freeze(ABILITIES.map(id => ({ id, name: id[0].toUpperCase() + id.slice(1) })));

export function applySagaFoundation(snapshot, choices = {}, now = new Date().toISOString()) {
  const current = ensureAdvancementScaffold(snapshot);
  if (!current.character) throw advancementError("No player character is available for advancement.");
  const foundationId = String(choices.advancementId || "").trim();
  if (!foundationId || foundationId.length > 100) throw advancementError("A valid advancement identifier is required.");
  const priorCommit = current.gameState.advancementHistory.find(entry => entry.advancementId === foundationId);
  if (priorCommit) {
    if (priorCommit.kind !== "level-1-foundation" || priorCommit.classId !== String(choices.classId || "").toLowerCase()) throw advancementError("That advancement identifier is already associated with a different choice.", 409);
    return current;
  }
  const status = progressionStatus(current.character);
  if (!status.foundationRequired) throw advancementError("The character's starting class is already established.");
  if (status.level !== 1) throw advancementError("This legacy character needs a GM-reviewed class-level reconstruction before further advancement.");
  if (!status.buildConsistent) throw advancementError("The existing class record requires reconstruction before first-level choices can be recorded.");
  const scores = requireAbilityScores(current.character);
  requireSelectionRecords(current.character);
  // This path fills an empty historical sheet. Existing talents/classes/feats
  // require reconciliation into their original slots, not another free build.
  if (cleanList(current.character.talents).length || (current.character.talentSelections || []).length || cleanList(current.character.feats).length || (current.character.featSelections || []).length || cleanList(current.character.heroicClass).length) throw advancementError("Existing class, feat, or talent choices must be reconstructed into their original build slots before establishing the foundation.");
  const classId = String(choices.classId || "").toLowerCase();
  const heroic = HEROIC_CLASSES[classId];
  if (!heroic) throw advancementError("Choose a valid starting heroic class.");
  const human = /^human$/i.test(String(current.character.species || "").trim());
  if (!human) throw advancementError("This foundation workflow currently verifies Human species traits. Reconstruct other species' starting traits before committing a complete build.");
  const character = { ...current.character, level: 1, classLevels: { [classId]: 1 }, baseAttackBonus: classLevelBab(classId, 1), abilityScores: scores, featSelections: [], talentSelections: [] };
  const requirements = foundationRequirements(character, classId, choices);
  const selectedSkillIds = Array.isArray(choices.trainedSkillIds) ? choices.trainedSkillIds.map(String) : [];
  const skillOptions = new Set(availableClassSkills(advancementChoiceContext(character, classId), classId).map(item => item.id));
  // Force Sensitivity chosen in either player feat slot expands class skills.
  if ([choices.generalFeatId, choices.humanBonusFeatId].includes("force-sensitivity")) skillOptions.add("use-the-force");
  if (selectedSkillIds.length !== requirements.trainedSkillCount || new Set(selectedSkillIds).size !== selectedSkillIds.length || selectedSkillIds.some(id => !skillOptions.has(id))) throw advancementError(`Choose exactly ${requirements.trainedSkillCount} different trained skills from the starting class skill list.`);
  const priorSkillIds = trainedSkillIds(current.character);
  if (cleanList(current.character.trainedSkills).length !== priorSkillIds.size || [...priorSkillIds].some(id => !selectedSkillIds.includes(id))) throw advancementError("The foundation choices must preserve the character's existing established trained skills.");
  character.trainedSkills = selectedSkillIds.map(id => SAGA_SKILL_OPTIONS.find(item => item.id === id).name);
  const featSelections = character.featSelections;
  for (const id of heroic.startingFeats) {
    const entry = FEAT_CATALOG.find(item => item.id === id);
    // Noble Linguist and Scout Shake It Off are explicitly conditional.
    if (entry && hasPrerequisites(entry, character)) featSelections.push({ id, name: entry.name, source: "starting-class", classId, level: 1 });
  }
  const generalFeat = findFeat(character, classId, String(choices.generalFeatId || ""), false);
  if (!generalFeat) throw advancementError("Choose an eligible 1st-level feat.");
  featSelections.push({ id: generalFeat.id, name: generalFeat.name, source: "level-1-feat", classId, level: 1 });
  const humanBonusFeat = findFeat(character, classId, String(choices.humanBonusFeatId || ""), false);
  if (!humanBonusFeat) throw advancementError("Choose an eligible Human bonus feat; nonrepeatable feats cannot be chosen twice.");
  featSelections.push({ id: humanBonusFeat.id, name: humanBonusFeat.name, source: "human-bonus-feat", classId, level: 1 });
  if (selectedSkillIds.includes("use-the-force") && !ownedFeatIds(character).has("force-sensitivity")) throw advancementError("Training Use the Force requires Force Sensitivity.");
  const talentChoice = findTalent(character, classId, String(choices.talentId || ""), current.gameState);
  if (!talentChoice) throw advancementError("Choose an eligible talent from the starting class or available Force talent trees.");
  const talentSelections = [{ id: talentChoice.id, name: talentChoice.name, tree: talentChoice.tree, classId, level: 1 }];
  character.languages = validateLanguageChoices({ ...character, languages: [...new Set(["Basic", ...cleanList(character.languages)])] }, choices, requirements.bonusLanguageCount);
  const maxHitPoints = Math.max(1, heroic.hitDie * 3 + abilityModifier(scores.constitution)) + (ownedFeatIds(character).has("toughness") ? 1 : 0);
  if (knownNumber(current.character.maxHitPoints) && Number(current.character.maxHitPoints) !== maxHitPoints) throw advancementError("The selected build conflicts with established maximum hit points; reconstruct the original build before recording it.");
  const improvedDefense = ownedFeatIds(character).has("improved-defenses") ? 1 : 0;
  const martialDefense = ownedFeatIds(character).has("martial-arts-1") ? 1 : 0;
  const defenses = {
    reflex: 11 + heroic.defense.reflex + abilityModifier(scores.dexterity) + improvedDefense + martialDefense,
    fortitude: 11 + heroic.defense.fortitude + abilityModifier(scores.constitution) + improvedDefense,
    will: 11 + heroic.defense.will + abilityModifier(scores.wisdom) + improvedDefense,
  };
  Object.assign(character, {
    classLevels: { [classId]: 1 }, heroicClass: `${heroic.name} 1`, abilityScores: scores, sagaStats: formatAbilityScores(scores),
    talentSelections, featSelections, talents: talentSelections.map(item => item.name).join(", ") || "None recorded",
    feats: [...new Set(featSelections.map(item => item.name))].join(", ") || "None recorded",
    baseAttackBonus: classLevelBab(classId, 1), maxHitPoints, defenses, damageThreshold: defenses.fortitude + 5 * featCount(character, "improved-damage-threshold"),
    hitPointHistory: [{ level: 1, base: heroic.hitDie * 3, constitutionModifier: abilityModifier(scores.constitution), hitPoints: Math.max(1, heroic.hitDie * 3 + abilityModifier(scores.constitution)) }],
  });
  if (ownedFeatIds(character).has("force-sensitivity")) character.forceSensitive = "Yes";
  const gameState = { ...current.gameState };
  gameState.health = Math.min(maxHitPoints, Math.max(0, Number(gameState.health) || 0));
  const forceBoonPoints = ownedFeatIds(character).has("force-boon") ? 3 : 0;
  gameState.forcePoints = gameState.forcePoints == null ? 5 + forceBoonPoints : Math.max(0, Number(gameState.forcePoints) || 0) + forceBoonPoints;
  // Destiny is an optional campaign rule, not an automatic build reward.
  if (gameState.destinyEnabled === true && gameState.destinyPoints == null) gameState.destinyPoints = 1;
  const wealthCreditGain = talentChoice.id === "wealth" ? 5_000 : 0;
  if (wealthCreditGain) gameState.credits = Math.max(0, Number(gameState.credits) || 0) + wealthCreditGain;
  const record = { advancementId: foundationId, kind: "level-1-foundation", fromLevel: 1, toLevel: 1, classId, classLevel: 1, talent: talentChoice, generalFeat, humanBonusFeat, trainedSkillIds: selectedSkillIds, languageIds: choices.languageIds || [], wealthCreditGain, startingFeats: featSelections.filter(item => item.source === "starting-class"), maxHitPoints, committedAt: now };
  gameState.advancementHistory = [...gameState.advancementHistory, record].slice(-100);
  gameState.levelUpAvailable = progressionStatus(character).advancementAvailable;
  gameState.flags = [...(Array.isArray(gameState.flags) ? gameState.flags : []), { note: `Level 1 Saga build established: ${heroic.name}; ${talentChoice.name}.`, ts: Date.parse(now) || Date.now() }];
  return { ...current, character, gameState };
}
