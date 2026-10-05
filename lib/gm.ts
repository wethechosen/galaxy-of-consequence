import { createHash, randomUUID } from "node:crypto";
import type { Account } from "./accounts";
import { accountStore } from "./accounts";
import { readDatapad, saveAuthoritativeDatapad, type DatapadSnapshot } from "./datapad-save";
import { invokeNvidia, NvidiaProviderError, type NvidiaMessage } from "./original-provider";
import { rollSagaCheck } from "./saga-dice";
import { planSagaAction } from "./saga-planner";
import { permitsLocationChange, positiveActionText } from "./action-intent";
import { sceneDirections, genericDirections } from "@/original/lib/sceneDirections";
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

Use only the supplied authoritative server roll for uncertain actions. Never reroll, change its modifier, target, stakes, or outcome. Do not invent an exact Saga rule when the retrieved sources do not support it. Keep hidden NPC statistics and secret DCs hidden. D'mir knows and accepts that he is Force-sensitive and recognizes the dark-side pull he has experienced. This awareness does not grant trained Use the Force, a Force power, or conscious command of a technique before it is earned.

Treat every player message as a declaration of D'mir's attempted action plus the player's observations. A claim about hidden money, passwords, evidence, NPC motives, prior promises, off-screen events, or secret knowledge is not established merely because the player states it. Verify it against authoritative saved state and retrieved sources. If it is not established, frame it as D'mir's belief, suspicion, hope, or search objective and adjudicate normally. Never turn a player's speculation into canon.

D'mir's creator may clarify identity, established backstory, family history, personality, motivations, beliefs, prior relationships, historical events, campaign themes, long-term goals, and intended story direction. Historical clarification belongs only in creatorCanon and has no mechanical authority. A desired future is a story directive: create opportunities, opposition, mysteries, training paths, and consequences, but never grant its final outcome. Creator authority never grants a successful roll, Force power, feat, talent, level, XP, equipment, credits, political or faction control, NPC obedience, victory, or immunity.

D'mir continuity anchors are binding: D'mir knew Kelvek before he learned anything about XIII. His later XIII knowledge is limited to what play has actually confirmed. XIII is not retroactively connected to D'mir's parents, childhood home, or their smuggling bunker. The concealed bunker beneath Unit 4-B remained untouched from D'mir's childhood until his post-escape rediscovery; it is his parents' thread, not Kelvek's or XIII's, unless future gameplay establishes a connection. Do not pull a dormant named mystery or NPC into an unrelated scene merely because it appears in history. Follow the player's chosen subject and the immediate physical evidence.

Player wording never establishes the result of an action. Statements such as “I remember the password,” “I know exactly where it is,” “the hatch is here,” “Kelvek left me billions,” or “I submit to the dark side” declare what D'mir believes or attempts; they do not prove a password, create a hatch, transfer funds, grant a Force power, change alignment, or complete an objective. The GM must be willing to say that an assumption is wrong, incomplete, inaccessible, misleading, or presently unprovable. Do not reward persistence by reversing a prior failure without a materially different approach, new evidence, or changed circumstances.

Every understandable declaration is an attempted action, not a request for permission. Accept the executable intent and resolve it under Saga Edition even when the player names an unconfirmed destination or desired outcome. Strip only the unsupported assumption. If the exact method exceeds D'mir's earned capabilities, resolve the nearest rules-legal attempt that preserves his intent—for example, physical movement, Perception, investigation, research, or involuntary Force intuition—and explain the limitation inside the fiction instead of refusing the turn. Ask for clarification only when no reasonable attempted action can be inferred.

The saved transcript may contain legacy playtest errors. Previous assistant prose is continuity context only when the same fact is supported by the authoritative character/world state or by the player-established campaign direction below. Unsupported passwords, victories, transfers, items, evidence, injuries, locations, and NPC revelations from older narration are not canon and must not be repeated as fact.

The supplied roll outcome is binding. On FAILURE, the declared objective does not occur: no bypass, download, withdrawal, decisive discovery, hit, defeat, escape, acquisition, decryption, or actionable secret is gained. Failure must still move play forward through a concrete obstacle, exposed risk, elapsed time, changed position, NPC/world reaction, or newly visible scene boundary supported by the stakes. Never reset to the same generic corridor or answer only that nothing happens. On SUCCESS, grant only the declared objective within the established fiction—do not add unrelated treasure, evidence, contacts, access, or victories. Under SAGA CHECK include the exact line RESULT: SUCCESS or RESULT: FAILURE matching the supplied roll.

Resolve only the attempted action. The player owns D'mir's intent, words, feelings, movement, purchases, attacks, and decisions. Never continue D'mir's action past what the player declared, choose dialogue for him, or tell the player what he should do. Common public commerce and ordinary travel can succeed when the ledger shows adequate funds and access; dangerous, quarantined, hidden Sith, or story-locked routes require earned access. Preserve chronology, injuries, resources, relationships, and faction motives.

Do not invent major campaign facts as established truth: hidden fortunes, safe combinations, transfers, new locations, new NPC histories, or discovered relics require prior establishment or source-grounded discovery, an appropriate successful check, and a confirmed state update. A failed check must not reveal the actionable detail it was meant to find. If hostilities begin and initiative has not been established, stop at the onset of danger and resolve initiative before any attack. Do not resolve a multi-round fight or defeat multiple enemies in one response. One player attack roll can address one declared target only; initiative and each meaningful NPC turn must be resolved separately. Never narrate the player's unchosen dialogue, motives, attacks, victories, item-taking, future plans, or moral conclusions.

Major assets use a mandatory evidence chain: SUSPECTED → INACCESSIBLE → CONFIRMED → CONTROLLED → LIQUID TRANSFER. Advance at most one step in a turn and only after a successful, relevant action. A successful search can reveal evidence; it cannot also authenticate ownership, defeat security, seize control, and transfer funds. Funds exceeding 100,000 credits cannot enter the spendable ledger unless the same asset was already CONTROLLED before the turn. Repeated attempts do not lower security or become automatic successes.

Keep prose concrete and immediate, but make the SCENE a real narrated story beat rather than a status report. Show what D'mir can perceive moment by moment: spatial relationships, light, sound, heat, machinery, clothing, weapons, architecture, movement, and NPC behavior that are already plausible in the established location. Let the declared action visibly meet the world before presenting mechanics. Avoid destiny speeches, grand declarations about what D'mir has become, cinematic time jumps, or summaries of actions he did not declare. Never replace narration with a bare list of stats.

