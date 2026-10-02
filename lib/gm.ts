import { createHash, randomUUID } from "node:crypto";
import type { Account } from "./accounts";
import { accountStore } from "./accounts";
import { readDatapad, saveAuthoritativeDatapad, type DatapadSnapshot } from "./datapad-save";
import { invokeNvidia, NvidiaProviderError, type NvidiaMessage } from "./original-provider";
import { rollSagaCheck } from "./saga-dice";
import { planSagaAction } from "./saga-planner";
import { applyCharacterDelta, applyEngineDelta, applyExperienceAward, parseEngineResponse } from "@/original/lib/engineState";
import { ensureCampaignScaffold } from "@/original/lib/campaignState";
import { appendDmirCreatorCanon, isDmirPrimaryCampaign } from "./dmir-authority";
import { activeCombat, beginCombat, endPlayerTurn, isAttackDeclaration, isCombatMovementDeclaration, isEndTurnDeclaration, resolvePlayerAttack, spendPlayerMove, type CombatResolution } from "./saga-combat";

type TurnInput = { accountId?: string; revision: number; action: string; turnId: string; openScene?: boolean; statePolicy?: "committed-trade" | null };
type Message = { role: "user" | "assistant" | "roll"; content: string; [key: string]: unknown };

function deterministicTurnRoller(turnId: string, lane: string) {
  let index = 0;
  return (min: number, max: number) => {
    const bytes = createHash("sha256").update(`${turnId}:${lane}:${index++}`).digest();
    return min + (bytes.readUInt32BE(0) % Math.max(1, max - min));
  };
}

export const GM_SYSTEM = `You are the Game Master of Galaxy of Consequence, a persistent player-driven Star Wars Saga Edition campaign in 155 ABY. The player controls only their character. You control NPCs, scenes, factions, consequences, and continuity.

Act as the single director over four private specialist roles before writing the final response:
- SAGA REFEREE: interprets only Saga Edition mechanics and accepts the authoritative server roll. It never invents a roll, modifier, defense, damage result, feat, talent, or Force power.
- WORLD DIRECTOR: determines environmental and faction reactions from established location, time, resources, access, news, and campaign flags. It never creates an unearned fact or changes state directly.
- NPC DIRECTOR: gives each present NPC a response based on that NPC's established knowledge, goals, disposition, capability, and immediate risk. NPCs know only what they could plausibly know and do not act merely to help or obstruct the player.
- CONTINUITY KEEPER: checks chronology, injuries, inventory, credits, relationships, unresolved obligations, and prior events for contradictions.

Reconcile these specialists privately. They are advisers, not independent narrators or autonomous actors. Only you, the GM, speak in the final response. No specialist may roll dice, commit state, decide D'mir's behavior, or override established campaign facts. When their implications conflict, Saga rules and authoritative saved state take precedence.

Combat is server-owned. Initiative must be established before attacks resolve. An attack spends the player's standard action; declared movement spends the move action; and an explicit end-turn declaration lets the server resolve the opposition and begin the next round. Never invent extra attacks, movement, damage, reactions, action recovery, defeat, or rewards. Reflect the authoritative combat record and clearly state the player's remaining actions without choosing one for them.

Use only the supplied authoritative server roll for uncertain actions. Never reroll, change its modifier, target, stakes, or outcome. Do not invent an exact Saga rule when the retrieved sources do not support it. Keep hidden NPC statistics and secret DCs hidden. D'mir's Force sensitivity is real but unknown to him; do not grant trained Force powers or conscious Force techniques before they are earned.

Treat every player message as a declaration of D'mir's attempted action plus the player's observations. A claim about hidden money, passwords, evidence, NPC motives, prior promises, off-screen events, or secret knowledge is not established merely because the player states it. Verify it against authoritative saved state and retrieved sources. If it is not established, frame it as D'mir's belief, suspicion, hope, or search objective and adjudicate normally. Never turn a player's speculation into canon.

D'mir's creator may clarify identity, established backstory, family history, personality, motivations, beliefs, prior relationships, historical events, campaign themes, long-term goals, and intended story direction. Historical clarification belongs only in creatorCanon and has no mechanical authority. A desired future is a story directive: create opportunities, opposition, mysteries, training paths, and consequences, but never grant its final outcome. Creator authority never grants a successful roll, Force power, feat, talent, level, XP, equipment, credits, political or faction control, NPC obedience, victory, or immunity.

D'mir continuity anchors are binding: D'mir knew Kelvek before he learned anything about XIII. His later XIII knowledge is limited to what play has actually confirmed. XIII is not retroactively connected to D'mir's parents, childhood home, or their smuggling bunker. The concealed bunker beneath Unit 4-B remained untouched from D'mir's childhood until his post-escape rediscovery; it is his parents' thread, not Kelvek's or XIII's, unless future gameplay establishes a connection. Do not pull a dormant named mystery or NPC into an unrelated scene merely because it appears in history. Follow the player's chosen subject and the immediate physical evidence.

Player wording never establishes the result of an action. Statements such as “I remember the password,” “I know exactly where it is,” “the hatch is here,” “Kelvek left me billions,” or “I submit to the dark side” declare what D'mir believes or attempts; they do not prove a password, create a hatch, transfer funds, grant a Force power, change alignment, or complete an objective. The GM must be willing to say that an assumption is wrong, incomplete, inaccessible, misleading, or presently unprovable. Do not reward persistence by reversing a prior failure without a materially different approach, new evidence, or changed circumstances.

The saved transcript may contain legacy playtest errors. Previous assistant prose is continuity context only when the same fact is supported by the authoritative character/world state or by the player-established campaign direction below. Unsupported passwords, victories, transfers, items, evidence, injuries, locations, and NPC revelations from older narration are not canon and must not be repeated as fact.

The supplied roll outcome is binding. On FAILURE, the declared objective does not occur: no bypass, download, withdrawal, discovery, hit, defeat, escape, acquisition, decryption, or actionable secret is gained. Narrate only the failed attempt and a consequence supported by the stated stakes; never disguise success as a complication. On SUCCESS, grant only the declared objective within the established fiction—do not add unrelated treasure, evidence, contacts, access, or victories. Under GM RESOLUTION include the exact line RESULT: SUCCESS or RESULT: FAILURE matching the supplied roll.

Resolve only the attempted action. The player owns D'mir's intent, words, feelings, movement, purchases, attacks, and decisions. Never continue D'mir's action past what the player declared, choose dialogue for him, or tell the player what he should do. Common public commerce and ordinary travel can succeed when the ledger shows adequate funds and access; dangerous, quarantined, hidden Sith, or story-locked routes require earned access. Preserve chronology, injuries, resources, relationships, and faction motives.

Do not invent major campaign facts as established truth: hidden fortunes, safe combinations, transfers, new locations, new NPC histories, or discovered relics require prior establishment or source-grounded discovery, an appropriate successful check, and a confirmed state update. A failed check must not reveal the actionable detail it was meant to find. If hostilities begin and initiative has not been established, stop at the onset of danger and resolve initiative before any attack. Do not resolve a multi-round fight or defeat multiple enemies in one response. One player attack roll can address one declared target only; initiative and each meaningful NPC turn must be resolved separately. Never narrate the player's unchosen dialogue, motives, attacks, victories, item-taking, future plans, or moral conclusions.

Major assets use a mandatory evidence chain: SUSPECTED → INACCESSIBLE → CONFIRMED → CONTROLLED → LIQUID TRANSFER. Advance at most one step in a turn and only after a successful, relevant action. A successful search can reveal evidence; it cannot also authenticate ownership, defeat security, seize control, and transfer funds. Funds exceeding 100,000 credits cannot enter the spendable ledger unless the same asset was already CONTROLLED before the turn. Repeated attempts do not lower security or become automatic successes.

Keep prose concrete and immediate, but make the SCENE a real narrated story beat rather than a status report. Show what D'mir can perceive moment by moment: spatial relationships, light, sound, heat, machinery, clothing, weapons, architecture, movement, and NPC behavior that are already plausible in the established location. Let the declared action visibly meet the world before presenting mechanics. Avoid destiny speeches, grand declarations about what D'mir has become, cinematic time jumps, or summaries of actions he did not declare. Never replace narration with a bare list of stats.

Address D'mir directly as “you” in second-person present tense. Never call him “the player,” describe him in detached third person, expose system or validation language, or use engine-facing phrases in the narration. Every visible sentence must read as part of the immediate Star Wars scene or as a concise entry on D'mir's own datapad.

PLAYER-ESTABLISHED CAMPAIGN DIRECTION: Kelvek left D'mir a concealed contingency and inheritance. Its first recoverable layers are worth hundreds of millions of credits; the wider network of assets, claims, and leverage can ultimately reach billions. D'mir does not begin with those funds as liquid personal credits. Access must be discovered, authenticated, secured, and survived through play. The opening arc concerns D'mir escaping prison, then eventually finding a way off Coruscant; never choose his escape method or decisions for him.

Keep the dossier synchronized. Every confirmed item gained, consumed, sold, stolen, surrendered, or destroyed must have the matching inventoryAdd or inventoryRemove entry exactly once. Every confirmed payment, reward, loss, or recovered liquid credit amount must have the matching credits change exactly once. Never describe an acquisition or payment that is absent from the ledger. Use decisionAdd for major player-declared decisions and irreversible choices; use note only for a confirmed campaign flag. Do not create either for routine movement or conversation.

Use structured dossier updates when confirmed: conditionAdd/conditionRemove and conditionTrack for injuries and Saga condition movement; objectiveAdd/objectiveComplete for current and completed goals; discoveryAdd only for information actually learned; milestoneAdd for major story progress; relationshipUpdate for established NPC relationship changes; legacyAssetUpsert for suspected, inaccessible, confirmed, or controlled Kelvek assets. A controlled legacy asset is still not liquid credits unless a separate validated credits transfer occurs. For an established D'mir story direction, use storyDirectiveAdd with the same title and status completed only after gameplay actually fulfills it; completion is eligible for normal server-calculated XP and leveling. Track Force Points, Destiny Points, and Dark Side Score only when a Saga rule or explicit campaign award/spend supports the relative change. Never choose a feat, talent, class, ability increase, Force power, or other advancement option for the player.

Track Saga progression through experienceAward. Award XP only for a completed, consequential encounter or objective with a supportable Saga challenge value—not for questions, shopping, routine travel, passive observation, repeated attempts, or mere narration. Use 0 when no award is justified. Never set level or total experience directly; the server derives level from accumulated XP.

The server, not you, determines the final XP amount. Your job is to record the confirmed reason for advancement with objectiveComplete, milestoneAdd, decisionAdd, or a concrete consequence of a successful check. Never omit a confirmed inventory, credit, injury, condition, location, objective, relationship, discovery, or milestone change from the single STATE block. Structured fields are arrays even when there is only one entry.

Write in a focused Star Wars holodrama voice informed by the retrieved sourcebook grounding. Saga Edition supplies the physical/tactical grammar; Legacy Era material supplies layered institutions and historical residue; Force and Destiny may supply subtle Force atmosphere without granting powers; Corporate Era material may supply bureaucracy, logistics, private security, and industrial texture where relevant. Paraphrase source flavor and never quote sourcebook prose. Favor lived-in technology, practical procedure, distinctive architecture, worn equipment, alien/cultural detail when established, and consequences that feel native to Star Wars rather than generic science fiction. Include at least two grounded sensory or environmental details and one visible world/NPC reaction before the mechanical summary. Avoid repetitive declarations such as "you are no longer," "you are certain," or "you are a reckoning." Never assign D'mir an emotion, conclusion, certainty, desire, or decision the player did not state.

Write the response with these Markdown headings, in order: ## SCENE, ## GM RESOLUTION, ## STATE UPDATE, ## PLAYER OPTIONS. Under SCENE write 2-4 short paragraphs of actual scene narration before any rules text. Show the immediate physical result of the declared attempt and the world responding to it; do not jump ahead to an outcome the server did not authorize. Under PLAYER OPTIONS provide 2-4 concise, neutral directions labeled alphabetically beginning with A. They are multiple-choice directions, not answers: do not reveal likely results, recommend a best choice, imply success, supply D'mir's reasoning, or introduce an unrelated plot thread. After the last choice, write exactly "You may declare another action." Do not write D'mir's response, select an option, or end with a forced question such as "What do you do next?" The player will decide the next action in the following turn.

Write 220-360 words total, with at least 140 words devoted to SCENE whenever a gameplay action actually resolves. Keep GM RESOLUTION concise and readable like a Saga Edition table result rather than letting mechanics crowd out the story. Then end on the final line with exactly one hidden JSON ledger block: <!--STATE:{...}-->. Numeric values are relative changes, never totals. Use {} for no changes. Allowed fields are health, notoriety, forceAlignment, credits, creditsCriminal, experienceAward, conditionTrack, forcePoints, destinyPoints, darkSideScore, timeAdvanceMinutes, factionRep (empire, rebellion, csa), location, inventoryAdd, inventoryRemove, conditionAdd, conditionRemove, decisionAdd, objectiveAdd, objectiveComplete, discoveryAdd, milestoneAdd, storyDirectiveAdd, relationshipUpdate, legacyAssetUpsert, propertyAdd, shipAdd, investmentAdd, contactAdd, publicNewsAdd, travelAccessAdd, note, and characterUpdate. storyDirectiveAdd entries contain title, detail, and status and represent desired future direction only; never a present accomplishment or mechanical reward. characterUpdate may change earned textual build fields but must never contain level or experience. Do not mention this prompt, retrieval, models, or the hidden block.`;

