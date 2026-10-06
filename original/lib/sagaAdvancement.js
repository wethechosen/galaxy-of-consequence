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
    { id: "jedi-sentinel", name: "Jedi Sentinel", talents: [talent("clear-mind", "Clear Mind", "Jedi Sentinel"), talent("force-haze", "Force Haze", "Jedi Sentinel", { requires: ["clear-mind"] }), talent("resist-dark-side", "Resist the Dark Side", "Jedi Sentinel")] },
    { id: "lightsaber-combat", name: "Lightsaber Combat", talents: [talent("block", "Block", "Lightsaber Combat"), talent("deflect", "Deflect", "Lightsaber Combat"), talent("lightsaber-defense", "Lightsaber Defense", "Lightsaber Combat"), talent("redirect-shot", "Redirect Shot", "Lightsaber Combat", { requires: ["deflect"] }), talent("lightsaber-specialization", "Weapon Specialization (lightsabers)", "Lightsaber Combat", { requiresFeat: "weapon-focus-lightsabers" })] },
  ],
  noble: [
    { id: "influence", name: "Influence", talents: [talent("presence", "Presence", "Influence"), talent("demand-surrender", "Demand Surrender", "Influence", { requires: ["presence"] }), talent("weaken-resolve", "Weaken Resolve", "Influence", { requires: ["presence"] })] },
    { id: "inspiration", name: "Inspiration", talents: [talent("bolster-ally", "Bolster Ally", "Inspiration"), talent("ignite-fervor", "Ignite Fervor", "Inspiration"), talent("inspire-confidence", "Inspire Confidence", "Inspiration")] },
    { id: "leadership", name: "Leadership", talents: [talent("born-leader", "Born Leader", "Leadership"), talent("coordinate", "Coordinate", "Leadership"), talent("distant-command", "Distant Command", "Leadership", { requires: ["born-leader"] }), talent("trust", "Trust", "Leadership")] },
    { id: "lineage", name: "Lineage", talents: [talent("connections", "Connections", "Lineage"), talent("educated", "Educated", "Lineage"), talent("spontaneous-skill", "Spontaneous Skill", "Lineage"), talent("wealth", "Wealth", "Lineage")] },
  ],
  scoundrel: [
    { id: "fortune", name: "Fortune", talents: [talent("fools-luck", "Fool's Luck", "Fortune"), talent("fortune-favor", "Fortune's Favor", "Fortune"), talent("gambler", "Gambler", "Fortune"), talent("knack", "Knack", "Fortune"), talent("lucky-shot", "Lucky Shot", "Fortune")] },
    { id: "misfortune", name: "Misfortune", talents: [talent("dastardly-strike", "Dastardly Strike", "Misfortune"), talent("disruptive", "Disruptive", "Misfortune"), talent("skirmisher", "Skirmisher", "Misfortune"), talent("sneak-attack", "Sneak Attack", "Misfortune")] },
    { id: "slicer", name: "Slicer", talents: [talent("gimmick", "Gimmick", "Slicer"), talent("master-slicer", "Master Slicer", "Slicer", { requires: ["gimmick"] }), talent("security-slicer", "Security Slicer", "Slicer", { requires: ["gimmick"] })] },
    { id: "spacer", name: "Spacer", talents: [talent("hyperdriven", "Hyperdriven", "Spacer"), talent("spacehound", "Spacehound", "Spacer"), talent("starship-raider", "Starship Raider", "Spacer")] },
  ],
  scout: [
    { id: "awareness", name: "Awareness", talents: [talent("acute-senses", "Acute Senses", "Awareness"), talent("expert-tracker", "Expert Tracker", "Awareness", { requires: ["acute-senses"] }), talent("improved-initiative", "Improved Initiative", "Awareness"), talent("uncanny-dodge-1", "Uncanny Dodge I", "Awareness"), talent("uncanny-dodge-2", "Uncanny Dodge II", "Awareness", { requires: ["uncanny-dodge-1"] })] },
    { id: "camouflage", name: "Camouflage", talents: [talent("hidden-movement", "Hidden Movement", "Camouflage"), talent("improved-stealth", "Improved Stealth", "Camouflage"), talent("total-concealment", "Total Concealment", "Camouflage", { requires: ["improved-stealth"] })] },
    { id: "fringer", name: "Fringer", talents: [talent("barter", "Barter", "Fringer"), talent("jury-rigger", "Jury-Rigger", "Fringer"), talent("long-stride", "Long Stride", "Fringer")] },
    { id: "survivor", name: "Survivor", talents: [talent("evasion", "Evasion", "Survivor"), talent("extreme-effort", "Extreme Effort", "Survivor"), talent("improved-evasion", "Improved Evasion", "Survivor", { requires: ["evasion"] }), talent("surefooted", "Surefooted", "Survivor")] },
  ],
  soldier: [
    { id: "armor-specialist", name: "Armor Specialist", talents: [talent("armored-defense", "Armored Defense", "Armor Specialist"), talent("improved-armored-defense", "Improved Armored Defense", "Armor Specialist", { requires: ["armored-defense"] }), talent("juggernaut", "Juggernaut", "Armor Specialist", { requires: ["armored-defense"] }), talent("second-skin", "Second Skin", "Armor Specialist", { requires: ["armored-defense"] })] },
    { id: "brawler", name: "Brawler", talents: [talent("expert-grappler", "Expert Grappler", "Brawler"), talent("gun-club", "Gun Club", "Brawler"), talent("melee-smash", "Melee Smash", "Brawler"), talent("stunning-strike", "Stunning Strike", "Brawler", { requires: ["melee-smash"] })] },
    { id: "commando", name: "Commando", talents: [talent("battle-analysis", "Battle Analysis", "Commando"), talent("cover-fire", "Cover Fire", "Commando"), talent("demolitionist", "Demolitionist", "Commando"), talent("draw-fire", "Draw Fire", "Commando"), talent("indomitable", "Indomitable", "Commando")] },
    { id: "weapon-specialist", name: "Weapon Specialist", talents: [talent("devastating-attack", "Devastating Attack", "Weapon Specialist"), talent("penetrating-attack", "Penetrating Attack", "Weapon Specialist"), talent("weapon-specialization", "Weapon Specialization", "Weapon Specialist", { requiresFeatPrefix: "weapon-focus" })] },
  ],
});