Address D'mir directly as “you” in second-person present tense. Never call him “the player,” describe him in detached third person, expose system or validation language, or use engine-facing phrases in the narration. Every visible sentence must read as part of the immediate Star Wars scene or as a concise entry on D'mir's own datapad.

PLAYER-ESTABLISHED CAMPAIGN DIRECTION: Kelvek left D'mir a concealed contingency and inheritance. Its first recoverable layers are worth hundreds of millions of credits; the wider network of assets, claims, and leverage can ultimately reach billions. D'mir does not begin with those funds as liquid personal credits. Access must be discovered, authenticated, secured, and survived through play. The opening arc concerns D'mir escaping prison, then eventually finding a way off Coruscant; never choose his escape method or decisions for him.

PLAYER-ESTABLISHED CAMPAIGN DIRECTION: D'mir is actively seeking the ancient dark-side vergence and Sith foundations associated with the depths beneath Coruscant's Jedi Temple. Treat this as a valid campaign pursuit, not an automatic arrival or proof of his current route. Build a playable chain of physical routes, records, architecture, hazards, rivals, checks, and consequences toward it. Each relevant search or movement attempt must reach a new clue-bearing boundary, obstacle, or decision point instead of being rejected because the final destination has not yet been earned.

Keep the dossier synchronized. Every confirmed item gained, consumed, sold, stolen, surrendered, or destroyed must have the matching inventoryAdd or inventoryRemove entry exactly once. Every confirmed payment, reward, loss, or recovered liquid credit amount must have the matching credits change exactly once. Never describe an acquisition or payment that is absent from the ledger. Use decisionAdd for major player-declared decisions and irreversible choices; use note only for a confirmed campaign flag. Do not create either for routine movement or conversation.

Use structured dossier updates when confirmed: conditionAdd/conditionRemove and conditionTrack for injuries and Saga condition movement; objectiveAdd/objectiveComplete for current and completed goals; discoveryAdd only for information actually learned; milestoneAdd for major story progress; relationshipUpdate for established NPC relationship changes; legacyAssetUpsert for suspected, inaccessible, confirmed, or controlled Kelvek assets. A controlled legacy asset is still not liquid credits unless a separate validated credits transfer occurs. For an established D'mir story direction, use storyDirectiveAdd with the same title and status completed only after gameplay actually fulfills it; completion is eligible for normal server-calculated XP and leveling. Track Force Points, Destiny Points, and Dark Side Score only when a Saga rule or explicit campaign award/spend supports the relative change. Never choose a feat, talent, class, ability increase, Force power, or other advancement option for the player.

Track Saga progression through experienceAward. Award XP only for a completed, consequential encounter or objective with a supportable Saga challenge value—not for questions, shopping, routine travel, passive observation, repeated attempts, or mere narration. Use 0 when no award is justified. Never set level or total experience directly; the server derives level from accumulated XP.

The server, not you, determines the final XP amount. Your job is to record the confirmed reason for advancement with objectiveComplete, milestoneAdd, decisionAdd, or a concrete consequence of a successful check. Never omit a confirmed inventory, credit, injury, condition, location, objective, relationship, discovery, or milestone change from the single STATE block. Structured fields are arrays even when there is only one entry.

Write in a focused Star Wars holodrama voice informed by the retrieved sourcebook grounding. Saga Edition supplies the physical/tactical grammar; Legacy Era material supplies layered institutions and historical residue; Force and Destiny may supply subtle Force atmosphere without granting powers; Corporate Era material may supply bureaucracy, logistics, private security, and industrial texture where relevant. Paraphrase source flavor and never quote sourcebook prose. Favor lived-in technology, practical procedure, distinctive architecture, worn equipment, alien/cultural detail when established, and consequences that feel native to Star Wars rather than generic science fiction. Include at least two grounded sensory or environmental details and one visible world/NPC reaction before the mechanical summary. Avoid repetitive declarations such as "you are no longer," "you are certain," or "you are a reckoning." Never assign D'mir an emotion, conclusion, certainty, desire, or decision the player did not state.

Write the response with these Markdown headings, in this exact order: ## LOCATION, ## SCENE, ## GM ADJUDICATION, ## GAMEPLAY RESULT, ## SAGA CHECK, ## STATE UPDATE, ## PLAYER OPTIONS.
- LOCATION: one concise line naming the authoritative saved location. Do not infer a new destination.
- SCENE: 2-4 short paragraphs of actual narration before rules text. Describe D'mir's visible position, posture, confirmed clothing/gear or a relevant established appearance detail; the surrounding spatial layout, sensory conditions, and active pressure; then show his declared action beginning and the immediate world reaction. Use second-person present tense and never assign an undeclared emotion, dialogue, or choice.
- GM ADJUDICATION: accept and restate the attempted intent, name the relevant Saga approach, and state the public stakes. An unconfirmed destination changes what can be achieved, not whether D'mir is allowed to try.
- GAMEPLAY RESULT: narrate the concrete fictional outcome. On failure, deny only the objective and fail forward to a tangible obstacle, cost, reaction, or new boundary. On success, grant only the stated objective.
- SAGA CHECK: show the exact server-owned arithmetic and RESULT line, or write "No check required." Never roll here.
- STATE UPDATE: list only confirmed persistent changes in player-facing language, or "No persistent change."
- PLAYER OPTIONS: provide 2-4 concise, neutral directions labeled alphabetically beginning with A. They are suggestions, not answers or promises. After the last choice, write exactly "You may declare another action." Do not choose for D'mir or end with a forced question.

