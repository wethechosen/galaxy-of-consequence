import type { SagaCheckPlan } from "./saga-dice";
import { activeCombat } from "./saga-combat";
import { positiveActionText } from "./action-intent";
import { isExplicitAttackDeclaration, isObjectAttackDeclaration } from "./gpt-turn-intent";
import { sagaEquipmentAttackModifier, sagaSkillModifier } from "./saga-character";

type RecordValue = Record<string, unknown>;
const ABILITY_KEYS = { strength: "STR", dexterity: "DEX", constitution: "CON", intelligence: "INT", wisdom: "WIS", charisma: "CHA" } as const;
type Ability = keyof typeof ABILITY_KEYS;
const hasWord = (text: string, pattern: RegExp) => pattern.test(text);

function abilityModifier(character: RecordValue, ability: Ability) {
  const match = String(character.sagaStats || "").match(new RegExp(`${ABILITY_KEYS[ability]}\\s*(\\d+)`, "i"));
  return match ? Math.floor((Number(match[1]) - 10) / 2) : 0;
}

function isTrained(character: RecordValue, skill: string) {
  const trained = Array.isArray(character.trainedSkills) ? character.trainedSkills : [];
  if (trained.some((entry) => String(entry).toLowerCase() === skill.toLowerCase())) return true;
  const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`trained(?:\\s+in)?\\s+${escaped}`, "i").test(String(character.skills || ""));
}

function basePlan(character: RecordValue, state: RecordValue, label: string, ability: Ability, target: number, reason: string, stakes: string): SagaCheckPlan {
  const level = Math.max(1, Number(character.level) || 1);
  return {
    needed: true,
    actor: "player",
    kind: "skill",
    label,
    modifier: sagaSkillModifier(character, state, label, ability),
    target,
    targetLabel: "DC",
    targetVisible: true,
    reason,
    stakes,
    provisional: !character.sagaStats || /not revealed|unestablished/i.test(String(character.sagaStats)),
    damage: null,
  };
}

