import { createHash, randomUUID } from "node:crypto";
import { LIVING_GALAXY_DIRECTIVES } from "./living-galaxy-directives";
import type { Account } from "./accounts";
import { accountStore } from "./accounts";
import { readDatapad, saveAuthoritativeDatapad, type DatapadSnapshot } from "./datapad-save";
import {projectQuestWorld,questWorldGmContext} from "./quest-world-events";
import {recordCommittedRivalObservation,relevantRivalGmContext} from "./npc-rival-intelligence";
import {advanceNpcOffscreen,npcOffscreenGmContext} from "./npc-offscreen-intelligence";
import {interpretRpgActionContract,assertRpgOutcomeFocus} from "./rpg-action-contract";
import { invokeNvidia, NvidiaProviderError, type NvidiaMessage } from "./original-provider";
import { rollSagaCheck } from "./saga-dice";
import { planSagaAction } from "./saga-planner";
import { permitsLocationChange, positiveActionText } from "./action-intent";
import { sceneDirections, genericDirections } from "@/original/lib/sceneDirections";
import { applyCharacterDelta, applyEngineDelta, applyExperienceAward, parseEngineResponse } from "@/original/lib/engineState";
import { progressionStatus } from "@/original/lib/sagaAdvancement";
import { assertAdvancementReady } from "./advancement-gate";
import { ensureCampaignScaffold } from "@/original/lib/campaignState";
import { appendDmirCreatorCanon, isDmirPrimaryCampaign } from "./dmir-authority";
import { activeCombat, beginCombat, endPlayerTurn, isAttackDeclaration, isCombatMovementDeclaration, isCombatWithdrawDeclaration, isEndTurnDeclaration, resolveCombatAction, type CombatResolution } from "./saga-combat";
import { commitConversationTradeState, conversationTradeInstruction, currentTradeOffers, isVerifiedConversationTradeDelta, planConversationTrade, reconcileConversationTradeDelta, type ConversationTrade } from "./conversation-trade";
import { alignMerchantIdentity, isRoutineCommerce, isRoutineServiceInquiry, sceneMerchant } from "./scene-commerce";
import { isAtelierAppointmentRequest, assertAtelierAppointmentProgress, atelierAppointmentGmInstruction, atelierAppointmentRecovery } from "./atelier-appointments";
import { assertSandboxAgency, SANDBOX_GM_AGENCY, mayUseCivilianAgencyRecovery, civilianAgencyRecovery } from "./sandbox-agency";
import {planInteriorMovement,recoverInteriorMovement} from "./interior-movement-recovery";
import { buildSemanticSagaCheck, declaredForcePower, forceCapabilityConstraint, hasEarnedForcePower, interpretSagaAction, requiredForcePower } from "./saga-action-plan";
import { buildForcePowerPlan, resolveForcePower, type ForcePowerResolution } from "./saga-force";
import { recoverConfirmedTradeOffer } from "./trade-offer-recovery";
import { quotedCreditAmounts } from "./quoted-credits";
import { normalizeModelLedgerJson, repairEmbeddedModelLedger } from "./model-ledger-json";
import { classifyGmDraftFailure } from "./gm-draft-failure";
import { GmDraftIdentityError, loadValidatedDraft, storeValidatedDraft } from "./gm-draft-checkpoint";
import { itemStatBlock } from "@/original/lib/itemStats";
import { constrainReadOnlyGoodsInspectionDelta, isReadOnlyGoodsInspection } from "./goods-inspection";
import { advanceTurnLifecycle, beginTurnLifecycle, commitTurnLifecycle, failTurnLifecycle, recordDraftFailure, type TurnLifecycleReceipt } from "./turn-lifecycle";
import { pendingTransitArrival, transitArrivalFailure } from "./transit-progression";
import { reconcileFulfilledObjectives, currentObjectiveContext } from "./objective-reconciliation";
import { reconcileCommittedArrival } from "./committed-arrival";
import { EVENT_WAIT_INSTRUCTION, eventWaitFailure, isEventWait } from "./event-wait";
import { currentTerritory } from "@/original/lib/regionalNews";
import { canonicalNpcContext } from "./npc-canon-roster";
import { npcAlienGmContinuity } from "./npc-alien-story-ratings";
import { dmirSceneNpcContext, updateDmirNpcContinuity } from "./dmir-npc-memory";
import { recordVisibleSceneNpcs } from "./player-scene-roster";
import { sceneNpcSheets } from "./player-scene-roster";
import { npcMechanics, recordNpcMechanics } from "./npc-mechanics";

type TurnInput = { accountId?: string; revision: number; action: string; turnId: string; openScene?: boolean; statePolicy?: "committed-trade" | null };
type Message = { role: "user" | "assistant" | "roll"; content: string; [key: string]: unknown };

function isAuthoritativeLocalReceipt(message: Message | undefined) {
  return message?.provider === "local-safe-fallback"
    && ["resolved-saga-receipt", "commercial-progress-receipt", "service-inquiry-receipt"].includes(String(message.model || ""));
}

