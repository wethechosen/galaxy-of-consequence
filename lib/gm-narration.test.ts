import { describe, expect, it } from "vitest";
import { attachRepairedLedger, appendTurnEvent, assertCampaignResponseStructure, assertFreshScene, assertMaterialAuthority, assertMechanicalNarration, assertMovementSceneProgress, assertNarrativeAuthority, assertNarrativeFocus, assertNarrativeLedgerConsistency, assertStoryDirectiveAuthority, authorityWarnings, buildLocalSafeFallback, constrainExperienceAward, constrainFailedCheckDelta, deriveExperienceAward, ensureStateUpdateSection, extractSceneNarration, GM_SYSTEM, normalizePlayerOptions, normalizeTurnAction, safeMessages, sanitizeGmNarration, sceneSimilarity, withSceneFrame } from "./gm";
import { parseEngineResponse } from "@/original/lib/engineState";
import { planConversationTrade, reconcileConversationTradeDelta } from "./conversation-trade";

describe("authoritative Saga narration", () => {
  it("repairs a blank final state section even when options are also missing", () => {
    const narration = "## LOCATION\nMarket\n## SCENE\nThe seller waits.\n## GM ADJUDICATION\nA public inquiry.\n## GAMEPLAY RESULT\nThe vendor names a nearby guesthouse.\n## SAGA CHECK\nNo check required.\n## STATE UPDATE\n";
    expect(ensureStateUpdateSection(narration, {})).toContain("STATE UPDATE\nNo persistent change.");
  });
  it("requires the specific earned Force power even when Use the Force is trained", () => {
    const character = { trainedSkills: ["Use the Force"], feats: "Force Training", forcePowers: "Mind Trick" };
    expect(() => assertNarrativeAuthority("You telekinetically lift the slab.", [], null, character, "I lift the slab with the Force")).toThrow(/not earned/);
    expect(() => assertNarrativeAuthority("The slab rises under your telekinetic command.", [], null, character, "I lift the slab with the Force")).toThrow(/not earned/);
    expect(() => assertNarrativeAuthority("You reach out, but the slab remains still.\nPLAYER OPTIONS\nA. Train before attempting to lift it with the Force.", [], null, character, "I lift the slab with the Force")).not.toThrow();
    expect(() => assertNarrativeAuthority("You telekinetically lift the slab.", [], { outcome: "success" }, { ...character, forcePowers: "Move Object" }, "I lift the slab with the Force")).not.toThrow();
  });
  it("distinguishes received information and future suggestions from completed currency or item transfers", () => {
    expect(() => assertNarrativeLedgerConsistency("You receive directions to a guesthouse. You now have an address. You obtain information about paid rooms.", {})).not.toThrow();
    expect(() => assertNarrativeLedgerConsistency("You receive 500 credits.", {})).toThrow(/credit transfer/);
    expect(() => assertNarrativeLedgerConsistency("You receive 500 credits.", { credits: 500 })).not.toThrow();
    expect(() => assertNarrativeLedgerConsistency("Transaction complete. You hand over 1,500 credits and take the suit.", { credits: -1500, inventoryAdd: [{ name: "Suit", qty: 1 }] })).not.toThrow();
    expect(() => assertNarrativeLedgerConsistency("No payment occurs.\nPLAYER OPTIONS\nA. You pay 20 credits for a room.\nB. You acquire a suit.", {})).not.toThrow();
  });
  it("allows an exact no-roll merchant transaction but no unquoted windfall", () => {
    const state = { location: "market", credits: 3000, tradeOffers: [{ id: "offer:quoted", sourceTurnId: "quote-turn", location: "market", status: "open", sellerName: "clothing vendor", totalCredits: 1500, items: [{ name: "Armored spacer's flight suit", qty: 1, tag: "armor" }] }] };
    const trade = planConversationTrade("I buy the suit", state, "purchase-turn");
    const delta = reconcileConversationTradeDelta({}, trade);
    expect(() => assertMaterialAuthority(delta, "I buy the suit", null, state, trade)).not.toThrow();
    expect(() => assertMaterialAuthority({ ...delta, propertyAdd: [{ name: "Free palace" }] }, "I buy the suit", null, state, trade)).toThrow();
    expect(() => assertNarrativeLedgerConsistency("You hand over 1,500 credits and take the armored suit.", {})).toThrow(/payment/);
    expect(() => assertNarrativeLedgerConsistency("You hand over 1,500 credits and take the armored suit.", delta)).not.toThrow();
  });
  it("does not reject an NPC question as an unchosen player emotion", () => {
    expect(() => assertNarrativeFocus('SCENE\nThe vendor asks, “You want a room?”\nGAMEPLAY RESULT\nHe points to the lodging desk.', "Ain't looking for free")).not.toThrow();
    expect(() => assertNarrativeFocus('SCENE\nYou want a safe place to rest.\nGAMEPLAY RESULT\nThe vendor quotes a room.', 'I want somewhere to rest')).not.toThrow();
    expect(() => assertNarrativeFocus('SCENE\nYou decide to accept the room.\nGAMEPLAY RESULT\nPayment is made.', 'I ask about rooms')).toThrow(/unchosen/);
  });
  it("keeps credit-free market conversation in the market with a concrete lodging lead", () => {
    const output = buildLocalSafeFallback({ mode: "play", action: "Ain't looking for free, I say", location: "Coruscant — lower-city local market", roll: null, combatSummary: null, merchant: { name: "clothing vendor", species: "Twi'lek", location: "Coruscant — lower-city local market" }, state: {}, character: {} });
    const parsed = parseEngineResponse(output.content, { requireState: true });
    expect(parsed.clean).toContain("guesthouse desk");
    expect(parsed.clean).toContain("Twi'lek");
    expect(parsed.clean).not.toMatch(/conduit|Force|dark-side/i);
    expect(parsed.delta).not.toHaveProperty("timeAdvanceMinutes");
    expect(parsed.delta).not.toHaveProperty("credits");
  });
  it("can reach a vendor in the same market when AI drafting is unavailable", () => {
    const action = 'I head towards the clothing vendor';
    const parsed = parseEngineResponse(buildLocalSafeFallback({ mode: "play", action, location: "market", roll: null }).content, { requireState: true });
    expect(parsed.clean).toContain('reach the clothing stall');
    expect(() => assertMovementSceneProgress(parsed.clean, action, null, parsed.delta as Record<string, unknown> | null, 'market')).not.toThrow();
  });
  it("rejects invented dice on an ordinary no-check turn", () => {
    expect(() => assertMechanicalNarration('## SAGA CHECK\nPersuasion: 1d20+0 = 12 vs DC 15 — Failure\n## STATE UPDATE\nNone.', null)).toThrow(/invented dice/);
    expect(() => assertMechanicalNarration('## SAGA CHECK\nNo check required.\n## STATE UPDATE\nNone.', null)).not.toThrow();
  });
  it("strips retry direction prefixes before action resolution", () => expect(normalizeTurnAction("Continue with a specific declared action. i use a medpac")).toBe("i use a medpac"));
  it("accepts narration that preserves the server result", () => {
    expect(() => assertMechanicalNarration("GM RESOLUTION\nRESULT: FAILURE\nThe lock remains sealed.", { outcome: "failure" })).not.toThrow();
  });

  it("rejects a missing or contradictory result before saving", () => {
    expect(() => assertMechanicalNarration("The archive opens and the files download.", { outcome: "failure" })).toThrow(/did not preserve/);
    expect(() => assertMechanicalNarration("RESULT: SUCCESS", { outcome: "failure" })).toThrow(/did not preserve/);
  });

  it("rejects prose that disguises a failed objective as success", () => {
    expect(() => assertMechanicalNarration("GM RESOLUTION\nRESULT: FAILURE\nAuthorization confirmed. The transfer completes.", { outcome: "failure" })).toThrow(/failed objective/);
    expect(() => assertMechanicalNarration("GM RESOLUTION\nRESULT: FAILURE\nThe lock remains sealed and the attempt draws attention.", { outcome: "failure" })).not.toThrow();
  });

  it("requires the complete GM response contract in order", () => {
    const valid = "LOCATION\nCoruscant — lower-city substructure\nSCENE\nImmediate situation.\nGM ADJUDICATION\nThe declared attempt is valid.\nGAMEPLAY RESULT\nThe world answers the attempt.\nSAGA CHECK\nNo check required.\nSTATE UPDATE\nNo persistent change.\nPLAYER OPTIONS\nA. Observe the hatch.\nB. Secure the room.\nC. Study the controls.\nD. Withdraw to cover.\nYou may declare another action.";
    expect(() => assertCampaignResponseStructure(valid)).not.toThrow();
    expect(() => assertCampaignResponseStructure("LOCATION\nHere\nSCENE\nText\nSTATE UPDATE\nNone\nPLAYER OPTIONS\nAct")).toThrow(/GM ADJUDICATION/);
    expect(() => assertCampaignResponseStructure("GM ADJUDICATION\nNone\nLOCATION\nHere\nSCENE\nText\nGAMEPLAY RESULT\nNone\nSAGA CHECK\nNone\nSTATE UPDATE\nNone\nPLAYER OPTIONS\nAct")).toThrow(/GM ADJUDICATION/);
    expect(() => assertCampaignResponseStructure("LOCATION\nHere\nSCENE\nText\nGM ADJUDICATION\nAttempt.\nGAMEPLAY RESULT\nResult.\nSAGA CHECK\nNone.\nSTATE UPDATE\nNone\nPLAYER OPTIONS\nA. Act.\nYou may declare another action.")).toThrow(/2–4 alphabetical/);
    expect(() => assertCampaignResponseStructure(`${valid}\nWhat do you do?`)).toThrow(/neutral option contract/);
  });

  it("preserves an authored turn when an empty ledger leaves STATE UPDATE blank", () => {
    const draft = "LOCATION\nCoruscant — lower-city substructure\nSCENE\nThe old stone answers with a pulse beneath D'mir's palm.\nGM ADJUDICATION\nThe attempt is valid.\nGAMEPLAY RESULT\nThe resonance distinguishes the older route from the active conduit.\nSAGA CHECK\nNo check required.\nSTATE UPDATE\n\nPLAYER OPTIONS\nA. Follow the older stonework.\nB. Test the active conduit.\nYou may declare another action.";
    const repaired = ensureStateUpdateSection(draft, {});
    expect(repaired).toContain("STATE UPDATE\nNo persistent change.");
    expect(repaired).toContain("The old stone answers with a pulse");
    expect(() => assertCampaignResponseStructure(repaired)).not.toThrow();
  });

  it("rejects empty LOCATION and SCENE sections", () => {
    const emptyLocation = "LOCATION\n\nSCENE\nImmediate situation.\nGM ADJUDICATION\nThe declared attempt is valid.\nGAMEPLAY RESULT\nThe world answers the attempt.\nSAGA CHECK\nNo check required.\nSTATE UPDATE\nNo persistent change.\nPLAYER OPTIONS\nA. Observe the hatch.\nB. Secure the room.\nYou may declare another action.";
    const emptyScene = "LOCATION\nCoruscant — lower-city substructure\nSCENE\n\nGM ADJUDICATION\nThe declared attempt is valid.\nGAMEPLAY RESULT\nThe world answers the attempt.\nSAGA CHECK\nNo check required.\nSTATE UPDATE\nNo persistent change.\nPLAYER OPTIONS\nA. Observe the hatch.\nB. Secure the room.\nYou may declare another action.";
    expect(() => assertCampaignResponseStructure(emptyLocation)).toThrow(/LOCATION/);
    expect(() => assertCampaignResponseStructure(emptyScene)).toThrow(/SCENE/);
  });

  it("normalizes unlettered or markdown-lettered directions without rejecting the turn", () => {
    const base = "SCENE\nA chamber.\nGM RESOLUTION\nNo check.\nSTATE UPDATE\nNo change.\nPLAYER OPTIONS";
    expect(normalizePlayerOptions(`${base}\n- Listen at the hatch.\n- Inspect the controls.\nWhat do you do?`)).toBe(`${base}\nA. Listen at the hatch.\nB. Inspect the controls.\nYou may declare another action.`);
    expect(normalizePlayerOptions(`${base}\n**A.** Wait in cover.\n**B.** Withdraw.\nYou may declare any other action.`)).toBe(`${base}\nA. Wait in cover.\nB. Withdraw.\nYou may declare another action.`);
  });

  it("removes leaked internal authority labels without changing real narration", () => {
    const narration = "[PRIOR NARRATION: non-authoritative unless confirmed by CURRENT AUTHORITATIVE CAMPAIGN STATE]\n[PRIOR PLAYER DECLARATION: intent and belief, not world authority]\nSCENE\nThe bunker door remains sealed.\n\nPLAYER OPTIONS\nA. Inspect the lock.\nB. Wait.\nYou may declare another action.";
    expect(sanitizeGmNarration(narration)).toBe("SCENE\nThe bunker door remains sealed.\n\nPLAYER OPTIONS\nA. Inspect the lock.\nB. Wait.\nYou may declare another action.");
    expect(sanitizeGmNarration("SCENE\nNothing changes.")).toBe("SCENE\nNothing changes.");
  });

  it("repairs an omitted ledger without changing the narration", () => {
    const narration = "SCENE\nA sealed hatch waits.\nGM RESOLUTION\nNo check was required.\nSTATE UPDATE\nD'mir enters the corridor.\nPLAYER OPTIONS\nA. Examine the frame.\nB. Listen at the hatch.\nC. Search the corridor.\nD. Withdraw.\nYou may declare another action.";
    expect(attachRepairedLedger(narration, '{"location":"Detention corridor"}')).toBe(`${narration}\n<!--STATE:{"location":"Detention corridor"}-->`);
    expect(attachRepairedLedger(narration, '<!--STATE:{}-->')).toBe(`${narration}\n<!--STATE:{}-->`);
    expect(attachRepairedLedger(`${narration}\n<!--STATE:{"conditionAdd":"strained"}-->`, '<!--STATE:{"conditionAdd":[{"name":"strained"}]}-->')).toBe(`${narration}\n<!--STATE:{"conditionAdd":[{"name":"strained"}]}-->`);
    expect(() => attachRepairedLedger(narration, "not valid JSON")).toThrow(/ledger repair was malformed/);
    expect(attachRepairedLedger(narration, '```json\n{“timeAdvanceMinutes”: 5,}\n```')).toBe(`${narration}\n<!--STATE:{"timeAdvanceMinutes":5}-->`);
  });

  it("keeps gameplay available with a credit-free deterministic fallback", () => {
    const response = buildLocalSafeFallback({
      mode: "play",
      action: "I search the maintenance hatch",
      location: "Coruscant — Level 1313",
      roll: { label: "Perception", formula: "1d20+2", raw: 14, modifier: 2, total: 16, target: 15, targetLabel: "DC", targetVisible: true, outcome: "success" },
    });
    expect(response.provider).toBe("local-safe-fallback");
    expect(response.content).toContain("RESULT: SUCCESS");
    expect(response.content).not.toMatch(/NVIDIA|provider|quota|API/i);
    const parsed = parseEngineResponse(response.content, { requireState: true });
    expect(parsed.delta).toEqual({ timeAdvanceMinutes: 5 });
    expect(() => assertCampaignResponseStructure(parsed.clean)).not.toThrow();
    expect(() => assertMechanicalNarration(parsed.clean, { outcome: "success" })).not.toThrow();
  });

  it("never grants an unverified result when fallback play has no check", () => {
    const response = buildLocalSafeFallback({ mode: "play", action: "I wait and listen", location: "A concealed bunker", roll: null });
    const parsed = parseEngineResponse(response.content, { requireState: true });
    expect(parsed.delta).toEqual({ timeAdvanceMinutes: 5 });
    expect(parsed.clean).toContain("Time advances 5 minutes");
  });

  it("makes deterministic narration react differently to different actions", () => {
    const meditation = buildLocalSafeFallback({ mode: "play", action: "I meditate without moving", location: "Coruscant — lower-city transit route", roll: null }).content;
    const movement = buildLocalSafeFallback({ mode: "play", action: "I follow the pressure", location: "Coruscant — lower-city transit route", roll: null }).content;
    const waiting = buildLocalSafeFallback({ mode: "play", action: "I end my turn", location: "Coruscant — lower-city transit route", roll: null }).content;
    expect(meditation).toMatch(/hold your position and narrow your attention/i);
    expect(movement).toMatch(/maintenance junction/i);
    expect(waiting).toMatch(/ventilation cycle/i);
    expect(new Set([extractSceneNarration(meditation), extractSceneNarration(movement), extractSceneNarration(waiting)]).size).toBe(3);
    expect(`${meditation}${movement}${waiting}`).not.toMatch(/\bthe player\b/i);
  });

  it("does not narrate a negated attack as combat in the deterministic fallback", () => {
    const response = buildLocalSafeFallback({
      mode: "play",
      action: "I do not attack anyone; I meditate in place",
      location: "Coruscant — lower-city transit route",
      roll: null,
    }).content;
    expect(response).toMatch(/hold your position and narrow your attention/i);
    expect(response).toMatch(/slow your breathing/i);
    expect(response).not.toMatch(/your attack begins|declared combat action|target, cover, and distance/i);
  });

  it("rejects copied scene prose and accepts a genuinely new beat", () => {
    const prior = "Old conduits crowd the left wall while service lights flicker over the damp deck.\n\nA low vibration passes through the floor and fades toward the eastern passage.";
    const copied = `SCENE\n${prior}\nGM RESOLUTION\nNo check.\nSTATE UPDATE\nNone.\nPLAYER OPTIONS\nA. Wait.\nB. Listen.\nYou may declare another action.`;
    const fresh = "SCENE\nYou reach a three-way maintenance junction. A recessed service door faces two offset passages, and the vibration is strongest beneath the left-hand threshold.\n\nA cart wheel turns slowly in the airflow, marking a current from the darker branch.\nGM RESOLUTION\nNo check.\nSTATE UPDATE\nPosition advanced.\nPLAYER OPTIONS\nA. Inspect the door.\nB. Compare the passages.\nYou may declare another action.";
    expect(sceneSimilarity(prior, copied)).toBeGreaterThan(0.7);
    expect(() => assertFreshScene(copied, prior, "I follow the passage")).toThrow(/repeated the prior scene/);
    expect(() => assertFreshScene(fresh, prior, "I follow the passage")).not.toThrow();
  });

  it("rejects an actionable turn whose SCENE is too thin to establish the fiction", () => {
    const thin = "LOCATION\nCoruscant — lower-city substructure\nSCENE\nYou stand in a corridor.\nGM ADJUDICATION\nThe movement is allowed.\nGAMEPLAY RESULT\nYou continue.\nSAGA CHECK\nNo check required.\nSTATE UPDATE\nTime advances.\nPLAYER OPTIONS\nA. Continue.\nB. Wait.\nYou may declare another action.";
    expect(() => assertFreshScene(thin, "", "I follow the pressure deeper")).toThrow(/SCENE|scene/);
  });

  it("requires ordinary movement to reach an observable stopping point", () => {
    const vague = "SCENE\nYou continue through the same generic corridor. The machinery keeps humming around you.\nGM RESOLUTION\nNo check.\nSTATE UPDATE\nFive minutes pass.\nPLAYER OPTIONS\nA. Continue.\nB. Wait.\nYou may declare another action.";
    const concrete = "SCENE\nYou reach a maintenance junction and stop opposite a sealed service door.\nGM RESOLUTION\nNo check.\nSTATE UPDATE\nYour position advances.\nPLAYER OPTIONS\nA. Inspect the door.\nB. Compare the branches.\nYou may declare another action.";
    expect(() => assertMovementSceneProgress(vague, "I follow the route", null, {}, "Transit route")).toThrow(/observable position/);
    expect(() => assertMovementSceneProgress(concrete, "I follow the route", null, {}, "Transit route")).not.toThrow();
    expect(() => assertMovementSceneProgress(vague, "I remain still", null, {}, "Transit route")).not.toThrow();
  });

  it("stores the current narrated beat and advances route progress only through play", () => {
    const base = { character: { name: "D'mir Holloran" }, gameState: { location: "Transit route" }, messages: [], comms: [], settings: {} };
    const first = withSceneFrame(base, "SCENE\nYou reach a junction.\nGM RESOLUTION\nNo check.\nSTATE UPDATE\nPosition advanced.\nPLAYER OPTIONS\nA. Wait.\nB. Listen.\nYou may declare another action.", "I follow the route", null, false, "2026-10-03T00:00:00.000Z");
    expect(first.gameState.scene).toMatchObject({ beat: 1, routeProgress: 1, action: "I follow the route", location: "Transit route" });
    const refresh = withSceneFrame(first, "SCENE\nAmber light shows the same junction from a sharper angle.\nGM RESOLUTION\nYou have not acted yet. No time passes.\nSTATE UPDATE\nNothing changes.\nPLAYER OPTIONS\nA. Wait.\nB. Listen.\nYou may declare another action.", "", null, true, "2026-10-03T00:01:00.000Z");
    expect(refresh.gameState.scene).toMatchObject({ beat: 1, routeProgress: 1, action: "Open scene" });
  });

  it("sends prior outcomes without replaying old scene prose", () => {
    const snapshot = {
      character: { name: "D'mir Holloran" }, gameState: {}, comms: [], settings: {},
      messages: [
        { role: "user", content: "I follow the pressure" },
        { role: "assistant", content: "SCENE\nYou are already in the deeper lower-city substructure. Worn durasteel walls and utility conduits show the scars of age and stress.\nGM RESOLUTION\nNo check.\nSTATE UPDATE\nFive minutes pass.\nPLAYER OPTIONS\nA. Continue.\nB. Wait.\nYou may declare another action." },
        { role: "user", content: "I inspect the junction" },
        { role: "assistant", content: "SCENE\nA junction opens ahead.\nGM RESOLUTION\nPerception succeeds.\nSTATE UPDATE\nA service mark is discovered.\nPLAYER OPTIONS\nA. Read it.\nB. Wait.\nYou may declare another action.", provider: "nvidia" },
      ],
    };
    const history = safeMessages(snapshot);
    expect(history).toHaveLength(2);
    expect(history[0].content).toBe("I inspect the junction");
    expect(history[1].content).toContain("Perception succeeds");
    expect(history[1].content).not.toContain("A junction opens ahead");
    expect(JSON.stringify(history)).not.toContain("Worn durasteel walls");
  });
});