/** Plans only common, deterministic Saga Edition checks. The GM narrates; it never chooses the die or modifier. */
export function planSagaAction(action: string, character: RecordValue, state: RecordValue): SagaCheckPlan | null {
  const lower = positiveActionText(action).toLowerCase();
  if (!lower || /^\s*\[\[/.test(lower) || /^(?:i\s+)?(?:say|tell|ask|answer|wait|rest|sleep|read|remember|recall)\b/.test(lower)) return null;
  const skill = (label: string, ability: Ability, target: number, reason: string, stakes: string) => basePlan(character, state, label, ability, target, reason, stakes);
  if (hasWord(lower, /\binitiative\b|\bdraw first\b|\breact first\b/)) {
    const plan = skill("Initiative", "dexterity", 15, "Determine acting order when timing is contested.", "The result establishes the player's place in the encounter order.");
    plan.kind = "initiative";
    return plan;
  }
  const pursuitVerb = /\b(?:follow(?:s|ed|ing)?|trace(?:s|d|ing)?|track(?:s|ed|ing)?|pursu(?:e|es|ed|ing)|seek(?:s|ing)?|search(?:es|ed|ing)?(?:\s+for)?|locat(?:e|es|ed|ing)|find(?:s|ing)?)\b/;
  const forceLead = /\b(?:pressure|pull|call|vergence|dark[ -]side|force|sith|jedi temple|temple|shrine)\b/;
  if ((pursuitVerb.test(lower) && forceLead.test(lower)) || /\b(?:pressure|pull|call)\b[^.]{0,80}\b(?:deeper|below|beneath|source)\b/.test(lower)) {
    if (isTrained(character, "Use the Force")) {
      return skill("Use the Force", "charisma", 15, "Follow an established Force impression without assuming its source or destination.", "Success identifies one actionable direction or corroborating impression; failure reaches a concrete obstruction or misleading current without confirming the hidden destination.");
    }
    return skill("Perception", "wisdom", 15, "Follow physical disturbances and involuntary intuition while searching for a suspected Force-related site.", "Success identifies one actionable route or physical corroboration; failure reaches a concrete obstacle, false lead, or exposure without confirming the hidden destination.");
  }
  if (hasWord(lower, /\buse the force\b|\bforce push\b|\bforce pull\b|\bmove\b.*\bforce\b|\bsense\b.*\bforce\b/)) {
    if (!isTrained(character, "Use the Force")) return null;
    return skill("Use the Force", "charisma", 15, "Attempt a trained Force technique.", "Success produces only the declared, rules-legal Force effect; failure does not grant the effect.");
  }
  const digitalTransfer = /\b(?:console|terminal|computer|account)\b.*\b(?:withdraw|transfer|download|copy|extract)\b|\b(?:withdraw|transfer|download|copy|extract)\b.*\b(?:console|terminal|computer|account)\b/.test(lower);
  if (hasWord(lower, /\b(?:pick|bypass|disable|override|hotwire|repair|slice|hack)\b/) || digitalTransfer) {
    const plan = skill("Mechanics", "intelligence", /reinforced|security|imperial|prison|detention/.test(`${lower} ${String(state.location || "").toLowerCase()}`) ? 20 : 15, "Manipulate or bypass a device under pressure.", "Success changes the device as intended; failure costs time, exposes tampering, or draws attention.");
    plan.provisional = !isTrained(character, "Mechanics");
    return plan;
  }
  if (hasWord(lower, /\b(?:listen|search|spot|notice|examine|inspect|scan|watch)\b|\blook for\b/)) return skill("Perception", "wisdom", /\b(?:hidden|quiet|guard|patrol|trap|secret)\b/.test(lower) ? 15 : 10, "Notice useful details that are not automatically apparent.", "Success reveals actionable information; failure leaves the threat or detail unnoticed.");
  const cautiousMovement = /\b(?:enter|move|advance|approach|proceed|cross|go|step|climb)\b/.test(lower)
    && /\b(?:caution|cautious|cautiously|careful|carefully|quiet|quietly|undetected|unseen)\b/.test(lower);
  if (cautiousMovement) {
    const context = `${lower} ${String(state.location || "").toLowerCase()}`;
    const observedArea = /\b(?:guard|camera|droid|security|patrol|hostile|gang|black sun|prison|detention|service shaft|occupied)\b/.test(context);
    return skill("Stealth", "dexterity", observedArea ? 20 : 15, "Move cautiously through an area where observation or discovery matters.", "Success preserves concealment or avoids notice; failure reveals the movement or gives nearby opposition a clear clue.");
  }
  if (hasWord(lower, /\b(?:sneak|hide|shadow)\b|\bmove quietly\b|\bslip past\b/)) return skill("Stealth", "dexterity", /\b(?:guard|camera|droid|security|patrol)\b/.test(lower) ? 20 : 15, "Avoid observation while moving or hiding.", "Success avoids detection; failure alerts or gives the opposition a clear clue.");
  if (hasWord(lower, /\b(?:lie|deceive|bluff|mislead|disguise)\b/)) return skill("Deception", "charisma", 15, "Convince a listener of a deliberate falsehood.", "Success wins provisional belief; failure creates suspicion or closes this approach.");
  if (hasWord(lower, /\b(?:persuade|convince|negotiate|bargain|intimidate|threaten)\b/)) return skill("Persuasion", "charisma", 15, "Shift an NPC's attitude or secure cooperation.", "Success earns limited cooperation; failure hardens the NPC's position or adds a demand.");
  if (hasWord(lower, /\bclimb\b/)) return skill("Climb", "strength", 15, "Overcome a difficult climb.", "Success gains position; failure costs time or risks a fall.");
  if (hasWord(lower, /\b(?:jump|leap)\b/)) return skill("Jump", "strength", 15, "Clear an obstacle under pressure.", "Success clears it; failure leaves the character short or exposed.");
  if (hasWord(lower, /\bswim\b/)) return skill("Swim", "strength", 15, "Move through hazardous water.", "Success makes progress; failure causes fatigue or loss of position.");
  if (hasWord(lower, /\b(?:balance|tumble|acrobat)\w*\b|\bescape grip\b/)) return skill("Acrobatics", "dexterity", 15, "Use agility under pressure.", "Success gains the intended position; failure causes exposure or lost movement.");
  if (hasWord(lower, /\b(?:pilot|fly|maneuver|dock|land)\b/)) return skill("Pilot", "dexterity", 15, "Control a vehicle or starship in a consequential maneuver.", "Success completes the maneuver; failure loses position or creates a vehicle complication.");
  if (hasWord(lower, /\b(?:heal|treat|stabilize|medpac|med[- ]?pack)\b|\bfirst aid\b/)) return skill("Treat Injury", "wisdom", 15, "Provide medical treatment under the current conditions.", "Success provides the rules-appropriate treatment; failure expends time without the benefit.");
  // Keep combat verbs token-aware. A substring match turns words such as
  // "chits" into an attack because they contain "hit".
  if (isObjectAttackDeclaration(action)) {
    const ranged = /shoot|fire|blaster|rifle|pistol|bow|blast/.test(lower);
    const bab = Number.isFinite(Number(character.baseAttackBonus)) ? Number(character.baseAttackBonus) : 0;
    return {
      needed: true,
      actor: "player",
      kind: "attack",
      label: ranged ? "Ranged object attack" : "Melee object attack",
      modifier: bab + abilityModifier(character, ranged ? "dexterity" : "strength") + sagaEquipmentAttackModifier(character),
      target: 5,
      targetLabel: "Object Reflex Defense",
      targetVisible: true,
      reason: "Resolve the declared attack against an unattended, immobile object without creating a creature encounter.",
      stakes: "A hit deals rolled damage; the object's hardness, damage reduction, and hit points determine whether the obstruction is breached.",
      provisional: true,
      damage: ranged ? { count: 3, sides: 6, modifier: 0, type: "energy" } : { count: 1, sides: 4, modifier: abilityModifier(character, "strength"), type: "kinetic" },
    };
  }
  if (isExplicitAttackDeclaration(action)) {
    const ranged = /shoot|fire|blaster|rifle|pistol|bow/.test(lower);
    const bab = Number.isFinite(Number(character.baseAttackBonus)) ? Number(character.baseAttackBonus) : 0;
    const combat = activeCombat(state);
    if (!combat) {
      const plan = skill("Initiative", "dexterity", 1, "Hostilities are beginning; establish combat order before resolving any attack.", "The higher initiative total acts first; the declared attack is not resolved until the player's turn.");
      plan.kind = "initiative";
      plan.targetVisible = false;
      plan.targetLabel = "Initiative order";
      return plan;
    }
    const opponent = combat.combatants.find((entry) => entry.side === "opposition" && entry.hp > 0);
    return { needed: true, actor: "player", kind: "attack", label: ranged ? "Ranged attack" : "Melee attack", modifier: bab + abilityModifier(character, ranged ? "dexterity" : "strength") + sagaEquipmentAttackModifier(character), target: opponent?.reflex || 15, targetLabel: "Reflex Defense", targetVisible: false, reason: "Resolve one declared attack against the active target's Reflex Defense.", stakes: "Success hits and deals rolled damage; failure misses. The player retains control of any unspent actions.", provisional: !Number.isFinite(Number(character.baseAttackBonus)), damage: ranged ? { count: 3, sides: 6, modifier: 0, type: "energy" } : { count: 1, sides: 4, modifier: abilityModifier(character, "strength"), type: "kinetic" } };
  }
  const explicitStrengthTask = /^(?:i\s+)?(?:(?:try|attempt)\s+to\s+)?(?:break|lift|hold|force\s+open|shove|bend|push|pull)\b/.test(lower);
  const explicitEnduranceTask = /^(?:i\s+)?(?:(?:try|attempt)\s+to\s+)?(?:endure|resist|hold\s+my\s+breath|push\s+through\s+(?:the\s+)?(?:pain|fatigue|exhaustion))\b/.test(lower);
  if (explicitStrengthTask || explicitEnduranceTask) {
    const ability: Ability = explicitStrengthTask ? "strength" : "constitution";
    return { needed: true, actor: "player", kind: "ability", label: `${ability[0].toUpperCase()}${ability.slice(1)} check`, modifier: abilityModifier(character, ability), target: 15, targetLabel: "DC", targetVisible: true, reason: "Resolve a consequential task not covered by a specific skill.", stakes: "Success achieves the stated physical intent; failure costs time, position, or endurance.", provisional: false, damage: null };
  }
  return null;
}