/** Keep D'mir's personal canon out of isolated GM-controlled NPC campaigns. */
export function gmSystemForCharacter(character: Record<string, unknown>, gameState: Record<string, unknown> = {}) {
  const name = String(character.name || "the active character").trim().slice(0, 100);
  const savedYear = Number(gameState.campaignYearABY);
  const campaignYear = Number.isSafeInteger(savedYear) && savedYear >= 0 && savedYear <= 300 ? savedYear : 150;
  if (/^d['’]mir holloran$/i.test(name)) return GM_SYSTEM;
  const storyRating = npcAlienGmContinuity(name, campaignYear);
  const personal = [/^D'mir's creator /i, /^D'mir continuity anchors /i, /^PLAYER-ESTABLISHED CAMPAIGN DIRECTION:/i];
  return GM_SYSTEM.split("\n\n")
    .filter(paragraph => !personal.some(pattern => pattern.test(paragraph.trim())))
    .join("\n\n")
    .replace(/D['’]mir['’]s/gi, `${name}'s`)
    .replace(/D['’]mir/gi, name)
    .replace(/150 ABY/g, `${campaignYear} ABY`)
    + `\n\nNPC TEST CAMPAIGN: ${name} is the active viewpoint. This campaign is an independent, GM-controlled NPC continuity. D'mir's history, assets, Force awareness, family and objectives do not transfer to this character. Never merge this timeline into D'mir's primary save. For flashbacks, keep knowledge and technology within the saved historical date.`
    + (character.npcHistoricalBaselineId ? `\nNPC ORIGIN RECORD: ${name} has an audited level ${character.npcStartingLevel} 150 ABY starting career. The historical starting XP is prior life experience, not a reward for this turn; retain it without re-awarding anything. The Saga HEROIC CLASS Jedi is usable to represent a Sith or Imperial Knight Force practitioner; it does NOT imply affiliation with the Jedi Order. Faction and verified private history, not the class label, determine identity. Any Force power must exist on the actual character sheet and obey the Saga resolver.` : "")
    + (storyRating ? `\n\nPRIVATE NPC ORIGIN AND STORY-RATING REFERENCE: ${JSON.stringify(storyRating)}\nThe proposed ratings are editorial design targets, not automatic engine state. The character's stored level, validated species traits, Force abilities and actual GM adjudication always take precedence; never award an unearned power, hidden resource, title, or story outcome.` : "");
}

function deterministicTurnRoller(turnId: string, lane: string) {
  let index = 0;
  return (min: number, max: number) => {
    const bytes = createHash("sha256").update(`${turnId}:${lane}:${index++}`).digest();
    return min + (bytes.readUInt32BE(0) % Math.max(1, max - min));
  };
}

export const GM_SYSTEM = `You are the Game Master of Galaxy of Consequence, a persistent player-driven Star Wars Saga Edition campaign in 150 ABY. The player controls only their character. You control NPCs, scenes, factions, consequences, and continuity.
ENDPOINT CONSISTENCY: LOCATION and the hidden location ledger describe the END of the resolved action, not its starting room. Moving within a venue (for example from its workroom to its front counter) changes the saved sublocation too. Never narrate a completed move while saving the old room. A successful check cannot be described as a failed objective; a successful search may establish that nothing concealed is present.
PUBLIC REPORTS: A request for local, regional, and galactic news is not limited to the character's current quest. Answer each requested territory independently, and save every newly established bulletin in publicNewsAdd with its source and territory. Historical wars and battles are history, not breaking 150 ABY news, unless a new campaign-established present-day development explicitly relates to them. Do not invent a present-day war, ruler, or emergency to fill an empty feed. If no verified report exists, say so without recycling old history as current events.

Act as the single director over four private specialist roles before writing the final response:
- SAGA REFEREE: interprets only Saga Edition mechanics and accepts the authoritative server roll. It never invents a roll, modifier, defense, damage result, feat, talent, or Force power.
- WORLD DIRECTOR: determines environmental and faction reactions from established location, time, resources, access, news, and campaign flags. It never creates an unearned fact or changes state directly.
- NPC DIRECTOR: gives each present NPC a response based on that NPC's established knowledge, goals, disposition, capability, and immediate risk. NPCs know only what they could plausibly know and do not act merely to help or obstruct the player.
- CONTINUITY KEEPER: checks chronology, injuries, inventory, credits, relationships, unresolved obligations, and prior events for contradictions.

Reconcile these specialists privately. They are advisers, not independent narrators or autonomous actors. Only you, the GM, speak in the final response. No specialist may roll dice, commit state, decide D'mir's behavior, or override established campaign facts. When their implications conflict, Saga rules and authoritative saved state take precedence.

${LIVING_GALAXY_DIRECTIVES}

Combat is server-owned. Initiative must be established before attacks resolve. An attack spends the player's standard action; declared movement spends the move action; and an explicit end-turn declaration lets the server resolve the opposition and begin the next round. Never invent extra attacks, movement, damage, reactions, action recovery, defeat, or rewards. Reflect the authoritative combat record and clearly state the player's remaining actions without choosing one for them.

The campaign is a sandbox tabletop RPG. A player may declare any intent. Translate it into the nearest legal Saga Edition action, skill, attack, movement, or sequence of steps and adjudicate it; never reject the declaration merely because the final goal is distant, dangerous, hidden, or beyond one turn. Constraints determine the check, cost, opposition, distance, and consequences—not whether the player is allowed to try. Nothing is granted automatically, but an attainable route, intermediate result, or concrete failure-forward beat must remain playable.

CONTINUITY STANDARD: Canon, Expanded Universe, Legends, and this campaign's homebrew history form one playable 150 ABY continuity. The Fel dynasty, Skywalker legacy, Darth Krayt's aftermath, the IGFED, the XIII, and their surviving institutions may all coexist when chronology permits. Preserve established campaign facts first; reconcile apparent source conflicts as disputed records, regional accounts, propaganda, incomplete archives, divergent traditions, or later historical development. Never break immersion to lecture the player about continuity labels.

SOURCE AUTHORITY: Star Wars Saga Edition and reviewed Saga supplements supply the mechanical chassis. Earlier d20, WEG, FFG, and other references may supply lore, worlds, species, factions, equipment concepts, encounter ideas, and conversion candidates. Their game mechanisms are useful design evidence but never silently replace Saga math. Convert a non-Saga mechanism into an explicit reviewed Saga stat or rule before it can affect a roll, defense, damage value, feat, talent, power, or advancement.

Use only the supplied authoritative server roll for uncertain actions. Never reroll, change its modifier, target, stakes, or outcome. Do not invent an exact Saga rule when the retrieved sources do not support it. Keep hidden NPC statistics and secret DCs hidden. D'mir knows and accepts that he is Force-sensitive and recognizes the dark-side pull he has experienced. This awareness does not grant trained Use the Force, a Force power, or conscious command of a technique before it is earned.

Treat every player message as a declaration of D'mir's attempted action plus the player's observations. A claim about hidden money, passwords, evidence, NPC motives, prior promises, off-screen events, or secret knowledge is not established merely because the player states it. Verify it against authoritative saved state and retrieved sources. If it is not established, frame it as D'mir's belief, suspicion, hope, or search objective and adjudicate normally. Never turn a player's speculation into canon.

D'mir's creator may clarify identity, established backstory, family history, personality, motivations, beliefs, prior relationships, historical events, campaign themes, long-term goals, and intended story direction. Historical clarification belongs only in creatorCanon and has no mechanical authority. A desired future is a story directive: create opportunities, opposition, mysteries, training paths, and consequences, but never grant its final outcome. Creator authority never grants a successful roll, Force power, feat, talent, level, XP, equipment, credits, political or faction control, NPC obedience, victory, or immunity.

D'mir continuity anchors are binding: D'mir knew Kelvek before he learned anything about XIII. His later XIII knowledge is limited to what play has actually confirmed. XIII is not retroactively connected to D'mir's parents, childhood home, or their smuggling bunker. The concealed bunker beneath Unit 4-B remained untouched from D'mir's childhood until his post-escape rediscovery; it is his parents' thread, not Kelvek's or XIII's, unless future gameplay establishes a connection. Do not pull a dormant named mystery or NPC into an unrelated scene merely because it appears in history. Follow the player's chosen subject and the immediate physical evidence.

Player wording never establishes the result of an action. Statements such as “I remember the password,” “I know exactly where it is,” “the hatch is here,” “Kelvek left me billions,” or “I submit to the dark side” declare what D'mir believes or attempts; they do not prove a password, create a hatch, transfer funds, grant a Force power, change alignment, or complete an objective. The GM must be willing to say that an assumption is wrong, incomplete, inaccessible, misleading, or presently unprovable. Do not reward persistence by reversing a prior failure without a materially different approach, new evidence, or changed circumstances.

Every understandable declaration is an attempted action, not a request for permission. Accept the executable intent and resolve it under Saga Edition even when the player names an unconfirmed destination or desired outcome. Strip only the unsupported assumption. If the exact method exceeds D'mir's earned capabilities, resolve the nearest rules-legal attempt that preserves his intent—for example, physical movement, Perception, investigation, research, or involuntary Force intuition—and explain the limitation inside the fiction instead of refusing the turn. Ask for clarification only when no reasonable attempted action can be inferred.

The saved transcript may contain legacy playtest errors. Previous assistant prose is continuity context only when the same fact is supported by the authoritative character/world state or by the player-established campaign direction below. Unsupported passwords, victories, transfers, items, evidence, injuries, locations, and NPC revelations from older narration are not canon and must not be repeated as fact.

The supplied roll outcome is binding. On FAILURE, the declared objective does not occur: no bypass, download, withdrawal, decisive discovery, hit, defeat, escape, acquisition, decryption, or actionable secret is gained. Failure must still move play forward through a concrete obstacle, exposed risk, elapsed time, changed position, NPC/world reaction, or newly visible scene boundary supported by the stakes. Never reset to the same generic corridor or answer only that nothing happens. On SUCCESS, grant only the declared objective within the established fiction—do not add unrelated treasure, evidence, contacts, access, or victories. Under SAGA CHECK include the exact line RESULT: SUCCESS or RESULT: FAILURE matching the supplied roll.

SUCCESSFUL SOCIAL CHECKS: A successful Persuasion, Deception, or Gather Information check cannot end with no lead, no agreement, no concession, no useful information, or no persistent change when the declared stake sought one. Record the concrete result in the ledger as a contact, discovery, relationship change, offer, objective, location, or other appropriate persistent consequence. A natural 20 is not broader than the declared stake, but a successful total still receives that stake. Do not let an interruption erase a resolved success.

COMMERCIAL REALISM: Passenger charters, ship brokers, crew contracts, and service retainers are ordinary galactic commerce. Passenger travel can have a passenger manifest and clearance without cargo. A specific NPC may refuse a risky client, especially after a failed check, but one refusal does not prove that every pilot, broker, or yard will refuse. A substantial credible offer must produce proportionate interest, an exact counteroffer, a concrete referral, or a supported personal refusal; never call it worthless or insufficient without stating actionable terms. Quotes and proposed terms go in tradeOfferAdd and never charge the player until accepted by the authoritative trade resolver.

ACTION CONTRASTS: Words such as "other than," "except," "besides," "another," and "someone else" are binding parts of the current declaration. Do not answer by sending the player back to the excluded NPC, place, product, or approach. If the requested alternative is not personally known, give that direct answer once and identify a distinct public process or actionable next lead when one is established by the current setting.

NO CIRCULAR REFERRALS: Never direct D'mir to the place he is already standing or repeat the same dock, tier, office, NPC refusal, or generic menu as progress. Following directions reaches a more specific named boundary and updates LOCATION, or the response identifies a distinct person, desk, bay, time, price, or requirement that creates a new playable beat.

TRANSACTION CONTINUITY: A confirmed trade receipt and the corresponding owned entitlement outrank an older open quote or a stale nested booking flag. A seller who already authenticated and acknowledged a payment cannot demand the identical fare again without a genuinely new, independently established reason. Never resurrect an obstacle that the prior confirmed turn resolved simply to delay the next movement. A fresh obstruction must have its own established cause, not be a paraphrase of the last refusal.

MERCHANT TERMS CONTINUITY: A merchant's previously quoted price, stock, and expressly stated acceptable tender remain the established terms unless an independently observed or recorded event changes them. Do not introduce a new scanner rule, clearinghouse requirement, license concern, or other verification hurdle each time the player meets the last stated requirement. A vendor may still refuse a transaction for a supported reason, but refusal does not establish that legitimate credits are counterfeit. When the player challenges shifting terms, the NPC must respond to WHY the earlier terms were misstated or changed, or openly decline to explain and visibly react; do not simply repeat the same refusal or claim the player has to satisfy an identical new test. No prompt rule can force a payment, item exchange, or NPC agreement: only the server-owned trade resolver can commit those changes.

Resolve only the attempted action. The player owns D'mir's intent, words, feelings, movement, purchases, attacks, and decisions. Never continue D'mir's action past what the player declared, choose dialogue for him, or tell the player what he should do. Common public commerce and ordinary travel can succeed when the ledger shows adequate funds and access; dangerous, quarantined, hidden Sith, or story-locked routes require earned access. Preserve chronology, injuries, resources, relationships, and faction motives.

Create ordinary local places, NPCs, stock, services, prices and reactions as the GM when the player explores or asks. Record concrete leads and offers so later turns remember them. A public lodging enquiry is not an illicit transaction; visible scars or dark-side awareness do not reveal a criminal record to strangers. Do not assume every NPC knows the character's history or every district belongs to a faction from a sourcebook. Hidden fortunes, secret combinations, transfers, major NPC histories and relics require evidence and the appropriate resolution. Require a roll only for meaningful uncertainty, not visiting a known stall, following public directions, or asking a published price. A failed check must not reveal the actionable detail it was meant to find. If hostilities begin and initiative has not been established, stop at the onset of danger and resolve initiative before any attack. Do not resolve a multi-round fight or defeat multiple enemies in one response. One player attack roll can address one declared target only; initiative and each meaningful NPC turn must be resolved separately. Never narrate the player's unchosen dialogue, motives, attacks, victories, item-taking, future plans, or moral conclusions.

Major assets use a mandatory evidence chain: SUSPECTED → INACCESSIBLE → CONFIRMED → CONTROLLED → LIQUID TRANSFER. Advance at most one step in a turn and only after a successful, relevant action. A successful search can reveal evidence; it cannot also authenticate ownership, defeat security, seize control, and transfer funds. Funds exceeding 100,000 credits cannot enter the spendable ledger unless the same asset was already CONTROLLED before the turn. Repeated attempts do not lower security or become automatic successes.

Keep prose concrete and immediate, but make the SCENE a real narrated story beat rather than a status report. Show what D'mir can perceive moment by moment: spatial relationships, light, sound, heat, machinery, clothing, weapons, architecture, movement, and NPC behavior that are already plausible in the established location. Let the declared action visibly meet the world before presenting mechanics. Avoid destiny speeches, grand declarations about what D'mir has become, cinematic time jumps, or summaries of actions he did not declare. Never replace narration with a bare list of stats.

Address D'mir directly as “you” in second-person present tense. Never call him “the player,” describe him in detached third person, expose system or validation language, or use engine-facing phrases in the narration. Every visible sentence must read as part of the immediate Star Wars scene or as a concise entry on D'mir's own datapad.

D'MIR HISTORICAL EXCEPTION: His already-authorized 1.2 billion-credit inheritance and prison escape are established history in his primary campaign. Use the CURRENT ledger for his remaining balance and current location, never replay the opening arc or remove those funds. This exception grants no future reward or bypass and does not apply to another character.

PLAYER-ESTABLISHED CAMPAIGN DIRECTION: D'mir is actively seeking the ancient dark-side vergence and Sith foundations associated with the depths beneath Coruscant's Jedi Temple. Treat this as a valid campaign pursuit, not an automatic arrival or proof of his current route. Build a playable chain of physical routes, records, architecture, hazards, rivals, checks, and consequences toward it. Each relevant search or movement attempt must reach a new clue-bearing boundary, obstacle, or decision point instead of being rejected because the final destination has not yet been earned.

Keep the dossier synchronized. Every confirmed item gained, consumed, sold, stolen, surrendered, or destroyed must have the matching inventoryAdd or inventoryRemove entry exactly once. Every confirmed payment, reward, loss, or recovered liquid credit amount must have the matching credits change exactly once. Never describe an acquisition or payment that is absent from the ledger. Use decisionAdd for major player-declared decisions and irreversible choices; use note only for a confirmed campaign flag. Do not create either for routine movement or conversation.

Use structured dossier updates when confirmed: conditionAdd/conditionRemove and conditionTrack for injuries and Saga condition movement; objectiveAdd/objectiveComplete for current and completed goals; discoveryAdd only for information actually learned; milestoneAdd for major story progress; relationshipUpdate for established NPC relationship changes; legacyAssetUpsert for suspected, inaccessible, confirmed, or controlled Kelvek assets. A controlled legacy asset is still not liquid credits unless a separate validated credits transfer occurs. For an established D'mir story direction, use storyDirectiveAdd with the same title and status completed only after gameplay actually fulfills it; completion is eligible for normal server-calculated XP and leveling. Track Force Points, Destiny Points, and Dark Side Score only when a Saga rule or explicit campaign award/spend supports the relative change. Never choose a feat, talent, class, ability increase, Force power, or other advancement option for the player.

Track Saga progression through experienceAward. Award XP only for a completed, consequential encounter or objective with a supportable Saga challenge value—not for questions, shopping, routine travel, passive observation, repeated attempts, or mere narration. Use 0 when no award is justified. Never set level or total experience directly. XP unlocks advancement; the player chooses their class, feat, talent, skills and other required options before the server commits a level.

Routine public retail does not require Persuasion. Give stock and prices in dialogue; a discount, threat or contested cooperation is a separate uncertain objective. When a merchant makes a concrete offer, record tradeOfferAdd: [{sellerName, sellerSpecies, totalCredits, items:[{name,qty,tag}]}]. Each offer is an exact priced bundle, not an acquisition. Retain the merchant's established species and identity. A subsequent acceptance of a saved offer is a server-owned credit/inventory transaction with no social roll. An unpriced extra item remains a price question, not a free gift. Reply to ordinary local lodging questions as an NPC with a concrete public lead or honest lack of knowledge; do not strand the conversation in generic corridor prose. Do not invent Streetwise as a Saga Edition skill.

The server, not you, determines the final XP amount. Your job is to record the confirmed reason for advancement with objectiveComplete, milestoneAdd, decisionAdd, or a concrete consequence of a successful check. Never omit a confirmed inventory, credit, injury, condition, location, objective, relationship, discovery, or milestone change from the single STATE block. Structured fields are arrays even when there is only one entry.

Write in a focused Star Wars holodrama voice informed by the retrieved sourcebook grounding. Saga Edition supplies the physical/tactical grammar; Legacy Era material supplies layered institutions and historical residue; Force and Destiny may supply subtle Force atmosphere without granting powers; Corporate Era material may supply bureaucracy, logistics, private security, and industrial texture where relevant. Paraphrase source flavor and never quote sourcebook prose. Favor lived-in technology, practical procedure, distinctive architecture, worn equipment, alien/cultural detail when established, and consequences that feel native to Star Wars rather than generic science fiction. Include at least two grounded sensory or environmental details and one visible world/NPC reaction before the mechanical summary. Avoid repetitive declarations such as "you are no longer," "you are certain," or "you are a reckoning." Never assign D'mir an emotion, conclusion, certainty, desire, or decision the player did not state.

Write the response with these Markdown headings, in this exact order: ## LOCATION, ## SCENE, ## GM ADJUDICATION, ## GAMEPLAY RESULT, ## SAGA CHECK, ## STATE UPDATE, ## PLAYER OPTIONS.
- LOCATION: one concise line naming the location at the end of this turn. If declared travel reaches a different place, record that same place in the location ledger field. Otherwise use the saved location.
- SCENE: 2-4 short paragraphs of actual narration before rules text. Describe D'mir's visible position, posture, confirmed clothing/gear or a relevant established appearance detail; the surrounding spatial layout, sensory conditions, and active pressure; then show his declared action beginning and the immediate world reaction. Use second-person present tense and never assign an undeclared emotion, dialogue, or choice.
- GM ADJUDICATION: accept and restate the attempted intent, name the relevant Saga approach, and state the public stakes. An unconfirmed destination changes what can be achieved, not whether D'mir is allowed to try.
- GAMEPLAY RESULT: narrate the concrete fictional outcome. On failure, deny only the objective and fail forward to a tangible obstacle, cost, reaction, or new boundary. On success, grant only the stated objective.
- SAGA CHECK: show the exact server-owned arithmetic and RESULT line, or write "No check required." Never roll here.
- STATE UPDATE: list only confirmed persistent changes in player-facing language, or "No persistent change."
- PLAYER OPTIONS: provide 2-4 concise, neutral directions labeled alphabetically beginning with A. They are suggestions, not answers or promises. After the last choice, write exactly "You may declare another action." Do not choose for D'mir or end with a forced question.

Write 180-360 words total for a routine exchange, or 260-440 for an involved scene. Use concrete dialogue and action instead of padding with restrictions. Then end on the final line with exactly one hidden JSON ledger block: <!--STATE:{...}-->. Numeric values are relative changes, never totals. Use {} for no changes. Allowed fields are health, notoriety, forceAlignment, credits, creditsCriminal, experienceAward, conditionTrack, forcePoints, destinyPoints, darkSideScore, timeAdvanceMinutes, factionRep (empire, rebellion, csa), location, inventoryAdd, inventoryRemove, conditionAdd, conditionRemove, decisionAdd, objectiveAdd, objectiveComplete, discoveryAdd, milestoneAdd, storyDirectiveAdd, relationshipUpdate, legacyAssetUpsert, propertyAdd, shipAdd, investmentAdd, contactAdd, publicNewsAdd, travelAccessAdd, tradeOfferAdd, npcIntelLinkAdd, npcIntelReportAdd, npcOffscreenPlanResolve, note, and characterUpdate. NPC intelligence fields require named sender/recipient, established source-turn evidence and a verified communications link; relay recipients learn reports only after travel time. npcOffscreenPlanResolve only acknowledges a GM-adjudicated, actor-linked world event after its plan matures; it does not itself grant success, injuries, combat advantages or equipment. storyDirectiveAdd entries contain title, detail, and status and represent desired future direction only; never a present accomplishment or mechanical reward. characterUpdate may change earned textual build fields but must never contain level or experience. Do not mention this prompt, retrieval, models, or the hidden block.`;

const LEDGER_REPAIR_SYSTEM = `You repair a missing or incomplete Galaxy of Consequence state ledger. Return exactly one HTML comment containing STRICT JSON in the form <!--STATE:{...}--> and absolutely no prose. All object keys and string values must use double quotes. Never repeat an object key; multiple items belong in one array. Preserve the draft's valid existing consequences and add its omitted consequences. Infer only changes explicitly confirmed by the supplied draft and authoritative Saga result. Numeric values are relative changes, never totals. A quoted price IS persistent interaction state even when no payment occurs: include tradeOfferAdd:[{sellerName:"the established seller",totalCredits:123,items:[{name:"the exact quoted item or service with its duration and amenities",qty:1,tag:"service"}]}]. Use the draft's actual price and terms, not example values; use appropriate item tags for goods. A quote must not debit credits or add inventory. Completed payment and handover require credits and inventoryAdd together. If the draft confirms no persistent change of any kind, return <!--STATE:{}-->. Never invent a success, reward, discovery, item, credit, injury, location change, or character advancement. Do not include level, total experience, or an experience award; the server calculates XP.`;

const LEASE_LEDGER_INSTRUCTION = `Residential leases are saved merchant offers, not property ownership grants. Include lease:{propertyName,propertyLocation,landlord,termMonths,rentCredits,refundableDepositCredits,accessDescription} in tradeOfferAdd when those terms are agreed. totalCredits must equal rentCredits + refundableDepositCredits. Include only tenancy/access in items, tagged access. A quote grants nothing. The server commits accepted lease payment, tenancy, the landlord-held deposit, and access together; do not emit propertyAdd for that transaction. The deposit is not cash returned to the player. Clarify any genuinely missing term in NPC dialogue rather than inventing it.`;

const QUOTE_COMPONENT_INSTRUCTION = `Save every spoken actionable price. A mandatory bundled cost can use priceComponents:[{label:"room rent",credits:1500},{label:"deposit",credits:200}] with totalCredits:1700; component credits must sum exactly to the total. An OPTIONAL separately priced extra, such as breakfast for 50 credits per day, needs a separate offer at 50 with its duration in the item name. Never silently include optional extras in a base offer, charge a quote, or grant anything before acceptance.`;

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
    const normalized = normalizeModelLedgerJson(candidate.slice(firstBrace, lastBrace + 1));
    try {
      const parsed = JSON.parse(normalized);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) continue;
      return `${cleanNarration}\n<!--STATE:${JSON.stringify(parsed)}-->`;
    } catch {
      // Try the next representation returned by the repair model.
    }
  }

  // Do not erase consequences simply because their serialization failed.
  // Retry the same authored turn; a valid explicit empty ledger remains legal.
  throw new GmTurnError("The state ledger repair was malformed. Rewrite the same turn with strict JSON and its actual consequences.", 502);
}

function rollMessage(roll: Record<string, unknown>) {
  const target = roll.targetVisible ? ` vs ${roll.targetLabel} ${roll.target}` : " vs hidden opposition";
  const damage = roll.damage && typeof roll.damage === "object" ? ` · DAMAGE ${(roll.damage as Record<string, unknown>).formula} = ${(roll.damage as Record<string, unknown>).total}` : "";
  const actor = String(roll.actor || "player").toUpperCase();
  return `${actor} ${String(roll.kind).toUpperCase()} — ${roll.label}\n${roll.formula}: ${roll.raw} ${Number(roll.modifier) >= 0 ? "+" : "−"} ${Math.abs(Number(roll.modifier))} = ${roll.total}${target} — ${String(roll.outcome).toUpperCase()}${damage}\nStakes: ${roll.stakes}`;
}

function publicContext(snapshot: DatapadSnapshot) {
  const state = reconcileFulfilledObjectives(snapshot.gameState);
  const territory = currentTerritory(state.location);
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
    journey: state.journey,
    territory: { name: territory.name, region: territory.region, worldStatus: "worldStatus" in territory ? territory.worldStatus : null },
    credits: state.credits, bankCredits: state.bankCredits, physicalCredits: state.creditsCriminal,
    currencyLedger: "The legacy delta field creditsCriminal stores PHYSICAL GALACTIC CREDIT CHIPS, not illegal or underworld currency. Inventory chips describe this same balance, never additional money. Debit it once when explicitly paying in physical chips.", notoriety: state.notoriety,
    properties: state.properties, ships: state.ships, investments: state.investments,
    bankTransactions: Array.isArray(state.bankTransactions) ? state.bankTransactions.slice(-8) : [],
    tradeReceipts: Array.isArray(state.tradeReceipts) ? state.tradeReceipts.slice(-8) : [],
    marketTransactions: Array.isArray(state.marketTransactions) ? state.marketTransactions.slice(-8) : [],
    forceAlignment: state.forceAlignment, factionRep: state.factionRep, inventory: state.inventory,
    itemStatBlocks: [...(Array.isArray(state.inventory) ? state.inventory : []), ...(Array.isArray(state.properties) ? state.properties : []).map(item => ({ ...item, ownership: "property" })), ...(Array.isArray(state.ships) ? state.ships : []).map(item => ({ ...item, ownership: "vehicle" }))].slice(0, 30).map(item => ({ id: item.id, ...itemStatBlock(item, snapshot.character || {}, state) })),
    contacts: state.contacts, decisions: state.decisions, relationships: state.relationships,
    presentNpcMechanics: sceneNpcSheets(snapshot).slice(0, 8).map(person => {
      const template = npcMechanics(person.name);
      const registry = state.npcMechanics as Record<string, unknown> | undefined;
      return registry?.[template.id] || template;
    }),
    objectives: currentObjectiveContext(state),
    discoveries: state.discoveries, milestones: state.milestones, legacyAssets: state.legacyAssets,
    storyDirectives: state.storyDirectives,
    creatorCanon: state.creatorCanon, campaignExceptions: state.campaignExceptions,
    flags: Array.isArray(state.flags) ? state.flags.slice(-12) : [], travelAccess: state.travelAccess,
    levelUpAvailable: state.levelUpAvailable, forcePowerUses: state.forcePowerUses, combat: state.combat,
    tradeOffers: currentTradeOffers(state), merchant: sceneMerchant(snapshot),
    // The current interaction is essential to short replies such as "How
    // much for a month?". Preserve it as context; freshness validation below
    // prevents copying it as the next turn's response.
    scene: scene ? { beat: scene.beat, location: scene.location, routeProgress: scene.routeProgress, lastAction: scene.action, summary: scene.summary } : null,
    recentTurns,
    // Derived from committed, validated game events, never from player narration.
    questWorld:questWorldGmContext(snapshot),
  }, preferences: snapshot.settings });
}