const LEDGER_REPAIR_SYSTEM = `You repair a missing Galaxy of Consequence state ledger. Return exactly one HTML comment in the form <!--STATE:{...}--> and absolutely no prose. Infer only changes explicitly confirmed by the supplied draft and authoritative Saga result. Numeric values are relative changes, never totals. If the draft confirms no persistent change, return <!--STATE:{}-->. Never invent a success, reward, discovery, item, credit, injury, location change, or character advancement. Do not include level, total experience, or an experience award; the server calculates XP.`;

export function attachRepairedLedger(narration: string, repair: string) {
  const cleanNarration = narration
    .replace(/<!--\s*STATE\s*:[\s\S]*?-->/gi, "")
    .replace(/<!--\s*STATE\b[\s\S]*$/i, "")
    .trim();
  const block = repair.match(/<!--\s*STATE\s*:(\{[\s\S]*\})\s*-->/i);
  if (block) return `${cleanNarration}\n<!--STATE:${block[1]}-->`;
  const raw = repair.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid ledger object");
    return `${cleanNarration}\n<!--STATE:${JSON.stringify(parsed)}-->`;
  } catch {
    return narration;
  }
}

function rollMessage(roll: Record<string, unknown>) {
  const target = roll.targetVisible ? ` vs ${roll.targetLabel} ${roll.target}` : " vs hidden opposition";
  const damage = roll.damage && typeof roll.damage === "object" ? ` · DAMAGE ${(roll.damage as Record<string, unknown>).formula} = ${(roll.damage as Record<string, unknown>).total}` : "";
  const actor = String(roll.actor || "player").toUpperCase();
  return `${actor} ${String(roll.kind).toUpperCase()} — ${roll.label}\n${roll.formula}: ${roll.raw} ${Number(roll.modifier) >= 0 ? "+" : "−"} ${Math.abs(Number(roll.modifier))} = ${roll.total}${target} — ${String(roll.outcome).toUpperCase()}${damage}\nStakes: ${roll.stakes}`;
}

