import { invokeNvidia } from "./original-provider";
import { positiveActionText } from "./action-intent";
import { planSagaAction } from "./saga-planner";
import type { SagaCheckPlan } from "./saga-dice";
import { forcePowerKnown } from "../original/lib/sagaForcePowers";
import { sagaSkillModifier } from "./saga-character";

type Ledger = Record<string, unknown>;
export const SAGA_ACTION_INTENTS = ["dialogue", "commerce", "travel", "search", "manipulate", "social", "medical", "force", "attack", "physical", "rest", "wait", "goal", "other"] as const;
export type SagaActionIntent = typeof SAGA_ACTION_INTENTS[number];
const SKILL_ABILITIES = {
  Acrobatics: "DEX", Climb: "STR", Deception: "CHA", Endurance: "CON", "Gather Information": "CHA", Initiative: "DEX",
  Jump: "STR", "Knowledge (bureaucracy)": "INT", "Knowledge (galactic lore)": "INT", "Knowledge (life sciences)": "INT",
  "Knowledge (physical sciences)": "INT", "Knowledge (social sciences)": "INT", "Knowledge (tactics)": "INT", "Knowledge (technology)": "INT",
  Mechanics: "INT", Perception: "WIS", Persuasion: "CHA", Pilot: "DEX", Ride: "DEX", Stealth: "DEX", Survival: "WIS",
  Swim: "STR", "Treat Injury": "WIS", "Use Computer": "INT", "Use the Force": "CHA",
} as const;
export type SagaSkill = keyof typeof SKILL_ABILITIES;
export const SAGA_SKILLS = Object.keys(SKILL_ABILITIES) as SagaSkill[];
export type SagaSemanticAction = {
  intent: SagaActionIntent; canonicalAction: string; declaredSpan: string;
  checkNeeded: boolean; skill: SagaSkill | null; rationale: string; travelTarget: string | null;
  acceptedOfferId?: string | null;
};
export type SagaActionInterpretation = { semantic: SagaSemanticAction | null; fallbackReason: string | null };

const NO_CHECK_INTENTS = new Set<SagaActionIntent>(["dialogue", "wait", "goal"]);
const isRecord = (value: unknown): value is Ledger => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, field: string, max: number) => {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`Invalid action interpretation ${field}.`);
  return value.trim();
};

/** Validate an interpretation only; this object has no state or outcome authority. */
export function validateSagaSemanticAction(value: unknown, action: string): SagaSemanticAction {
  if (!isRecord(value)) throw new Error("Invalid action interpretation.");
  const allowed = new Set(["intent", "canonicalAction", "declaredSpan", "checkNeeded", "skill", "rationale", "travelTarget", "acceptedOfferId"]);
  if (Object.keys(value).some((field) => !allowed.has(field))) throw new Error("Action interpretation cannot contain outcomes, numbers, or state changes.");
  if (!SAGA_ACTION_INTENTS.includes(value.intent as SagaActionIntent) || typeof value.checkNeeded !== "boolean") throw new Error("Invalid interpreted intent or check requirement.");
  const intent = value.intent as SagaActionIntent;
  const declaredSpan = text(value.declaredSpan, "declaredSpan", 2000);
  if (!action.includes(declaredSpan)) throw new Error("Interpreted action must cite the player's exact declaration.");
  const positiveEvidence = positiveActionText(declaredSpan);
  if (intent !== "dialogue" && intent !== "goal" && (!positiveEvidence || /^(?:i\s+)?(?:do not|don't|will not|won't|never)\b/i.test(positiveEvidence))) {
    throw new Error("A negated action cannot be executed.");
  }
  if (value.skill !== null && !SAGA_SKILLS.includes(value.skill as SagaSkill)) throw new Error("Only Saga Edition skills may be selected.");
  const canonicalAction = text(value.canonicalAction, "canonicalAction", 2000);
  const rationale = text(value.rationale, "rationale", 600);
  const travelTarget = value.travelTarget === null ? null : text(value.travelTarget, "travelTarget", 240);
  if (travelTarget && intent !== "travel") throw new Error("Only declared travel may propose a destination.");
  const checkNeeded = NO_CHECK_INTENTS.has(intent) ? false : value.checkNeeded;
  const skill = checkNeeded ? value.skill as SagaSkill | null : null;
  if (checkNeeded && intent !== "attack" && !skill) throw new Error("A consequential action needs a supported Saga skill.");
  const acceptedOfferId = value.acceptedOfferId == null ? null : text(value.acceptedOfferId, "acceptedOfferId", 160);
  if (acceptedOfferId && (intent !== "commerce" || checkNeeded)) throw new Error("Only an ordinary offer acceptance can reference a saved offer.");
  return { intent, canonicalAction, declaredSpan, checkNeeded, skill, rationale, travelTarget, ...(acceptedOfferId ? { acceptedOfferId } : {}) };
}