export function sanitizeGmNarration(value: string) {
  return String(value || "")
    .replace(/^\[(?:PRIOR NARRATION|PRIOR PLAYER DECLARATION):[^\]]*\]\s*/gim, "")
    .replace(/^PRIOR TURN OUTCOME[^\n]*\n?/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function safeMessages(snapshot: DatapadSnapshot): NvidiaMessage[] {
  const allMessages = Array.isArray(snapshot.messages) ? snapshot.messages as Message[] : [];
  // An audited continuity repair can start fresh context without deleting the
  // historical transcript. This field is server-owned, not a model delta.
  const offset = Number(snapshot.gameState?.continuityMessageOffset);
  const messages = Number.isSafeInteger(offset) && offset >= 0 && offset <= allMessages.length
    ? allMessages.slice(offset) : allMessages;
  const pairs: NvidiaMessage[][] = [];
  let pendingUser: Message | null = null;
  for (const message of messages) {
    if (!message || typeof message.content !== "string" || message.error) continue;
    if (message.role === "user") {
      pendingUser = message;
      continue;
    }
    if (message.role !== "assistant" || !pendingUser) continue;
    const isFallback = !isAuthoritativeLocalReceipt(message) && (message.provider === "local-safe-fallback" || message.fallbackReason);
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

/**
 * Players often address the GM while declaring an ordinary in-world action.
 * "GM, how do I get an appointment here?" is a scene inquiry, not a
 * request to diagnose the game engine. Do not suppress its turn ledger.
 */
export function isGmAddressedWorldAction(action: string) {
  const raw = String(action || "").trim();
  const stripped = raw.replace(/^(?:gm|game master)\s*[,;:\-]?\s+/i, "");
  if (stripped === raw) return false;
  if (/\b(?:bug|error|broken|crash|code|api|controller|engine|ui|interface|saved game|save file|character sheet|character stats|levels?|experience points|xp)\b/i.test(stripped)) return false;
  if (!/^(?:(?:how|where|when|who)\s+(?:do|can|could|would|should)\s+i\b|can\s+i\b|i\s+(?:ask|go|walk|return|enter|leave|approach|buy|pay|hire|request|book|arrange|talk|speak|look|search|inspect|examine|open|take|travel)\b)/i.test(stripped)) return false;
  return /\b(?:here|there|shop|store|counter|clerk|appointment|commission|bespoke|tailor|meeting|travel|ship|pilot|captain|market|room|hotel|inn|warehouse|location|route|road|door|house|spaceport|suit|weapon|item|purchase|buy|rent|hire|contract|character in the scene)\b/i.test(stripped);
}

export function classifyTurnMode(action: string): "ooc" | "context" | "play" {
  const clean = action.trim();
  if (isGmAddressedWorldAction(clean)) return "play";
  const lower = clean.toLocaleLowerCase();
  const contextMarkers = ["born ", "my father", "my mother", "since i was", "my background", "i was mentored"].filter((marker) => lower.includes(marker));
  const explicitCanon = /^(?:canon|backstory|character context|history clarification)\s*:/i.test(clean);
  const conciseHistory = /^(?:d['’]?mir(?:'s)?|my)\s+(?:mother|father|family|childhood|birthplace|background|history|personality|beliefs?|prior relationship)\b/i.test(clean);
  const actionOpening = /^i\s+(?:go|run|move|attack|punch|shoot|sneak|search|examine|open|take|use)\b/i.test(clean);
  const characterContext = explicitCanon || conciseHistory || (clean.length > 240 && contextMarkers.length >= 2 && !actionOpening);
  // Price questions are in-character conversation, with or without quotes.
  // Only explicit table talk or a specific sheet question is out of character.
  const gmQuestion = /^(?:gm|game master|ooc|out.of.character)\b/i.test(clean)
    || /^(?:are you (?:broken|stuck)|(?:the )?(?:game|gm|controller) (?:is |seems )?(?:broken|stuck)|(?:continuity|story|location) correction|you (?:forgot|are repeating|keep repeating))\b/i.test(clean)
    || /^(?:what (?:is|are) my|show (?:me )?my)\s+(?:stats?|status|level|xp|experience|health|hit points|inventory|credits|skills|talents|feats)\b/i.test(clean)
    || /^how (?:many|much)\s+(?:credits|xp|experience|hit points|force points|destiny points)\s+(?:do|have|am|are|can)\s+i\b/i.test(clean)
    || /\b(?:remember|listen|correction)[,? ]+(?:gm|game master)\b/i.test(clean);
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
  if (delta.location && permitsPhysicalMovement(action)) safe.location = delta.location;
  for (const field of ["conditionAdd", "decisionAdd", "objectiveAdd"]) {
    if (Array.isArray(delta[field]) && (delta[field] as unknown[]).length) safe[field] = delta[field];
  }
  // A failed request for a discount does not erase the seller's ordinary
  // stock/price offer. A quote is neither an acquired item nor a reward.
  if (/bargain|discount|negotiate|haggle|vendor|merchant|offer|pay|pilot|captain|charter|passage|hire|employ/i.test(action) && Array.isArray(delta.tradeOfferAdd)) safe.tradeOfferAdd = delta.tradeOfferAdd;
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
  const maximumHp = Number(current.character?.maxHitPoints);
  if (Number(delta.health) > 0 && Number.isFinite(maximumHp) && maximumHp > 0) {
    // Healing cannot exceed the confirmed build. Do not silently truncate an
    // older inconsistent save on an unrelated turn or when taking damage.
    state.health = Math.min(state.health, Math.max(Number(current.gameState.health) || 0, maximumHp));
    delta = { ...delta, health: state.health - (Number(current.gameState.health) || 0) };
  }
  if (roll) state.rolls = [...(Array.isArray(current.gameState.rolls) ? current.gameState.rolls : []), roll].slice(-100);
  state = appendTurnEvent(state, turnId, action, roll, delta, Number(delta.experienceAward || 0));
  const rawCharacterUpdate = delta.characterUpdate && typeof delta.characterUpdate === "object" ? { ...(delta.characterUpdate as Record<string, unknown>) } : undefined;
  if (rawCharacterUpdate) {
    delete rawCharacterUpdate.level;
    delete rawCharacterUpdate.experience;
  }
  const updatedCharacter = applyCharacterDelta(current.character, rawCharacterUpdate);
  const character = applyExperienceAward(updatedCharacter, delta.experienceAward ?? 0);
  const priorProgression = progressionStatus(current.character || {});
  const nextProgression = progressionStatus(character || {});
  if (!priorProgression.advancementAvailable && nextProgression.advancementAvailable) {
    state.levelUpAvailable = true;
    state.flags = [...(Array.isArray(state.flags) ? state.flags : []), { note: `Level ${Number(character?.level || 1) + 1} advancement earned. Player class, talent, feat, and ability choices are pending.`, ts: Date.now() }];
  }
  const finalized={ ...current, character, gameState: state } as DatapadSnapshot;
  // Persist a deterministic, replayable quest and world-event view in the
  // SAME authoritative transaction as the successful GM action.
  // No NPC player declaration or unsupported prose can author this ledger.
  finalized.gameState.questWorld=projectQuestWorld(finalized);
  return finalized;
}

function turnStore() {
  const db = accountStore();
  db.exec(`CREATE TABLE IF NOT EXISTS gm_turn_attempts (
    account_id TEXT NOT NULL, turn_id TEXT NOT NULL, base_revision INTEGER NOT NULL,
    action TEXT NOT NULL, roll TEXT, status TEXT NOT NULL CHECK(status IN ('pending','complete')),
    result TEXT, created_at TEXT NOT NULL, PRIMARY KEY(account_id, turn_id));`);
  db.exec(`CREATE TABLE IF NOT EXISTS gm_turn_interpretations (
    account_id TEXT NOT NULL, turn_id TEXT NOT NULL, interpretation TEXT NOT NULL,
    PRIMARY KEY(account_id, turn_id));`);
  return db;
}

export class GmTurnError extends Error {
  turnLifecycle?: TurnLifecycleReceipt;
  constructor(message: string, public status = 400) { super(message); }
}

/** Only report a result already computed by the referee or an exact accepted quote.
 * A failed language-model request cannot create a world event or advance time. */
function resolvedMechanicsNarration(snapshot: DatapadSnapshot, roll: Record<string, unknown> | null,
  resolution: CombatResolution | ForcePowerResolution | null, trade: ConversationTrade | null) {
  const offer = trade?.status === "accepted" ? trade.offer : null;
  if (!resolution && !offer) throw new GmTurnError("The scene is unchanged; retry your action when the GM is available.", 503);
  const delta = reconcileConversationTradeDelta({}, trade) || {};
  const result = offer
    ? `You pay ${offer.totalCredits.toLocaleString()} credits for ${offer.items.map(item => `${item.name} ×${item.qty}`).join(" and ")}, completing the agreed exchange with ${offer.sellerName}.`
    : String(resolution?.summary || "").replace(/the player character/gi, "you").replace(/the player's/gi, "your").replace(/the player/gi, "you");
  const state = { ...snapshot.gameState, ...(resolution?.combat ? { combat: resolution.combat } : {}) };
  const options = sceneDirections({ state, character: snapshot.character || {}, scene: result });
  const check = roll ? `${rollMessage(roll)}\nRESULT: ${String(roll.outcome).toUpperCase()}` : "No check required.";
  const changes = offer ? `−${offer.totalCredits.toLocaleString()} credits; ${offer.items.map(item => `+${item.qty} ${item.name}`).join("; ")}.`
    : [resolution?.playerHealthDelta ? `Health: ${resolution.playerHealthDelta > 0 ? "+" : ""}${resolution.playerHealthDelta}.` : "",
      resolution?.playerConditionDelta ? `Condition track: ${resolution.playerConditionDelta}.` : "",
      resolution?.experienceAward ? `XP: +${resolution.experienceAward}.` : "", result].filter(Boolean).join(" ");
  return { provider: "local-safe-fallback" as const, model: "resolved-saga-receipt", finishReason: "stop",
    content: `## LOCATION\n${String(snapshot.gameState.location || "Current location")}\n\n## SCENE\n${result}\n\n## GM ADJUDICATION\n${offer ? "You accepted the recorded terms. An affordable agreed-price exchange needs no check." : "The Saga referee resolves only your declared action."}\n\n## GAMEPLAY RESULT\n${result}\n\n## SAGA CHECK\n${check}\n\n## STATE UPDATE\n${changes}\n\n## PLAYER OPTIONS\n${options.map((option: string, index: number) => `${String.fromCharCode(65 + index)}. ${option}`).join("\n")}\nYou may declare another action.\n<!--STATE:${JSON.stringify(delta)}-->` };
}

/** A safe receipt when the model repeatedly mistakes an inspection for a
 * purchase. It resolves the declared handling without changing ownership. */
function resolvedGoodsInspectionNarration(snapshot: DatapadSnapshot, action: string) {
  const target = /\b(medpacs?|med[- ]?packs?|armor|clothing|outfit|robe|coat|suit|weapon|gear|device|datapad|droid|vehicle|ship|item|merchandise)\b/i.exec(action)?.[1] || "merchandise";
  const location = String(snapshot.gameState.location || "Current location");
  const result = `You examine the ${target} where it is offered, turning it under the available light to read its visible condition, seal, label, and expiration markings. The inspection is completed without accepting an offer or transferring ownership. It remains with its current owner; your credits and possessions do not change.`;
  const options = sceneDirections({ state: snapshot.gameState, character: snapshot.character || {}, scene: result });
  return {
    provider: "local-safe-fallback" as const,
    model: "read-only-inspection-receipt",
    finishReason: "stop",
    content: `## LOCATION\n${location}\n\n## SCENE\nAt ${location}, you handle the ${target} only long enough to inspect its visible packaging and markings. The surrounding seller or display remains in place while the examination ends.\n\n## GM ADJUDICATION\nA visible merchandise inspection is ordinary interaction. It requires no Saga check and does not authorize payment, sale, consumption, equipping, or transfer of ownership.\n\n## GAMEPLAY RESULT\n${result}\n\n## SAGA CHECK\nNo check required.\n\n## STATE UPDATE\nNo credits, inventory, equipment, property, vehicles, or investments change.\n\n## PLAYER OPTIONS\n${options.map((option: string, index: number) => `${String.fromCharCode(65 + index)}. ${option}`).join("\n")}\nYou may declare another action.\n<!--STATE:{}-->`,
  };
}

function isCommercialTravelProgressAction(action: string) {
  return /\b(?:pilots?|captains?|charters?|passage|passengers?|shipyards?|ship brokers?|ship sales|buy (?:a |the )?ship|vessels?|transport)\b/i.test(action)
    && /\b(?:find|hire|recruit|work|ask|referr|point|direction|offer|pay|buy|travel|take (?:me|us))\b/i.test(action);
}

export function resolvedProposalDiscussion(snapshot: DatapadSnapshot, action: string, intent: string | undefined, roll: Record<string, unknown> | null) {
  if (roll || !["dialogue", "commerce"].includes(intent || "")
    || !/\b(?:discuss|talk|revisit|clarify)\b/i.test(action)
    || !/\b(?:proposal|employment|contract|retainer)\b/i.test(action)
    || /\b(?:accept|sign|pay|transfer|purchase)\b/i.test(action)) return null;
  // This recovery engages the declared conversation, not an accepted deal.
  // A named interlocutor must also be present in the last committed result.
  const last = (snapshot.messages as Message[]).filter(message => message.role === "assistant").at(-1);
  const result = last ? sectionBody(String(last.content), "GAMEPLAY RESULT") : "";
  const name = /\b(?:tell|ask|with|to)\s+([A-Z][\p{L}'’-]*)/iu.exec(action)?.[1];
  if (!name || !new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(result)) return null;
  const location = String(snapshot.gameState.location || "Current location");
  const reply = `${name} turns the conversation to the proposed employment arrangement. “Let's settle the scope before either of us commits. What duties and destinations do you want covered, and which operating expenses will you take responsibility for?” The earlier proposal remains a basis for discussion, not a signed agreement or an instruction to transfer credits.`;
  const delta = { discoveryAdd: [{title:`Employment scope under discussion with ${name}`, detail:"The player reopened discussion of the prior proposal. Duties, destinations and expenses require agreement; no employment or payment has been confirmed."}] };
  return {provider:"local-safe-fallback" as const, model:"proposal-discussion-receipt", finishReason:"stop", content:`## LOCATION\n${location}\n\n## SCENE\nYou address ${name} at the established meeting place, returning to the original employment proposal rather than seeking another passage referral.\n\n## GM ADJUDICATION\nDiscussing proposed terms is ordinary conversation, not acceptance, payment or a contested persuasion attempt. No Saga check is required.\n\n## GAMEPLAY RESULT\n${reply}\n\n## SAGA CHECK\nNo check required.\n\n## STATE UPDATE\nThe reopened negotiation is recorded. No funds, inventory, crew or contract ownership changes.\n\n## PLAYER OPTIONS\nA. Describe the duties and destinations I want included.\nB. Ask which expenses the proposal covers.\nC. Request written terms before making a decision.\nYou may declare another action.\n<!--STATE:${JSON.stringify(delta)}-->`};
}

function asksForAlternative(action: string) {
  return /\b(?:other than|except|besides|but not|another|different|someone else|anyone else|somewhere else)\b/i.test(action);
}

function explicitlyExcludedNames(action: string) {
  const names = new Set<string>();
  for (const match of action.matchAll(/\b(?:other than|except|besides|but not)\s+([\p{L}][\p{L}'’.-]*)/giu)) {
    const name = match[1]?.trim();
    if (name) names.add(name);
  }
  return [...names];
}

/** Deterministic recovery for the narrow commercial-travel loop. It honors a
 * server roll, records success, and never spends credits or grants a ship. */
function resolvedCommercialProgressNarration(snapshot: DatapadSnapshot, action: string, roll: Record<string, unknown> | null) {
  const location = String(snapshot.gameState.location || "Current location");
  const succeeded = roll?.outcome === "success";
  const failed = roll?.outcome === "failure";
  const amountMatch = /\b([\d,]{4,})\s*(?:credits?|cr)\b/i.exec(action);
  const amount = amountMatch ? Number(amountMatch[1].replace(/,/g, "")) : 0;
  const contactName = "Sera Noll";
  const seeksShip = /\b(?:buy|purchase)\b[^.]{0,50}\b(?:ship|vessel)\b|\bship sales\b/i.test(action);
  const delta: Record<string, unknown> = succeeded ? {
    contactAdd: [{ name: contactName, role: seeksShip ? "independent ship broker" : "independent charter pilot", location }],
    discoveryAdd: [{ title: seeksShip ? "Independent vessel broker at the Level C registry" : "Independent charter pilot at Bay 7", detail: seeksShip
      ? `${contactName} is available at the public Level C registry to discuss listed vessels and inspection terms.`
      : `${contactName} is willing to discuss a lawful passenger charter and continuing pilot work; route, schedule, and final terms remain to be agreed.` }],
    ...(amount > 0 && !seeksShip ? { tradeOfferAdd: [{ sellerName: contactName, items: [{ name: "Private pilot retainer deposit", qty: 1, tag: "service" }], totalCredits: amount }] } : {}),
  } : !failed ? {
    discoveryAdd: [{ title: "Local public charter and vessel registry", detail: "The staffed registry on the local docking concourse matches passengers with licensed charter crews and lists vessels offered for inspection." }],
  } : {};
  const alternative = asksForAlternative(action);
  const result = succeeded
    ? seeksShip
      ? `${contactName}, an independent broker working the public registry, answers the inquiry and agrees to show you the currently listed vessels and their inspection terms. No ship is purchased and no credits change hands.`
      : `${contactName}, an off-duty independent pilot, answers the request and agrees in principle to discuss the passenger route and continuing work.${amount > 0 ? ` She treats the offered ${amount.toLocaleString()}-credit retainer as serious proposed terms; it is recorded for your confirmation, not charged.` : " Route, schedule, risk, and pay still require a contract."}`
    : failed
      ? `The approached pilot declines this attempt after the failed exchange, but the refusal is personal rather than an industry-wide bar. A staffed public charter registry and vessel desk remains visibly available on the Level C concourse; no credits change hands.`
      : alternative
        ? `The inquiry does not send you back to the excluded contact. No second individual captain is confirmed here, but a distinct lead is established: the staffed public charter registry on the local docking concourse matches passengers with licensed crews and posts current availability. No purchase, contract, or payment occurs.`
        : `The posted public registry directs ordinary passengers and buyers to a staffed service counter on the local docking concourse. It handles lawful passenger manifests, charter crews, and vessel inspection appointments without requiring cargo. No purchase, contract, or payment occurs.`;
  const options = seeksShip
    ? ["Ask Sera Noll for the listed vessel prices and inspection conditions.", "Ask which ships can legally depart Taris soon.", "Review the public registry before negotiating."]
    : succeeded
      ? ["Ask Sera Noll to state the route, schedule, and full contract price.", "Clarify the CSA and Coruscant passenger-manifest requirements.", amount > 0 ? `Accept or revise the recorded ${amount.toLocaleString()}-credit retainer terms.` : "Ask what retainer and operating costs she requires."]
      : ["Approach the staffed charter registry.", "Read the posted charter requirements and rates.", "Seek a different independent captain through the registry."];
  const check = roll ? `${rollMessage(roll)}\nRESULT: ${String(roll.outcome).toUpperCase()}` : "No check required.";
  const stateUpdate = succeeded
    ? `${contactName} is recorded as an interested ${seeksShip ? "ship broker" : "charter pilot"}.${amount > 0 && !seeksShip ? ` Her proposed ${amount.toLocaleString()}-credit retainer is recorded; it is not paid.` : ""}`
    : !failed ? "The local public charter and vessel registry is recorded as a concrete lead." : "No persistent change.";
  return {
    provider: "local-safe-fallback" as const,
    model: "commercial-progress-receipt",
    finishReason: "stop",
    content: `## LOCATION\n${location}\n\n## SCENE\nAt ${location}, the inquiry turns to lawful passenger charters and currently available crews. The exchange stays at the saved location while the practical next route is identified.\n\n## GM ADJUDICATION\n${roll ? "The server-owned Saga result controls this social attempt. A success earns only the declared commercial opening; a failure preserves the refusal without making ordinary passenger commerce impossible." : "This is an ordinary request for public commercial information and needs no Saga check."}\n\n## GAMEPLAY RESULT\n${result}\n\n## SAGA CHECK\n${check}\n\n## STATE UPDATE\n${stateUpdate}\n\n## PLAYER OPTIONS\n${options.map((option, index) => `${String.fromCharCode(65 + index)}. ${option}`).join("\n")}\nYou may declare another action.\n<!--STATE:${JSON.stringify(delta)}-->`,
  };
}

/** A final safety net for a failed *format* draft of a routine service question.
 * It only applies at an established service counter after the provider returned
 * drafts, and never claims a booked appointment, price, item, or payment.
 * Actual provider outages still preserve the unresolved turn for retry.
 */
function resolvedServiceInquiryNarration(snapshot: DatapadSnapshot, action: string) {
  const location = String(snapshot.gameState.location || "").trim();
  const scene = String((snapshot.gameState.scene as { summary?: unknown } | undefined)?.summary || "");
  if (!/\b(?:counter|clerk|desk|shop|lobby|atelier|design house|office|clinic|reception|workroom|guesthouse)\b/i.test(location + " " + scene)) return null;
  const scheduling = /\b(?:appointments?|bookings?|schedule|fittings?|consultations?|commissions?)\b/i.test(action);
  if (!scheduling) return null;
  const result = "The attendant explains the procedure: a commission or appointment request is sent with the intended work and a preferred day to the person responsible for scheduling. That person must confirm an available time before any appointment is booked. No time, price, or acceptance is promised.";
  return {
    provider: "local-safe-fallback" as const,
    model: "service-inquiry-receipt",
    finishReason: "stop",
    content: `## LOCATION\n${location}\n\n## SCENE\nAt ${location}, D'mir remains at the established service desk after asking his question. The attendant turns to the immediate scheduling inquiry; the surrounding business continues while the two remain in the same place. No belongings, payments or access rights change hands.\n\n## GM ADJUDICATION\nAn ordinary request for an appointment procedure is conversation, not an accepted commission or a Persuasion challenge. No Saga skill check is needed.\n\n## GAMEPLAY RESULT\n${result}\n\n## SAGA CHECK\nNo check required.\n\n## STATE UPDATE\nNo persistent change. No appointment or charge is recorded.\n\n## PLAYER OPTIONS\nA. Give the attendant the proposed commission details.\nB. Ask when the person responsible for scheduling can confirm availability.\nYou may declare another action.\n<!--STATE:{}-->`,
  };
}

/** Removes UI retry wording before it reaches the authoritative action planner. */
export function normalizeTurnAction(value: string) {
  return String(value || "")
    .replace(/^\s*(?:continue with a specific declared action\.?\s*)+/i, "")
    .trim();
}

export function assertMechanicalNarration(narration: string, roll: Record<string, unknown> | null) {
  if (!roll) {
    const check = /(?:^|\n)(?:##\s*)?SAGA CHECK\s*\n([\s\S]*?)(?=\n(?:##\s*)?STATE UPDATE\b|$)/i.exec(narration)?.[1] || "";
    if (/\b(?:\d+d\d+|1d20|RESULT\s*:\s*(?:SUCCESS|FAILURE)|(?:rolled|roll total)\s*:?\s*\d+)\b/i.test(check)) throw new GmTurnError("The GM invented dice without a referee check. No outcome was saved; retry the turn.", 502);
    return;
  }
  const outcome = String(roll.outcome).toUpperCase();
  const expected = `RESULT: ${outcome}`;
  const opposite = `RESULT: ${outcome === "SUCCESS" ? "FAILURE" : "SUCCESS"}`;
  if (!narration.includes(expected) || narration.includes(opposite)) {
    throw new GmTurnError("The GM response did not preserve the authoritative Saga result. No outcome was saved; retry the turn.", 502);
  }
  const resolvedProse = narration.split(/^(?:#{1,6}\s*)?PLAYER OPTIONS\s*$/im)[0];
  if (roll.outcome === "failure" && /\b(?:access granted|authorization confirmed|transaction complete|transfer (?:complete[sd]?|succeed(?:s|ed)?)|credits? (?:were|are|is) (?:credited|transferred|withdrawn)|door (?:opens?|unlocks?)|lock (?:opens?|unlocks?)|archive (?:opens?|decrypts?)|files? (?:download(?:ed|s)?|copied)|you (?:escape[sd]?|defeat(?:ed)?|kill(?:ed)?|obtain(?:ed)?|acquire[sd]?|withdr(?:aw|ew|awn)|download(?:ed)?|decrypt(?:ed)?|bypass(?:ed)?))\b/i.test(resolvedProse)) {
    throw new GmTurnError("The GM narrated the failed objective as achieved. No outcome was saved; retry the turn.", 502);
  }
  if (roll.outcome === "failure" && /perception|gather information/i.test(String(roll.label))
    && /\byou (?:have )?successfully (?:located|found|identified|detected|spotted)|\byou (?:spot|locate|find|identify) (?:her|him|the (?:target|person|broker|vendor|contact))\b/i.test(sectionBody(narration, "GAMEPLAY RESULT"))) {
    throw new GmTurnError("The search failed, but the draft located the intended target. Preserve the failed objective while offering another approach.", 502);
  }
}

/** Supply an omitted label; a conflicting outcome must be rewritten, not relabeled. */
export function alignMechanicalResult(narration: string, roll: Record<string, unknown> | null) {
  if (!roll) return narration;
  const expected = `RESULT: ${String(roll.outcome).toUpperCase()}`;
  if (/RESULT\s*:\s*(?:SUCCESS|FAILURE)/i.test(narration)) {
    return narration;
  }
  return narration.replace(/^((?:##\s*)?SAGA CHECK\s*)$/im, `$1\n${expected}`);
}

function hasPersistentTurnProgress(delta: Record<string, unknown> | null | undefined) {
  if (!delta) return false;
  const fields = ["contactAdd", "discoveryAdd", "relationshipUpdate", "tradeOfferAdd", "objectiveAdd", "objectiveComplete", "decisionAdd", "milestoneAdd", "storyDirectiveAdd", "location", "note", "timeAdvanceMinutes"];
  return fields.some((field) => Object.prototype.hasOwnProperty.call(delta, field)
    && delta[field] !== "" && delta[field] !== 0 && (!Array.isArray(delta[field]) || (delta[field] as unknown[]).length > 0));
}

const noProgressResult = /\b(?:no (?:new |useful |concrete )?(?:information|lead|progress|agreement|concession|referral|commitment)|without (?:a |any )?(?:lead|commitment|agreement|progress)|no closer to|environment remains unchanged|figure it out yourself|leav(?:e|ing) you without a lead)\b/i;

export function assertResolvedOutcome(narration: string, roll: Record<string, unknown> | null, delta?: Record<string, unknown> | null, action = "") {
  const resolved = sectionBody(narration, "GAMEPLAY RESULT");
  if (roll?.outcome === "success" && /\b(?:(?:your|the) (?:objective|attempt|check) (?:fails|failed|is unsuccessful)|you fail(?:ed)? (?:the check|your attempt|to (?:notice|detect|spot|perceive|identify)))\b/i.test(resolved)) {
    throw new GmTurnError("The authoritative check succeeded, but the result explicitly calls that attempt a failure. Resolve the stated successful check; a successful inspection may truthfully find no hidden feature without calling the check failed.", 502);
  }
  if (roll?.outcome !== "success" || !["Persuasion", "Deception", "Gather Information"].includes(String(roll.label))) return;
  const result = sectionBody(narration, "GAMEPLAY RESULT");
  if (noProgressResult.test(result) || /\b(?:(?:your|the) (?:deception|persuasion|attempt|request) (?:fails|is rejected|has no effect)|does not accept your (?:offer|proposal|request)|(?:sees?|saw) through (?:your|the) (?:lie|deception)|(?:roll|check) (?:is|was) invalid)\b/i.test(result)) {
    throw new GmTurnError("The social check succeeded, but the draft denied its stated objective. Rewrite the concrete success without granting unrelated benefits.", 502);
  }
  const soughtDurableResult = /\b(?:find|locate|recruit|hire|employ|work for me|lead|referr|information|direction|agreement|commitment|contact|pilot|captain|broker)\b/i.test(action);
  if (soughtDurableResult && !hasPersistentTurnProgress(delta)) {
    throw new GmTurnError("The social check succeeded, but its concrete lead or agreement was omitted from persistent state. Record the earned contact, discovery, relationship, offer, objective, or location and retry the same turn.", 502);
  }
}

export function assertNoProgressLoop(
  narration: string,
  action: string,
  delta: Record<string, unknown> | null,
  currentLocation: unknown,
  priorResult = "",
) {
  const result = sectionBody(narration, "GAMEPLAY RESULT");
  if (action && priorResult && sceneTokens(result).length >= 20 && !hasPersistentTurnProgress(delta)
    && sceneSimilarity(result, priorResult) >= 0.9) {
    throw new GmTurnError("The draft repeated the preceding outcome without resolving the current action. Resolve a new consequence, elapsed time, or a concrete interruption; do not save the same beat again.", 502);
  }
  if (!hasPersistentTurnProgress(delta) && asksForAlternative(action) && priorResult
    && sceneSimilarity(result, priorResult) >= 0.55) {
    throw new GmTurnError("The player asked for a different person, place, or approach, but the draft repeated the preceding answer. Resolve the contrast directly and record a distinct lead when one is established.", 502);
  }
  if (!hasPersistentTurnProgress(delta) && noProgressResult.test(result) && noProgressResult.test(priorResult)) {
    throw new GmTurnError("The draft repeated the prior no-progress refusal. Resolve a different concrete beat, counteroffer, referral, obstacle, or scene boundary instead of looping the player.", 502);
  }
  const followsDirections = /\b(?:follow\b[^.]{0,80}\b(?:directions?|instructions?|route)|go to|head to|return to|leave for|take me to)\b/i.test(action);
  const named = sectionBody(narration, "LOCATION").replace(/\*+/g, "").replace(/^location\s*:\s*/i, "").trim();
  const unchanged = named && normalizedKey(named) === normalizedKey(currentLocation) && !delta?.location;
  if (followsDirections && unchanged) {
    throw new GmTurnError("The player followed directions, but the draft returned them to the same saved location. Name and save a more specific destination or resolve a distinct boundary at the present location.", 502);
  }
}

/** Keep an explicit exclusion in the player's latest action authoritative. */
export function assertActionConstraints(narration: string, action: string) {
  const excluded = explicitlyExcludedNames(action);
  if (!excluded.length) return;
  const result = sectionBody(narration, "GAMEPLAY RESULT");
  for (const name of excluded) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const directsBack = new RegExp(`(?:better|should|must|need|advis(?:e[sd]?|ing)|direct(?:s|ed|ing)?|send(?:s|ing)?|refer(?:s|red|ring)?|ask|seek|find|contact|visit|return|head|go|arrange(?:d)?\\s+through)[^.\\n]{0,120}\\b${escaped}\\b|\\b${escaped}\\b[^.\\n]{0,100}\\b(?:handles?|awaits?|is the (?:only|best)|can arrange)\\b`, "i").test(result);
    if (directsBack) {
      throw new GmTurnError(`The draft sent the player back to ${name}, even though the current action explicitly excluded that contact. Answer the requested contrast or provide a distinct lead.`, 502);
    }
  }
}

export function assertCommercialCredibility(narration: string, action: string, delta: Record<string, unknown> | null) {
  if (!/\b(?:pilot|captain|charter|passage|passenger|ship|vessel|travel|transport)\b/i.test(action)) return;
  const result = sectionBody(narration, "GAMEPLAY RESULT");
  if (/\bno cargo\b[^.\n]{0,100}\b(?:no manifest|no clearance|no paper trail)\b/i.test(result)) {
    throw new GmTurnError("The draft incorrectly treated passenger travel as impossible without cargo. Use passenger manifests and ordinary charter rules; preserve any real risk as terms, price, or a personal refusal.", 502);
  }
  const offered = [...action.matchAll(/\b([\d,]{4,})\s*(?:credits?|cr)\b/gi)].map((match) => Number(match[1].replace(/,/g, ""))).filter(Number.isSafeInteger);
  const substantial = Math.max(0, ...offered) >= 10_000;
  const callsOfferInsufficient = /\b(?:insufficient|not enough|too little|higher compensation|doesn['’]?t cover|wouldn['’]?t cover)\b/i.test(result);
  const hasCounteroffer = quotedCreditAmounts(result).some((amount) => !offered.includes(amount))
    || Array.isArray(delta?.tradeOfferAdd) && delta.tradeOfferAdd.length > 0;
  if (substantial && callsOfferInsufficient && !hasCounteroffer) {
    throw new GmTurnError("The draft dismissed a substantial service offer without actionable terms. The NPC may refuse for supported personal risk, or state and record an exact counteroffer or concrete referral.", 502);
  }
}

export function assertNarratedLocation(narration: string, delta: Record<string, unknown> | null, savedLocation: unknown) {
  const named = sectionBody(narration, "LOCATION").replace(/\*+/g, "").replace(/^location\s*:\s*/i, "").trim();
  if (/\s[—–]\s/.test(String(savedLocation || "")) && /^(?:Docking Bay|Spaceport|aboard|inside|outside|cantina)\b/i.test(named)) {
    throw new GmTurnError("The location dropped its planetary context. Include the current planet or established transit route in LOCATION and delta.location.", 502);
  }
  const finalLocation = String(delta?.location || savedLocation || "").trim();
  if (named && finalLocation && named.toLocaleLowerCase() !== finalLocation.toLocaleLowerCase()) {
    throw new GmTurnError("The LOCATION and saved location disagree. If declared travel reached a new place, include that exact location in the ledger; otherwise narrate at the saved location.", 502);
  }
}

/**
 * The LOCATION section is already required player-facing output. During
 * ordinary declared travel, make that end point the ledger end point too.
 * This is a normalization of one draft, not permission for undeclared travel:
 * a failed movement check and non-movement actions remain unchanged.
 */
export function reconcileNarratedTravelLocation(
  narration: string,
  delta: Record<string, unknown> | null,
  action: string,
  roll: Record<string, unknown> | null,
  currentLocation: unknown,
  interpretedTravel = false,
) {
  if (!action || (!interpretedTravel && !permitsPhysicalMovement(action)) || roll?.outcome === "failure") return delta;
  const named = sectionBody(narration, "LOCATION").replace(/\*+/g, "").replace(/^location\s*:\s*/i, "").trim();
  const current = String(currentLocation || "").trim();
  if (!named || named.length > 240 || named.toLocaleLowerCase() === current.toLocaleLowerCase()) return delta;
  return { ...(delta || {}), location: named };
}

const ASSET_RANK: Record<string, number> = { suspected: 0, inaccessible: 1, confirmed: 2, controlled: 3 };

export function assertMaterialAuthority(delta: Record<string, unknown> | null, action: string, roll: Record<string, unknown> | null, state: Record<string, unknown>, trade: ConversationTrade | null = null) {
  if (!delta) return;
  const succeeded = roll?.outcome === "success";
  const materialArrays = ["inventoryAdd", "inventoryRemove", "propertyAdd", "shipAdd", "investmentAdd"];
  const changesMoney = Number(delta.credits || 0) !== 0 || Number(delta.creditsCriminal || 0) !== 0;
  const changesMaterial = materialArrays.some((field) => Array.isArray(delta[field]) && (delta[field] as unknown[]).length > 0);
  const verifiedTrade = isVerifiedConversationTradeDelta(delta, trade)
    && !["propertyAdd", "shipAdd", "investmentAdd"].some((field) => Array.isArray(delta[field]) && (delta[field] as unknown[]).length > 0);
  if ((changesMoney || changesMaterial) && !succeeded && !verifiedTrade) {
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

/** Validate narrated offers, not the player's vocabulary. Missing terms are
 * extracted from the same draft before it can become a finalized turn. */
export function assertQuotedOfferConsistency(narration: string, delta: Record<string, unknown> | null, trade: ConversationTrade | null = null) {
  if (trade?.status === "accepted" || Number(delta?.credits || 0) < 0) return;
  const result = sectionBody(narration, "GAMEPLAY RESULT");
  const sentences = result.split(/(?<=[.!?])\s+/);
  const quotedPrices = sentences.filter(sentence => /\b(?:costs?|price|quotes?|rate|payable|for (?:a |one |the )?(?:full )?(?:month|night|week|room|stay)|credits? for)\b/i.test(sentence))
    .flatMap(quotedCreditAmounts);
  const offers = Array.isArray(delta?.tradeOfferAdd) ? delta.tradeOfferAdd as Record<string, unknown>[] : [];
  if (quotedPrices.some(price => price > 0 && !offers.some(offer => Number(offer.totalCredits) === price
    || Array.isArray(offer.priceComponents) && offer.priceComponents.some(part => Number(part?.credits) === price)
    || offer.lease && typeof offer.lease === "object" && [Number((offer.lease as Record<string, unknown>).rentCredits), Number((offer.lease as Record<string, unknown>).refundableDepositCredits)].includes(price)))) {
    throw new GmTurnError("The world-state ledger omitted a quoted offer. Preserve this draft and record its exact seller, price, items or service duration in tradeOfferAdd without charging or granting it.", 502);
  }
}

export function assertNarrativeLedgerConsistency(narration: string, delta: Record<string, unknown> | null, action = "") {
  // "You receive directions" is information, not money. A completed retail
  // transaction can debit credits; it must not be validated as a credit gain.
  // Suggestions are future attempts, never claims about finalized state.
  const resolved = sectionBody(narration, "GAMEPLAY RESULT") || narration.split(/^(?:#{1,6}\s*)?PLAYER OPTIONS\s*$/im)[0];
  const claimsLiquidTransfer = /\b(?:(?:[\d,]+\s+|the\s+)?credits?\s+(?:are\s+)?credited to (?:your|d['’]?holloran)|personal credits? (?:jump|rose|increase)|you (?:now have|receive[sd]?)\s+(?:(?:the|your|an? additional)\s+)?(?:[\d,]+\s+(?:galactic\s+)?credits?|(?:credits?|funds|money)\b))\b/i.test(resolved);
  const creditGain = Number(delta?.credits || 0) + Number(delta?.creditsCriminal || 0);
  const accountToCashConversion = isFinancialWithdrawalAction(action)
    && /\b(?:physical|cash|chips?)\b/i.test(resolved);
  if (claimsLiquidTransfer && creditGain <= 0 && !accountToCashConversion) {
    throw new GmTurnError("The GM narrated a credit gain that was not authorized by the ledger. No outcome was saved; retry the turn.", 502);
  }
  // A bank cash-out must conserve funds: an authoritative bank debit and
  // physical-chip inventory receipt must BOTH exist for a completed withdrawal.
  const claimsPhysicalWithdrawal =
    /\byou\s+(?:withdraw|withdrew|collect|collected|receive|received)\b[^.!?\n]{0,100}\b(?:physical\s+(?:credit\s+)?chips?|credit\s+chips?|chips?\s+(?:worth|totall?ing)|credits?\s+in\s+(?:physical\s+)?chips?)\b/i.test(resolved)
    || /\b(?:terminal|kiosk|cashier|bank)\s+(?:dispenses?|dispensed|hands?\s+(?:you|over))\b[^.!?\n]{0,90}\b(?:chips?|credits?)\b/i.test(resolved);
  if (claimsPhysicalWithdrawal && (isFinancialWithdrawalAction(action) || /\b(?:bank|banking|atm|kiosk|terminal)\b/i.test(action))) {
    const chipInventory = Array.isArray(delta?.inventoryAdd) && delta.inventoryAdd.some((item) =>
      item && typeof item === "object" && /\b(?:physical\s+credits?|credit\s+chips?|currency\s+chips?)\b/i.test(String((item as Record<string, unknown>).name || "")));
    if (!(Number(delta?.bankCredits || 0) < 0 && chipInventory)) {
      throw new GmTurnError("The GM narrated a chip withdrawal without a matching bank debit and physical-chip receipt. No outcome was saved; retry the turn.", 502);
    }
  }
  const completedPayment = /\byou\s+(?:(?:hand|handed)\s+over|pay(?:s|ed)?|spend|spent)\s+(?:the\s+)?[\d,]+\s+credits?\b|\b(?:vendor|merchant|seller|server|bartender)\s+accepts?\s+(?:the|your)\s+payment\b|\bcredits?\s+(?:leave|left|are deducted from)\s+(?:your|the)\s+(?:ledger|account|balance)\b/i.test(resolved);
  const settledTab = /(?:tab|bill) (?:is|was|has been) (?:cleared|paid|settled)/i.test(resolved);
  if ((completedPayment || settledTab) && Number(delta?.credits || 0) >= 0 && Number(delta?.creditsCriminal || 0) >= 0) {
    throw new GmTurnError("The GM narrated a payment without its matching credit deduction. Rewrite the same transaction with an authoritative ledger.", 502);
  }
  const claimsItemGain = /\b(?:added to (?:your|the) inventory|you (?:take possession of|acquire|obtain|now own)\s+(?!(?:(?:an?|the|your)\s+)?(?:directions?|information|answers?|permission|address|lead|knowledge|access)\b)|handed to you|(?:vendor|merchant|seller)\s+(?:bundles?|hands?\s+(?:them|it|the items)\s+over))\b/i.test(resolved)
    || (completedPayment && /\b(?:take|took|hand(?:s|ed)?\s+(?:them|it)\s+over)\b/i.test(resolved));
  if (claimsItemGain && ![delta?.inventoryAdd, delta?.propertyAdd, delta?.shipAdd].some(items => Array.isArray(items) && items.length > 0)) {
    throw new GmTurnError("The GM narrated an item acquisition that was not authorized by the ledger. No outcome was saved; retry the turn.", 502);
  }
}

/**
 * Presentation-only repair. The model can put LOCATION after SCENE or use
 * "LOCATION:" without changing what occurred. Reassemble unique section
 * bodies in canonical order, inserting LOCATION only from the proposed
 * location delta or the authoritative saved location. Never invent outcomes,
 * rolls, offers, or ledger entries here. Semantic validators still run after.
 */
export function normalizeCampaignSections(
  narration: string,
  delta: Record<string, unknown> | null,
  savedLocation: unknown,
  anchorStaticLocation = false,
) {
  const headings = ["LOCATION", "SCENE", "GM ADJUDICATION", "GAMEPLAY RESULT", "SAGA CHECK", "STATE UPDATE", "PLAYER OPTIONS"] as const;
  const inlineLocation = narration.replace(
    /^\s*(?:#{1,6}\s*)?LOCATION\s*:\s*(\S[^\r\n]*)\s*$/im,
    (_, location: string) => `## LOCATION\n${location.trim()}`,
  );
  const pattern = /^(?:#{1,6}\s*)?(LOCATION|SCENE|GM ADJUDICATION|GAMEPLAY RESULT|SAGA CHECK|STATE UPDATE|PLAYER OPTIONS)\s*:?\s*$/gim;
  const markers = [...inlineLocation.matchAll(pattern)];
  if (!markers.length) return narration;
  const sections = new Map<string, string>();
  for (let index = 0; index < markers.length; index += 1) {
    const match = markers[index];
    const name = match[1].toUpperCase();
    if (sections.has(name)) {
      // Duplicate location labels are presentation noise on a stationary turn;
      // preserve strict rejection of duplicate outcome and rules sections.
      if (name === "LOCATION" && anchorStaticLocation) continue;
      return narration;
    }
    const start = (match.index || 0) + match[0].length;
    const end = index + 1 < markers.length ? markers[index + 1].index! : inlineLocation.length;
    sections.set(name, inlineLocation.slice(start, end).trim());
  }
  // Don't silently discard arbitrary text preceding the first section.
  if (inlineLocation.slice(0, markers[0].index || 0).trim()) return narration;
  if (anchorStaticLocation) {
    // An NPC answer cannot move the player. Repair only the displayed location;
    // the original delta still passes through authoritative movement checks.
    const verifiedLocation = String(savedLocation || "").trim();
    if (!verifiedLocation) return narration;
    sections.set("LOCATION", verifiedLocation);
  } else if (!sections.has("LOCATION")) {
    const verifiedLocation = String(delta?.location || savedLocation || "").trim();
    if (!verifiedLocation) return narration;
    sections.set("LOCATION", verifiedLocation);
  }
  return headings.filter((heading) => sections.has(heading))
    .map((heading) => `## ${heading}\n${sections.get(heading)}`)
    .join("\n\n");
}

export function assertCampaignResponseStructure(narration: string) {
  const headings: Array<typeof SECTION_HEADINGS[number]> = ["LOCATION", "SCENE", "GM ADJUDICATION", "GAMEPLAY RESULT", "SAGA CHECK", "STATE UPDATE", "PLAYER OPTIONS"];
  let cursor = -1;
  for (const heading of headings) {
    const matches = [...narration.matchAll(new RegExp(`^(?:#{1,6}\\s*)?${heading}\\s*$`, "gim"))];
    if (matches.length !== 1) {
      throw new GmTurnError(`The GM response must contain exactly one ${heading} section. No outcome was saved; retry the turn.`, 502);
    }
    const match = matches[0];
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

/**
 * A valid turn may have no persistent consequences. Some providers correctly
 * return an empty hidden ledger (`STATE:{}`) but leave the player-facing
 * STATE UPDATE section blank. Preserve the authored scene instead of rejecting
 * the whole turn and falling back to generic prose.
 */
export function ensureStateUpdateSection(narration: string, delta: Record<string, unknown> | null) {
  const existing = sectionBody(narration, "STATE UPDATE");
  const offers = Array.isArray(delta?.tradeOfferAdd) ? delta.tradeOfferAdd as Record<string, unknown>[] : [];
  const quotedTerms = offers.map(offer => {
    const items = Array.isArray(offer.items) ? offer.items as Record<string, unknown>[] : [];
    return `Offer from ${String(offer.sellerName)}: ${items.map(item => String(item.name)).join(" + ")} — ${Number(offer.totalCredits).toLocaleString("en-US")} credits. Not purchased.`;
  });
  if (/[\p{L}\p{N}]/u.test(existing) && !quotedTerms.length) return narration;
  const heading = /^(?:#{1,6}\s*)?STATE UPDATE\s*$/im.exec(narration);
  if (!heading) return narration;
  const bodyStart = heading.index + heading[0].length;
  const next = /^(?:#{1,6}\s*)?PLAYER OPTIONS\s*$/im.exec(narration.slice(bodyStart));
  const summary = quotedTerms.length ? [existing, ...quotedTerms].filter(Boolean).join("\n")
    : delta && Object.keys(delta).length ? "The resolved consequences are recorded in this character's campaign state." : "No persistent change.";
  const prefix = narration.slice(0, bodyStart).trimEnd();
  if (!next) return `${prefix}\n${summary}`;
  const nextStart = bodyStart + next.index;
  return `${prefix}\n${summary}\n\n${narration.slice(nextStart)}`;
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

export function assertFreshScene(narration: string, priorScene: string, action: string, priorResult = "") {
  const scene = extractSceneNarration(narration);
  if (!scene || (action && sceneTokens(scene).length < 25)) {
    throw new GmTurnError("The GM SCENE did not narrate the declared attempt in a concrete setting. Rewrite the same turn with D'mir's visible position, surroundings, and immediate world reaction.", 502);
  }
  if (!priorScene) return;
  const priorParagraphs = new Set(normalizedParagraphs(priorScene));
  const repeatsParagraph = normalizedParagraphs(scene).some((paragraph) => priorParagraphs.has(paragraph));
  const similarity = sceneSimilarity(scene, priorScene);
  const result = sectionBody(narration, "GAMEPLAY RESULT");
  // Staying at a desk does not require inventing a different room every turn.
  // A new concrete answer/payment/reaction can progress that same setting.
  const newResult = sceneTokens(result).length >= 12
    && !/declared (?:action|attempt)|immediate scene|world answers|nothing changes/i.test(result)
    && (!priorResult || sceneSimilarity(result, priorResult) < 0.72);
  if (!newResult && (repeatsParagraph || (sceneTokens(scene).length >= 45 && similarity >= 0.72))) {
    throw new GmTurnError(`The GM repeated the prior scene instead of showing how the world answered ${action || "the scene refresh"}. Rewrite from the present beat with new, action-specific sensory narration.`, 502);
  }
}

/**
 * Banking withdrawal is not physical movement. The general travel classifier
 * can otherwise mistake "withdraw credits" for "withdraw from a location".
 */
export function isFinancialWithdrawalAction(action: string) {
  const text = positiveActionText(action).toLocaleLowerCase();
  const withdrawal = /\b(?:withdraw|withdrawing|withdrawal|cash\s+out)\b/.test(text);
  const bankingContext = /\b(?:bank|banking|account|currency|credit|credits|chips?|funds|cash|atm|kiosk)\b/.test(text);
  const amount = /\b(?:withdraw|withdrawing|withdrawal)\s+(?:of\s+)?\d[\d,]*(?:\.\d+)?\s*[km]?\b|\b\d[\d,]*(?:\.\d+)?\s*[km]?\s+(?:worth\s+of\s+)?(?:credit\s+)?withdrawal\b/.test(text);
  return withdrawal && (bankingContext || amount);
}

export function permitsPhysicalMovement(action: string) {
  return !isFinancialWithdrawalAction(action) && permitsLocationChange(action);
}

export function assertMovementSceneProgress(
  narration: string,
  action: string,
  roll: Record<string, unknown> | null,
  delta: Record<string, unknown> | null,
  currentLocation?: unknown,
) {
  if (!action || !permitsPhysicalMovement(action)) return;
  const result = sectionBody(narration, "GAMEPLAY RESULT");
  const localEndpoint = result.match(/\byou\s+(?:return|move|walk|cross|go|step)\s+(?:back\s+)?(?:to|into|through|across)\s+(?:the\s+)?(front counter|rear workroom|showroom|workshop|office|reception|lobby|corridor)\b/i)?.[1];
  if (localEndpoint && !normalizedKey(delta?.location || currentLocation).includes(localEndpoint.toLowerCase())) {
    throw new GmTurnError("The movement reached a different position within the venue, but the saved location does not name that endpoint. Rewrite LOCATION and delta.location to the confirmed endpoint, preserving its planet and venue. Do not send the character back to the prior room.", 502);
  }
  if (delta?.location && delta.location !== currentLocation) return;
  const scene = extractSceneNarration(narration);
  // Kiosks, counters and stalls are local waypoints within the saved concourse.
  // Still require a delta for travel to a distinct place such as a new port or ship.
  const completedNamedPlace = /\byou\s+(?:arrive(?:\s+at)?|reach|enter|exit|leave|[^.!?\n]{0,100}\band\s+(?:arrive\s+(?:at|in)|reach))\b[^.!?\n]{0,100}\b(?:apartment|residence|home|docking bay|spaceport|district|city|planet|ship|shuttle|transport)\b/i.test(`${scene}\n${result}`);
  if (completedNamedPlace) {
    throw new GmTurnError("The GM completed travel to a named place without saving that destination. Rewrite the same turn with the exact end location in the ledger.", 502);
  }
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
    if (!isAuthoritativeLocalReceipt(message) && (message.provider === "local-safe-fallback" || message.fallbackReason) || isRepeatedSceneTemplate(message.content)) continue;
    const location = sectionBody(message.content, "LOCATION").trim();
    if (location && location !== String(snapshot.gameState.location || "")) continue;
    const scene = sectionBody(message.content, "GAMEPLAY RESULT") || extractSceneNarration(message.content);
    if (scene) return scene;
  }
  return "";
}

function currentSceneFrame(snapshot: DatapadSnapshot) {
  const state = snapshot.gameState || {};
  const stored = state.scene && typeof state.scene === "object" && !Array.isArray(state.scene)
    ? state.scene as Record<string, unknown>
    : null;
  const messages = Array.isArray(snapshot.messages) ? snapshot.messages as Message[] : [];
  const latest = messages.filter(message => message.role === "assistant").at(-1);
  const polluted = !isAuthoritativeLocalReceipt(latest) && (latest?.provider === "local-safe-fallback" || latest?.fallbackReason)
    || isRepeatedSceneTemplate(String(stored?.summary || ""));
  const summary = String((!polluted && stored?.summary) || latestAssistantScene(snapshot)).slice(0, 2800);
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
  // SCENE can describe the start of an action. The resolved result is the
  // current moment: retaining the opening resets travel and conversations.
  const summary = (sectionBody(narration, "GAMEPLAY RESULT") || extractSceneNarration(narration)).slice(0, 2800);
  if (!summary) return snapshot;
  const previous = currentSceneFrame(snapshot);
  // Route progress records reaching a new playable boundary, not automatic
  // success at the final destination. A failed pursuit can still reach an
  // obstruction, false branch, checkpoint, or exposed position.
  const movementProgress = Boolean(action && permitsPhysicalMovement(action));
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
  const journey = snapshot.gameState.journey as Record<string, unknown> | undefined;
  const destination = String(journey?.destination || "").toLocaleLowerCase();
  const endLocation = scene.location.toLocaleLowerCase();
  const arrived = journey?.status === "in_transit" && destination
    && (endLocation === destination || endLocation.startsWith(destination + " —") || endLocation.startsWith(destination + " -") || endLocation.startsWith(destination + " orbit") || endLocation.startsWith(destination + " system"));
  return { ...snapshot, gameState: { ...snapshot.gameState, scene,
    ...(arrived ? { journey: { ...journey, status: "arrived", arrivedAt: now } } : {}),
  } };
}

export function assertLocationIntent(delta: Record<string, unknown> | null, action: string, currentLocation?: unknown, interpretedTravel = false) {
  if (delta?.location === currentLocation) return;
  if (delta?.location && !interpretedTravel && !permitsPhysicalMovement(action)) throw new GmTurnError("The narration moved the character without a declared movement. Rewrite at the saved location.", 502);
}

export function assertSceneRefreshDelta(delta: Record<string, unknown> | null) {
  if (Object.values(delta || {}).some((value) => value !== 0 && value !== null && !(Array.isArray(value) && value.length === 0))) {
    throw new GmTurnError("A scene description cannot change the campaign. Rewrite the same scene with no consequences.", 502);
  }
}

/**
 * Reject a repeated claim of nonpayment when the preceding committed
 * narration authenticated that same payment. A new fee or evidence of fraud
 * is not blocked by this narrow continuity check.
 */
export function assertSettledPaymentContinuity(narration: string, priorResult: string, action: string) {
  if (!permitsPhysicalMovement(action) || !priorResult) return;
  const settled = /(?:receipt|payment|transaction|fare)[^.\n]{0,140}(?:acknowledg|validat|confirm|settled|accepted|secured)|(?:acknowledg|verified|confirmed)[^.\n]{0,120}(?:receipt|payment|fare)/i.test(priorResult);
  if (!settled) return;
  const currentBeat = [sectionBody(narration, "SCENE"), sectionBody(narration, "GAMEPLAY RESULT")].join("\n");
  const rejectsSamePayment = /\b(?:haven['’]?t|hasn['’]?t|have not|has not|not yet)\s+paid\b|\b(?:no|can['’]?t find|cannot find|don['’]?t see|do not see)\s+(?:(?:a|the|your)\s+)?(?:credit\s+)?(?:transfer|payment)\b|\b(?:pay|payment)\s+(?:the\s+)?(?:same\s+)?(?:fare|deposit)\s+again\b/i.test(currentBeat);
  if (rejectsSamePayment) {
    throw new GmTurnError("The GM repeated a denial of payment that the preceding committed turn acknowledged. Rewrite this movement from the settled transaction; a new obstacle requires new evidence.", 502);
  }
}

/**
 * An objection to shifting retail-payment terms is a question about the
 * seller's conduct, not another request to hear the same chip-clearing rule.
 * The NPC may admit an error, explain an independently grounded change, or
 * explicitly refuse to explain. None of those responses obliges a sale.
 */
export function isMerchantTermsChallenge(action: string) {
  const text = positiveActionText(action).toLocaleLowerCase();
  const merchant = /\b(?:merchant|vendor|seller|shopkeeper|stall|he|she|they)\b/.test(text);
  const payment = /\b(?:payment|requirements?|conditions?|terms?|credits?|chips?|bank-issued|clearinghouse|policy|quoted|quote|offer|sale|price|verification)\b/.test(text);
  const dispute = /\b(?:why|keep|keeps|changing|changed|introducing|introduced|new|previous|previously|earlier|already|originally|first|honor|refuse|refuses|refused|demanded|specifically|satisfy|satisfied)\b/.test(text);
  return merchant && payment && dispute;
}

export function assertMerchantTermsContinuity(narration: string, priorResult: string, action: string) {
  if (!priorResult || !isMerchantTermsChallenge(action)) return;
  // Don't apply this check to an unrelated interlocutor or a stale scene.
  if (!/\b(?:merchant|vendor|seller|stall|credits?|chips?|bank|clearinghouse|payment|sale|medpacs?)\b/i.test(priorResult)) return;
  const result = sectionBody(narration, "GAMEPLAY RESULT");
  if (!result) return; // The section-structure validator handles this.
  if (sceneSimilarity(result, priorResult) >= 0.82) {
    throw new GmTurnError("The merchant repeated the preceding answer rather than responding to the new challenge about payment terms. Rewrite the response; preserve all established conditions and do not force a purchase.", 502);
  }
  // A vendor may be evasive, but the scene must make that evasion explicit.
  // Saying only that the chips lack a clearinghouse flag does not answer why
  // the vendor earlier requested exactly those bank-issued chips.
  const discussesPriorPromise = /\b(?:earlier|before|first|initially|originally|previously|previous|changed|change|misstated|mistake|misunderstood|forgot|omitted|left out|should have (?:told|said|mentioned|explained)|didn['’]?t (?:tell|say|mention|explain)|i (?:said|asked|told|quoted|promised)|we (?:said|asked|told|quoted|promised))\b/i.test(result);
  const openlyDeclinesToExplain = /\b(?:refus(?:e[sd]?|ing) to (?:answer|explain)|declin(?:e[sd]?|ing) to (?:answer|explain)|won['’]?t (?:answer|explain|discuss)|will not (?:answer|explain|discuss)|not (?:going to|willing to) (?:answer|explain|discuss)|evad(?:es?|ed) (?:the|your) question|dodg(?:es?|ed) (?:the|your) question|no explanation|without (?:answering|explaining)|cuts off (?:the|your) question)\b/i.test(result);
  if (!discussesPriorPromise && !openlyDeclinesToExplain) {
    throw new GmTurnError("The player challenged changing merchant payment requirements, but the merchant only repeated the current verification rule. Address the earlier promise or explicitly decline to explain it; do not invent a new obstacle or guaranteed sale.", 502);
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
  // NPC questions and an explicitly declared want do not assign a new motive.
  const narratorText = [sectionBody(narration, "SCENE"), sectionBody(narration, "GAMEPLAY RESULT")].filter(Boolean).join("\n") || narration;
  const outsideDialogue = narratorText.replace(/“[^”]*”|"[^"]*"/g, "").replace(/\b(?:if|when|should) you\b/gi, "if one");
  const unchosenWant = /\byou want\b/i.test(outsideDialogue) && !/\b(?:i want|looking for|i need)\b/i.test(action);
  if (/\byou (?:are (?:certain|unafraid|afraid|ready)|decide|do not care|don't care)\b/i.test(outsideDialogue) || unchosenWant) {
    throw new GmTurnError("The GM assigned D'mir an unchosen emotion, conclusion, or decision. No outcome was saved; retry the turn.", 502);
  }
}

function hasTrainedForceUse(character: Record<string, unknown>) {
  const skills = Array.isArray(character.trainedSkills) ? character.trainedSkills.map(String).join(" ") : String(character.skills || "");
  return /\buse the force\b/i.test(skills) || /\bforce training\b/i.test(String(character.feats || ""));
}

export function assertNarrativeAuthority(narration: string, claims: string[], roll: Record<string, unknown> | null, character: Record<string, unknown>, action = "") {
  const succeeded = roll?.outcome === "success";
  if (!succeeded && claims.includes("hidden wealth or ownership")
    && /\b(?:you (?:find|discover|locate|confirm)|records? (?:show|confirm)|account (?:contains|holds)|cache (?:contains|holds)|Kelvek (?:left|hid|stashed))\b[^.]{0,180}\b(?:millions?|billions?|credits?)\b/i.test(narration)) {
    throw new GmTurnError("The GM confirmed hidden wealth without a successful authoritative resolution. No outcome was saved; retry the turn.", 502);
  }
  if (!succeeded && claims.includes("unstored memory, credential, or prior promise")
    && /\b(?:password|access code|backdoor|escape hatch)\b[^.]{0,120}\b(?:works?|opens?|unlocks?|is correct|is confirmed|reveals?)\b/i.test(narration)) {
    throw new GmTurnError("The GM confirmed an unstored secret or credential without a successful authoritative resolution. No outcome was saved; retry the turn.", 502);
  }
  const finalizedNarration = narration.split(/(?:^|\n)(?:##\s*)?PLAYER OPTIONS\b/i)[0];
  const overtEffect = /\byou\s+(?:force[- ]?choke|telekinetically\s+(?:lift|hurl|push|pull)|(?:lift|hurl|push|pull)\s+[^.]{0,80}\s+with the force)|\bthe force\s+(?:obeys|answers your command|surges through you at will)\b|\b(?:slab|crate|debris|stone|object)\s+(?:rises?|lifts?|levitates?|floats?)\b[^.]{0,80}\b(?:force|telekinetic|command|will)\b/i.test(finalizedNarration);
  const required = requiredForcePower(action || finalizedNarration);
  if (overtEffect && (!hasTrainedForceUse(character) || required && !hasEarnedForcePower(character, required))) {
    throw new GmTurnError("The GM granted an overt Force technique that the character has not earned. No outcome was saved; retry the turn.", 502);
  }
}

export async function runGmTurn(actor: Account, input: TurnInput) {
  let phase = "load";
  let draftAttempt = 0;
  const turnLifecycle = beginTurnLifecycle(input.turnId, input.revision);
  const enterPhase = (next: string, attempts = draftAttempt) => {
    phase = next;
    advanceTurnLifecycle(turnLifecycle, next, attempts);
  };
  try {
  const providerDeadline = Date.now() + 80_000;
  const providerBudget = (limit: number) => {
    const remaining = providerDeadline - Date.now();
    if (remaining < 1000) throw new NvidiaProviderError("The GM drafting deadline elapsed.", 504);
    return Math.min(limit, remaining);
  };
  const accountId = input.accountId || actor.id;
  const saved = readDatapad(actor, accountId);
  if (!saved.snapshot?.character) throw new GmTurnError("Create or load a character before opening a scene.", 409);
  let currentSnapshot = reconcileCommittedArrival(ensureCampaignScaffold(saved.snapshot) as DatapadSnapshot);
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(input.turnId)) throw new GmTurnError("A valid turn identifier is required.");
  const action = normalizeTurnAction(input.action);
  if ((!action && !input.openScene) || action.length > 2000) throw new GmTurnError("Provide an action between 1 and 2,000 characters.");
  const actionContract=interpretRpgActionContract(action);

  const db = turnStore();
  db.prepare("DELETE FROM gm_turn_attempts WHERE created_at < ?").run(new Date(Date.now() - 7 * 86400000).toISOString());
  const existing = db.prepare("SELECT * FROM gm_turn_attempts WHERE account_id = ? AND turn_id = ?").get(accountId, input.turnId) as { base_revision: number; action: string; roll: string | null; status: string; result: string | null } | undefined;
  if (existing && existing.action !== action) throw new GmTurnError("This turn identifier was already used for a different action.", 409);
  if (existing?.status === "complete" && existing.result) return JSON.parse(existing.result);
  if (!Number.isSafeInteger(input.revision) || input.revision !== saved.revision) throw new GmTurnError("The campaign changed in another window. Reload the saved game before continuing.", 409);
  if (existing && existing.base_revision !== input.revision) throw new GmTurnError("The campaign changed after this turn began. Submit the action again as a new turn or reload the saved game.", 409);
  // A validated draft is keyed to precisely this account, action, turn and base revision.
  // Reading it never changes the authoritative campaign save.
  const checkpoint = await loadValidatedDraft(db, accountId, input.turnId, input.revision, action);

  const mode = classifyTurnMode(action);
  const transitArrival = mode === "play"
    ? pendingTransitArrival(currentSnapshot.gameState as Record<string, unknown>, action)
    : null;
  if (mode === "play" && action) assertAdvancementReady(currentSnapshot.character);
  const priorInterpretation = db.prepare("SELECT interpretation FROM gm_turn_interpretations WHERE account_id = ? AND turn_id = ?").get(accountId, input.turnId) as { interpretation: string } | undefined;
  enterPhase("interpret-action");
  const interpretation = checkpoint ? checkpoint.interpretation as Awaited<ReturnType<typeof interpretSagaAction>>
    : priorInterpretation ? JSON.parse(priorInterpretation.interpretation)
    : mode === "play" && action ? await interpretSagaAction(action, currentSnapshot.character as Record<string, unknown>, { ...currentSnapshot.gameState, scene: currentSceneFrame(currentSnapshot), sceneMerchant: sceneMerchant(currentSnapshot), recentInteraction: safeMessages(currentSnapshot).slice(-4) }) : { semantic: null, fallbackReason: null };
  if (!priorInterpretation) db.prepare("INSERT OR IGNORE INTO gm_turn_interpretations VALUES (?, ?, ?)").run(accountId, input.turnId, JSON.stringify(interpretation));
  let semantic = interpretation.semantic;
  let resolvedIntent = semantic?.canonicalAction || action;
  if (isEventWait(action)) resolvedIntent = action;
  const ordinaryTrade = mode === "play" && !input.openScene && !input.statePolicy && (!semantic || semantic.intent === "commerce" && !semantic.checkNeeded);
  if (ordinaryTrade && semantic?.intent === "commerce" && !currentTradeOffers(currentSnapshot.gameState).length) {
    try {
      const recovered = await recoverConfirmedTradeOffer(currentSnapshot);
      if (recovered !== currentSnapshot) {
        currentSnapshot = recovered;
        const refreshed = await interpretSagaAction(action, currentSnapshot.character as Record<string, unknown>, {
          ...currentSnapshot.gameState, scene: currentSceneFrame(currentSnapshot), recentInteraction: safeMessages(currentSnapshot).slice(-4),
        });
        if (refreshed.semantic) {
          semantic = refreshed.semantic;
          resolvedIntent = semantic.canonicalAction;
          db.prepare("UPDATE gm_turn_interpretations SET interpretation = ? WHERE account_id = ? AND turn_id = ?").run(JSON.stringify(refreshed), accountId, input.turnId);
        }
      }
    }
    catch { /* Preserve the save when a historical quote cannot be verified. */ }
  }
  enterPhase("plan-commerce");
  const trade = ordinaryTrade ? planConversationTrade(semantic?.acceptedOfferId ? action : resolvedIntent, currentSnapshot.gameState, input.turnId, semantic?.acceptedOfferId) : null;
  const atelierAppointment = mode === "play" && isAtelierAppointmentRequest(action, currentSnapshot.gameState.location);
  const routineServiceInquiry = mode === "play" && (isRoutineServiceInquiry(action) || atelierAppointment);
  // Simple informational questions cannot become Persuasion rolls because an
  // upstream intent draft mislabeled them as contested dialogue.
  const routineCommerce = routineServiceInquiry || (semantic ? !semantic.checkNeeded && ["commerce", "dialogue"].includes(semantic.intent) : isRoutineCommerce(action, currentSnapshot.gameState.location));
  const merchant = sceneMerchant(currentSnapshot);
  // Shared by the browser and GPT controller, including historical quote repairs.
  const encounter = activeCombat(currentSnapshot.gameState as Record<string, unknown>);
  const forceConstraint = forceCapabilityConstraint(semantic, currentSnapshot.character as Record<string, unknown>);
  const forcePowerId = declaredForcePower(resolvedIntent, semantic);
  enterPhase("plan-saga");
  let plan = mode === "play" && action && !trade && !routineCommerce
    ? forcePowerId && !forceConstraint
      ? buildForcePowerPlan(forcePowerId, currentSnapshot.character as Record<string, unknown>, currentSnapshot.gameState, encounter)
      : semantic ? buildSemanticSagaCheck(semantic, currentSnapshot.character as Record<string, unknown>, currentSnapshot.gameState) : planSagaAction(action, currentSnapshot.character as Record<string, unknown>, currentSnapshot.gameState)
    : null;
  // Battle Strike modifies the next attack before the server rolls it. The
  // modifier is carried by the combat snapshot, never supplied by the model.
  const battleStrike = encounter?.combatants.find(entry => entry.side === "player")?.battleStrike;
  if (plan?.kind === "attack" && battleStrike && battleStrike.expiresRound >= (encounter?.round || 0)) {
    plan = { ...plan, modifier: plan.modifier + battleStrike.attackBonus, damage: plan.damage ? { ...plan.damage, count: plan.damage.count + battleStrike.damageDice } : plan.damage };
  }
  enterPhase("roll-saga");
  const roll = checkpoint ? checkpoint.roll : existing?.roll ? JSON.parse(existing.roll) : plan ? rollSagaCheck(plan) : null;
  let combatResolution: CombatResolution | null = null;
  let forceResolution: ForcePowerResolution | null = null;
  const combatActionText = positiveActionText(resolvedIntent).toLowerCase();
  if (mode === "play" && !encounter && isAttackDeclaration(resolvedIntent) && roll?.kind === "initiative") {
    combatResolution = beginCombat(resolvedIntent, currentSnapshot.character as Record<string, unknown>, currentSnapshot.gameState, roll, deterministicTurnRoller(input.turnId, "combat-open"));
  } else if (mode === "play" && forcePowerId && plan && !forceConstraint) {
    forceResolution = resolveForcePower(forcePowerId, resolvedIntent, currentSnapshot.character as Record<string, unknown>, currentSnapshot.gameState, roll, deterministicTurnRoller(input.turnId, "force-power"));
    if (forceResolution.combat) combatResolution = forceResolution as CombatResolution;
  } else if (mode === "play" && encounter && isAttackDeclaration(resolvedIntent) && roll?.kind === "attack") {
    combatResolution = resolveCombatAction(encounter, { kind: "attack", action: resolvedIntent }, { character: currentSnapshot.character as Record<string, unknown>, currentHealth: Number(currentSnapshot.gameState.health || 0), playerRoll: roll, roller: deterministicTurnRoller(input.turnId, "combat-attack") });
  } else if (mode === "play" && encounter && isCombatWithdrawDeclaration(resolvedIntent)) {
    const escapeConfirmed = semantic?.intent === "travel" || /\b(?:market|shelter|higher|upward|leave\s+(?:level|1313)|out of the prison|populated)\b/i.test(combatActionText);
    combatResolution = resolveCombatAction(encounter, { kind: "withdraw", action: resolvedIntent, escapeConfirmed, escapeReason: escapeConfirmed ? "The declared route reaches a concrete boundary outside the immediate encounter." : undefined }, { character: currentSnapshot.character as Record<string, unknown>, currentHealth: Number(currentSnapshot.gameState.health || 0) });
  } else if (mode === "play" && encounter && isEndTurnDeclaration(resolvedIntent)) {
    combatResolution = resolveCombatAction(encounter, { kind: "end_turn", action: resolvedIntent }, { character: currentSnapshot.character as Record<string, unknown>, currentHealth: Number(currentSnapshot.gameState.health || 0), roller: deterministicTurnRoller(input.turnId, "npc-turn") });
  } else if (mode === "play" && encounter && isCombatMovementDeclaration(resolvedIntent)) {
    combatResolution = resolveCombatAction(encounter, { kind: "move", action: resolvedIntent, cover: /\bcover\b/i.test(combatActionText) ? "cover" : undefined, coverEstablished: /\bcover\b/i.test(combatActionText) }, { character: currentSnapshot.character as Record<string, unknown>, currentHealth: Number(currentSnapshot.gameState.health || 0) });
  } else if (mode === "play" && encounter && /\b(?:aim|take aim|steady|sights?)\b/i.test(combatActionText)) {
    combatResolution = resolveCombatAction(encounter, { kind: "aim", action: resolvedIntent }, { character: currentSnapshot.character as Record<string, unknown>, currentHealth: Number(currentSnapshot.gameState.health || 0) });
  } else if (mode === "play" && encounter && /\b(?:recover|regain composure|shake it off|tend my condition)\b/i.test(combatActionText)) {
    combatResolution = resolveCombatAction(encounter, { kind: "recover", action: resolvedIntent, swiftActions: 3 }, { character: currentSnapshot.character as Record<string, unknown>, currentHealth: Number(currentSnapshot.gameState.health || 0) });
  } else if (mode === "play" && encounter && /\b(?:second wind|catch my breath|push through)\b/i.test(combatActionText)) {
    combatResolution = resolveCombatAction(encounter, { kind: "second_wind", action: resolvedIntent, dayId: String(currentSnapshot.gameState.resourceDay || "campaign-day-1") }, { character: currentSnapshot.character as Record<string, unknown>, currentHealth: Number(currentSnapshot.gameState.health || 0) });
  } else if (mode === "play" && encounter && /\b(?:fight defensively|total defense|defensive stance|guard myself)\b/i.test(combatActionText)) {
    combatResolution = resolveCombatAction(encounter, { kind: "total_defense", action: resolvedIntent }, { character: currentSnapshot.character as Record<string, unknown>, currentHealth: Number(currentSnapshot.gameState.health || 0) });
  }
  if (!existing) db.prepare("INSERT INTO gm_turn_attempts VALUES (?, ?, ?, ?, ?, 'pending', NULL, ?)").run(accountId, input.turnId, input.revision, action, roll ? JSON.stringify(roll) : null, new Date().toISOString());

  enterPhase("prepare-draft");
  const history = safeMessages(currentSnapshot);
  const priorScene = currentSceneFrame(currentSnapshot)?.summary || "";
  const lastAuthored = (currentSnapshot.messages as Message[]).filter(message => message.role === "assistant"
    && (isAuthoritativeLocalReceipt(message) || message.provider !== "local-safe-fallback" && !message.fallbackReason)).at(-1);
  const priorResult = lastAuthored ? sectionBody(lastAuthored.content, "GAMEPLAY RESULT") : "";
  const lastConfirmedBeat = priorResult
    ? `\nPREVIOUS CONFIRMED RESULT (history, not a new obstacle):\n${priorResult.slice(0, 1200)}\nA completed payment, release, agreement, or cleared obstruction remains completed unless the current authoritative ledger supplies new evidence.`
    : "";

  const userMessage = action || "Describe the CURRENT saved scene, not the opening scene. Use the full seven-section response contract. LOCATION must repeat the authoritative saved location. SCENE must freshly describe my visible established appearance or gear, posture, immediate sensory setting, and spatial layout without claiming that I acted, felt a prescribed emotion, noticed a new clue, or gained anything. Under GM ADJUDICATION say this is a read-only scene view. Under GAMEPLAY RESULT say I remain at the saved moment. Under SAGA CHECK write: No check required. Under STATE UPDATE write: No persistent change. Give scene-specific PLAYER OPTIONS using confirmed capabilities. Do not advance time, move me, invent a discovery, or change mechanical state. Return STATE:{}.";
  const claims = authorityWarnings(action);
  const authorityInstruction = claims.length ? `\n\nPLAYER AUTHORITY WARNING: This declaration contains unverified ${claims.join(", ")}. Treat those clauses only as D'mir's belief or intended approach. They are not facts and cannot become true without support from current authoritative state plus a relevant successful resolution.` : "";
  let creatorInstruction = actor.username.toLocaleLowerCase() === "dmir@galaxy.local" && /^d['’]mir holloran$/i.test(String((currentSnapshot.character as Record<string, unknown>).name || "").trim())
    ? `\n\nD'MIR CREATOR DIRECTION: This is D'mir's creator-controlled player campaign. Respect explicit long-term themes, goals, and desired arcs by creating plausible Star Wars opportunities rather than blocking them. Record a new explicit long-term direction with storyDirectiveAdd. Creating a direction is not an accomplished fact and grants no immediate XP, level, credits, item, feat, talent, Force power, training, victory, or automatic success. Once gameplay actually fulfills an established direction, update that same title to status completed and record the concrete outcome; the server will award XP and derive leveling normally.`
    : "";
  const rollInstruction = roll ? `\n\nAUTHORITATIVE SAGA RESULT:\n${JSON.stringify(roll)}\nUnder SAGA CHECK include concise public arithmetic and the exact line RESULT: ${String(roll.outcome).toUpperCase()}. ${roll.outcome === "failure" ? "The attempted objective fails, but GAMEPLAY RESULT must fail forward to a concrete obstacle, cost, world reaction, or new scene boundary supported by the stakes. Do not grant the intended secret, access, damage, victory, item, or funds." : "Grant only the declared objective; do not expand the success beyond its stated scope."} ${roll.targetVisible ? "Show the DC or defense." : "Do not reveal the hidden target number or NPC statistics."}` : "\\n\\nAUTHORITATIVE SAGA RESULT: No check required. Do not show dice, a DC, a RESULT label or an imagined social/search check. Resolve ordinary access, conversation and travel through concrete NPC/world responses. Do not add hidden obstacles solely to demand a roll.";
  const authoritativeResolution = combatResolution || forceResolution;
  const combatInstruction = authoritativeResolution ? `\n\nAUTHORITATIVE MECHANICS UPDATE:\n${JSON.stringify({ summary: authoritativeResolution.summary, combat: authoritativeResolution.combat || null, additionalRolls: authoritativeResolution.rolls, playerHealthDelta: authoritativeResolution.playerHealthDelta, playerConditionDelta: authoritativeResolution.playerConditionDelta, experienceAward: authoritativeResolution.experienceAward, stateDelta: authoritativeResolution.stateDelta || {} })}\nThis update is server-owned. Narrate it exactly without inventing another attack, damage roll, movement, action, victory, Force effect, or reward. An opening attack declaration starts initiative only; it does not also resolve the attack. Reflect remaining player actions and stop for the player's next declaration.` : "";
  let system = mode === "ooc" ? `You are the campaign Game Master. Answer the player's out-of-character rules or character-status question concisely from authoritative saved state. Distinguish confirmed state from rumors or prior narrative claims. Do not advance time, narrate a new scene, change state, or output a STATE block.\n\nCURRENT CAMPAIGN STATE:\n${publicContext(currentSnapshot)}`
    : mode === "context" ? `The player supplied character background/context, not an in-world action. Acknowledge it briefly, do not roll, do not advance the scene, and do not invent additions. Do not output a STATE block.\n\nCURRENT CAMPAIGN STATE:\n${publicContext(currentSnapshot)}`
    : `${gmSystemForCharacter(currentSnapshot.character as Record<string, unknown>, currentSnapshot.gameState)}${rollInstruction}${combatInstruction}${authorityInstruction}${creatorInstruction}\n\nTURN CONTRACT: Suggestions must change with the current scene, visible interactables, injuries, carried equipment, trained skills and remaining combat actions. Use 2-4 A-D possible attempts, never a static menu, guaranteed outcome, secret clue or unearned Force technique. Only suggest objects already visible in this scene or recorded in state. LOCATION names the end-of-turn place and matches the ledger, not a stale district label. SCENE shows the active character's established visible condition and the declared action meeting the immediate environment before mechanics. GM ADJUDICATION accepts the executable intent; an asserted destination is a goal, not a reason to refuse the attempt. GAMEPLAY RESULT must create a playable new beat even on failure. SAGA CHECK contains only server-owned dice or "No check required." Meditation and terminal interaction are not travel. Negated actions never occur. Travel reaches a concrete observable boundary, not an endless generic transit summary. Historical NPCs and locations in old receipts are not present at the CURRENT planet or location unless authoritative state places them there; never replay an old dock, ship, or contact as the destination of generic movement. PRIOR TURN OUTCOME messages omit old scene prose: use them only for continuity, never as a writing template. The saved scene summary identifies the present beat but its wording must not be copied.\n\nCURRENT AUTHORITATIVE CAMPAIGN STATE:\n${publicContext(currentSnapshot)}`;
  let response: Awaited<ReturnType<typeof invokeNvidia>> | null = checkpoint
    ? { content: checkpoint.content, provider: checkpoint.provider, model: checkpoint.model, finishReason: "stop" }
    : null;
  if (mode === "play") {
    const currentIdentity = String((currentSnapshot.character as Record<string, unknown>).name || "");
    const lore = canonicalNpcContext(currentIdentity + "\n" + action);
    if (lore.length) system += `\n\nCONFIDENTIAL GM CAST CONTINUITY (150 ABY; NOT a player-facing disclosure): ${JSON.stringify(lore)}\nThese names are GOC-specific campaign canon compatible with Star Wars Legends, not external franchise facts. Source documents describe potential 200 ABY futures; never promote anyone to a future title in 150 ABY, make unsupported secrets public, grant powers by narration, or force a cameo without an established scene. The active character's declared action and location remain the authority.`;
  }
  if (mode === "play" && isDmirPrimaryCampaign(actor, currentSnapshot.character as Record<string, unknown>)) {
    const storyCast = dmirSceneNpcContext(action, currentSnapshot.gameState);
    if (storyCast.length) system += `\n\nDMIR HOMEBREW CHARACTER CONTAINERS (GM CONFIDENTIAL): ${JSON.stringify(storyCast)}\nNPCs have independent motivations; presence and contact must be confirmed through play. Never grant player knowledge of private facts, invent a meeting, resurrect a dead character, or pre-complete a future story.`;
  }
  if (mode === "play") system += `\n\nCURRENT ACTION TO RESOLVE NOW: ${action}\n${lastConfirmedBeat}\nCURRENT ACTION PRIORITY: Follow this declaration, not any NPC demand from an earlier scene. When public movement is unopposed and access is established, resolve movement and record the new end location. When an action includes unpriced shopping or sales, present exact prices and offers rather than silently charging, granting items, or forcing an unrelated NPC confrontation; resolve the other independently executable substeps as far as the confirmed state permits. Never invent a second payment for an already receipted purchase.`;
  // NPC intelligence is private to the GM, scoped to current confirmed scene
  // participants. A candidate tactic is not a granted stat bonus or an event.
  if (mode === "play") {
    const rivalIntel=relevantRivalGmContext(currentSnapshot,action);
    if (rivalIntel.length) system += "\n\nGM-PRIVATE WITNESSED NPC INTELLIGENCE: "+JSON.stringify(rivalIntel)+"\nUse only these firsthand memories. Let NPC personality, resources, location and elapsed time determine a plausible response. Foreshadow counters and allow counterplay; do not spawn a rival, grant free equipment or automatically penalize player style. Observing is not proof of a secret, and suggested preparation is not accomplished.";
  }
  // Matured NPC plans and delivered source-linked reports are PRIVATE
  // character context, never pre-resolved story outcomes or player knowledge.
  if (mode === "play") {
    const behindScenes=npcOffscreenGmContext(currentSnapshot);
    if (behindScenes.reports.length||behindScenes.plans.length||behindScenes.offscreenDue.length)
      system += "\n\nGM-PRIVATE NPC OFFSCREEN INTELLIGENCE: "+JSON.stringify(behindScenes)+
       "\nDo not reveal rumors as truth, make offscreen plans automatically succeed, invent resources, or resolve a conflict without SAGA adjudication. Report delivery is knowledge only. Do not narrate unobserved NPC plans as public news unless a separate adjudicated event justifies it. Plans outside the scene may advance as independent world actions only when evidence, resources, elapsed time, and valid world-state changes are present. An offscreen NPC may not apply player health, credits, inventory, XP or conditions.";
  }
  if (mode === "play" && isReadOnlyGoodsInspection(action)) system += `\n\nREAD-ONLY MERCHANDISE INSPECTION: Resolve the declared examination only. Describe visible condition, seals, labels, packaging, and expiration markings supported by the scene. Do not deduct or grant credits; do not add, remove, consume, sell, equip, or transfer an item; do not narrate a completed transaction. Temporary handling remains with the current owner. Use an empty material ledger unless an authoritative mechanic supplied above requires a non-material change.`;
  if (atelierAppointment) system += `\n\n${atelierAppointmentGmInstruction()}`;
  if (mode === "play") system += `\n\n${SANDBOX_GM_AGENCY}`;
  if (mode === "play" && isMerchantTermsChallenge(action)) system += `\n\nPAYMENT-TERMS DISPUTE: The player is challenging why the seller changed the previously stated payment conditions. The last confirmed merchant response is history, not fresh dialogue: ${priorResult.slice(0, 900)}. Have the merchant address the change in terms directly, acknowledging the earlier instruction and giving an established or plausible explanation, or explicitly declining to explain with a concrete world reaction. The merchant may remain uncooperative; do not force acceptance, reverse past turns, create a new payment verification obstacle without grounded evidence, or repeat the previous explanation verbatim. Any actual sale must pass the authoritative trade-and-ledger checks.`;
  if (mode === "play" && isFinancialWithdrawalAction(resolvedIntent)) system += `\n\nBANKING SAFETY: Withdrawing deposited credits as physical chips is an account-to-cash conversion, not a new reward or a change of location. Respect any confirmed terminal lockout. Do not narrate a completed cash-out unless the authorized state ledger can debit bankCredits and record corresponding physical credit chips atomically. If the current ledger schema cannot represent both, explain the operational limitation in the fiction without claiming chips were dispensed, money was lost, or a new security failure was established. Ordinary use of a functioning legitimate terminal does not automatically require a Use Computer check.`;
  if (semantic) system += `\n\nINTERPRETED PLAYER INTENT (not an outcome): ${JSON.stringify(semantic)}\nResolve this intent, not a keyword trigger. The original declaration below remains the player's words and choices. Ordinary competent substeps are part of the attempt; never add a new player decision. Any check is already supplied by the referee; never invent another.`;
  if (mode === "play") system += `\n\nDETERMINISTIC ACTION CONTRACT (classification/guard only; not a success or roll): ${JSON.stringify(actionContract)}\nDo not replace its declared research, technical or combat operation with generic shopping, forms, or unearned outcomes. Respect the Saga referee result and only emit a grounded, valid state delta.`;
  if (forceConstraint) system += `\n\nSAGA CAPABILITY CONSTRAINT: ${forceConstraint}`;
  if (mode === "play" && isEventWait(action)) system += `\n\n${EVENT_WAIT_INSTRUCTION}`;
  if (transitArrival) system += `\n\nCONFIRMED TRANSPORT TRANSIT — ARRIVAL REQUEST: The current saved journey establishes transit to ${transitArrival.destination}. Older completed journeys and departure scenes are history. The player has chosen to wait until arrival. Resolve this existing flight to ${transitArrival.destination}, without requiring another departure order or payment. Narrate arrival/approach, use an end-of-turn LOCATION beginning "${transitArrival.destination}", and save the same location plus positive, plausible timeAdvanceMinutes. No unrelated credits, equipment, or XP awards. A repeated departure or in-flight scene is not a resolved arrival.`;
  if (mode === "play") system += `\n\n${conversationTradeInstruction(trade)}\n${routineCommerce ? "ORDINARY INTERACTION: No check is required for a normal question or stock/price inquiry. Answer the actual question as the CURRENT interlocutor in the saved scene. A broad market location does not mean a clothing stall. Resolve short follow-ups against the last exchange, including lodging duration, privacy, meals and prices. Quote new terms before charging; do not invent procedural refusal without an established reason." : ""}\nSERIALIZATION: End with exactly one HTML STATE comment containing strict JSON, with double-quoted keys and string values. Multiple merchandise items use one inventoryAdd array, never duplicate keys. A no-change example is <!--STATE:{}-->. Record every concrete priced offer in tradeOfferAdd, including services as named entitlements tagged service with the agreed duration and amenities. Quotes grant nothing yet. LOCATION names the place at the END of this action and must match delta.location when declared travel changes it, or the saved location otherwise.`;
  if (mode === "play") system += `\n${LEASE_LEDGER_INSTRUCTION}\n${QUOTE_COMPONENT_INSTRUCTION}`;
  if (mode === "play" && !input.openScene) system += `\nHOLONET WORLD UPDATES: Resolve the current 150 ABY territory using the saved atlas entry. When a turn establishes a public development, or significant elapsed time produces a plausible public bulletin, record that bulletin in publicNewsAdd with headline, facts, an attributed in-universe source, and location. Use the planet name for a local report, its region name for a territorial report, or "Galactic" for genuinely galaxy-wide news. Do not recycle old headlines, announce an unestablished war or ruler as canonical fact, reveal private conversations or undiscovered secrets, or describe player purchases as galaxy-wide news. Reports are campaign developments, not real-world news. Destroyed worlds cannot have intact planetary ports; damaged inhabited worlds are not automatically destroyed. Canon imports must respect the established Legends-led continuity.`;
  let parsed: ReturnType<typeof parseEngineResponse> | null = checkpoint?.stage === "validated"
    ? parseEngineResponse(checkpoint.content, { requireState: mode === "play" })
    : null;
  let delta: Record<string, unknown> | null = checkpoint?.stage === "validated"
    ? (parsed?.delta as Record<string, unknown> | null) : null;
  let validationError: unknown = null;
  let fallbackReason: "provider" | "validation" | null = null;
  for (let attempt = 0; checkpoint?.stage !== "validated" && attempt < 3; attempt += 1) {
    draftAttempt = attempt + 1;
    enterPhase("invoke-provider", draftAttempt);
    const inspectionMaterialFailure = isReadOnlyGoodsInspection(action) && validationError instanceof Error
      && /change money or possessions|item acquisition|payment|material/i.test(validationError.message);
    const correction = attempt && validationError instanceof Error
      ? { role: "user" as const, content: inspectionMaterialFailure
        ? `[SERVER VALIDATION REJECTED THE PRIOR DRAFT: UNAUTHORIZED MATERIAL CHANGE] The player's action is inspection only. Rewrite the same turn at the CURRENT authoritative location. Describe the visible examination, but do not deduct or grant credits, add or remove inventory, transfer ownership, consume or equip anything, or describe a completed transaction. Temporary handling is not acquisition. Use <!--STATE:{}--> unless a confirmed non-material scene field must change. Follow all seven required sections in order and do not add a new player action.`
        : `[SERVER VALIDATION REJECTED THE PRIOR DRAFT: ${validationError.message}] Rewrite the same turn from the CURRENT authoritative location. Address the player\'s latest action specifically. Do not replay the last NPC obstruction or undo any confirmed payment, release, purchase, or access. Preserve the supplied roll exactly, use only authoritative state, follow all seven required sections in order, accept the declared action as an attempt, fail forward when necessary, and output one valid STATE block. Do not add a new action or reroll.` }
      : null;
    try {
      if (!(checkpoint?.stage === "raw" && attempt === 0)) {
      const authored = await invokeNvidia({
        purpose: "gm",
        system,
        timeout_ms: providerBudget(55_000),
        sourceQuery: action || String(currentSnapshot.gameState.location || "opening scene"),
        max_tokens: mode === "ooc" ? 768 : Math.min(4096, Math.max(1200, Math.round(Number(process.env.NVIDIA_GM_MAX_TOKENS) || 3072)) + (attempt > 0 ? 512 : 0)),
        messages: [...history, { role: "user", content: userMessage }, ...(correction ? [correction] : [])],
      });
      response = authored;
      // Raw narration is never authoritative. Persist it only so an interrupted
      // ledger repair can resume without generating a second GM scene.
      try {
        await storeValidatedDraft(db, accountId, input.turnId, input.revision, action, {
          version: 1, stage: "raw", interpretation,
          roll: roll && typeof roll === "object" ? roll : null,
          content: authored.content, provider: authored.provider, model: authored.model,
        });
      } catch (error) {
        if (error instanceof GmDraftIdentityError) throw error;
        console.warn("[api/gm] raw draft checkpoint unavailable", { turnId: input.turnId,
          status: (error as { status?: number } | null)?.status || null });
      }
      }
    } catch (error) {
      if (!(error instanceof NvidiaProviderError)) throw error;
      fallbackReason = "provider";
      console.warn("[api/gm] drafting failed", { turnId: input.turnId, attempt: attempt + 1, status: error.status, message: error.message });
      recordDraftFailure(turnLifecycle, attempt + 1, "provider", error);
      // Provider outages are not invalid GM drafts. Never spend additional
      // tokens on immediate retries during the same request.
      if (error.status >= 500 || error.status === 429) throw error;
      validationError = error;
      // An outage is not an in-world event. Keep the action and roll for retry.
      continue;
    }
    if (!response) throw new GmTurnError("No draft exists for the preserved turn. No gameplay was saved.", 502);
    try {
      enterPhase("validate-draft", draftAttempt);
      // Correct only an EXISTING, syntactically repairable JSON ledger locally.
      // Missing consequences or a missing ledger still need semantic review.
      let candidate = repairEmbeddedModelLedger(response.content) || response.content;
      try {
        parsed = parseEngineResponse(candidate, { requireState: mode === "play" });
        if (mode === "play") assertQuotedOfferConsistency(parsed.clean, parsed.delta as Record<string, unknown> | null, trade);
        if (mode === "play" && !trade && input.statePolicy !== "committed-trade") assertNarrativeLedgerConsistency(parsed.clean, parsed.delta as Record<string, unknown> | null, resolvedIntent);
      } catch (error) {
        const repairableLedger = mode === "play" && error instanceof Error && /(?:world-state ledger|world-state field|world-state JSON|world-state block)/i.test(error.message);
        if (!repairableLedger) throw error;
        const repair = await invokeNvidia({
          purpose: "ledger",
          system: `${LEDGER_REPAIR_SYSTEM}\n${LEASE_LEDGER_INSTRUCTION}\nSCHEMA: objectiveComplete is an array of existing objective title strings, conditionRemove is an array of condition name strings. A spoken merchant quote MUST produce tradeOfferAdd even when no payment occurred and the draft says 'no persistent change'. Convert written-out prices into whole-credit integers. These amounts occur in the result; retain the offered terms associated with each quoted price, never ignore them: ${JSON.stringify(quotedCreditAmounts(sectionBody(candidate, "GAMEPLAY RESULT")))}. If quoting rent and deposit components, save one lease offer at their total instead of selling the components separately.\n\nAUTHORITATIVE CAMPAIGN STATE:\n${publicContext(currentSnapshot)}\n\nAUTHORITATIVE SAGA RESULT:\n${JSON.stringify(roll || null)}`,
          timeout_ms: providerBudget(10_000),
          sourceQuery: action || String(currentSnapshot.gameState.location || "opening scene"),
          max_tokens: 1024,
          temperature: 0.1,
          top_p: 0.2,
          messages: [{ role: "user", content: `PLAYER ACTION:\n${userMessage}\n\nGM DRAFT WITH MISSING LEDGER:\n${candidate}\n\nQUOTE SCHEMA:\n${QUOTE_COMPONENT_INSTRUCTION}` }],
        });
        candidate = attachRepairedLedger(candidate, repair.content);
        parsed = parseEngineResponse(candidate, { requireState: true });
        assertQuotedOfferConsistency(parsed.clean, parsed.delta as Record<string, unknown> | null, trade);
      }
      parsed = {
        ...parsed,
        clean: ensureStateUpdateSection(
          alignMechanicalResult(alignMerchantIdentity(sanitizeGmNarration(parsed.clean), merchant), roll),
          parsed.delta as Record<string, unknown> | null,
        ),
      };
      if (mode === "play") {
        parsed = { ...parsed, clean: ensurePlayerOptions(normalizePlayerOptions(parsed.clean), currentSnapshot.gameState, currentSnapshot.character as Record<string, unknown>, action) };
        parsed = { ...parsed, clean: normalizeCampaignSections(parsed.clean, parsed.delta as Record<string, unknown> | null, currentSnapshot.gameState.location, !permitsLocationChange(resolvedIntent) && semantic?.intent !== "travel" && !transitArrival && !(parsed.delta as Record<string, unknown> | null)?.location) };
      }
      if (mode === "play") assertCampaignResponseStructure(parsed.clean);
      if (mode === "play") assertNarrativeFocus(parsed.clean, action);
      if (mode === "play") assertActionConstraints(parsed.clean, resolvedIntent);
      if (mode === "play") assertSettledPaymentContinuity(parsed.clean, priorResult, action);
       if (mode === "play") assertMerchantTermsContinuity(parsed.clean, priorResult, action);
      if (mode === "play" && response.provider !== "local-safe-fallback") {
        try {
          assertFreshScene(parsed.clean, priorScene, action, priorResult);
        } catch (error) {
          // Freshness is a quality guard, not campaign authority. Give the
          // provider two rewrites, then accept the third safe, action-specific
          // draft instead of disconnecting the player from an unchanged save.
          if (attempt < 2) throw error;
          console.warn("[api/gm] scene freshness degraded after rewrites", {
            turnId: input.turnId,
            reason: error instanceof Error ? error.message : String(error),
          });
        }
      }
      assertMechanicalNarration(parsed.clean, roll);
      assertResolvedOutcome(parsed.clean, roll, parsed.delta as Record<string, unknown> | null, resolvedIntent);
      if (mode === "play") assertRpgOutcomeFocus(actionContract,parsed.clean);
      delta = constrainFailedCheckDelta(parsed.delta as Record<string, unknown> | null, roll, resolvedIntent);
      delta = constrainExperienceAward(delta, roll);
      delta = reconcileConversationTradeDelta(delta, trade);
      delta = constrainReadOnlyGoodsInspectionDelta(delta, action, trade?.status === "accepted");
      if (mode === "play") {
        const waitError = eventWaitFailure(action, sectionBody(parsed.clean, "GAMEPLAY RESULT"), delta);
        if (waitError) throw new GmTurnError(waitError, 502);
      }
      delta = reconcileNarratedTravelLocation(parsed.clean, delta, resolvedIntent, roll, currentSnapshot.gameState.location, semantic?.intent === "travel" || Boolean(transitArrival));
      if (input.statePolicy === "committed-trade" && delta) {
        delta = { ...delta, credits: 0, creditsCriminal: 0, inventoryAdd: [], inventoryRemove: [] };
      }
      if (!action && input.openScene) { assertSceneRefreshDelta(delta); delta = {}; }
      if (transitArrival) {
        const arrivalError = transitArrivalFailure(transitArrival, sectionBody(parsed.clean, "GAMEPLAY RESULT"), delta);
        if (arrivalError) throw new GmTurnError(`${arrivalError} Rewrite the same transport turn with arrival, location, and elapsed campaign time.`, 502);
        const completed = Array.isArray(delta?.objectiveComplete) ? delta.objectiveComplete.map(String) : [];
        delta = { ...(delta || {}), ...(transitArrival.objectiveTitle ? { objectiveComplete: [...new Set([...completed, transitArrival.objectiveTitle])] } : {}) };
      }
      assertLocationIntent(delta, resolvedIntent, currentSnapshot.gameState.location, semantic?.intent === "travel" || Boolean(transitArrival));
      if (mode === "play") assertNarratedLocation(parsed.clean, delta, currentSnapshot.gameState.location);
      if (mode === "play") assertMovementSceneProgress(parsed.clean, resolvedIntent, roll, delta, currentSnapshot.gameState.location);
      if (mode === "play") assertNoProgressLoop(parsed.clean, resolvedIntent, delta, currentSnapshot.gameState.location, priorResult);
      if (mode === "play") assertCommercialCredibility(parsed.clean, resolvedIntent, delta);
      if (atelierAppointment && !roll) assertAtelierAppointmentProgress(parsed.clean, action, currentSnapshot.gameState.location);
      if (mode === "play") assertSandboxAgency(parsed.clean, action, roll, delta);
      assertMaterialAuthority(delta, action, roll, currentSnapshot.gameState as Record<string, unknown>, trade);
      assertStoryDirectiveAuthority(delta, actor, currentSnapshot.character as Record<string, unknown>);
      assertNarrativeLedgerConsistency(parsed.clean, delta, resolvedIntent);
      assertNarrativeAuthority(parsed.clean, claims, roll, currentSnapshot.character as Record<string, unknown>, resolvedIntent);
      if (mode === "play") {
        const experienceAward = trade || routineCommerce || Boolean(transitArrival) ? 0 : deriveExperienceAward(delta, roll, currentSnapshot.gameState as Record<string, unknown>, currentSnapshot.character as Record<string, unknown>);
        delta = {
          ...(delta || {}),
          health: Number(delta?.health || 0) + Number(combatResolution?.playerHealthDelta || 0),
          conditionTrack: Number(delta?.conditionTrack || 0) + Number(combatResolution?.playerConditionDelta || 0),
          darkSideScore: Number(delta?.darkSideScore || 0) + Number(forceResolution?.stateDelta?.darkSideScoreDelta || 0),
          experienceAward: Math.max(experienceAward, Number(combatResolution?.experienceAward || 0), Number(forceResolution?.experienceAward || 0)),
        };
      }
      validationError = null;
      fallbackReason = null;
      break;
    } catch (error) {
      const failureKind = classifyGmDraftFailure(error);
      enterPhase(failureKind === "format" ? "validate-format" : failureKind === "provider" ? "invoke-provider" : "validate-semantic", attempt + 1);
      console.warn("[api/gm] draft validation failed", { turnId: input.turnId, attempt: attempt + 1, failureKind, reason: error instanceof Error ? error.message : String(error) });
      recordDraftFailure(turnLifecycle, attempt + 1, "validation", error);
      if (failureKind === "provider") throw error;
      validationError = error;
      parsed = null;
      delta = null;
    }
  }
  // Revalidate saved intermediate work before advancing a turn. Its identity
  // and base revision were checked before any roll or model request.
  if (checkpoint?.stage === "validated" && parsed && mode === "play") {
    enterPhase("revalidate-checkpoint");
    assertCampaignResponseStructure(parsed.clean);
    assertNarrativeFocus(parsed.clean, resolvedIntent);
    assertMechanicalNarration(parsed.clean, roll);
    assertMaterialAuthority(delta, action, roll, currentSnapshot.gameState as Record<string, unknown>, trade);
    assertNarrativeLedgerConsistency(parsed.clean, delta, resolvedIntent);
    assertQuotedOfferConsistency(parsed.clean, delta, trade);
  }
  if (validationError) {
    const proposalRecovery = mode === "play" ? resolvedProposalDiscussion(currentSnapshot, action, semantic?.intent, roll) : null;
    const interiorRecovery = mode === "play" && !roll && !trade && !encounter
      ? planInteriorMovement(resolvedIntent, currentSnapshot.gameState.location) : null;
    const serviceRecovery = routineServiceInquiry && !roll && !trade && response?.content && response.provider !== "local-safe-fallback"
      ? resolvedServiceInquiryNarration(currentSnapshot, action) : null;
    if (mode === "play" && isReadOnlyGoodsInspection(action)) {
      fallbackReason = "validation";
      response = resolvedGoodsInspectionNarration(currentSnapshot, action);
      parsed = parseEngineResponse(response.content, { requireState: true });
      delta = {};
      validationError = null;
    } else if (proposalRecovery) {
      fallbackReason = "validation";
      response = proposalRecovery;
      parsed = parseEngineResponse(response.content, { requireState: true });
      delta = parsed.delta as unknown as Record<string, unknown>;
      assertCampaignResponseStructure(parsed.clean);
      assertMechanicalNarration(parsed.clean, null);
      assertMaterialAuthority(delta, action, null, currentSnapshot.gameState as Record<string, unknown>, null);
      validationError = null;
    } else if (interiorRecovery) {
      // A safely reachable public interior waypoint must not cause a terminal 503
      // merely because all provider drafts kept the character in the old room.
      const recovered = recoverInteriorMovement(interiorRecovery);
      fallbackReason = "validation";
      response = {provider:"local-safe-fallback",model:"interior-movement-receipt",finishReason:"stop",content:recovered.content};
      parsed = parseEngineResponse(recovered.content, {requireState:true});
      delta = parsed.delta as unknown as Record<string,unknown>;
      assertCampaignResponseStructure(parsed.clean);
      assertNarratedLocation(parsed.clean, delta, currentSnapshot.gameState.location);
      assertMovementSceneProgress(parsed.clean, resolvedIntent, null, delta, currentSnapshot.gameState.location);
      assertNoProgressLoop(parsed.clean, resolvedIntent, delta, currentSnapshot.gameState.location, priorResult);
      assertMaterialAuthority(delta, action, null, currentSnapshot.gameState as Record<string,unknown>, null);
      assertNarrativeLedgerConsistency(parsed.clean, delta, resolvedIntent);
      validationError = null;
    } else if (atelierAppointment && !roll && !trade) {
      // The GM must not strand a client at Nuvorren behind circular refusals.
      // This last resort gives a concrete intake route, NOT a booking or sale.
      const recovered = atelierAppointmentRecovery(String(currentSnapshot.gameState.location || ""));
      fallbackReason = "validation";
      response = {provider:"local-safe-fallback",model:"atelier-intake-receipt",finishReason:"stop",content:recovered.content};
      parsed = parseEngineResponse(recovered.content, {requireState:true});
      delta = parsed.delta as unknown as Record<string, unknown>;
      assertCampaignResponseStructure(parsed.clean);
      assertAtelierAppointmentProgress(parsed.clean, action, currentSnapshot.gameState.location);
      assertMechanicalNarration(parsed.clean, null);
      assertNoProgressLoop(parsed.clean, action, delta, currentSnapshot.gameState.location, priorResult);
      assertMaterialAuthority(delta, action, null, currentSnapshot.gameState as Record<string, unknown>, null);
      assertNarrativeLedgerConsistency(parsed.clean, delta, resolvedIntent);
      validationError = null;
    } else if (serviceRecovery) {
      // Three malformed GM drafts must not strand a harmless service inquiry.
      // Use only established service-desk context and a zero-mutation receipt.
      const recovered = serviceRecovery;
      fallbackReason = "validation";
      response = recovered;
      parsed = parseEngineResponse(recovered.content, { requireState: true });
      delta = {};
      assertCampaignResponseStructure(parsed.clean);
      assertNarrativeFocus(parsed.clean, action);
      assertMechanicalNarration(parsed.clean, null);
      assertMaterialAuthority(delta, action, null, currentSnapshot.gameState as Record<string, unknown>);
      assertNarrativeLedgerConsistency(parsed.clean, delta, resolvedIntent);
      assertNoProgressLoop(parsed.clean, resolvedIntent, delta, currentSnapshot.gameState.location, priorResult);
      validationError = null;
    } else if (mode === "play" && isCommercialTravelProgressAction(resolvedIntent)) {
      fallbackReason = "validation";
      response = resolvedCommercialProgressNarration(currentSnapshot, resolvedIntent, roll);
      parsed = parseEngineResponse(response.content, { requireState: true });
      parsed = { ...parsed, clean: ensurePlayerOptions(normalizePlayerOptions(parsed.clean), currentSnapshot.gameState, currentSnapshot.character as Record<string, unknown>, action) };
      parsed = { ...parsed, clean: normalizeCampaignSections(parsed.clean, parsed.delta as Record<string, unknown> | null, currentSnapshot.gameState.location, !permitsLocationChange(resolvedIntent) && semantic?.intent !== "travel" && !transitArrival && !(parsed.delta as Record<string, unknown> | null)?.location) };
      assertCampaignResponseStructure(parsed.clean);
      assertNarrativeFocus(parsed.clean, action);
      assertActionConstraints(parsed.clean, resolvedIntent);
      assertMechanicalNarration(parsed.clean, roll);
      assertResolvedOutcome(parsed.clean, roll, parsed.delta as Record<string, unknown> | null, resolvedIntent);
      if (mode === "play") assertRpgOutcomeFocus(actionContract,parsed.clean);
      delta = constrainFailedCheckDelta(parsed.delta as Record<string, unknown> | null, roll, resolvedIntent);
      delta = constrainExperienceAward(delta, roll);
      assertNoProgressLoop(parsed.clean, resolvedIntent, delta, currentSnapshot.gameState.location, priorResult);
      assertCommercialCredibility(parsed.clean, resolvedIntent, delta);
      assertMaterialAuthority(delta, action, roll, currentSnapshot.gameState as Record<string, unknown>, null);
      assertNarrativeLedgerConsistency(parsed.clean, delta, resolvedIntent);
      const experienceAward = routineCommerce ? 0 : deriveExperienceAward(delta, roll, currentSnapshot.gameState as Record<string, unknown>, currentSnapshot.character as Record<string, unknown>);
      delta = { ...(delta || {}), experienceAward };
      validationError = null;
    } else if (mode === "play" && !roll && !trade && !encounter && mayUseCivilianAgencyRecovery(action, currentSnapshot.gameState.location)) {
      // All ordinary civilian sandbox attempts still have an independent avenue
      // after the specific service/travel recoveries have run.
      const recovered = civilianAgencyRecovery(action, String(currentSnapshot.gameState.location || ""));
      fallbackReason = "validation";
      response = {provider:"local-safe-fallback",model:"civilian-agency-recovery",finishReason:"stop",content:recovered.content};
      parsed = parseEngineResponse(recovered.content, {requireState:true});
      delta = parsed.delta as unknown as Record<string,unknown>;
      assertCampaignResponseStructure(parsed.clean);
      assertSandboxAgency(parsed.clean, action, null, delta);
      assertMechanicalNarration(parsed.clean, null);
      assertNoProgressLoop(parsed.clean, action, delta, currentSnapshot.gameState.location, priorResult);
      assertMaterialAuthority(delta, action, null, currentSnapshot.gameState as Record<string,unknown>, null);
      assertNarrativeLedgerConsistency(parsed.clean, delta, resolvedIntent);
      validationError = null;
    } else {
      enterPhase("drafting-exhausted", 3);
      console.error("[api/gm] drafting exhausted", {
        turnId: input.turnId,
        revision: input.revision,
        attempts: 3,
        reason: validationError instanceof Error ? validationError.message : String(validationError),
      });
      if (mode !== "play" || (!authoritativeResolution && trade?.status !== "accepted")) {
        // Nothing has resolved: never manufacture progress or replace the scene.
        throw new GmTurnError("The GM could not finish this response. Your action is preserved; the scene and campaign have not advanced. Retry the same action.", 503);
      }
      fallbackReason = "validation";
      response = resolvedMechanicsNarration(currentSnapshot, roll, authoritativeResolution, trade);
      parsed = parseEngineResponse(response.content, { requireState: mode === "play" });
      parsed = { ...parsed, clean: alignMechanicalResult(sanitizeGmNarration(parsed.clean), roll) };
      if (mode === "play") {
        parsed = { ...parsed, clean: ensurePlayerOptions(normalizePlayerOptions(parsed.clean), currentSnapshot.gameState, currentSnapshot.character as Record<string, unknown>, action) };
        parsed = { ...parsed, clean: normalizeCampaignSections(parsed.clean, parsed.delta as Record<string, unknown> | null, currentSnapshot.gameState.location, !permitsLocationChange(resolvedIntent) && semantic?.intent !== "travel" && !transitArrival && !(parsed.delta as Record<string, unknown> | null)?.location) };
        assertCampaignResponseStructure(parsed.clean);
        assertNarrativeFocus(parsed.clean, action);
      }
      assertMechanicalNarration(parsed.clean, roll);
      delta = constrainFailedCheckDelta(parsed.delta as Record<string, unknown> | null, roll, resolvedIntent);
      delta = constrainExperienceAward(delta, roll);
      delta = reconcileConversationTradeDelta(delta, trade);
      if (input.statePolicy === "committed-trade" && delta) delta = { ...delta, credits: 0, creditsCriminal: 0, inventoryAdd: [], inventoryRemove: [] };
      assertLocationIntent(delta, resolvedIntent, currentSnapshot.gameState.location, semantic?.intent === "travel");
      assertMaterialAuthority(delta, action, roll, currentSnapshot.gameState as Record<string, unknown>, trade);
      assertStoryDirectiveAuthority(delta, actor, currentSnapshot.character as Record<string, unknown>);
      assertNarrativeLedgerConsistency(parsed.clean, delta, resolvedIntent);
      assertNarrativeAuthority(parsed.clean, claims, roll, currentSnapshot.character as Record<string, unknown>, resolvedIntent);
      if (mode === "play") {
        const experienceAward = trade || routineCommerce || Boolean(transitArrival) ? 0 : deriveExperienceAward(delta, roll, currentSnapshot.gameState as Record<string, unknown>, currentSnapshot.character as Record<string, unknown>);
        delta = {
          ...(delta || {}),
          health: Number(delta?.health || 0) + Number(combatResolution?.playerHealthDelta || 0),
          conditionTrack: Number(delta?.conditionTrack || 0) + Number(combatResolution?.playerConditionDelta || 0),
          darkSideScore: Number(delta?.darkSideScore || 0) + Number(forceResolution?.stateDelta?.darkSideScoreDelta || 0),
          experienceAward: Math.max(experienceAward, Number(combatResolution?.experienceAward || 0), Number(forceResolution?.experienceAward || 0)),
        };
      }
    }
  }
  if (!response || !parsed) throw new GmTurnError("The GM could not produce a valid authoritative response. No outcome was saved; retry the turn.", 502);
  // All recovery branches must satisfy the same action contract before commit.
  if (mode === "play") {
    assertResolvedOutcome(parsed.clean, roll, delta, resolvedIntent);
    assertRpgOutcomeFocus(actionContract,parsed.clean);
    assertNarratedLocation(parsed.clean, delta, currentSnapshot.gameState.location);
    assertMovementSceneProgress(parsed.clean, resolvedIntent, roll, delta, currentSnapshot.gameState.location);
    const waitError = eventWaitFailure(action, sectionBody(parsed.clean, "GAMEPLAY RESULT"), delta);
    if (waitError) throw new GmTurnError(waitError, 502);
    if (transitArrival) {
      const arrivalError = transitArrivalFailure(transitArrival, sectionBody(parsed.clean, "GAMEPLAY RESULT"), delta);
      if (arrivalError) throw new GmTurnError(arrivalError, 502);
    }
  }
  enterPhase("finalize-state");
  let finalized = mode === "play"
    ? applyFinalizedTurn(currentSnapshot, input.turnId, action, roll, delta || {})
    : mode === "context" && isDmirPrimaryCampaign(actor, currentSnapshot.character as Record<string, unknown>)
      ? { ...currentSnapshot, gameState: appendDmirCreatorCanon(currentSnapshot.gameState, action, actor, currentSnapshot.character as Record<string, unknown>) }
      : currentSnapshot;
  if (mode === "play") {
    finalized = { ...finalized, gameState: commitConversationTradeState(finalized.gameState, delta, trade, input.turnId) };
    finalized = { ...finalized, gameState: reconcileFulfilledObjectives(finalized.gameState) };
    // Derive seller continuity from this finalized scene, not the prior vendor.
  }
  if (mode === "play" && combatResolution) {
    finalized = { ...finalized, gameState: { ...finalized.gameState, combat: combatResolution.combat } };
    if (combatResolution.rolls.length) {
      finalized.gameState.rolls = [...(Array.isArray(finalized.gameState.rolls) ? finalized.gameState.rolls : []), ...combatResolution.rolls].slice(-100);
    }
  }
  if (mode === "play" && forceResolution?.stateDelta) {
    const { darkSideScoreDelta: _darkSideScoreDelta, ...persistentForceState } = forceResolution.stateDelta;
    finalized = { ...finalized, gameState: { ...finalized.gameState, ...persistentForceState } };
  }
  if (mode === "play") finalized = withSceneFrame(finalized, parsed.clean, action, roll, Boolean(input.openScene));
  const messages: Message[] = [...(currentSnapshot.messages as Message[])];
  if (action) messages.push({ role: "user", content: action });
  if (roll) messages.push({ role: "roll", content: rollMessage(roll), roll });
  for (const combatRoll of combatResolution?.rolls || []) messages.push({ role: "roll", content: rollMessage(combatRoll), roll: combatRoll });
  const fallbackDetail = validationError instanceof Error ? validationError.message.slice(0, 500) : null;
  messages.push({ role: "assistant", content: parsed.clean, turnId: input.turnId, provider: response.provider, model: response.model, fallbackReason, fallbackDetail });
  const snapshot: DatapadSnapshot = { ...finalized, messages };
  if (mode === "play") snapshot.gameState = { ...snapshot.gameState, sceneMerchant: sceneMerchant(snapshot) };
  if (mode === "play") snapshot.gameState = recordVisibleSceneNpcs(snapshot.gameState, parsed.clean, input.turnId);
  if (mode === "play") snapshot.gameState = recordNpcMechanics(snapshot.gameState, sceneNpcSheets(snapshot));
  if (mode === "play") {
    // Only the current, actually committed turn can teach firsthand witnesses.
    // The old saved scene—not new GM prose—defines who could observe it.
    const intel=recordCommittedRivalObservation(currentSnapshot,snapshot,input.turnId,action,roll);
    if (intel.memories.length) snapshot.gameState.rivalIntelligence=intel;
  }
  // Reconcile the final world projection after verified commerce, scene and
  // quest updates, just before the authoritative CAS save commits.
  if (mode === "play") snapshot.gameState.questWorld=projectQuestWorld(snapshot);
  if (mode === "play") {
    // Advance independently timed NPC plans and report deliveries only as
    // part of the existing compare-and-swap authoritative save transaction.
    snapshot.gameState.npcOffscreen=advanceNpcOffscreen(currentSnapshot,snapshot,input.turnId,delta);
  }
  if (mode === "play" && isDmirPrimaryCampaign(actor, snapshot.character as Record<string, unknown>)) {
    snapshot.gameState = updateDmirNpcContinuity(snapshot.gameState, delta, input.turnId, action);
  }
  // The completed, validated draft can be reused after a transient failure in
  // persistence. A checkpoint NEVER modifies gameplay state or its revision.
  enterPhase("checkpoint-validated");
  try {
    await storeValidatedDraft(db, accountId, input.turnId, input.revision, action, {
      version: 1, stage: "validated", interpretation, roll: roll && typeof roll === "object" ? roll : null,
      content: mode === "play" ? parsed.clean + "\n<!--STATE:" + JSON.stringify(delta || {}) + "-->" : parsed.clean,
      provider: response.provider, model: response.model,
    });
  } catch (error) {
    if (error instanceof GmDraftIdentityError) throw error;
    // Storage availability must not make an otherwise valid turn fail.
    console.warn("[api/gm] draft checkpoint unavailable", { turnId: input.turnId,
      status: (error as { status?: number } | null)?.status || null });
  }
  enterPhase("persist");
  const persisted = saveAuthoritativeDatapad(actor, accountId, input.revision, snapshot);
  const receipt = commitTurnLifecycle(turnLifecycle, persisted.revision, persisted.updatedAt);
  const result = { snapshot, revision: persisted.revision, updatedAt: persisted.updatedAt, roll, narration: parsed.clean, provider: response.provider, model: response.model, fallbackReason, fallbackDetail, receipt };
  try {
    db.prepare("UPDATE gm_turn_attempts SET status = 'complete', result = ? WHERE account_id = ? AND turn_id = ?").run(JSON.stringify(result), accountId, input.turnId);
  } catch (error) {
    // The authoritative save already committed. Do not turn a successful gameplay
    // transaction into a misleading 503 just because the local result cache
    // failed. The committed turn event still prevents duplicate state changes.
    console.error("[api/gm] local result cache failed after commit v2", {
      turnId: input.turnId,
      revision: persisted.revision,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
  return result;
  } catch (error) {
    const fault = error as { message?: string; status?: number; name?: string; code?: string } | null;
    const failedReceipt = failTurnLifecycle(turnLifecycle, phase, fault?.message || String(error), Number(fault?.status) || 500);
    if (error && typeof error === "object") (error as { turnLifecycle?: TurnLifecycleReceipt }).turnLifecycle = failedReceipt;
    console.error("[api/gm] turn phase failure v2", {
      turnId: input.turnId,
      revision: input.revision,
      phase,
      draftAttempt,
      name: fault?.name || "Unknown",
      status: fault?.status || null,
      code: fault?.code || null,
      reason: fault?.message || String(error),
    });
    throw error; // Never convert a failure into a fictional gameplay outcome.
  }
}