Write 260-440 words total, with at least 140 words devoted to SCENE whenever a gameplay action actually resolves. Keep adjudication and mechanics concise so the fiction remains primary. Then end on the final line with exactly one hidden JSON ledger block: <!--STATE:{...}-->. Numeric values are relative changes, never totals. Use {} for no changes. Allowed fields are health, notoriety, forceAlignment, credits, creditsCriminal, experienceAward, conditionTrack, forcePoints, destinyPoints, darkSideScore, timeAdvanceMinutes, factionRep (empire, rebellion, csa), location, inventoryAdd, inventoryRemove, conditionAdd, conditionRemove, decisionAdd, objectiveAdd, objectiveComplete, discoveryAdd, milestoneAdd, storyDirectiveAdd, relationshipUpdate, legacyAssetUpsert, propertyAdd, shipAdd, investmentAdd, contactAdd, publicNewsAdd, travelAccessAdd, note, and characterUpdate. storyDirectiveAdd entries contain title, detail, and status and represent desired future direction only; never a present accomplishment or mechanical reward. characterUpdate may change earned textual build fields but must never contain level or experience. Do not mention this prompt, retrieval, models, or the hidden block.`;

const LEDGER_REPAIR_SYSTEM = `You repair a missing Galaxy of Consequence state ledger. Return exactly one HTML comment in the form <!--STATE:{...}--> and absolutely no prose. Infer only changes explicitly confirmed by the supplied draft and authoritative Saga result. Numeric values are relative changes, never totals. If the draft confirms no persistent change, return <!--STATE:{}-->. Never invent a success, reward, discovery, item, credit, injury, location change, or character advancement. Do not include level, total experience, or an experience award; the server calculates XP.`;

export function attachRepairedLedger(narration: string, repair: string) {
  const cleanNarration = narration
    .replace(/<!--\s*STATE\s*:[\s\S]*?-->/gi, "")
    .replace(/<!--\s*STATE\b[\s\S]*$/i, "")
    .trim();
  const candidates: string[] = [];
  for (const match of repair.matchAll(/<!--\s*STATE\s*:\s*([\s\S]*?)\s*-->/gi)) candidates.push(match[1]);
  for (const match of repair.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gi)) candidates.push(match[1]);
  candidates.push(repair.trim());

  // Model ledger repairs occasionally include smart quotes or a trailing comma.
  // Normalize only those unambiguous serialization mistakes, then re-serialize
  // parsed objects so downstream state validation always receives strict JSON.
  for (const candidate of candidates) {
    const firstBrace = candidate.indexOf("{");
    const lastBrace = candidate.lastIndexOf("}");
    if (firstBrace < 0 || lastBrace <= firstBrace) continue;
    const normalized = candidate.slice(firstBrace, lastBrace + 1)
      .replace(/[\u201c\u201d]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/,\s*([}\]])/g, "$1");
    try {
      const parsed = JSON.parse(normalized);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) continue;
      return `${cleanNarration}\n<!--STATE:${JSON.stringify(parsed)}-->`;
    } catch {
      // Try the next representation returned by the repair model.
    }
  }

  // Preserve the valid immersive draft when bookkeeping alone is malformed.
  // An empty ledger is safe: later authority checks still reject prose that
  // claims a material change without a matching server-owned delta.
  return `${cleanNarration}\n<!--STATE:{}-->`;
}

function rollMessage(roll: Record<string, unknown>) {
  const target = roll.targetVisible ? ` vs ${roll.targetLabel} ${roll.target}` : " vs hidden opposition";
  const damage = roll.damage && typeof roll.damage === "object" ? ` · DAMAGE ${(roll.damage as Record<string, unknown>).formula} = ${(roll.damage as Record<string, unknown>).total}` : "";
  const actor = String(roll.actor || "player").toUpperCase();
  return `${actor} ${String(roll.kind).toUpperCase()} — ${roll.label}\n${roll.formula}: ${roll.raw} ${Number(roll.modifier) >= 0 ? "+" : "−"} ${Math.abs(Number(roll.modifier))} = ${roll.total}${target} — ${String(roll.outcome).toUpperCase()}${damage}\nStakes: ${roll.stakes}`;
}

function publicContext(snapshot: DatapadSnapshot) {
  const state = snapshot.gameState;
  const scene = currentSceneFrame(snapshot);
  const recentTurns = (Array.isArray(state.turnEvents) ? state.turnEvents as Array<Record<string, unknown>> : [])
    .slice(-8)
    .map((event) => ({
      turnId: event.turnId,
      action: String(event.action || "").slice(0, 280),
      roll: event.roll || null,
      experienceAward: Number(event.experienceAward || 0),
      changed: event.changes && typeof event.changes === "object" && !Array.isArray(event.changes)
        ? Object.keys(event.changes as Record<string, unknown>)
        : [],
    }));
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
    scene, recentTurns,
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
  state?: Record<string, unknown>;
  character?: Record<string, unknown>;
  priorScene?: string;
};

function visibleCharacterBeat(character: Record<string, unknown>, state: Record<string, unknown>) {
  const appearance = String(character.appearance || "").trim();
  const details = appearance.split(/[,;.]/).map((part) => part.trim()).filter(Boolean).slice(0, 3).join(", ");
  const carried = Array.isArray(state.inventory)
    ? (state.inventory as Array<Record<string, unknown>>).filter((item) => Number(item.qty || 0) > 0).slice(0, 2).map((item) => String(item.name || "")).filter(Boolean)
    : [];
  const visible = details
    ? `The available light picks out ${details.charAt(0).toLocaleLowerCase()}${details.slice(1)} as you set your weight and begin the declared action.`
    : "Your stance, clothing, and the strain of the route remain visible as you set your weight and begin the declared action.";
  return carried.length ? `${visible} ${carried.join(" and ")} remain secured within reach.` : visible;
}

/**
 * Credit-free, deterministic last-resort narration. It deliberately cannot
 * invent discoveries, rewards, inventory, credits, NPC decisions, or scene
 * facts. Server-owned rolls and combat still resolve and are saved normally.
 */
export function buildLocalSafeFallback({ mode, action, location, roll, combatSummary, state = {}, character = {}, priorScene = "" }: LocalFallbackInput) {
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
  const lowerAction = positiveActionText(action).toLowerCase();
  const sceneBeat = Number((state.scene as Record<string, unknown> | undefined)?.beat || 0);
  const textureIndex = createHash("sha256").update(`${sceneBeat}:${action}:${priorScene.slice(-240)}`).digest()[0] % 3;
  const lowerCityTextures = [
    "A tired service strip flickers across ribbed durasteel, turning beads of condensation into brief silver lines. Beneath your boots, a buried repulsor conduit sends an uneven pulse through the deck while warm recycled air leaks from a grille at shoulder height.",
    "The passage is narrower here than it first appeared. Bundled conduits crowd one wall, old repair seals overlap along the other, and the distant growl of Coruscant traffic reaches this depth as a vibration rather than a sound.",
    "Amber maintenance light spills across a floor scored by utility carts and years of hurried repairs. Ozone hangs close to an exposed junction box; somewhere beyond the visible bend, metal answers metal once and then goes quiet.",
  ];
  const generalTextures = [
    "Used machinery and scarred surfaces define the immediate space. Indicator lights blink out of rhythm, hard cover breaks the sightlines, and the nearest access point carries the soft electrical hum of a system still doing its work.",
    "The room's practical layout comes into focus: a clear route behind you, equipment within reach, and a boundary ahead that blocks any easy view of what lies beyond. Air circulators stir dust along the deck.",
    "Light catches on worn controls and the edges of nearby cover. A motor cycles somewhere out of sight, briefly changing the pitch of the background noise before the space settles again.",
  ];
  const setting = (/coruscant|1313|unit 4-b|sublevel|bunker|corridor|substructure|transit/i.test(place) ? lowerCityTextures : generalTextures)[textureIndex];
  const isEndTurn = /\b(?:end (?:my |the )?turn|wait|hold position|stay put)\b/i.test(lowerAction);
  const isMeditation = /\b(?:meditat\w*|trance|focus inward|center myself|remain seated)\b/i.test(lowerAction);
  const isDevice = /\b(?:terminal|console|datapad|computer|control panel|storage module|interface)\b/i.test(lowerAction);
  const isInvestigation = /\b(?:search|examine|inspect|look|study|listen|scan|check)\b/i.test(lowerAction);
  const isAttack = isAttackDeclaration(action);
  const isForcePursuit = /\b(?:follow\w*|trace\w*|track\w*|pursu\w*|seek\w*|search\w*|locat\w*|find\w*)\b[^.]{0,120}\b(?:pressure|pull|call|vergence|dark[ -]side|force|sith|jedi temple|temple|shrine)\b|\b(?:pressure|pull|call|vergence|dark[ -]side|force|sith|jedi temple|temple|shrine)\b[^.]{0,120}\b(?:follow\w*|trace\w*|track\w*|pursu\w*|seek\w*|search\w*|locat\w*|find\w*)\b/i.test(lowerAction);
  const isMovement = permitsLocationChange(action);
  const appearanceBeat = visibleCharacterBeat(character, state);
  const routeProgress = Number((state.scene as Record<string, unknown> | undefined)?.routeProgress || 0);
  const pursuitBoundaries = [
    "The pressure leads through the next offset passage to a three-way maintenance junction. One branch carries newer traffic-scoring; another slopes toward older foundations behind a recessed service threshold.",
    "The route brings you beneath a low service arcade where modern conduit brackets have been bolted across much older load-bearing stone. A sealed Republic-era bulkhead interrupts the most direct line downward.",
    "The vibration resolves into a decommissioned power-balancing chamber. Three feeder trunks cancel one another's mechanical hum, leaving a separate low pressure beyond a shielded service shaft.",
    "The next accessible boundary is a braced foundation seam where durasteel repairs meet an older stone-lined passage. Nothing here proves the vergence's source, but the route no longer reads as an ordinary transit conduit.",
  ];

  let actionBeat: string;
  if (!action) {
    actionBeat = "You remain exactly where the campaign record left you. From this angle the visible routes, cover, and working machinery can be judged without inventing a new clue or moving time forward; nothing acts on your behalf while you take in the scene.";
  } else if (combatSummary || isAttack) {
    actionBeat = combatSummary
      ? "The exchange breaks across the space in a few sharp motions, then stops at the exact position recorded by the referee. Smoke, footwork, and exposed angles remain where the combat result leaves them; no second attack or unchosen movement follows."
      : "Your attack begins only as far as the encounter order allows. The target, cover, and distance remain part of the same tactical problem, and no hit is assumed before the server-owned attack result says it lands.";
  } else if (isForcePursuit) {
    actionBeat = pursuitBoundaries[routeProgress % pursuitBoundaries.length];
  } else if (isMeditation) {
    actionBeat = "You hold your position and narrow your attention to breath, balance, and the machinery's uneven rhythm. Heat from the conduit presses against one side of your face while the pulse beneath the deck separates from the ordinary transit vibration. The attempt gives you a concrete sensation to test without turning intuition into an unearned technique.";
  } else if (isDevice) {
    actionBeat = "You address the device and nothing else. Its casing, active indicators, and accessible controls answer only the contact you actually make; locked data stays locked, and the corridor beyond remains where it was while the interface gives its immediate, observable response.";
  } else if (isInvestigation) {
    actionBeat = "You work across the surfaces and sightlines named in your approach, comparing wear, dust, seams, and sound. The attempt carries you to the first physical inconsistency: a repair line and airflow break that do not match the surrounding construction, giving the check a concrete point to resolve.";
  } else if (isMovement) {
    actionBeat = "You follow the route only as far as the next concrete boundary. The floor's vibration shifts beneath you and the straight run resolves into a maintenance junction where a recessed service door faces two offset passages. You stop there with all three approaches visible; nothing beyond them is chosen or revealed for you.";
  } else if (isEndTurn) {
    actionBeat = "You hold position. A ventilation cycle rolls through the passage, lifting grit along the wall and then letting it settle. No enemy crosses the visible route and no choice is made for you; the moment changes only through what the world can plainly do while you wait.";
  } else {
    actionBeat = "You carry the declared action into the immediate scene. Nearby equipment, distance, and access shape how far it can go, and the environment answers with a concrete change in position, pressure, or attention rather than refusing the attempt.";
  }

  const actionInProgress = !action
    ? "You take in the present scene without acting; your position and the visible routes remain unchanged."
    : combatSummary || isAttack
      ? "Your shoulders square and your attention fixes on the tactical space as the declared combat action begins; cover, distance, and the opponent's position remain visible around you."
      : isForcePursuit
        ? "You move deliberately through the accessible route, testing the pressure against vibration, airflow, old construction seams, and the changing weight beneath your steps rather than assuming where it ends."
        : isMeditation
          ? "You settle your stance without leaving the spot, slow your breathing, and listen past the ordinary machinery for the pressure you have chosen to examine."
          : isDevice
            ? "You bring your hands to the accessible controls and work only with what the casing, display, and live indicators actually place in front of you."
            : isInvestigation
              ? "You begin a methodical examination, shifting your sightline across the reachable surfaces while keeping the open approaches in view."
              : isMovement
                ? "You commit to the declared route and advance only to the next observable boundary, keeping your carried gear close and the way behind you in mind."
                : isEndTurn
                  ? "You hold your ground and watch the visible approaches while the surrounding machinery completes another cycle."
                  : "You commit to the declared attempt in the immediate space, using only the access, equipment, and capabilities already established for you.";

  let adjudication = !action
    ? "No action has been declared. This is a read-only view of the present moment."
    : isForcePursuit
      ? "Your declaration is accepted as a search for a suspected Force-related destination. Until trained Use the Force is earned, the executable approach is physical navigation and Perception informed by involuntary intuition; the vergence itself is not assumed."
      : `Your declaration is accepted as the attempted action for this turn. ${roll ? String(roll.reason || "Saga Edition resolves the meaningful uncertainty.") : "The immediate step is ordinary and does not require a Saga check."}`;
  let gameplayResult = !action
    ? "You remain in the saved scene while the immediate layout and pressures are presented without advancing time."
    : actionBeat;
  let checkText = "No check required.";
  const fallbackDelta: Record<string, unknown> = {};
  if (action && !combatSummary) fallbackDelta.timeAdvanceMinutes = isMeditation ? 10 : 5;
  let stateUpdate = Object.keys(fallbackDelta).length ? `Time advances ${Number(fallbackDelta.timeAdvanceMinutes)} minutes. The current scene boundary is recorded.` : "No persistent change.";
  if (roll) {
    const modifier = Number(roll.modifier) || 0;
    const target = roll.targetVisible ? ` vs ${String(roll.targetLabel || "DC")} ${Number(roll.target)}` : " vs hidden opposition";
    const damage = roll.damage && typeof roll.damage === "object" ? ` Damage: ${String((roll.damage as Record<string, unknown>).formula || "rolled damage")} = ${Number((roll.damage as Record<string, unknown>).total) || 0}.` : "";
    const succeeded = roll.outcome === "success";
    checkText = `${String(roll.label || "Saga check")}: ${String(roll.formula || "1d20")} = ${Number(roll.raw)} ${modifier >= 0 ? "+" : "−"} ${Math.abs(modifier)} = ${Number(roll.total)}${target}.\nRESULT: ${succeeded ? "SUCCESS" : "FAILURE"}${damage}`;
    gameplayResult = isForcePursuit
      ? succeeded
        ? `${actionBeat} The successful check distinguishes one actionable route from the surrounding mechanical noise without yet proving what waits at its end.`
        : `${actionBeat} The failed check does not identify the true route or confirm the vergence. Instead, it brings you to a real obstruction where the signal divides, forcing a different method or approach.`
      : succeeded
        ? `${actionBeat} The declared objective succeeds within the stated scope and the world now reflects that result.`
        : `${actionBeat} The objective is not achieved, but the attempt changes the immediate situation through the obstacle, elapsed time, or reaction now in front of you.`;
    stateUpdate = combatSummary || `${succeeded ? "The successful attempt" : "The failed attempt"} and its elapsed time are recorded. No unrelated reward, possession, or secret is added.`;
  } else if (combatSummary) {
    adjudication = "The declaration is resolved through the server-owned Saga combat sequence and action economy.";
    gameplayResult = `${actionBeat} ${combatSummary}`;
    checkText = "The authoritative combat rolls are shown in this turn's Saga record.";
    stateUpdate = "The server-owned combat record is updated.";
  }

  const sceneText = `${appearanceBeat}\n\n${setting}\n\n${actionInProgress}`;
  const directions = sceneDirections({ state: { ...state, location }, character, scene: sceneText, action, result: gameplayResult })
    .map((text, index) => `${String.fromCharCode(65 + index)}. ${text}`)
    .join("\n");

  return {
    content: `## LOCATION\n${place}\n\n## SCENE\n${sceneText}\n\n## GM ADJUDICATION\n${adjudication}\n\n## GAMEPLAY RESULT\n${gameplayResult}\n\n## SAGA CHECK\n${checkText}\n\n## STATE UPDATE\n${stateUpdate}\n\n## PLAYER OPTIONS\n${directions}\nYou may declare another action.\n<!--STATE:${JSON.stringify(fallbackDelta)}-->`,
    provider: "local-safe-fallback" as const,
    model: "deterministic-saga-referee",
    finishReason: "stop",
  };
}