function interpretationContext(character: Ledger, state: Ledger) {
  return {
    character: { name: character.name, level: character.level, trainedSkills: character.trainedSkills, feats: character.feats, forcePowers: character.forcePowers, forceSensitive: character.forceSensitive },
    location: state.location, scene: state.scene, sceneMerchant: state.sceneMerchant, recentInteraction: state.recentInteraction,
    recentTurnActions: (Array.isArray(state.turnEvents) ? state.turnEvents.filter(isRecord) : []).slice(-4).map((turn) => ({ action: turn.action })),
    inventory: state.inventory, conditions: state.conditions, tradeOffers: state.tradeOffers,
    activeCombat: isRecord(state.combat) ? { status: state.combat.status, activeSide: state.combat.activeSide } : null,
  };
}

function contextualReply(action: string, state: Ledger): SagaSemanticAction | null {
  const declaration = action.trim();
  const context = `${JSON.stringify(state.scene || {})} ${JSON.stringify(state.recentInteraction || [])}`;
  const currentNpcSolicited = /\b(?:what do you need|what can i do for you|what are you looking for|waits? for (?:your|the) request|asks? what you need)\b/i.test(context);
  const terseServiceAnswer = declaration.split(/\s+/).length <= 12
    && /\b(?:travel|passage|transport|documents?|clearance|lodging|room|ship|outfit|armor|work|job|information)\b/i.test(declaration)
    && !/^(?:i|we)\s+(?:go|leave|depart|walk|run|fly|travel|head|move|sneak|board)\b/i.test(declaration);
  if (!currentNpcSolicited || !terseServiceAnswer) return null;
  return {
    intent: "dialogue",
    canonicalAction: `I tell the current contact what I need: ${declaration}`,
    declaredSpan: declaration,
    checkNeeded: false,
    skill: null,
    rationale: "This is a direct answer to the current NPC's request, not movement or completion of the requested service.",
    travelTarget: null,
  };
}

function normalizeRoutineProcedure(semantic: SagaSemanticAction, action: string): SagaSemanticAction {
  const legitimateForm = /\b(?:complete|fill(?:\s+out)?|submit|sign)\b[^.]{0,100}\b(?:application|form|paperwork)\b/i.test(action)
    && /\b(?:legitimate|truthful|accurate|personal information|required biometrics?)\b/i.test(action)
    && !/\b(?:forge|forged|false|fake|lie|deceive|alter|hack|bypass)\b/i.test(action);
  if (!legitimateForm) return semantic;
  return { ...semantic, checkNeeded: false, skill: null, rationale: "Truthfully completing an available routine form and supplying required biometrics is ordinary access; a real external obstacle may respond without inventing a skill check." };
}