describe("GM state authority", () => {
  it("removes rewards, discoveries, inventory, and XP from failed checks", () => {
    const delta = constrainFailedCheckDelta({ credits: 500, inventoryAdd: [{ name: "Datapad", qty: 1 }], discoveryAdd: [{ title: "Cache" }], experienceAward: 200, health: -2 }, { outcome: "failure" });
    expect(delta).toEqual({ health: -2 });
  });

  it("keeps fail-forward costs and declared movement while stripping failed rewards", () => {
    const delta = constrainFailedCheckDelta({
      location: "Foundation bulkhead",
      timeAdvanceMinutes: 10,
      objectiveAdd: [{ title: "Find another way through the sealed bulkhead" }],
      discoveryAdd: [{ title: "Ancient Sith vergence confirmed" }],
      inventoryAdd: [{ name: "Sith holocron", qty: 1 }],
      experienceAward: 500,
    }, { outcome: "failure" }, "I follow the pressure deeper");
    expect(delta).toEqual({
      timeAdvanceMinutes: 10,
      location: "Foundation bulkhead",
      objectiveAdd: [{ title: "Find another way through the sealed bulkhead" }],
    });
  });

  it("removes XP from ordinary descriptive turns", () => {
    expect(constrainExperienceAward({ experienceAward: 200, note: "Looked around." }, null)).toEqual({ note: "Looked around." });
    expect(constrainExperienceAward({ experienceAward: 200, objectiveComplete: ["Escape"] }, null)).toEqual({ objectiveComplete: ["Escape"] });
    expect(constrainExperienceAward({ experienceAward: 200, objectiveComplete: ["Escape"] }, { outcome: "success" })).toMatchObject({ experienceAward: 200 });
  });

  it("derives conservative XP on the server from confirmed outcomes", () => {
    const character = { level: 1, experience: 0 };
    const state = { objectives: [{ title: "Escape detention", status: "active" }], milestones: [], decisions: [] };
    expect(deriveExperienceAward({ location: "Hallway" }, null, state, character)).toBe(0);
    expect(deriveExperienceAward({ discoveryAdd: [{ title: "Guard rotation" }] }, { outcome: "success", target: 15 }, state, character)).toBe(100);
    expect(deriveExperienceAward({ decisionAdd: [{ title: "Refuse the gang" }] }, null, state, character)).toBe(100);
    expect(deriveExperienceAward({ objectiveComplete: ["Escape detention"] }, null, state, character)).toBe(200);
    expect(deriveExperienceAward({ milestoneAdd: [{ title: "Prison escaped" }] }, null, state, character)).toBe(200);
    expect(deriveExperienceAward({ milestoneAdd: [{ title: "Prison escaped" }] }, null, { ...state, milestones: [{ title: "Prison escaped" }] }, character)).toBe(0);
    expect(deriveExperienceAward(
      { storyDirectiveAdd: [{ title: "Escape Coruscant", status: "completed" }] },
      null,
      { ...state, storyDirectives: [{ title: "Escape Coruscant", status: "active" }] },
      character,
    )).toBe(200);
    expect(deriveExperienceAward(
      { storyDirectiveAdd: [{ title: "Instant mastery", status: "completed" }] },
      null,
      state,
      character,
    )).toBe(0);
  });

  it("does not award XP when a failed check claims a story directive was completed", () => {
    const state = {
      objectives: [],
      milestones: [],
      decisions: [],
      storyDirectives: [{ title: "Reach the ancient vergence", status: "active" }],
    };
    expect(deriveExperienceAward(
      { storyDirectiveAdd: [{ title: "Reach the ancient vergence", status: "completed" }] },
      { outcome: "failure", target: 20 },
      state,
      { level: 1, experience: 0 },
    )).toBe(0);
  });

  it("records one auditable event per committed turn", () => {
    const state = appendTurnEvent({}, "turn-123456", "I search the desk", { id: "roll-1", kind: "skill", label: "Perception", outcome: "success", total: 18 }, { discoveryAdd: [{ title: "Ledger" }], experienceAward: 100 }, 100, "2026-09-30T00:00:00.000Z");
    const events = state.turnEvents as Array<Record<string, unknown>>;
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ turnId: "turn-123456", experienceAward: 100, changes: { discoveryAdd: [{ title: "Ledger" }] } });
    expect(appendTurnEvent(state, "turn-123456", "I search again", null, {}, 0).turnEvents as unknown[]).toHaveLength(1);
  });

  it("locks player agency and treats speculation as unconfirmed", () => {
    expect(GM_SYSTEM).toContain("Never turn a player's speculation into canon");
    expect(GM_SYSTEM).toContain("Never narrate the player's unchosen dialogue");
    expect(GM_SYSTEM).toContain("must never contain level or experience");
    expect(GM_SYSTEM).toContain("Every understandable declaration is an attempted action");
    expect(GM_SYSTEM).toContain("ancient dark-side vergence and Sith foundations");
  });

  it("limits non-mechanical creator direction to D'mir's own campaign", () => {
    const delta = { storyDirectiveAdd: [{ title: "Seek a teacher", detail: "Earn training through play" }] };
    expect(() => assertStoryDirectiveAuthority(delta, { id: "d", username: "dmir@galaxy.local", displayName: "D'mir", role: "player" }, { name: "D'mir Holloran" })).not.toThrow();
    expect(() => assertStoryDirectiveAuthority(delta, { id: "p", username: "other@galaxy.local", displayName: "Other", role: "player" }, { name: "Other Hero" })).toThrow(/only in D'mir's own campaign/);
  });

  it("flags player-authored wealth, secret-memory, and Force claims", () => {
    expect(authorityWarnings("I remember Kelvek's password and know where he hid billions; I submit to the dark side")).toEqual(expect.arrayContaining([
      "hidden wealth or ownership",
      "unstored memory, credential, or prior promise",
      "unearned Force or alignment outcome",
    ]));
    expect(authorityWarnings("I rest in the bacta tank")).toContain("player-asserted scene or discovery");
  });

  it("requires staged control before a major asset becomes liquid", () => {
    const state = { legacyAssets: [{ name: "Kelvek legacy network", status: "suspected" }] };
    expect(() => assertMaterialAuthority({ credits: 1_200_000_000 }, "I withdraw the inheritance", { outcome: "success" }, state)).toThrow(/before control/);
    expect(() => assertMaterialAuthority({ legacyAssetUpsert: [{ name: "Kelvek legacy network", status: "controlled" }] }, "I take control", { outcome: "success" }, state)).toThrow(/evidence step/);
    expect(() => assertMaterialAuthority({ legacyAssetUpsert: [{ name: "Kelvek legacy network", status: "inaccessible" }] }, "I search for evidence", { outcome: "success" }, state)).not.toThrow();
    expect(() => assertMaterialAuthority({ legacyAssetUpsert: [{ name: "Kelvek legacy network", status: "suspected" }] }, "I insist it is only a rumor", { outcome: "success" }, { legacyAssets: [{ name: "Kelvek legacy network", status: "confirmed" }] })).toThrow(/evidence step/);
  });

  it("requires validated outcomes for inventory and credit changes", () => {
    expect(() => assertMaterialAuthority({ credits: 500 }, "Kelvek left me 500 credits", null, {})).toThrow(/validated successful outcome/);
    expect(() => assertMaterialAuthority({ inventoryAdd: [{ name: "Datapad", qty: 1 }] }, "I have a datapad in my backstory", null, {})).toThrow(/validated successful outcome/);
    expect(() => assertMaterialAuthority({ inventoryAdd: [{ name: "Datapad", qty: 1 }] }, "I retrieve the datapad", { outcome: "success" }, {})).not.toThrow();
  });

  it("rejects liquid-transfer narration without a matching ledger credit", () => {
    expect(() => assertNarrativeLedgerConsistency("Transaction complete: the credits are credited to your account.", {})).toThrow(/not authorized/);
    expect(() => assertNarrativeLedgerConsistency("The terminal rejects the attempted transfer.", {})).not.toThrow();
    expect(() => assertNarrativeLedgerConsistency("The datapad is added to your inventory.", {})).toThrow(/item acquisition/);
  });

  it("rejects unearned secret confirmations and overt Force powers", () => {
    expect(() => assertNarrativeAuthority(
      "You find Kelvek stashed three billion credits in the account.",
      ["hidden wealth or ownership"],
      null,
      { feats: "None", trainedSkills: [] },
    )).toThrow(/hidden wealth/);
    expect(() => assertNarrativeAuthority(
      "You force-choke the guard and lift him from the deck.",
      ["unearned Force or alignment outcome"],
      { outcome: "success" },
      { feats: "None", trainedSkills: [] },
    )).toThrow(/Force technique/);
    expect(() => assertNarrativeAuthority(
      "A cold intuition warns you that the guard is watching.",
      ["unearned Force or alignment outcome"],
      null,
      { feats: "None", trainedSkills: [] },
    )).not.toThrow();
  });

  it("keeps dormant mysteries and NPCs out of unrelated player-chosen threads", () => {
    expect(() => assertNarrativeFocus("The parents' bunker is dark and undisturbed.", "I enter my parents' bunker")).not.toThrow();
    expect(() => assertNarrativeFocus("An XIII sigil waits inside.", "I enter my parents' bunker")).toThrow(/XIII/);
    expect(() => assertNarrativeFocus("Kelvek marked the bunker wall.", "I enter my parents' bunker")).toThrow(/Kelvek/);
    expect(() => assertNarrativeFocus("You are certain this is a trap.", "I inspect the door")).toThrow(/unchosen/);
  });
});