export const FEAT_CATALOG = Object.freeze([
  feat("acrobatic-strike", "Acrobatic Strike"), feat("bantha-rush", "Bantha Rush"), feat("careful-shot", "Careful Shot", { requires: ["point-blank-shot"] }),
  feat("cleave", "Cleave"), feat("combat-reflexes", "Combat Reflexes"), feat("coordinated-attack", "Coordinated Attack"),
  feat("dodge", "Dodge"), feat("force-boon", "Force Boon", { forceSensitive: true }), feat("force-sensitivity", "Force Sensitivity"),
  feat("force-training", "Force Training", { forceSensitive: true }), feat("improved-damage-threshold", "Improved Damage Threshold"),
  feat("improved-defenses", "Improved Defenses"), feat("linguist", "Linguist"), feat("martial-arts-1", "Martial Arts I"),
  feat("martial-arts-2", "Martial Arts II", { requires: ["martial-arts-1"] }), feat("martial-arts-3", "Martial Arts III", { requires: ["martial-arts-2"] }),
  feat("mobility", "Mobility", { requires: ["dodge"] }), feat("point-blank-shot", "Point Blank Shot"),
  feat("precise-shot", "Precise Shot", { requires: ["point-blank-shot"] }), feat("quick-draw", "Quick Draw"), feat("rapid-shot", "Rapid Shot"),
  feat("rapid-strike", "Rapid Strike"), feat("running-attack", "Running Attack"), feat("shake-it-off", "Shake It Off"),
  feat("skill-focus", "Skill Focus"), feat("skill-training", "Skill Training"), feat("sniper", "Sniper", { requires: ["point-blank-shot", "precise-shot"] }),
  feat("spring-attack", "Spring Attack", { requires: ["dodge", "mobility"] }), feat("strong-in-force", "Strong in the Force", { forceSensitive: true }),
  feat("toughness", "Toughness"), feat("weapon-finesse", "Weapon Finesse"), feat("weapon-focus-lightsabers", "Weapon Focus (lightsabers)"),
  feat("weapon-focus-pistols", "Weapon Focus (pistols)"), feat("weapon-focus-rifles", "Weapon Focus (rifles)"), feat("weapon-focus-simple", "Weapon Focus (simple weapons)"),
]);