export function safeMessages(snapshot: DatapadSnapshot): NvidiaMessage[] {
  const messages = Array.isArray(snapshot.messages) ? snapshot.messages as Message[] : [];
  const pairs: NvidiaMessage[][] = [];
  let pendingUser: Message | null = null;
  for (const message of messages) {
    if (!message || typeof message.content !== "string" || message.error) continue;
    if (message.role === "user") {
      pendingUser = message;
      continue;
    }
    if (message.role !== "assistant" || !pendingUser) continue;
    const isFallback = message.provider === "local-safe-fallback" || message.fallbackReason;
    if (!isFallback && !isRepeatedSceneTemplate(message.content)) {
      const adjudication = sectionBody(message.content, "GM ADJUDICATION") || sectionBody(message.content, "GM RESOLUTION");
      const gameplay = sectionBody(message.content, "GAMEPLAY RESULT");
      const check = sectionBody(message.content, "SAGA CHECK");
      const stateUpdate = sectionBody(message.content, "STATE UPDATE");
      const outcome = [adjudication, gameplay, check, stateUpdate].filter(Boolean).join("\n").slice(0, 3000);
      pairs.push([
        { role: "user", content: sanitizeGmNarration(pendingUser.content).slice(0, 2000) },
        { role: "assistant", content: `PRIOR TURN OUTCOME — continuity only; authoritative saved state wins:\n${outcome || "No authoritative outcome summary was retained."}` },
      ]);
    }
    pendingUser = null;
  }
  return pairs.slice(-4).flat();
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

export function constrainFailedCheckDelta(delta: Record<string, unknown> | null, roll: Record<string, unknown> | null, action = "") {
  if (!delta || !roll || roll.outcome !== "failure") return delta;
  // A failed search, social attempt, or attack cannot award discoveries,
  // inventory, assets, contacts, or character progression. Failure can still
  // advance the fiction through time, a declared movement to an obstacle,
  // injury, exposure, an active objective, or another supported consequence.
  const safe: Record<string, unknown> = {};
  for (const field of ["notoriety", "forceAlignment", "factionRep", "note"]) {
    if (Object.prototype.hasOwnProperty.call(delta, field)) safe[field] = delta[field];
  }
  if (typeof delta.health === "number" && delta.health <= 0) safe.health = delta.health;
  if (typeof delta.conditionTrack === "number" && delta.conditionTrack >= 0) safe.conditionTrack = delta.conditionTrack;
  if (typeof delta.timeAdvanceMinutes === "number" && delta.timeAdvanceMinutes > 0) safe.timeAdvanceMinutes = delta.timeAdvanceMinutes;
  if (delta.location && permitsLocationChange(action)) safe.location = delta.location;
  for (const field of ["conditionAdd", "decisionAdd", "objectiveAdd"]) {
    if (Array.isArray(delta[field]) && (delta[field] as unknown[]).length) safe[field] = delta[field];
  }
  if (Array.isArray(delta.storyDirectiveAdd)) {
    const directions = delta.storyDirectiveAdd.filter((entry) => entry && typeof entry === "object"
      && String((entry as Record<string, unknown>).status || "active").trim().toLocaleLowerCase() !== "completed");
    if (directions.length) safe.storyDirectiveAdd = directions;
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
  if (!delta || roll?.outcome === "failure") return 0;
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
  return narration.replace(/^(SAGA CHECK\s*)$/im, `$1\n${expected}`);
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
  const headings: Array<typeof SECTION_HEADINGS[number]> = ["LOCATION", "SCENE", "GM ADJUDICATION", "GAMEPLAY RESULT", "SAGA CHECK", "STATE UPDATE", "PLAYER OPTIONS"];
  let cursor = -1;
  for (const heading of headings) {
    const match = new RegExp(`^(?:#{1,6}\\s*)?${heading}\\s*$`, "im").exec(narration);
    if (!match || match.index <= cursor) {
      throw new GmTurnError(`The GM response omitted or reordered the ${heading} section. No outcome was saved; retry the turn.`, 502);
    }
    cursor = match.index;
  }
  for (const heading of headings) {
    if (!/[\p{L}\p{N}]/u.test(sectionBody(narration, heading))) {
      throw new GmTurnError(`The GM response left the ${heading} section empty. Rewrite the same turn with a concrete scene and result.`, 502);
    }
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
export function ensurePlayerOptions(narration: string, state: Record<string, unknown> = {}, character: Record<string, unknown> = {}, action = "") {
  const heading = /^(?:#{1,6}\s*)?PLAYER OPTIONS\s*$/im.exec(narration);
  const choices = heading ? narration.slice(heading.index).split(/\r?\n/).filter((line) => /^[A-D]\.\s/.test(line)) : [];
  if (heading && choices.length >= 2 && !genericDirections(choices)) return narration;
  const body = heading ? narration.slice(0, heading.index).trimEnd() : narration.trim();
  const scene = sectionBody(narration, "SCENE") || body;
  const result = sectionBody(narration, "GAMEPLAY RESULT");
  const directions = sceneDirections({ state, character, scene, action, result }).map((text, index) => `${String.fromCharCode(65 + index)}. ${text}`);
  return `${body}\n\nPLAYER OPTIONS\n${directions.join("\n")}\nYou may declare another action.`;
}

const SECTION_HEADINGS = ["LOCATION", "SCENE", "GM ADJUDICATION", "GAMEPLAY RESULT", "SAGA CHECK", "STATE UPDATE", "PLAYER OPTIONS", "GM RESOLUTION"] as const;

function sectionBody(narration: string, heading: typeof SECTION_HEADINGS[number]) {
  const start = new RegExp(`^(?:#{1,6}\\s*)?${heading}\\s*$`, "im").exec(narration);
  if (!start) return "";
  const bodyStart = start.index + start[0].length;
  const later = SECTION_HEADINGS
    .filter((candidate) => candidate !== heading)
    .map((candidate) => new RegExp(`^(?:#{1,6}\\s*)?${candidate}\\s*$`, "im").exec(narration.slice(bodyStart)))
    .filter((match): match is RegExpExecArray => Boolean(match))
    .map((match) => match.index)
    .sort((a, b) => a - b)[0];
  return narration.slice(bodyStart, later === undefined ? narration.length : bodyStart + later).trim();
}

export function extractSceneNarration(narration: string) {
  return sectionBody(sanitizeGmNarration(narration), "SCENE")
    .replace(/<!--\s*STATE\s*:[\s\S]*?-->/gi, "")
    .trim();
}

function sceneTokens(value: string) {
  return value.toLocaleLowerCase()
    .replace(/\*+/g, "")
    .replace(/^location\s*:\s*.*$/gim, "")
    .match(/[a-z0-9'’]+/g) || [];
}

function sceneShingles(value: string) {
  const tokens = sceneTokens(value);
  const shingles = new Set<string>();
  for (let index = 0; index < tokens.length - 2; index += 1) shingles.add(tokens.slice(index, index + 3).join(" "));
  return shingles;
}

export function sceneSimilarity(left: string, right: string) {
  const a = sceneShingles(left), b = sceneShingles(right);
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  for (const value of a) if (b.has(value)) overlap += 1;
  return overlap / Math.max(1, Math.min(a.size, b.size));
}

function normalizedParagraphs(value: string) {
  return value.split(/\n\s*\n/)
    .map((paragraph) => sceneTokens(paragraph).join(" "))
    .filter((paragraph) => paragraph.split(" ").length >= 14);
}

export function assertFreshScene(narration: string, priorScene: string, action: string) {
  const scene = extractSceneNarration(narration);
  if (!scene || (action && sceneTokens(scene).length < 25)) {
    throw new GmTurnError("The GM SCENE did not narrate the declared attempt in a concrete setting. Rewrite the same turn with D'mir's visible position, surroundings, and immediate world reaction.", 502);
  }
  if (!priorScene) return;
  const priorParagraphs = new Set(normalizedParagraphs(priorScene));
  const repeatsParagraph = normalizedParagraphs(scene).some((paragraph) => priorParagraphs.has(paragraph));
  const similarity = sceneSimilarity(scene, priorScene);
  if (repeatsParagraph || (sceneTokens(scene).length >= 45 && similarity >= 0.72)) {
    throw new GmTurnError(`The GM repeated the prior scene instead of showing how the world answered ${action || "the scene refresh"}. Rewrite from the present beat with new, action-specific sensory narration.`, 502);
  }
}

export function assertMovementSceneProgress(
  narration: string,
  action: string,
  roll: Record<string, unknown> | null,
  delta: Record<string, unknown> | null,
  currentLocation?: unknown,
) {
  if (!action || !permitsLocationChange(action)) return;
  if (delta?.location && delta.location !== currentLocation) return;
  const scene = extractSceneNarration(narration);
  const establishesNewPosition = /\b(?:arrive|reach|stop at|draw near|close (?:in|the distance)|junction|intersection|threshold|door|hatch|gate|barrier|bend|turn|landing|stair|lift|opening|arch|bridge|platform|chamber|alcove|checkpoint|crossing|branch|fork|edge|entrance|exit|within reach|alongside|opposite)\b/i.test(scene);
  if (!establishesNewPosition) {
    throw new GmTurnError("The GM described movement without establishing a new observable position or scene boundary. Rewrite the same action so the route reaches a concrete stopping point.", 502);
  }
}

const REPEATED_SCENE_PATTERNS = [
  /you are already in the deeper lower-city substructure/i,
  /worn durasteel walls and utility conduits show the scars of age and stress/i,
  /your declared action reaches the point where the world must answer/i,
  /you leave the exact point recorded at/i,
  /machinery murmurs through the structure while the immediate pressure remains close/i,
];

export function isRepeatedSceneTemplate(content: string) {
  return REPEATED_SCENE_PATTERNS.some((pattern) => pattern.test(content));
}

function latestAssistantScene(snapshot: DatapadSnapshot) {
  const messages = Array.isArray(snapshot.messages) ? snapshot.messages as Message[] : [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== "assistant" || typeof message.content !== "string") continue;
    const scene = extractSceneNarration(message.content);
    if (scene) return scene;
  }
  return "";
}

function currentSceneFrame(snapshot: DatapadSnapshot) {
  const state = snapshot.gameState || {};
  const stored = state.scene && typeof state.scene === "object" && !Array.isArray(state.scene)
    ? state.scene as Record<string, unknown>
    : null;
  const summary = String(stored?.summary || latestAssistantScene(snapshot)).slice(0, 2800);
  if (!summary) return null;
  return {
    id: String(stored?.id || "legacy-scene"),
    beat: Number(stored?.beat || 0),
    routeProgress: Number(stored?.routeProgress || 0),
    location: String(stored?.location || state.location || ""),
    action: String(stored?.action || "Prior saved scene").slice(0, 280),
    summary,
  };
}

export function withSceneFrame(
  snapshot: DatapadSnapshot,
  narration: string,
  action: string,
  roll: Record<string, unknown> | null,
  openScene = false,
  now = new Date().toISOString(),
) {
  const summary = extractSceneNarration(narration).slice(0, 2800);
  if (!summary) return snapshot;
  const previous = currentSceneFrame(snapshot);
  // Route progress records reaching a new playable boundary, not automatic
  // success at the final destination. A failed pursuit can still reach an
  // obstruction, false branch, checkpoint, or exposed position.
  const movementProgress = Boolean(action && permitsLocationChange(action));
  const beat = openScene ? Number(previous?.beat || 0) : Number(previous?.beat || 0) + 1;
  const routeProgress = Number(previous?.routeProgress || 0) + (movementProgress ? 1 : 0);
  const scene = {
    id: createHash("sha256").update(`${beat}:${summary}`).digest("hex").slice(0, 16),
    beat,
    routeProgress,
    location: String(snapshot.gameState.location || ""),
    action: action || "Open scene",
    summary,
    updatedAt: now,
  };
  return { ...snapshot, gameState: { ...snapshot.gameState, scene } };
}

export function assertLocationIntent(delta: Record<string, unknown> | null, action: string, currentLocation?: unknown) {
  if (delta?.location === currentLocation) return;
  if (delta?.location && !permitsLocationChange(action)) throw new GmTurnError("The narration moved the character without a declared movement. Rewrite at the saved location.", 502);
}

export function assertSceneRefreshDelta(delta: Record<string, unknown> | null) {
  if (Object.values(delta || {}).some((value) => value !== 0 && value !== null && !(Array.isArray(value) && value.length === 0))) {
    throw new GmTurnError("A scene description cannot change the campaign. Rewrite the same scene with no consequences.", 502);
  }
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
  const priorScene = currentSceneFrame(currentSnapshot)?.summary || "";
  const userMessage = action || "Describe the CURRENT saved scene, not the opening scene. Use the full seven-section response contract. LOCATION must repeat the authoritative saved location. SCENE must freshly describe my visible established appearance or gear, posture, immediate sensory setting, and spatial layout without claiming that I acted, felt a prescribed emotion, noticed a new clue, or gained anything. Under GM ADJUDICATION say this is a read-only scene view. Under GAMEPLAY RESULT say I remain at the saved moment. Under SAGA CHECK write: No check required. Under STATE UPDATE write: No persistent change. Give scene-specific PLAYER OPTIONS using confirmed capabilities. Do not advance time, move me, invent a discovery, or change mechanical state. Return STATE:{}.";
  const claims = authorityWarnings(action);
  const authorityInstruction = claims.length ? `\n\nPLAYER AUTHORITY WARNING: This declaration contains unverified ${claims.join(", ")}. Treat those clauses only as D'mir's belief or intended approach. They are not facts and cannot become true without support from current authoritative state plus a relevant successful resolution.` : "";
  const creatorInstruction = actor.username.toLocaleLowerCase() === "dmir@galaxy.local" && /^d['’]mir holloran$/i.test(String((currentSnapshot.character as Record<string, unknown>).name || "").trim())
    ? `\n\nD'MIR CREATOR DIRECTION: This is D'mir's creator-controlled player campaign. Respect explicit long-term themes, goals, and desired arcs by creating plausible Star Wars opportunities rather than blocking them. Record a new explicit long-term direction with storyDirectiveAdd. Creating a direction is not an accomplished fact and grants no immediate XP, level, credits, item, feat, talent, Force power, training, victory, or automatic success. Once gameplay actually fulfills an established direction, update that same title to status completed and record the concrete outcome; the server will award XP and derive leveling normally.`
    : "";
  const rollInstruction = roll ? `\n\nAUTHORITATIVE SAGA RESULT:\n${JSON.stringify(roll)}\nUnder SAGA CHECK include concise public arithmetic and the exact line RESULT: ${String(roll.outcome).toUpperCase()}. ${roll.outcome === "failure" ? "The attempted objective fails, but GAMEPLAY RESULT must fail forward to a concrete obstacle, cost, world reaction, or new scene boundary supported by the stakes. Do not grant the intended secret, access, damage, victory, item, or funds." : "Grant only the declared objective; do not expand the success beyond its stated scope."} ${roll.targetVisible ? "Show the DC or defense." : "Do not reveal the hidden target number or NPC statistics."}` : "";
  const combatInstruction = combatResolution ? `\n\nAUTHORITATIVE COMBAT UPDATE:\n${JSON.stringify({ summary: combatResolution.summary, combat: combatResolution.combat, additionalRolls: combatResolution.rolls, playerHealthDelta: combatResolution.playerHealthDelta, playerConditionDelta: combatResolution.playerConditionDelta, experienceAward: combatResolution.experienceAward })}\nThis update is server-owned. Narrate it exactly without inventing another attack, damage roll, movement, action, victory, or reward. An opening attack declaration starts initiative only; it does not also resolve the attack. Reflect remaining player actions and stop for the player's next declaration.` : "";
  const system = mode === "ooc" ? `You are the campaign Game Master. Answer the player's out-of-character rules or character-status question concisely from authoritative saved state. Distinguish confirmed state from rumors or prior narrative claims. Do not advance time, narrate a new scene, change state, or output a STATE block.\n\nCURRENT CAMPAIGN STATE:\n${publicContext(currentSnapshot)}`
    : mode === "context" ? `The player supplied character background/context, not an in-world action. Acknowledge it briefly, do not roll, do not advance the scene, and do not invent additions. Do not output a STATE block.\n\nCURRENT CAMPAIGN STATE:\n${publicContext(currentSnapshot)}`
    : `${GM_SYSTEM}${rollInstruction}${combatInstruction}${authorityInstruction}${creatorInstruction}\n\nTURN CONTRACT: Suggestions must change with the current scene, visible interactables, injuries, carried equipment, trained skills and remaining combat actions. Use 2-4 A-D possible attempts, never a static menu, guaranteed outcome, secret clue or unearned Force technique. Only suggest objects already visible in this scene or recorded in state. LOCATION comes from saved state. SCENE shows D'mir's established visible condition and the declared action meeting the immediate environment before mechanics. GM ADJUDICATION accepts the executable intent; an asserted destination is a goal, not a reason to refuse the attempt. GAMEPLAY RESULT must create a playable new beat even on failure. SAGA CHECK contains only server-owned dice or "No check required." Meditation and terminal interaction are not travel. Negated actions never occur. Travel reaches a concrete observable boundary, not an endless generic transit summary. PRIOR TURN OUTCOME messages omit old scene prose: use them only for continuity, never as a writing template. The saved scene summary identifies the present beat but its wording must not be copied.\n\nCURRENT AUTHORITATIVE CAMPAIGN STATE:\n${publicContext(currentSnapshot)}`;
  let response: Awaited<ReturnType<typeof invokeNvidia>> | null = null;
  let parsed: ReturnType<typeof parseEngineResponse> | null = null;
  let delta: Record<string, unknown> | null = null;
  let validationError: unknown = null;
  let fallbackReason: "provider" | "validation" | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const correction = attempt && validationError instanceof Error
      ? { role: "user" as const, content: `[SERVER VALIDATION REJECTED THE PRIOR DRAFT: ${validationError.message}] Rewrite the same turn. Preserve the supplied roll exactly, use only authoritative state, follow all seven required sections in order, accept the declared action as an attempt, fail forward when necessary, and output one valid STATE block. Do not add a new action or reroll.` }
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
        state: currentSnapshot.gameState,
        character: currentSnapshot.character as Record<string, unknown>,
        priorScene,
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
      if (mode === "play") parsed = { ...parsed, clean: ensurePlayerOptions(normalizePlayerOptions(parsed.clean), currentSnapshot.gameState, currentSnapshot.character as Record<string, unknown>, action) };
      if (mode === "play") assertCampaignResponseStructure(parsed.clean);
      if (mode === "play") assertNarrativeFocus(parsed.clean, action);
      if (mode === "play" && response.provider !== "local-safe-fallback") assertFreshScene(parsed.clean, priorScene, action);
      assertMechanicalNarration(parsed.clean, roll);
      delta = constrainFailedCheckDelta(parsed.delta as Record<string, unknown> | null, roll, action);
      delta = constrainExperienceAward(delta, roll);
      if (input.statePolicy === "committed-trade" && delta) {
        delta = { ...delta, credits: 0, creditsCriminal: 0, inventoryAdd: [], inventoryRemove: [] };
      }
      if (!action && input.openScene) { assertSceneRefreshDelta(delta); delta = {}; }
      assertLocationIntent(delta, action, currentSnapshot.gameState.location);
      if (mode === "play") assertMovementSceneProgress(parsed.clean, action, roll, delta, currentSnapshot.gameState.location);
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
      state: currentSnapshot.gameState,
      character: currentSnapshot.character as Record<string, unknown>,
      priorScene,
    });
    parsed = parseEngineResponse(response.content, { requireState: mode === "play" });
    parsed = { ...parsed, clean: alignMechanicalResult(sanitizeGmNarration(parsed.clean), roll) };
    if (mode === "play") {
      parsed = { ...parsed, clean: ensurePlayerOptions(normalizePlayerOptions(parsed.clean), currentSnapshot.gameState, currentSnapshot.character as Record<string, unknown>, action) };
      assertCampaignResponseStructure(parsed.clean);
      assertNarrativeFocus(parsed.clean, action);
    }
    assertMechanicalNarration(parsed.clean, roll);
    delta = constrainFailedCheckDelta(parsed.delta as Record<string, unknown> | null, roll, action);
    delta = constrainExperienceAward(delta, roll);
    if (input.statePolicy === "committed-trade" && delta) delta = { ...delta, credits: 0, creditsCriminal: 0, inventoryAdd: [], inventoryRemove: [] };
    assertLocationIntent(delta, action, currentSnapshot.gameState.location);
    if (mode === "play") assertMovementSceneProgress(parsed.clean, action, roll, delta, currentSnapshot.gameState.location);
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
  if (mode === "play") finalized = withSceneFrame(finalized, parsed.clean, action, roll, Boolean(input.openScene));
  const messages: Message[] = [...(currentSnapshot.messages as Message[])];
  if (action) messages.push({ role: "user", content: action });
  if (roll) messages.push({ role: "roll", content: rollMessage(roll), roll });
  for (const combatRoll of combatResolution?.rolls || []) messages.push({ role: "roll", content: rollMessage(combatRoll), roll: combatRoll });
  messages.push({ role: "assistant", content: parsed.clean, turnId: input.turnId, provider: response.provider, model: response.model, fallbackReason });
  const snapshot: DatapadSnapshot = { ...finalized, messages };
  const persisted = saveAuthoritativeDatapad(actor, accountId, input.revision, snapshot);
  const result = { snapshot, revision: persisted.revision, updatedAt: persisted.updatedAt, roll, narration: parsed.clean, provider: response.provider, model: response.model, fallbackReason };
  db.prepare("UPDATE gm_turn_attempts SET status = 'complete', result = ? WHERE account_id = ? AND turn_id = ?").run(JSON.stringify(result), accountId, input.turnId);
  return result;
}
