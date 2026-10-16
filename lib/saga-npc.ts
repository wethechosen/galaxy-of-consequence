export type SagaNpcAbilities = {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
};

export type SagaNpcBuild = {
  ruleset: "Star Wars Saga Edition";
  buildVersion: 1;
  name: string;
  species: "Human";
  role: "guard" | "thug" | "skilled";
  characterLevel: number;
  heroicLevel: 0;
  classLevels: { nonheroic: number };
  abilityScores: SagaNpcAbilities;
  trainedSkills: string[];
  startingFeats: string[];
  generalFeats: string[];
  speciesBonusFeat: string;
  talents: [];
  forcePoints: 0;
  destinyPoints: 0;
  baseAttackBonus: number;
  hitPointRolls: number[];
  maxHitPoints: number;
  defenses: { reflex: number; fortitude: number; will: number };
  damageThreshold: number;
  initiativeModifier: number;
  armor: { name: string; reflexBonus: number } | null;
  attack: {
    name: string;
    mode: "melee" | "ranged";
    modifier: number;
    damage: { count: number; sides: number; modifier: number; type: string };
  };
};

export type SagaNpcBuildInput = {
  name: string;
  level: number;
  role?: SagaNpcBuild["role"];
};

const NONHEROIC_STARTING_FEATS = new Set([
  "Armor Proficiency (light)", "Armor Proficiency (medium)",
  "Skill Focus", "Skill Training", "Weapon Proficiency (advanced melee weapons)",
  "Weapon Proficiency (heavy weapons)", "Weapon Proficiency (pistols)",
  "Weapon Proficiency (rifles)", "Weapon Proficiency (simple weapons)",
]);

const ROLE_ABILITIES: Record<SagaNpcBuild["role"], SagaNpcAbilities> = {
  guard: { strength: 11, dexterity: 14, constitution: 12, intelligence: 10, wisdom: 11, charisma: 9 },
  thug: { strength: 14, dexterity: 12, constitution: 13, intelligence: 9, wisdom: 10, charisma: 11 },
  skilled: { strength: 9, dexterity: 12, constitution: 10, intelligence: 14, wisdom: 13, charisma: 11 },
};

const GENERAL_FEAT_TRACKS: Record<SagaNpcBuild["role"], string[]> = {
  guard: ["Point Blank Shot", "Weapon Focus (pistols)", "Precise Shot", "Quick Draw", "Toughness", "Improved Defenses", "Improved Damage Threshold"],
  thug: ["Power Attack", "Weapon Focus (simple weapons)", "Cleave", "Martial Arts I", "Toughness", "Improved Defenses", "Improved Damage Threshold"],
  skilled: ["Skill Training (Use Computer)", "Skill Focus (Use Computer)", "Point Blank Shot", "Precise Shot", "Toughness", "Improved Defenses", "Improved Damage Threshold"],
};

const STARTING_FEATS: Record<SagaNpcBuild["role"], string[]> = {
  guard: ["Armor Proficiency (light)", "Weapon Proficiency (pistols)", "Weapon Proficiency (simple weapons)"],
  thug: ["Weapon Proficiency (advanced melee weapons)", "Weapon Proficiency (pistols)", "Weapon Proficiency (simple weapons)"],
  skilled: ["Skill Training", "Weapon Proficiency (pistols)", "Weapon Proficiency (simple weapons)"],
};

function modifier(score: number) {
  return Math.floor((score - 10) / 2);
}

function generalFeatCount(level: number) {
  // Table 3-1 grants character feats at levels 1, 3, 6, 9, 12, 15 and 18.
  return 1 + Math.floor(level / 3);
}

function trainedSkills(role: SagaNpcBuild["role"], abilities: SagaNpcAbilities) {
  // Nonheroic: 1 + Intelligence modifier, minimum 1. Human adds one trained skill.
  const count = Math.max(1, 1 + modifier(abilities.intelligence)) + 1;
  const tracks: Record<SagaNpcBuild["role"], string[]> = {
    guard: ["Perception", "Initiative", "Endurance", "Persuasion"],
    thug: ["Endurance", "Initiative", "Perception", "Persuasion"],
    skilled: ["Use Computer", "Mechanics", "Knowledge (technology)", "Perception"],
  };
  return tracks[role].slice(0, count);
}

function deterministicHitPointRolls(level: number) {
  // A legal, deterministic sequence of d4 results for server-owned NPCs.
  return Array.from({ length: level }, (_, index) => index === 0 ? 4 : 3);
}

function roleAttack(role: SagaNpcBuild["role"], level: number, abilities: SagaNpcAbilities, feats: string[]) {
  const baseAttackBonus = Math.floor(level * 0.75);
  const levelDamage = Math.floor(level / 2);
  if (role === "thug") {
    return {
      name: "club", mode: "melee" as const,
      modifier: baseAttackBonus + modifier(abilities.strength) + (feats.includes("Weapon Focus (simple weapons)") ? 1 : 0),
      damage: { count: 1, sides: 6, modifier: modifier(abilities.strength) + levelDamage, type: "kinetic" },
    };
  }
  return {
    name: "blaster pistol", mode: "ranged" as const,
    modifier: baseAttackBonus + modifier(abilities.dexterity) + (feats.includes("Weapon Focus (pistols)") ? 1 : 0),
    damage: { count: 3, sides: 6, modifier: levelDamage, type: "energy" },
  };
}