const sharedBonusFeats = ["improved-damage-threshold", "point-blank-shot", "quick-draw", "skill-focus", "skill-training", "toughness", "weapon-focus-pistols", "weapon-focus-rifles", "weapon-focus-simple"];
export const HEROIC_CLASSES = Object.freeze({
  jedi: { id: "jedi", name: "Jedi", hitDie: 10, bab: "full", defense: { reflex: 1, fortitude: 1, will: 1 }, startingFeats: ["force-sensitivity", "weapon-proficiency-lightsabers", "weapon-proficiency-simple"], bonusFeats: ["force-boon", "force-sensitivity", "force-training", "rapid-strike", "strong-in-force", "weapon-finesse", "weapon-focus-lightsabers", ...sharedBonusFeats] },
  noble: { id: "noble", name: "Noble", hitDie: 6, bab: "three-quarter", defense: { reflex: 1, fortitude: 0, will: 2 }, startingFeats: ["linguist", "weapon-proficiency-pistols", "weapon-proficiency-simple"], bonusFeats: ["linguist", "skill-focus", "skill-training", "weapon-focus-pistols", ...sharedBonusFeats] },
  scoundrel: { id: "scoundrel", name: "Scoundrel", hitDie: 6, bab: "three-quarter", defense: { reflex: 2, fortitude: 0, will: 1 }, startingFeats: ["point-blank-shot", "weapon-proficiency-pistols", "weapon-proficiency-simple"], bonusFeats: ["careful-shot", "point-blank-shot", "precise-shot", "quick-draw", "rapid-shot", "sniper", ...sharedBonusFeats] },
  scout: { id: "scout", name: "Scout", hitDie: 8, bab: "three-quarter", defense: { reflex: 2, fortitude: 1, will: 0 }, startingFeats: ["shake-it-off", "weapon-proficiency-pistols", "weapon-proficiency-rifles", "weapon-proficiency-simple"], bonusFeats: ["dodge", "mobility", "running-attack", "shake-it-off", "skill-focus", "skill-training", "spring-attack", ...sharedBonusFeats] },
  soldier: { id: "soldier", name: "Soldier", hitDie: 10, bab: "full", defense: { reflex: 1, fortitude: 2, will: 0 }, startingFeats: ["armor-proficiency-light", "armor-proficiency-medium", "weapon-proficiency-pistols", "weapon-proficiency-rifles", "weapon-proficiency-simple"], bonusFeats: ["bantha-rush", "cleave", "combat-reflexes", "dodge", "martial-arts-1", "martial-arts-2", "martial-arts-3", "rapid-shot", "rapid-strike", "weapon-finesse", ...sharedBonusFeats] },
});

const STARTING_FEAT_NAMES = Object.freeze({
  "armor-proficiency-light": "Armor Proficiency (light)", "armor-proficiency-medium": "Armor Proficiency (medium)",
  "weapon-proficiency-lightsabers": "Weapon Proficiency (lightsabers)", "weapon-proficiency-pistols": "Weapon Proficiency (pistols)",
  "weapon-proficiency-rifles": "Weapon Proficiency (rifles)", "weapon-proficiency-simple": "Weapon Proficiency (simple weapons)",
  "force-sensitivity": "Force Sensitivity", linguist: "Linguist", "point-blank-shot": "Point Blank Shot", "shake-it-off": "Shake It Off",
});

const cleanList = (value, emptyPattern = /^(?:none|none recorded|unestablished)$/i) => Array.isArray(value)
  ? value.filter(Boolean).map(String)
  : String(value || "").split(/[,;|]/).map(item => item.trim()).filter(item => item && !emptyPattern.test(item));