const INTERPRETER_SYSTEM = `Interpret the player's natural-language action in a Star Wars Saga Edition sandbox. You are an intent translator, not a GM resolver. Recognize synonyms, slang, dialogue, object references, negation, and compound declarations without requiring a special phrase. Return exactly one JSON object with these fields: intent, canonicalAction, declaredSpan, checkNeeded, skill, rationale, travelTarget, acceptedOfferId. No markdown.
intent is one of ${SAGA_ACTION_INTENTS.join(", ")}. declaredSpan must be a verbatim substring of PLAYER DECLARATION that actually states the attempted action. canonicalAction paraphrases only that declared intent using clear first-person wording; include the actual target. Do not add a target, strategy, movement, expenditure, attack, emotion, power, or extra decision. Preserve the player's accompanying dialogue in the original declaration; do not replace it with invented words. Choose the first consequential attempted action when several require resolution.
checkNeeded is boolean. Ordinary speaking, stock/price inquiries, accepting a saved affordable merchant quote, using an unlocked interface, walking through a known accessible route, and resting safely need no check. Calling an action cautious does not itself require a roll. Threatening, bargaining for a discount, deceiving, forced access, hidden information, dangerous terrain, or an actual opponent can create uncertainty: explain the concrete uncertainty in rationale. Rejecting an NPC's suggestion or stating a desire never creates combat.
skill is null when no check is needed. Otherwise select only one of: ${SAGA_SKILLS.join(", ")}. Computer access/slicing uses Use Computer; physical repairs use Mechanics. Searching concealed details uses Perception. A specific chosen social outcome against resistance uses Persuasion or Deception, while a request for ordinary directions is dialogue. Do not require Persuasion for every spoken line. Force intuition does not grant a Force power. Only a long-term campaign aspiration is intent goal with no check or present reward. A present-tense reply to the current NPC remains dialogue even when it expresses a preference or says 'I want', 'would do', or 'ain't looking for free'. Use prior scene and previous turns to resolve that reply, not an isolated keyword. Negated actions do not occur; interpret an affirmative alternative if one exists.
acceptedOfferId is null for questions, inspection, bargaining, hypothetical or conditional consent, refusal, and offers that are not saved. When the declaration unambiguously accepts one of the open tradeOffers in the current scene, return its existing exact id and intent commerce with no check. Interpret ordinary consent such as 'charge it', 'we have a deal', and authorizing the displayed terminal; no special wording is required. Never create an id or alter a price. If several offers match, leave it null and preserve the ambiguity.
travelTarget is null except for explicitly declared travel, where it is the player's intended destination or direction, not proof of arrival. Goals and hidden destinations create opportunities, not guaranteed success. Never output dice, DCs, modifiers, results, credits, inventory changes, XP, levels, or any state patch. The server owns those values.`;

/** A failed interpreter leaves the existing deterministic referee available. */
export async function interpretSagaAction(action: string, character: Ledger, state: Ledger): Promise<SagaActionInterpretation> {
  if (!action.trim() || action.length > 2000) return { semantic: null, fallbackReason: "No valid player declaration to interpret." };
  const reply = contextualReply(action, state);
  if (reply) return { semantic: reply, fallbackReason: null };
  try {
    const response = await invokeNvidia({
      system: INTERPRETER_SYSTEM, max_tokens: 512, temperature: 0, top_p: 0.1, timeout_ms: 15_000,
      messages: [{ role: "user", content: `CURRENT SCENE CONTEXT:\n${JSON.stringify(interpretationContext(character, state)).slice(0, 10000)}\n\nPLAYER DECLARATION:\n${action}` }],
    });
    const content = response.content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    return { semantic: normalizeRoutineProcedure(validateSagaSemanticAction(JSON.parse(content), action), action), fallbackReason: null };
  } catch (error) {
    return { semantic: null, fallbackReason: error instanceof Error ? error.message.slice(0, 300) : "Action interpretation unavailable." };
  }
}

const ABILITY_NAMES: Record<string, string> = { STR: "strength", DEX: "dexterity", CON: "constitution", INT: "intelligence", WIS: "wisdom", CHA: "charisma" };
function abilityModifier(character: Ledger, code: string) {
  const scores = isRecord(character.abilityScores) ? character.abilityScores : {};
  const stored = Number(scores[ABILITY_NAMES[code]] ?? scores[code.toLowerCase()]);
  const textual = new RegExp(`\\b${code}\\s*(\\d+)`, "i").exec(String(character.sagaStats || ""));
  const score = Number.isFinite(stored) && stored >= 1 ? stored : textual ? Number(textual[1]) : 10;
  return Math.floor((score - 10) / 2);
}
function hasEstablishedAbilities(character: Ledger) {
  const scores = isRecord(character.abilityScores) ? character.abilityScores : {};
  return Object.keys(ABILITY_NAMES).every((code) => {
    const value = Number(scores[ABILITY_NAMES[code]] ?? scores[code.toLowerCase()]);
    return Number.isFinite(value) && value >= 1 || new RegExp(`\\b${code}\\s*(\\d+)`, "i").test(String(character.sagaStats || ""));
  });
}
function trained(character: Ledger, skill: string) {
  if (Array.isArray(character.trainedSkills) && character.trainedSkills.some((entry) => String(entry).toLocaleLowerCase() === skill.toLocaleLowerCase())) return true;
  const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`trained(?:\\s+in)?\\s+${escaped}`, "i").test(String(character.skills || ""));
}

/** Semantic intent gates technique lookup; mundane lifting/pulling is not Force use. */
export function declaredForcePower(action: string, semantic: SagaSemanticAction | null) {
  const isForce = semantic ? semantic.intent === "force" || semantic.skill === "Use the Force"
    : /\b(?:force|telekine\w*|mind trick|move object|battle strike|negate energy)\b/i.test(positiveActionText(action));
  return isForce ? requiredForcePower(action) : null;
}