export function sagaNpcBuildErrors(build: SagaNpcBuild): string[] {
  const errors: string[] = [];
  const level = build.characterLevel;
  const con = modifier(build.abilityScores.constitution);
  const improvedDefenses = build.generalFeats.includes("Improved Defenses") ? 1 : 0;
  const armorBonus = build.armor?.reflexBonus || 0;
  const expectedHp = build.hitPointRolls.reduce((sum, roll) => sum + Math.max(1, roll + con), 0)
    + (build.generalFeats.includes("Toughness") ? level : 0);
  const expectedDefenses = {
    reflex: 10 + armorBonus + modifier(build.abilityScores.dexterity) + improvedDefenses,
    fortitude: 10 + modifier(build.abilityScores.constitution) + improvedDefenses,
    will: 10 + modifier(build.abilityScores.wisdom) + improvedDefenses,
  };
  if (!Number.isInteger(level) || level < 1 || level > 20) errors.push("character level must be an integer from 1 through 20");
  if (build.heroicLevel !== 0 || build.classLevels.nonheroic !== level) errors.push("nonheroic class levels must equal character level and add no heroic levels");
  if (build.baseAttackBonus !== Math.floor(level * 0.75)) errors.push("nonheroic base attack bonus must use three-quarter progression");
  if (build.startingFeats.length !== 3 || build.startingFeats.some(feat => !NONHEROIC_STARTING_FEATS.has(feat.replace(/ \(.+\)$/, "")) && !NONHEROIC_STARTING_FEATS.has(feat))) errors.push("nonheroic level 1 must contain three legal starting feats");
  if (build.generalFeats.length !== generalFeatCount(level)) errors.push("character-level feat count does not match Table 3-1");
  if (build.talents.length || build.forcePoints !== 0 || build.destinyPoints !== 0) errors.push("a pure nonheroic build cannot gain talents, Force Points, or Destiny Points");
  if (build.hitPointRolls.length !== level || build.hitPointRolls.some(roll => !Number.isInteger(roll) || roll < 1 || roll > 4) || build.maxHitPoints !== expectedHp) errors.push("hit points must be produced by one legal d4 roll per nonheroic level");
  if (build.defenses.reflex !== expectedDefenses.reflex || build.defenses.fortitude !== expectedDefenses.fortitude || build.defenses.will !== expectedDefenses.will) errors.push("defenses must exclude nonheroic levels and use only ability, armor, feat, species, and size modifiers");
  if (build.damageThreshold !== build.defenses.fortitude + (build.generalFeats.includes("Improved Damage Threshold") ? 5 : 0)) errors.push("damage threshold must derive from Fortitude Defense");
  return errors;
}

export function assertSagaNpcBuild(build: SagaNpcBuild) {
  const errors = sagaNpcBuildErrors(build);
  if (errors.length) throw new Error(`Invalid Saga Edition NPC build: ${errors.join("; ")}`);
  return build;
}

export function buildSagaNpc(input: SagaNpcBuildInput): SagaNpcBuild {
  const level = Math.max(1, Math.min(20, Math.floor(Number(input.level) || 1)));
  const role = input.role || "guard";
  const abilityScores = { ...ROLE_ABILITIES[role] };
  const generalFeats = GENERAL_FEAT_TRACKS[role].slice(0, generalFeatCount(level));
  const startingFeats = [...STARTING_FEATS[role]];
  const speciesBonusFeat = role === "skilled" ? "Skill Focus (Mechanics)" : role === "thug" ? "Skill Focus (Endurance)" : "Skill Focus (Perception)";
  const hitPointRolls = deterministicHitPointRolls(level);
  const constitutionModifier = modifier(abilityScores.constitution);
  const toughness = generalFeats.includes("Toughness") ? level : 0;
  const maxHitPoints = hitPointRolls.reduce((sum, roll) => sum + Math.max(1, roll + constitutionModifier), 0) + toughness;
  const armor = role === "guard" ? { name: "blast helmet and vest", reflexBonus: 2 } : null;
  const improvedDefenses = generalFeats.includes("Improved Defenses") ? 1 : 0;
  const defenses = {
    reflex: 10 + (armor?.reflexBonus || 0) + modifier(abilityScores.dexterity) + improvedDefenses,
    fortitude: 10 + modifier(abilityScores.constitution) + improvedDefenses,
    will: 10 + modifier(abilityScores.wisdom) + improvedDefenses,
  };
  const trained = trainedSkills(role, abilityScores);
  const build: SagaNpcBuild = {
    ruleset: "Star Wars Saga Edition", buildVersion: 1, name: input.name, species: "Human", role,
    characterLevel: level, heroicLevel: 0, classLevels: { nonheroic: level }, abilityScores,
    trainedSkills: trained, startingFeats, generalFeats, speciesBonusFeat, talents: [], forcePoints: 0, destinyPoints: 0,
    baseAttackBonus: Math.floor(level * 0.75), hitPointRolls, maxHitPoints, defenses,
    damageThreshold: defenses.fortitude + (generalFeats.includes("Improved Damage Threshold") ? 5 : 0),
    initiativeModifier: Math.floor(level / 2) + modifier(abilityScores.dexterity) + (trained.includes("Initiative") ? 5 : 0),
    armor, attack: roleAttack(role, level, abilityScores, generalFeats),
  };
  return assertSagaNpcBuild(build);
}

export function sagaNpcRole(name: string): SagaNpcBuild["role"] {
  const value = String(name || "").toLowerCase();
  if (/thug|brawler|bruiser|enforcer|gang/.test(value)) return "thug";
  if (/slicer|technician|engineer|medic|specialist|pilot|captain|broker|clerk|merchant/.test(value)) return "skilled";
  return "guard";
}