const idSet = (value) => new Set((Array.isArray(value) ? value : []).map(item => typeof item === "string" ? item : item?.id).filter(Boolean));
const abilityModifier = score => Math.floor((Number(score) - 10) / 2);

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
    const direct = Number(established[key]);
    const match = String(character.sagaStats || "").match(new RegExp(`${ABILITY_LABELS[key]}\\s*(\\d+)`, "i"));
    result[key] = Number.isFinite(direct) ? direct : match ? Number(match[1]) : 10;
  }
  return result;
}

export function formatAbilityScores(scores) {
  return ABILITIES.map(key => `${ABILITY_LABELS[key]} ${Number(scores[key])}`).join(" | ");
}

export function progressionStatus(character = {}) {
  const level = Math.max(1, Math.min(20, Math.floor(Number(character.level) || 1)));
  const experience = Math.max(0, Math.floor(Number(character.experience) || 0));
  const earnedLevel = sagaLevelForExperience(experience);
  const classLevels = character.classLevels && typeof character.classLevels === "object" ? character.classLevels : {};
  const assignedClassLevels = Object.values(classLevels).reduce((sum, value) => sum + Math.max(0, Math.floor(Number(value) || 0)), 0);
  return { level, experience, earnedLevel, assignedClassLevels, foundationRequired: assignedClassLevels === 0, levelsAvailable: Math.max(0, earnedLevel - level), nextLevelXp: nextLevelExperience(level), advancementAvailable: earnedLevel > level };
}

export function advancementRequirements(character = {}, classId) {
  const status = progressionStatus(character);
  const selectedClass = HEROIC_CLASSES[classId];
  if (!selectedClass) return { ...status, validClass: false };
  const classLevels = character.classLevels && typeof character.classLevels === "object" ? character.classLevels : {};
  const nextClassLevel = Math.max(0, Math.floor(Number(classLevels[classId]) || 0)) + 1;
  return {
    ...status, validClass: true, targetLevel: status.level + 1, classId, nextClassLevel,
    talentRequired: nextClassLevel % 2 === 1,
    classBonusFeatRequired: nextClassLevel % 2 === 0,
    generalFeatRequired: (status.level + 1) % 3 === 0,
    abilityIncreasesRequired: (status.level + 1) % 4 === 0 ? 2 : 0,
    multiclassStartingFeatRequired: nextClassLevel === 1 && status.level > 0,
  };
}

function hasPrerequisites(entry, talentIds, featIds, forceSensitive) {
  if (entry.forceSensitive && !forceSensitive) return false;
  if ((entry.requires || []).some(id => !talentIds.has(id) && !featIds.has(id))) return false;
  if (entry.requiresFeat && !featIds.has(entry.requiresFeat)) return false;
  if (entry.requiresFeatPrefix && ![...featIds].some(id => id.startsWith(entry.requiresFeatPrefix))) return false;
  return true;
}

export function availableTalents(character = {}, classId) {
  const owned = idSet(character.talentSelections);
  const feats = idSet(character.featSelections);
  const forceSensitive = /^(?:yes|true)$/i.test(String(character.forceSensitive || "")) || feats.has("force-sensitivity") || /force sensitive/i.test(String(character.feats || ""));
  return (TALENT_TREES[classId] || []).map(tree => ({ ...tree, talents: tree.talents.filter(item => !owned.has(item.id) && hasPrerequisites(item, owned, feats, forceSensitive)) })).filter(tree => tree.talents.length);
}

export function availableFeats(character = {}, classId, bonusOnly = false) {
  const owned = idSet(character.featSelections);
  for (const value of cleanList(character.feats)) {
    const found = FEAT_CATALOG.find(item => item.name.toLowerCase() === value.toLowerCase());
    if (found) owned.add(found.id);
  }
  const forceSensitive = /^(?:yes|true)$/i.test(String(character.forceSensitive || "")) || owned.has("force-sensitivity");
  const allowed = bonusOnly ? new Set(HEROIC_CLASSES[classId]?.bonusFeats || []) : null;
  return FEAT_CATALOG.filter(item => !owned.has(item.id) && (!allowed || allowed.has(item.id)) && hasPrerequisites(item, new Set(), owned, forceSensitive));
}