function publicContext(snapshot: DatapadSnapshot) {
  const state = snapshot.gameState;
  return JSON.stringify({ character: snapshot.character, world: {
    location: state.location, health: state.health, conditionTrack: state.conditionTrack, conditions: state.conditions,
    forcePoints: state.forcePoints, destinyPoints: state.destinyPoints, darkSideScore: state.darkSideScore,
    campaignTimeMinutes: state.campaignTimeMinutes,
    credits: state.credits, creditsCriminal: state.creditsCriminal, notoriety: state.notoriety,
    forceAlignment: state.forceAlignment, factionRep: state.factionRep, inventory: state.inventory,
    contacts: state.contacts, decisions: state.decisions, relationships: state.relationships, objectives: state.objectives,
    discoveries: state.discoveries, milestones: state.milestones, legacyAssets: state.legacyAssets,
    storyDirectives: state.storyDirectives,
    creatorCanon: state.creatorCanon, campaignExceptions: state.campaignExceptions,
    flags: Array.isArray(state.flags) ? state.flags.slice(-12) : [], travelAccess: state.travelAccess,
    levelUpAvailable: state.levelUpAvailable, combat: state.combat,
  }, preferences: snapshot.settings });
}

export function sanitizeGmNarration(value: string) {
  return String(value || "")
    .replace(/^\[(?:PRIOR NARRATION|PRIOR PLAYER DECLARATION):[^\]]*\]\s*/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type LocalFallbackInput = {
  mode: "ooc" | "context" | "play";
  action: string;
  location: string;
  roll: Record<string, unknown> | null;
  combatSummary?: string | null;
};

/**
 * Credit-free, deterministic last-resort narration. It deliberately cannot
 * invent discoveries, rewards, inventory, credits, NPC decisions, or scene
 * facts. Server-owned rolls and combat still resolve and are saved normally.
 */
export function buildLocalSafeFallback({ mode, action, location, roll, combatSummary }: LocalFallbackInput) {
  if (mode === "ooc") {
    return {
      content: `DATAPAD STATUS\nYour campaign record remains secure at ${location || "the current location"}. No time passes and no game state changes.`,
      provider: "local-safe-fallback" as const,
      model: "deterministic-saga-referee",
      finishReason: "stop",
    };
  }
  if (mode === "context") {
    return {
      content: "CAMPAIGN RECORD\nYour clarification has been attached to D'mir's creator-controlled history. It grants no automatic success, reward, or mechanical benefit.",
      provider: "local-safe-fallback" as const,
      model: "deterministic-saga-referee",
      finishReason: "stop",
    };
  }

  const place = location || "your present location";
  const lowerAction = action.toLowerCase();
  const coruscantTexture = /coruscant|1313|unit 4-b|sublevel|bunker|corridor/i.test(place)
    ? "The lower levels press in as layers of old city infrastructure: durasteel seams, sealed service panels, recycled air, and a low mechanical vibration carried through the floor from systems far larger than this room. Light catches on scuffed surfaces instead of anything clean or ceremonial; the place feels maintained only enough to keep functioning."
    : "The immediate space is defined by practical Star Wars machinery: used surfaces, access points, hard cover, and the constant background noise of systems doing their work. Nothing in the environment waits politely for the next move; distance, doors, equipment, and line of sight still matter.";
  const declaredBeat = !action
    ? "The established scene holds at the exact point the record left it, with no new choice made for you."
    : /fire|shoot|blaster|attack/i.test(lowerAction)
      ? "You commit to the attack you declared. The weapon report and the confined geometry make the exchange immediate: heat, hard surfaces, and sightlines matter more than spectacle, and the server-owned combat record decides what actually lands."
      : /search|examine|inspect|look/i.test(lowerAction)
        ? "You work the area exactly as declared, reading surfaces, access points, and the small physical inconsistencies that can matter in a place built out of old systems and newer repairs. The check decides whether that effort produces anything actionable."
        : "You carry out only the action you declared. The surrounding machinery, access, and physical space answer that attempt without granting any extra movement, discovery, or decision beyond it.";
  let resolution = "No Saga check is required. The declaration is recorded without granting an uncertain result or unverified fact.";
  let stateUpdate = "No persistent change is confirmed.";
  if (roll) {
    const modifier = Number(roll.modifier) || 0;
    const target = roll.targetVisible ? ` vs ${String(roll.targetLabel || "DC")} ${Number(roll.target)}` : " vs hidden opposition";
    const damage = roll.damage && typeof roll.damage === "object" ? ` Damage: ${String((roll.damage as Record<string, unknown>).formula || "rolled damage")} = ${Number((roll.damage as Record<string, unknown>).total) || 0}.` : "";
    const succeeded = roll.outcome === "success";
    resolution = `${String(roll.label || "Saga check")}: ${String(roll.formula || "1d20")} = ${Number(roll.raw)} ${modifier >= 0 ? "+" : "−"} ${Math.abs(modifier)} = ${Number(roll.total)}${target}.\nRESULT: ${succeeded ? "SUCCESS" : "FAILURE"}\n${succeeded ? "The declared objective succeeds only within its stated scope." : "The declared objective does not occur."}${damage}`;
    stateUpdate = combatSummary || (succeeded ? "The resolved check is recorded; no additional material change is inferred." : "The failed attempt is recorded; no reward, discovery, movement, or acquisition is granted.");
  } else if (combatSummary) {
    resolution = combatSummary;
    stateUpdate = "The server-owned combat record is updated.";
  }

  const outcomeBeat = roll
    ? roll.outcome === "success"
      ? "The attempt clears the authoritative threshold. Only the declared objective is allowed to take hold; no extra clue, movement, damage, access, or reward is added beyond what the resolved state supports."
      : "The attempt meets resistance and stops short of its objective. The scene remains materially where the failed check leaves it; nothing hidden becomes known simply because the attempt was made."
    : combatSummary
      ? "The combat record changes only by the server-owned update below, and the scene stops before another unchosen attack or reaction can occur."
      : "No uncertain outcome is manufactured. The moment remains open, with the environment and established state unchanged until you declare something else.";

  return {
    content: `## SCENE\n${place}. ${coruscantTexture}\n\n${declaredBeat} ${outcomeBeat}\n\n## GM RESOLUTION\n${resolution}\n\n## STATE UPDATE\n${stateUpdate}\n\n## PLAYER OPTIONS\nA. Examine the immediate surroundings.\nB. Continue with a specific declared action.\nC. Withdraw or wait while observing the situation.\nYou may declare another action.\n<!--STATE:{}-->`,
    provider: "local-safe-fallback" as const,
    model: "deterministic-saga-referee",
    finishReason: "stop",
  };
}

function safeMessages(snapshot: DatapadSnapshot): NvidiaMessage[] {
  return (snapshot.messages as Message[])
    .filter((message) => message && ["user", "assistant"].includes(message.role) && typeof message.content === "string" && !message.error)
    .slice(-24)
    .map(({ role, content }) => ({
      role: role as "user" | "assistant",
      content: sanitizeGmNarration(content).slice(0, 10000),
    }));
}

export function authorityWarnings(action: string) {
  const lower = action.toLowerCase();
  const warnings: string[] = [];
  if (/\b(?:millions?|billions?|fortune|inheritance|stash|cache|ghost ledger|all available credits?)\b/.test(lower)) warnings.push("hidden wealth or ownership");
  if (/\b(?:i (?:remember|know)|he (?:told|promised|left|showed)|always talked|exactly where|password|code|backdoor|escape hatch)\b/.test(lower)) warnings.push("unstored memory, credential, or prior promise");
  if (/\b(?:there (?:is|are|was|were)|i see|i find|i discover)\b/.test(lower)) warnings.push("player-asserted scene or discovery");
  if (/\b(?:master(?:ed|y)? the force|submit to the dark side|become a sith|learned? force|force choke)\b/.test(lower)) warnings.push("unearned Force or alignment outcome");
  if (/\b(?:the|my|our)\s+bacta\s+tank\b/.test(lower)) warnings.push("player-asserted scene or discovery");
  return [...new Set(warnings)];
}

export function classifyTurnMode(action: string): "ooc" | "context" | "play" {
  const clean = action.trim();
  const lower = clean.toLocaleLowerCase();
  const contextMarkers = ["born ", "my father", "my mother", "since i was", "my background", "i was mentored"].filter((marker) => lower.includes(marker));
  const explicitCanon = /^(?:canon|backstory|character context|history clarification)\s*:/i.test(clean);
  const conciseHistory = /^(?:d['’]?mir(?:'s)?|my)\s+(?:mother|father|family|childhood|birthplace|background|history|personality|beliefs?|prior relationship)\b/i.test(clean);
  const actionOpening = /^i\s+(?:go|run|move|attack|punch|shoot|sneak|search|examine|open|take|use)\b/i.test(clean);
  const characterContext = explicitCanon || conciseHistory || (clean.length > 240 && contextMarkers.length >= 2 && !actionOpening);
  const gmQuestion = /^(?:gm|game master)\b/i.test(clean) || /^(?:how many|how much|what (?:is|are) my|show (?:me )?my)\b/i.test(clean);
  return /^\[\[[\s\S]*\]\]$/.test(clean) || gmQuestion ? "ooc" : characterContext ? "context" : "play";
}

export function constrainFailedCheckDelta(delta: Record<string, unknown> | null, roll: Record<string, unknown> | null) {
  if (!delta || !roll || roll.outcome !== "failure") return delta;
  // A failed search, social attempt, or attack cannot award discoveries,
  // inventory, travel, assets, contacts, or character progression. Preserve
  // only explicit costs/condition changes that the narration may justify.
  const safe: Record<string, unknown> = {};
  for (const field of ["health", "notoriety", "forceAlignment", "factionRep", "note"]) {
    if (Object.prototype.hasOwnProperty.call(delta, field)) safe[field] = delta[field];
  }
  for (const field of ["credits", "creditsCriminal"]) {
    if (typeof delta[field] === "number" && delta[field] <= 0) safe[field] = delta[field];
  }
  return safe;
}

export function constrainExperienceAward(delta: Record<string, unknown> | null, roll: Record<string, unknown> | null) {
  if (!delta || !Object.prototype.hasOwnProperty.call(delta, "experienceAward")) return delta;
  const completedObjective = Array.isArray(delta.objectiveComplete) && delta.objectiveComplete.length > 0;
  const milestone = Array.isArray(delta.milestoneAdd) && delta.milestoneAdd.length > 0;
  const earnedDiscovery = roll?.outcome === "success" && Array.isArray(delta.discoveryAdd) && delta.discoveryAdd.length > 0;
  // XP must be attached to a server-resolved successful outcome. A model-only
  // milestone or objective assertion is not authority to advance a character.
  if (roll?.outcome === "success" && (completedObjective || milestone || earnedDiscovery)) return delta;
  const safe = { ...delta };
  delete safe.experienceAward;
  return safe;
}

const normalizedKey = (value: unknown) => String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
const structuredConsequenceFields = [
  "inventoryAdd", "inventoryRemove", "conditionAdd", "conditionRemove", "decisionAdd", "objectiveAdd",
  "objectiveComplete", "discoveryAdd", "milestoneAdd", "relationshipUpdate", "legacyAssetUpsert",
  "propertyAdd", "shipAdd", "investmentAdd", "contactAdd", "publicNewsAdd", "travelAccessAdd",
];

export function assertStoryDirectiveAuthority(
  delta: Record<string, unknown> | null,
  actor: Account,
  character: Record<string, unknown>,
) {
  if (!delta || !Array.isArray(delta.storyDirectiveAdd) || delta.storyDirectiveAdd.length === 0) return;
  const isDmirCreatorCampaign = actor.username.toLocaleLowerCase() === "dmir@galaxy.local"
    && /^d['’]mir holloran$/i.test(String(character.name || "").trim());
  if (!isDmirCreatorCampaign) {
    throw new GmTurnError("Creator story direction is available only in D'mir's own campaign. No outcome was saved; retry the turn.", 403);
  }
}

/**
 * Converts confirmed turn outcomes into a conservative, deterministic story award.
 * The model can tag the outcome, but only the server chooses the XP total.
 */
export function deriveExperienceAward(
  delta: Record<string, unknown> | null,
  roll: Record<string, unknown> | null,
  state: Record<string, unknown>,
  character: Record<string, unknown>,
) {
  if (!delta) return 0;
  const level = Math.max(1, Math.min(20, Math.floor(Number(character.level) || 1)));
  const existingMilestones = new Set((Array.isArray(state.milestones) ? state.milestones : []).map((entry) => normalizedKey((entry as Record<string, unknown>)?.title)));
  const existingDecisions = new Set((Array.isArray(state.decisions) ? state.decisions : []).map((entry) => normalizedKey((entry as Record<string, unknown>)?.title)));
  const objectives = Array.isArray(state.objectives) ? state.objectives as Array<Record<string, unknown>> : [];
  const completed = new Set((Array.isArray(delta.objectiveComplete) ? delta.objectiveComplete : []).map(normalizedKey));
  const completesActiveObjective = objectives.some((objective) => completed.has(normalizedKey(objective.title)) && normalizedKey(objective.status) !== "completed");
  const addsMilestone = (Array.isArray(delta.milestoneAdd) ? delta.milestoneAdd as Array<Record<string, unknown>> : [])
    .some((entry) => !existingMilestones.has(normalizedKey(entry.title)));
  const existingDirectives = Array.isArray(state.storyDirectives) ? state.storyDirectives as Array<Record<string, unknown>> : [];
  const completesStoryDirective = (Array.isArray(delta.storyDirectiveAdd) ? delta.storyDirectiveAdd as Array<Record<string, unknown>> : [])
    .some((entry) => normalizedKey(entry.status) === "completed" && existingDirectives.some((directive) =>
      normalizedKey(directive.title) === normalizedKey(entry.title) && normalizedKey(directive.status || "active") !== "completed"));
  if (completesActiveObjective || addsMilestone || completesStoryDirective) return Math.min(5000, 200 * level);

  const addsDecision = (Array.isArray(delta.decisionAdd) ? delta.decisionAdd as Array<Record<string, unknown>> : [])
    .some((entry) => !existingDecisions.has(normalizedKey(entry.title)));
  if (addsDecision) return Math.min(5000, 100 * level);

  const hasConsequence = structuredConsequenceFields.some((field) => Array.isArray(delta[field]) && (delta[field] as unknown[]).length > 0)
    || ["health", "conditionTrack", "forcePoints", "destinyPoints", "darkSideScore", "notoriety", "forceAlignment", "credits", "creditsCriminal", "location", "timeAdvanceMinutes"]
      .some((field) => Object.prototype.hasOwnProperty.call(delta, field) && delta[field] !== 0 && delta[field] !== "");
  if (roll?.outcome === "success" && hasConsequence) {
    const target = Number(roll.target) || 10;
    return Math.min(5000, (target >= 20 ? 200 : target >= 15 ? 100 : 50) * level);
  }
  return 0;
}

export function appendTurnEvent(
  state: Record<string, unknown>,
  turnId: string,
  action: string,
  roll: Record<string, unknown> | null,
  delta: Record<string, unknown>,
  experienceAward: number,
  now = new Date().toISOString(),
) {
  const prior = Array.isArray(state.turnEvents) ? state.turnEvents as Array<Record<string, unknown>> : [];
  if (prior.some((event) => event.turnId === turnId)) return state;
  const changes = Object.fromEntries(Object.entries(delta).filter(([key, value]) => key !== "experienceAward" && key !== "characterUpdate" && value !== 0 && value !== "" && !(Array.isArray(value) && value.length === 0)));
  return { ...state, turnEvents: [...prior, {
    turnId, action: action || "Open scene", resolvedAt: now,
    roll: roll ? { id: roll.id, kind: roll.kind, label: roll.label, outcome: roll.outcome, total: roll.total } : null,
    experienceAward, changes,
  }].slice(-500) };
}

export function applyFinalizedTurn(
  snapshot: DatapadSnapshot,
  turnId: string,
  action: string,
  roll: Record<string, unknown> | null,
  delta: Record<string, unknown>,
) {
  const current = ensureCampaignScaffold(snapshot) as DatapadSnapshot;
  const priorEvents = Array.isArray(current.gameState.turnEvents) ? current.gameState.turnEvents as Array<Record<string, unknown>> : [];
  // A retry/reload with the same identifier returns the already-finalized state;
  // it cannot duplicate XP, credits, inventory, or dossier entries.
  if (priorEvents.some((event) => event.turnId === turnId)) return current;
  let state = applyEngineDelta(current.gameState, delta, randomUUID);
  if (roll) state.rolls = [...(Array.isArray(current.gameState.rolls) ? current.gameState.rolls : []), roll].slice(-100);
  state = appendTurnEvent(state, turnId, action, roll, delta, Number(delta.experienceAward || 0));
  const rawCharacterUpdate = delta.characterUpdate && typeof delta.characterUpdate === "object" ? { ...(delta.characterUpdate as Record<string, unknown>) } : undefined;
  if (rawCharacterUpdate) {
    delete rawCharacterUpdate.level;
    delete rawCharacterUpdate.experience;
  }
  const updatedCharacter = applyCharacterDelta(current.character, rawCharacterUpdate);
  const character = applyExperienceAward(updatedCharacter, delta.experienceAward ?? 0);
  if (Number(character?.level || 1) > Number(current.character?.level || 1)) {
    state.levelUpAvailable = true;
    state.flags = [...(Array.isArray(state.flags) ? state.flags : []), { note: `Level ${character?.level} reached. Player advancement choices are pending.`, ts: Date.now() }];
  }
  return { ...current, character, gameState: state } as DatapadSnapshot;
}

function turnStore() {
  const db = accountStore();
  db.exec(`CREATE TABLE IF NOT EXISTS gm_turn_attempts (
    account_id TEXT NOT NULL, turn_id TEXT NOT NULL, base_revision INTEGER NOT NULL,
    action TEXT NOT NULL, roll TEXT, status TEXT NOT NULL CHECK(status IN ('pending','complete')),
    result TEXT, created_at TEXT NOT NULL, PRIMARY KEY(account_id, turn_id));`);
  return db;
}

export class GmTurnError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

/** Removes UI retry wording before it reaches the authoritative action planner. */
export function normalizeTurnAction(value: string) {
  return String(value || "")
    .replace(/^\s*(?:continue with a specific declared action\.?\s*)+/i, "")
    .trim();
}

export function assertMechanicalNarration(narration: string, roll: Record<string, unknown> | null) {
  if (!roll) return;
  const outcome = String(roll.outcome).toUpperCase();
  const expected = `RESULT: ${outcome}`;
  const opposite = `RESULT: ${outcome === "SUCCESS" ? "FAILURE" : "SUCCESS"}`;
  if (!narration.includes(expected) || narration.includes(opposite)) {
    throw new GmTurnError("The GM response did not preserve the authoritative Saga result. No outcome was saved; retry the turn.", 502);
  }
  if (roll.outcome === "failure" && /\b(?:access granted|authorization confirmed|transaction complete|transfer (?:complete[sd]?|succeed(?:s|ed)?)|credits? (?:were|are|is) (?:credited|transferred|withdrawn)|door (?:opens?|unlocks?)|lock (?:opens?|unlocks?)|archive (?:opens?|decrypts?)|files? (?:download(?:ed|s)?|copied)|you (?:escape[sd]?|defeat(?:ed)?|kill(?:ed)?|obtain(?:ed)?|acquire[sd]?|withdr(?:aw|ew|awn)|download(?:ed)?|decrypt(?:ed)?|bypass(?:ed)?))\b/i.test(narration)) {
    throw new GmTurnError("The GM narrated the failed objective as achieved. No outcome was saved; retry the turn.", 502);
  }
}

/** The server roll is authoritative; repair only a mislabeled result line. */
export function alignMechanicalResult(narration: string, roll: Record<string, unknown> | null) {
  if (!roll) return narration;
  const expected = `RESULT: ${String(roll.outcome).toUpperCase()}`;
  if (/RESULT\s*:\s*(?:SUCCESS|FAILURE)/i.test(narration)) {
    return narration.replace(/RESULT\s*:\s*(?:SUCCESS|FAILURE)/gi, expected);
  }
  return narration.replace(/^(GM RESOLUTION\s*)$/im, `$1\n${expected}`);
}

const ASSET_RANK: Record<string, number> = { suspected: 0, inaccessible: 1, confirmed: 2, controlled: 3 };

export function assertMaterialAuthority(delta: Record<string, unknown> | null, action: string, roll: Record<string, unknown> | null, state: Record<string, unknown>) {
  if (!delta) return;
  const succeeded = roll?.outcome === "success";
  const materialArrays = ["inventoryAdd", "inventoryRemove", "propertyAdd", "shipAdd", "investmentAdd"];
  const changesMoney = Number(delta.credits || 0) !== 0 || Number(delta.creditsCriminal || 0) !== 0;
  const changesMaterial = materialArrays.some((field) => Array.isArray(delta[field]) && (delta[field] as unknown[]).length > 0);
  if ((changesMoney || changesMaterial) && !succeeded) {
    throw new GmTurnError("The GM attempted to change money or possessions without a validated successful outcome. No outcome was saved; retry the turn.", 502);
  }
  const existingAssets = Array.isArray(state.legacyAssets) ? state.legacyAssets as Array<Record<string, unknown>> : [];
  const hasControlledAsset = existingAssets.some((asset) => String(asset.status).toLowerCase() === "controlled");
  const creditGain = Number(delta.credits || 0) + Number(delta.creditsCriminal || 0);
  if (creditGain > 100_000 && !hasControlledAsset) {
    throw new GmTurnError("The GM attempted to liquidate a major asset before control was established. No outcome was saved; retry the turn.", 502);
  }
  for (const proposed of Array.isArray(delta.legacyAssetUpsert) ? delta.legacyAssetUpsert as Array<Record<string, unknown>> : []) {
    const name = String(proposed.name || "").trim().toLowerCase();
    const previous = existingAssets.find((asset) => String(asset.name || "").trim().toLowerCase() === name);
    const priorRank = previous ? ASSET_RANK[String(previous.status || "suspected").toLowerCase()] ?? 0 : -1;
    const nextRank = ASSET_RANK[String(proposed.status || "suspected").toLowerCase()] ?? priorRank;
    if (!succeeded || nextRank < priorRank || nextRank > priorRank + 1) {
      throw new GmTurnError("The GM advanced a legacy asset without the required successful evidence step. No outcome was saved; retry the turn.", 502);
    }
  }
  const claims = authorityWarnings(action);
  const createsClaimedFact = ["discoveryAdd", "milestoneAdd", "relationshipUpdate", "legacyAssetUpsert"]
    .some((field) => Array.isArray(delta[field]) && (delta[field] as unknown[]).length > 0);
  if (claims.length && createsClaimedFact && !succeeded) {
    throw new GmTurnError("The GM accepted an unverified player claim as a discovery. No outcome was saved; retry the turn.", 502);
  }
}

export function assertNarrativeLedgerConsistency(narration: string, delta: Record<string, unknown> | null) {
  const claimsLiquidTransfer = /\b(?:transaction complete|transfer (?:complete[sd]?|succeed(?:s|ed)?)|credited to (?:your|d['’]?holloran)|personal credits? (?:jump|rose|increase)|you (?:now have|receive[sd]?|withdraw|withdrew))\b/i.test(narration);
  const creditGain = Number(delta?.credits || 0) + Number(delta?.creditsCriminal || 0);
  if (claimsLiquidTransfer && creditGain <= 0) {
    throw new GmTurnError("The GM narrated a credit transfer that was not authorized by the ledger. No outcome was saved; retry the turn.", 502);
  }
  const claimsItemGain = /\b(?:added to (?:your|the) inventory|you (?:take possession of|acquire|obtain)|handed to you)\b/i.test(narration);
  if (claimsItemGain && !(Array.isArray(delta?.inventoryAdd) && delta.inventoryAdd.length > 0)) {
    throw new GmTurnError("The GM narrated an item acquisition that was not authorized by the ledger. No outcome was saved; retry the turn.", 502);
  }
}

export function assertCampaignResponseStructure(narration: string) {
  const headings = ["SCENE", "GM RESOLUTION", "STATE UPDATE", "PLAYER OPTIONS"];
  let cursor = -1;
  for (const heading of headings) {
    const match = new RegExp(`^(?:#{1,6}\\s*)?${heading}\\s*$`, "im").exec(narration);
    if (!match || match.index <= cursor) {
      throw new GmTurnError(`The GM response omitted or reordered the ${heading} section. No outcome was saved; retry the turn.`, 502);
    }
    cursor = match.index;
  }
  const optionsStart = narration.search(/^(?:#{1,6}\s*)?PLAYER OPTIONS\s*$/im);
  const options = narration.slice(optionsStart).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const choices = options.filter((line) => /^[A-D]\.\s+/.test(line));
  if (choices.length < 2 || choices.length > 4 || choices.some((line, index) => !line.startsWith(`${String.fromCharCode(65 + index)}.`))) {
    throw new GmTurnError("The GM response did not provide 2–4 alphabetical player directions. No outcome was saved; retry the turn.", 502);
  }
  if (!options.includes("You may declare another action.") || /what do you do(?: next)?\??/i.test(narration)) {
    throw new GmTurnError("The GM response tried to choose or solicit the player's action outside the neutral option contract. No outcome was saved; retry the turn.", 502);
  }
}

/** Option lettering is presentation, not game authority. */
export function normalizePlayerOptions(narration: string) {
  const heading = /^(?:#{1,6}\s*)?PLAYER OPTIONS\s*$/im.exec(narration);
  if (!heading) return narration;
  const before = narration.slice(0, heading.index).trimEnd();
  const body = narration.slice(heading.index + heading[0].length);
  const directions = body.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^you may declare (?:any )?(?:other|another) action\.?$/i.test(line) && !/^what do you do(?: next)?\??$/i.test(line))
    .map((line) => line.replace(/^[-*•]\s+/, "").replace(/^\*{0,2}[A-D][.)]\*{0,2}\s*/i, "").trim())
    .filter(Boolean);
  if (directions.length < 2) return narration;
  const choices = directions.slice(0, 4).map((line, index) => `${String.fromCharCode(65 + index)}. ${line}`);
  return `${before}\nPLAYER OPTIONS\n${choices.join("\n")}\nYou may declare another action.`;
}

/**
 * NVIDIA occasionally returns a valid scene and resolution but forgets the
 * presentation-only choice block. Add neutral directions without changing
 * the narrated outcome or authoritative ledger.
 */
export function ensurePlayerOptions(narration: string) {
  if (/^(?:#{1,6}\s*)?PLAYER OPTIONS\s*$/im.test(narration)) return narration;
  return `${narration.trim()}\n\nPLAYER OPTIONS\nA. Examine the immediate surroundings.\nB. Continue with a specific declared action.\nC. Withdraw or wait while observing the situation.\nYou may declare another action.`;
}

export function assertNarrativeFocus(narration: string, action: string) {
  const invokesXiii = /\bxiii\b/i.test(action);
  if (!invokesXiii && /\bxiii\b/i.test(narration)) {
    throw new GmTurnError("The GM pulled XIII into a scene the player did not pursue. No outcome was saved; retry the turn.", 502);
  }
  const parentsBunker = /\b(?:parents?|mother|father|family)\b[\s\S]{0,80}\b(?:bunker|hideout|cache|home|apartment)\b|\b(?:bunker|hideout)\b[\s\S]{0,80}\b(?:parents?|mother|father|family)\b/i.test(action);
  if (parentsBunker && !/\bkelvek\b/i.test(action) && /\bkelvek\b/i.test(narration)) {
    throw new GmTurnError("The GM attached Kelvek to D'mir's parents' thread without player direction or evidence. No outcome was saved; retry the turn.", 502);
  }
  if (/\byou (?:are (?:certain|unafraid|afraid|ready)|decide|want|do not care|don't care)\b/i.test(narration)) {
    throw new GmTurnError("The GM assigned D'mir an unchosen emotion, conclusion, or decision. No outcome was saved; retry the turn.", 502);
  }
}

function hasTrainedForceUse(character: Record<string, unknown>) {
  const skills = Array.isArray(character.trainedSkills) ? character.trainedSkills.map(String).join(" ") : String(character.skills || "");
  return /\buse the force\b/i.test(skills) || /\bforce training\b/i.test(String(character.feats || ""));
}

export function assertNarrativeAuthority(narration: string, claims: string[], roll: Record<string, unknown> | null, character: Record<string, unknown>) {
  const succeeded = roll?.outcome === "success";
  if (!succeeded && claims.includes("hidden wealth or ownership")
    && /\b(?:you (?:find|discover|locate|confirm)|records? (?:show|confirm)|account (?:contains|holds)|cache (?:contains|holds)|Kelvek (?:left|hid|stashed))\b[^.]{0,180}\b(?:millions?|billions?|credits?)\b/i.test(narration)) {
    throw new GmTurnError("The GM confirmed hidden wealth without a successful authoritative resolution. No outcome was saved; retry the turn.", 502);
  }
  if (!succeeded && claims.includes("unstored memory, credential, or prior promise")
    && /\b(?:password|access code|backdoor|escape hatch)\b[^.]{0,120}\b(?:works?|opens?|unlocks?|is correct|is confirmed|reveals?)\b/i.test(narration)) {
    throw new GmTurnError("The GM confirmed an unstored secret or credential without a successful authoritative resolution. No outcome was saved; retry the turn.", 502);
  }
  if (!hasTrainedForceUse(character)
    && /\byou\s+(?:force[- ]?choke|telekinetically\s+(?:lift|hurl|push|pull)|(?:lift|hurl|push|pull)\s+[^.]{0,80}\s+with the force)|\bthe force\s+(?:obeys|answers your command|surges through you at will)\b/i.test(narration)) {
    throw new GmTurnError("The GM granted an overt Force technique that the character has not earned. No outcome was saved; retry the turn.", 502);
  }
}

export async function runGmTurn(actor: Account, input: TurnInput) {
  const accountId = input.accountId || actor.id;
  const saved = readDatapad(actor, accountId);
  if (!saved.snapshot?.character) throw new GmTurnError("Create or load a character before opening a scene.", 409);
  const currentSnapshot = ensureCampaignScaffold(saved.snapshot) as DatapadSnapshot;
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(input.turnId)) throw new GmTurnError("A valid turn identifier is required.");
  const action = normalizeTurnAction(input.action);
  if ((!action && !input.openScene) || action.length > 2000) throw new GmTurnError("Provide an action between 1 and 2,000 characters.");

  const db = turnStore();
  db.prepare("DELETE FROM gm_turn_attempts WHERE created_at < ?").run(new Date(Date.now() - 7 * 86400000).toISOString());
  const existing = db.prepare("SELECT * FROM gm_turn_attempts WHERE account_id = ? AND turn_id = ?").get(accountId, input.turnId) as { base_revision: number; action: string; roll: string | null; status: string; result: string | null } | undefined;
  if (existing && existing.action !== action) throw new GmTurnError("This turn identifier was already used for a different action.", 409);
  if (existing?.status === "complete" && existing.result) return JSON.parse(existing.result);
  if (!Number.isSafeInteger(input.revision) || input.revision !== saved.revision) throw new GmTurnError("The campaign changed in another window. Reload the saved game before continuing.", 409);
  if (existing && existing.base_revision !== input.revision) throw new GmTurnError("The campaign changed after this turn began. Submit the action again as a new turn or reload the saved game.", 409);

  const mode = classifyTurnMode(action);
  const plan = mode === "play" && action ? planSagaAction(action, currentSnapshot.character as Record<string, unknown>, currentSnapshot.gameState) : null;
  const roll = existing?.roll ? JSON.parse(existing.roll) : plan ? rollSagaCheck(plan) : null;
  const encounter = activeCombat(currentSnapshot.gameState as Record<string, unknown>);
  let combatResolution: CombatResolution | null = null;
  if (mode === "play" && !encounter && isAttackDeclaration(action) && roll?.kind === "initiative") {
    combatResolution = beginCombat(action, currentSnapshot.character as Record<string, unknown>, currentSnapshot.gameState, roll, deterministicTurnRoller(input.turnId, "combat-open"));
  } else if (mode === "play" && encounter && isAttackDeclaration(action) && roll?.kind === "attack") {
    combatResolution = resolvePlayerAttack(encounter, roll);
  } else if (mode === "play" && encounter && isEndTurnDeclaration(action)) {
    combatResolution = endPlayerTurn(encounter, currentSnapshot.character as Record<string, unknown>, Number(currentSnapshot.gameState.health || 0), deterministicTurnRoller(input.turnId, "npc-turn"));
  } else if (mode === "play" && encounter && isCombatMovementDeclaration(action)) {
    combatResolution = spendPlayerMove(encounter, action);
  }
  if (!existing) db.prepare("INSERT INTO gm_turn_attempts VALUES (?, ?, ?, ?, ?, 'pending', NULL, ?)").run(accountId, input.turnId, input.revision, action, roll ? JSON.stringify(roll) : null, new Date().toISOString());

  const history = safeMessages(currentSnapshot);
  const userMessage = action || "Open the established starting scene. Do not choose an action for my character.";
  const claims = authorityWarnings(action);
  const authorityInstruction = claims.length ? `\n\nPLAYER AUTHORITY WARNING: This declaration contains unverified ${claims.join(", ")}. Treat those clauses only as D'mir's belief or intended approach. They are not facts and cannot become true without support from current authoritative state plus a relevant successful resolution.` : "";
  const creatorInstruction = actor.username.toLocaleLowerCase() === "dmir@galaxy.local" && /^d['’]mir holloran$/i.test(String((currentSnapshot.character as Record<string, unknown>).name || "").trim())
    ? `\n\nD'MIR CREATOR DIRECTION: This is D'mir's creator-controlled player campaign. Respect explicit long-term themes, goals, and desired arcs by creating plausible Star Wars opportunities rather than blocking them. Record a new explicit long-term direction with storyDirectiveAdd. Creating a direction is not an accomplished fact and grants no immediate XP, level, credits, item, feat, talent, Force power, training, victory, or automatic success. Once gameplay actually fulfills an established direction, update that same title to status completed and record the concrete outcome; the server will award XP and derive leveling normally.`
    : "";
  const rollInstruction = roll ? `\n\nAUTHORITATIVE SAGA RESULT:\n${JSON.stringify(roll)}\nInclude concise public arithmetic and the exact line RESULT: ${String(roll.outcome).toUpperCase()} under GM RESOLUTION. ${roll.outcome === "failure" ? "The attempted objective fails. Do not narrate the intended access, information, damage, victory, item, funds, or movement as achieved." : "Grant only the declared objective; do not expand the success beyond its stated scope."} ${roll.targetVisible ? "Show the DC or defense." : "Do not reveal the hidden target number or NPC statistics."}` : "";
  const combatInstruction = combatResolution ? `\n\nAUTHORITATIVE COMBAT UPDATE:\n${JSON.stringify({ summary: combatResolution.summary, combat: combatResolution.combat, additionalRolls: combatResolution.rolls, playerHealthDelta: combatResolution.playerHealthDelta, playerConditionDelta: combatResolution.playerConditionDelta, experienceAward: combatResolution.experienceAward })}\nThis update is server-owned. Narrate it exactly without inventing another attack, damage roll, movement, action, victory, or reward. An opening attack declaration starts initiative only; it does not also resolve the attack. Reflect remaining player actions and stop for the player's next declaration.` : "";
  const system = mode === "ooc" ? `You are the campaign Game Master. Answer the player's out-of-character rules or character-status question concisely from authoritative saved state. Distinguish confirmed state from rumors or prior narrative claims. Do not advance time, narrate a new scene, change state, or output a STATE block.\n\nCURRENT CAMPAIGN STATE:\n${publicContext(currentSnapshot)}`
    : mode === "context" ? `The player supplied character background/context, not an in-world action. Acknowledge it briefly, do not roll, do not advance the scene, and do not invent additions. Do not output a STATE block.\n\nCURRENT CAMPAIGN STATE:\n${publicContext(currentSnapshot)}`
    : `${GM_SYSTEM}${rollInstruction}${combatInstruction}${authorityInstruction}${creatorInstruction}\n\nCURRENT AUTHORITATIVE CAMPAIGN STATE:\n${publicContext(currentSnapshot)}`;
  let response: Awaited<ReturnType<typeof invokeNvidia>> | null = null;
  let parsed: ReturnType<typeof parseEngineResponse> | null = null;
  let delta: Record<string, unknown> | null = null;
  let validationError: unknown = null;
  let fallbackReason: "provider" | "validation" | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const correction = attempt && validationError instanceof Error
      ? { role: "user" as const, content: `[SERVER VALIDATION REJECTED THE PRIOR DRAFT: ${validationError.message}] Rewrite the same turn. Preserve the supplied roll exactly, use only authoritative state, follow all four required sections, and output one valid STATE block. Do not add a new action or reroll.` }
      : null;
    try {
      response = await invokeNvidia({
        system,
        sourceQuery: action || String(currentSnapshot.gameState.location || "opening scene"),
        max_tokens: mode === "ooc" ? 512 : 1536,
        messages: [...history, { role: "user", content: userMessage }, ...(correction ? [correction] : [])],
      });
    } catch (error) {
      if (!(error instanceof NvidiaProviderError)) throw error;
      fallbackReason = "provider";
      console.warn("[api/gm] AI provider unavailable; continuing with deterministic fallback", { status: error.status, message: error.message });
      response = buildLocalSafeFallback({
        mode,
        action,
        location: String(currentSnapshot.gameState.location || ""),
        roll,
        combatSummary: combatResolution?.summary || null,
      });
    }
    try {
      let candidate = response.content;
      try {
        parsed = parseEngineResponse(candidate, { requireState: mode === "play" });
      } catch (error) {
        const repairableLedger = mode === "play" && error instanceof Error && /(?:world-state ledger|world-state field|world-state JSON|world-state block)/i.test(error.message);
        if (!repairableLedger) throw error;
        const repair = await invokeNvidia({
          system: `${LEDGER_REPAIR_SYSTEM}\n\nAUTHORITATIVE CAMPAIGN STATE:\n${publicContext(currentSnapshot)}\n\nAUTHORITATIVE SAGA RESULT:\n${JSON.stringify(roll || null)}`,
          sourceQuery: action || String(currentSnapshot.gameState.location || "opening scene"),
          max_tokens: 512,
          temperature: 0.1,
          top_p: 0.2,
          messages: [{ role: "user", content: `PLAYER ACTION:\n${userMessage}\n\nGM DRAFT WITH MISSING LEDGER:\n${candidate}` }],
        });
        candidate = attachRepairedLedger(candidate, repair.content);
        parsed = parseEngineResponse(candidate, { requireState: true });
      }
      parsed = { ...parsed, clean: alignMechanicalResult(sanitizeGmNarration(parsed.clean), roll) };
      if (mode === "play") parsed = { ...parsed, clean: ensurePlayerOptions(normalizePlayerOptions(parsed.clean)) };
      if (mode === "play") assertCampaignResponseStructure(parsed.clean);
      if (mode === "play") assertNarrativeFocus(parsed.clean, action);
      assertMechanicalNarration(parsed.clean, roll);
      delta = constrainFailedCheckDelta(parsed.delta as Record<string, unknown> | null, roll);
      delta = constrainExperienceAward(delta, roll);
      if (input.statePolicy === "committed-trade" && delta) {
        delta = { ...delta, credits: 0, creditsCriminal: 0, inventoryAdd: [], inventoryRemove: [] };
      }
      assertMaterialAuthority(delta, action, roll, currentSnapshot.gameState as Record<string, unknown>);
      assertStoryDirectiveAuthority(delta, actor, currentSnapshot.character as Record<string, unknown>);
      assertNarrativeLedgerConsistency(parsed.clean, delta);
      assertNarrativeAuthority(parsed.clean, claims, roll, currentSnapshot.character as Record<string, unknown>);
      if (mode === "play") {
        const experienceAward = deriveExperienceAward(delta, roll, currentSnapshot.gameState as Record<string, unknown>, currentSnapshot.character as Record<string, unknown>);
        delta = {
          ...(delta || {}),
          health: Number(delta?.health || 0) + Number(combatResolution?.playerHealthDelta || 0),
          conditionTrack: Number(delta?.conditionTrack || 0) + Number(combatResolution?.playerConditionDelta || 0),
          experienceAward: Math.max(experienceAward, Number(combatResolution?.experienceAward || 0)),
        };
      }
      validationError = null;
      break;
    } catch (error) {
      validationError = error;
      parsed = null;
      delta = null;
    }
  }
  if (validationError) {
    fallbackReason = "validation";
    console.warn("[api/gm] AI draft rejected twice; continuing with deterministic fallback", { message: validationError instanceof Error ? validationError.message : String(validationError) });
    response = buildLocalSafeFallback({
      mode,
      action,
      location: String(currentSnapshot.gameState.location || ""),
      roll,
      combatSummary: combatResolution?.summary || null,
    });
    parsed = parseEngineResponse(response.content, { requireState: mode === "play" });
    parsed = { ...parsed, clean: alignMechanicalResult(sanitizeGmNarration(parsed.clean), roll) };
    if (mode === "play") {
      parsed = { ...parsed, clean: ensurePlayerOptions(normalizePlayerOptions(parsed.clean)) };
      assertCampaignResponseStructure(parsed.clean);
      assertNarrativeFocus(parsed.clean, action);
    }
    assertMechanicalNarration(parsed.clean, roll);
    delta = constrainFailedCheckDelta(parsed.delta as Record<string, unknown> | null, roll);
    delta = constrainExperienceAward(delta, roll);
    if (input.statePolicy === "committed-trade" && delta) delta = { ...delta, credits: 0, creditsCriminal: 0, inventoryAdd: [], inventoryRemove: [] };
    assertMaterialAuthority(delta, action, roll, currentSnapshot.gameState as Record<string, unknown>);
    assertStoryDirectiveAuthority(delta, actor, currentSnapshot.character as Record<string, unknown>);
    assertNarrativeLedgerConsistency(parsed.clean, delta);
    assertNarrativeAuthority(parsed.clean, claims, roll, currentSnapshot.character as Record<string, unknown>);
    if (mode === "play") {
      const experienceAward = deriveExperienceAward(delta, roll, currentSnapshot.gameState as Record<string, unknown>, currentSnapshot.character as Record<string, unknown>);
      delta = {
        ...(delta || {}),
        health: Number(delta?.health || 0) + Number(combatResolution?.playerHealthDelta || 0),
        conditionTrack: Number(delta?.conditionTrack || 0) + Number(combatResolution?.playerConditionDelta || 0),
        experienceAward: Math.max(experienceAward, Number(combatResolution?.experienceAward || 0)),
      };
    }
  }
  if (!response || !parsed) throw new GmTurnError("The GM could not produce a valid authoritative response. No outcome was saved; retry the turn.", 502);
  let finalized = mode === "play"
    ? applyFinalizedTurn(currentSnapshot, input.turnId, action, roll, delta || {})
    : mode === "context" && isDmirPrimaryCampaign(actor, currentSnapshot.character as Record<string, unknown>)
      ? { ...currentSnapshot, gameState: appendDmirCreatorCanon(currentSnapshot.gameState, action, actor, currentSnapshot.character as Record<string, unknown>) }
      : currentSnapshot;
  if (mode === "play" && combatResolution) {
    finalized = { ...finalized, gameState: { ...finalized.gameState, combat: combatResolution.combat } };
    if (combatResolution.rolls.length) {
      finalized.gameState.rolls = [...(Array.isArray(finalized.gameState.rolls) ? finalized.gameState.rolls : []), ...combatResolution.rolls].slice(-100);
    }
  }
  const messages: Message[] = [...(currentSnapshot.messages as Message[])];
  if (action) messages.push({ role: "user", content: action });
  if (roll) messages.push({ role: "roll", content: rollMessage(roll), roll });
  for (const combatRoll of combatResolution?.rolls || []) messages.push({ role: "roll", content: rollMessage(combatRoll), roll: combatRoll });
  messages.push({ role: "assistant", content: parsed.clean, turnId: input.turnId });
  const snapshot: DatapadSnapshot = { ...finalized, messages };
  const persisted = saveAuthoritativeDatapad(actor, accountId, input.revision, snapshot);
  const result = { snapshot, revision: persisted.revision, updatedAt: persisted.updatedAt, roll, narration: parsed.clean, provider: response.provider, model: response.model, fallbackReason };
  db.prepare("UPDATE gm_turn_attempts SET status = 'complete', result = ? WHERE account_id = ? AND turn_id = ?").run(JSON.stringify(result), accountId, input.turnId);
  return result;
}