export function requiredForcePower(action: string) {
  const declared = action.toLocaleLowerCase();
  return /\b(?:battle strike|battle-strike)\b/.test(declared) ? "battle-strike"
    : /\b(?:force[- ]?choke|force grip|choke|strangle)\b/.test(declared) ? "force grip"
    : /\b(?:force lightning|lightning)\b/.test(declared) ? "force lightning"
    : /\b(?:force slam|force wave|telekinetic slam)\b/.test(declared) ? "force slam"
    : /\b(?:force stun|stun with the force)\b/.test(declared) ? "force stun"
    : /\b(?:mind trick|dominate|control .{0,30} mind)\b/.test(declared) ? "mind trick"
    : /\b(?:force push|force thrust)\b/.test(declared) ? "force thrust"
    : /\b(?:move object|lift|levitate|telekinetically|hurl|pull)\b/.test(declared) ? "move object"
    : /\b(?:surge|burst of speed|force speed)\b/.test(declared) ? "surge"
    : /\b(?:negate energy|absorb the blaster|catch the bolt)\b/.test(declared) ? "negate-energy" : null;
}

export function hasEarnedForcePower(character: Ledger, power: string) {
  if (forcePowerKnown(character, power)) return true;
  const powers = Array.isArray(character.forcePowers) ? character.forcePowers : String(character.forcePowers || "").split(/[;,\n|]/);
  return powers.some(entry => String(entry).trim().replace(/\s*(?:[×x]\s*\d+|\(\s*\d+\s*\))$/i, "").toLocaleLowerCase() === power.toLocaleLowerCase());
}

export function forceCapabilityConstraint(semantic: SagaSemanticAction | null, character: Ledger) {
  if (!semantic || semantic.intent !== "force" && semantic.skill !== "Use the Force") return null;
  if (!trained(character, "Use the Force")) return "Trained Use the Force has not been established. Resolve the declared effort as an attempt without an overt Force effect; explain the missing training in tabletop terms and leave physical approaches or earned training opportunities available.";
  const required = requiredForcePower(semantic.canonicalAction);
  return required && !hasEarnedForcePower(character, required) ? `The ${required} power has not been earned. Resolve the declared effort without that power's effect; show the physical situation and offer relevant mundane or training approaches. Do not invent a successful technique, a roll, or a reward.` : null;
}

/** Numeric mechanics come exclusively from rules and the saved character. */
export function buildSemanticSagaCheck(semantic: SagaSemanticAction, character: Ledger, state: Ledger): SagaCheckPlan | null {
  if (!semantic.checkNeeded || NO_CHECK_INTENTS.has(semantic.intent)) return null;
  if (semantic.intent === "attack") return planSagaAction(semantic.canonicalAction, character, state);
  const skill = semantic.skill;
  if (!skill) return null;
  // Interpretation must not supply training or silently convert an attempted
  // unearned overt technique into a different successful Force effect.
  if (skill === "Use the Force" && forceCapabilityConstraint(semantic, character)) return null;
  const context = `${semantic.declaredSpan} ${String(state.location || "")} ${isRecord(state.scene) ? String(state.scene.summary || "") : ""}`;
  const security = /\b(?:reinforced|imperial|prison|detention|security|encrypted|encryption|guarded)\b/i.test(context);
  const target = ["Mechanics", "Use Computer", "Stealth"].includes(skill) && security ? 20
    : skill === "Perception" && !/\b(?:hidden|concealed|secret|threat|ambush|trap|danger|vergence|force)\b/i.test(context) ? 10 : 15;
  const level = Math.max(1, Math.min(20, Math.floor(Number(character.level) || 1)));
  return {
    needed: true, actor: "player", kind: skill === "Initiative" ? "initiative" : "skill", label: skill,
    modifier: sagaSkillModifier(character, state, skill, ({ STR: "strength", DEX: "dexterity", CON: "constitution", INT: "intelligence", WIS: "wisdom", CHA: "charisma" } as Record<string, string>)[SKILL_ABILITIES[skill]]),
    target, targetLabel: "DC", targetVisible: true, reason: semantic.rationale.slice(0, 180),
    stakes: "Success achieves only the declared rules-legal intent. Failure creates a concrete obstacle or consequence supported by this scene, preserving other available approaches.",
    provisional: !hasEstablishedAbilities(character) || ["Mechanics", "Use Computer"].includes(skill) && !trained(character, skill), damage: null,
  };
}