export function availableStartingFeats(character = {}, classId) {
  const ownedNames = new Set(cleanList(character.feats).map(item => item.toLowerCase()));
  const ownedIds = idSet(character.featSelections);
  return (HEROIC_CLASSES[classId]?.startingFeats || []).filter(id => !ownedIds.has(id) && !ownedNames.has(String(STARTING_FEAT_NAMES[id] || id).toLowerCase())).map(id => ({ id, name: STARTING_FEAT_NAMES[id] || id }));
}

function findTalent(character, classId, id) {
  return availableTalents(character, classId).flatMap(tree => tree.talents).find(item => item.id === id);
}
function findFeat(character, classId, id, bonusOnly) {
  return availableFeats(character, classId, bonusOnly).find(item => item.id === id);
}
function classLevelBab(classId, level) {
  return HEROIC_CLASSES[classId]?.bab === "full" ? level : Math.floor(level * 3 / 4);
}
function advancementError(message, status = 400) { const error = new Error(message); error.status = status; return error; }

export function ensureAdvancementScaffold(snapshot = {}) {
  const character = snapshot.character && typeof snapshot.character === "object" ? { ...snapshot.character } : snapshot.character;
  const gameState = snapshot.gameState && typeof snapshot.gameState === "object" ? { ...snapshot.gameState } : {};
  gameState.advancementHistory = Array.isArray(gameState.advancementHistory) ? gameState.advancementHistory.map(item => ({ ...item })) : [];
  gameState.levelUpAvailable = Boolean(character && progressionStatus(character).advancementAvailable);
  return { ...snapshot, character, gameState };
}

export function applySagaAdvancement(snapshot, choices = {}, roller = sides => 1 + Math.floor(Math.random() * sides), now = new Date().toISOString()) {
  const current = ensureAdvancementScaffold(snapshot);
  if (!current.character) throw advancementError("No player character is available for advancement.");
  const advancementId = String(choices.advancementId || "").trim();
  if (!advancementId || advancementId.length > 100) throw advancementError("A valid advancement identifier is required.");
  if (current.gameState.advancementHistory.some(entry => entry.advancementId === advancementId)) return current;
  const status = progressionStatus(current.character);
  if (status.foundationRequired) throw advancementError("Establish the character's level-1 class, talent, and starting feats before adding another level.");
  if (!status.advancementAvailable) throw advancementError("This character has not earned the XP required for another level.");
  const classId = String(choices.classId || "").toLowerCase();
  const rules = advancementRequirements(current.character, classId);
  if (!rules.validClass) throw advancementError("Choose a valid heroic class for this level.");

  const talentChoice = rules.talentRequired ? findTalent(current.character, classId, String(choices.talentId || "")) : null;
  if (rules.talentRequired && !talentChoice) throw advancementError("Choose an eligible talent from the selected class's talent trees.");
  const classFeat = rules.classBonusFeatRequired ? findFeat(current.character, classId, String(choices.classBonusFeatId || ""), true) : null;
  if (rules.classBonusFeatRequired && !classFeat) throw advancementError("Choose an eligible bonus feat for the selected class.");
  const generalFeat = rules.generalFeatRequired ? findFeat(current.character, classId, String(choices.generalFeatId || ""), false) : null;
  if (rules.generalFeatRequired && !generalFeat) throw advancementError("Choose an eligible character-level feat.");
  const startingFeat = rules.multiclassStartingFeatRequired ? availableStartingFeats(current.character, classId).find(item => item.id === choices.startingFeatId) : null;
  if (rules.multiclassStartingFeatRequired && !startingFeat) throw advancementError("Choose one available starting feat from the new class.");
  const selectedFeatIds = [startingFeat?.id, classFeat?.id, generalFeat?.id].filter(Boolean);
  if (new Set(selectedFeatIds).size !== selectedFeatIds.length) throw advancementError("Each feat choice for this level must be different.");

  const abilityIncreases = Array.isArray(choices.abilityIncreases) ? choices.abilityIncreases.map(String) : [];
  if (abilityIncreases.length !== rules.abilityIncreasesRequired || new Set(abilityIncreases).size !== abilityIncreases.length || abilityIncreases.some(key => !ABILITIES.includes(key))) {
    throw advancementError(rules.abilityIncreasesRequired ? "Choose two different ability scores to increase." : "This level does not grant an ability-score increase.");
  }

  const character = { ...current.character };
  const classLevels = { ...(character.classLevels && typeof character.classLevels === "object" ? character.classLevels : {}) };
  classLevels[classId] = rules.nextClassLevel;
  const scores = parseAbilityScores(character);
  for (const key of abilityIncreases) scores[key] += 1;
  const talentSelections = Array.isArray(character.talentSelections) ? [...character.talentSelections] : [];
  const featSelections = Array.isArray(character.featSelections) ? [...character.featSelections] : [];
  if (talentChoice) talentSelections.push({ id: talentChoice.id, name: talentChoice.name, tree: talentChoice.tree, classId, level: rules.targetLevel });
  for (const selected of [startingFeat, classFeat, generalFeat]) if (selected) featSelections.push({ id: selected.id, name: selected.name, source: selected === startingFeat ? "multiclass-starting-feat" : selected === classFeat ? "class-bonus-feat" : "general-feat", classId, level: rules.targetLevel });

  const hitDieRoll = Number(roller(HEROIC_CLASSES[classId].hitDie));
  if (!Number.isSafeInteger(hitDieRoll) || hitDieRoll < 1 || hitDieRoll > HEROIC_CLASSES[classId].hitDie) throw advancementError("The advancement hit-point roll was invalid.", 500);
  const hitPointGain = Math.max(1, hitDieRoll + abilityModifier(scores.constitution));
  const baseAttackBonus = Object.entries(classLevels).reduce((sum, [id, level]) => sum + classLevelBab(id, Math.max(0, Math.floor(Number(level) || 0))), 0);
  const legacyTalents = cleanList(character.talents);
  const legacyFeats = cleanList(character.feats);
  const talentNames = [...new Set([...legacyTalents, ...talentSelections.map(item => item.name)])];
  const featNames = [...new Set([...legacyFeats, ...featSelections.map(item => item.name)])];
  const heroicClass = Object.entries(classLevels).filter(([, value]) => Number(value) > 0).map(([id, value]) => `${HEROIC_CLASSES[id]?.name || id} ${value}`).join(" / ");

  Object.assign(character, {
    level: rules.targetLevel, classLevels, heroicClass, abilityScores: scores, sagaStats: formatAbilityScores(scores),
    talentSelections, featSelections, talents: talentNames.length ? talentNames.join(", ") : "None recorded",
    feats: featNames.length ? featNames.join(", ") : "None recorded", baseAttackBonus,
    maxHitPoints: Math.max(Number(character.maxHitPoints) || Number(current.gameState.health) || 1, 1) + hitPointGain,
  });

  const gameState = { ...current.gameState };
  gameState.health = Math.max(0, Number(gameState.health) || 0) + hitPointGain;
  gameState.forcePoints = 5 + Math.floor(rules.targetLevel / 2);
  const priorDefenses = character.defenses && typeof character.defenses === "object" ? character.defenses : null;
  if (priorDefenses) {
    character.defenses = { reflex: Number(priorDefenses.reflex) + 1, fortitude: Number(priorDefenses.fortitude) + 1, will: Number(priorDefenses.will) + 1 };
    if (Number.isFinite(Number(character.damageThreshold))) character.damageThreshold = Number(character.damageThreshold) + 1;
  }
  const record = { advancementId, fromLevel: status.level, toLevel: rules.targetLevel, classId, classLevel: rules.nextClassLevel, talent: talentChoice || null, classBonusFeat: classFeat || null, generalFeat: generalFeat || null, startingFeat: startingFeat || null, abilityIncreases, hitDie: `1d${HEROIC_CLASSES[classId].hitDie}`, hitDieRoll, constitutionModifier: abilityModifier(scores.constitution), hitPointGain, committedAt: now };
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
  if (current.gameState.advancementHistory.some(entry => entry.advancementId === foundationId)) return current;
  const status = progressionStatus(current.character);
  if (!status.foundationRequired) throw advancementError("The character's starting class is already established.");
  if (status.level !== 1) throw advancementError("This legacy character needs a GM-reviewed class-level reconstruction before further advancement.");
  const classId = String(choices.classId || "").toLowerCase();
  const heroic = HEROIC_CLASSES[classId];
  if (!heroic) throw advancementError("Choose a valid starting heroic class.");
  const talentChoice = findTalent(current.character, classId, String(choices.talentId || ""));
  if (!talentChoice) throw advancementError("Choose an eligible talent from the starting class's talent trees.");
  const generalFeat = findFeat(current.character, classId, String(choices.generalFeatId || ""), false);
  if (!generalFeat) throw advancementError("Choose an eligible 1st-level feat.");
  const human = /^human$/i.test(String(current.character.species || "").trim());
  const simulated = { ...current.character, featSelections: [...(Array.isArray(current.character.featSelections) ? current.character.featSelections : []), { id: generalFeat.id, name: generalFeat.name }] };
  const humanBonusFeat = human ? findFeat(simulated, classId, String(choices.humanBonusFeatId || ""), false) : null;
  if (human && !humanBonusFeat) throw advancementError("Choose a different eligible Human bonus feat.");

  const character = { ...current.character };
  const scores = parseAbilityScores(character);
  const talentSelections = [...(Array.isArray(character.talentSelections) ? character.talentSelections : []), { id: talentChoice.id, name: talentChoice.name, tree: talentChoice.tree, classId, level: 1 }];
  const existingFeatIds = idSet(character.featSelections);
  const featSelections = [...(Array.isArray(character.featSelections) ? character.featSelections : [])];
  for (const id of heroic.startingFeats) if (!existingFeatIds.has(id)) featSelections.push({ id, name: STARTING_FEAT_NAMES[id] || id, source: "starting-class", classId, level: 1 });
  for (const selected of [generalFeat, humanBonusFeat]) if (selected && !featSelections.some(item => item.id === selected.id)) featSelections.push({ id: selected.id, name: selected.name, source: selected === generalFeat ? "level-1-feat" : "human-bonus-feat", classId, level: 1 });
  const legacyTalents = cleanList(character.talents);
  const legacyFeats = cleanList(character.feats);
  const maxHitPoints = Math.max(Number(current.gameState.health) || 1, heroic.hitDie * 3 + abilityModifier(scores.constitution));
  const defenses = {
    reflex: 11 + heroic.defense.reflex + abilityModifier(scores.dexterity),
    fortitude: 11 + heroic.defense.fortitude + abilityModifier(scores.constitution),
    will: 11 + heroic.defense.will + abilityModifier(scores.wisdom),
  };
  Object.assign(character, {
    classLevels: { [classId]: 1 }, heroicClass: `${heroic.name} 1`, abilityScores: scores, sagaStats: formatAbilityScores(scores),
    talentSelections, featSelections, talents: [...new Set([...legacyTalents, ...talentSelections.map(item => item.name)])].join(", ") || "None recorded",
    feats: [...new Set([...legacyFeats, ...featSelections.map(item => item.name)])].join(", ") || "None recorded",
    baseAttackBonus: classLevelBab(classId, 1), maxHitPoints, defenses, damageThreshold: defenses.fortitude,
  });
  const gameState = { ...current.gameState };
  if (gameState.forcePoints == null) gameState.forcePoints = 5;
  if (gameState.destinyPoints == null) gameState.destinyPoints = 1;
  const record = { advancementId: foundationId, kind: "level-1-foundation", fromLevel: 1, toLevel: 1, classId, classLevel: 1, talent: talentChoice, generalFeat, humanBonusFeat, startingFeats: heroic.startingFeats.map(id => ({ id, name: STARTING_FEAT_NAMES[id] || id })), maxHitPoints, committedAt: now };
  gameState.advancementHistory = [...gameState.advancementHistory, record].slice(-100);
  gameState.levelUpAvailable = progressionStatus(character).advancementAvailable;
  gameState.flags = [...(Array.isArray(gameState.flags) ? gameState.flags : []), { note: `Level 1 Saga build established: ${heroic.name}; ${talentChoice.name}.`, ts: Date.parse(now) || Date.now() }];
  return { ...current, character, gameState };
}
