import { describe, expect, it } from 'vitest';
import {
  alignMechanicalResult,
  assertLocationIntent,
  assertMechanicalNarration,
  assertNarratedLocation,
  assertResolvedOutcome,
  classifyTurnMode,
} from './gm';

const MARKET = 'Coruscant — lower-city local market';
const HOUSING = 'Coruscant — Sector 7-G Housing Authority Office';
const DOCK = 'Coruscant — Docking Bay 94';
const failedPerception = {
  actor: 'player', kind: 'skill', label: 'Perception', formula: '1d20+0',
  raw: 5, modifier: 0, total: 5, target: 15, targetLabel: 'DC', targetVisible: true,
  outcome: 'failure', reason: 'Locate the familiar Twi\'lek vendor in the crowded market.',
  stakes: 'Success locates the vendor; failure leaves her whereabouts unknown.',
};

function narratedTurn(result: string, outcome = 'FAILURE', location = MARKET) {
  return `## LOCATION
${location}

## SCENE
You scan the market lanes beneath flickering signs while cargo trolleys pass between the stalls.

## GM ADJUDICATION
You try to locate the familiar vendor in the crowd. Perception determines whether you find her.

## GAMEPLAY RESULT
${result}

## SAGA CHECK
Perception: 1d20+0 = 5 + 0 = 5 vs DC 15.
RESULT: ${outcome}

## STATE UPDATE
No persistent change.

## PLAYER OPTIONS
A. Ask nearby vendors whether they have seen her.
B. Wait at her usual stall.
You may declare another action.`;
}

describe('reported sandbox outcome regressions', () => {
  it('rejects the reported successful vendor discovery after a failed Perception check', () => {
    // Both October 6 reports contain this contradictory result. The explicit
    // FAILURE label ensures this tests the fiction, not a missing result line.
    const result = "You focus your attention, filtering out the noise of haggling and the flicker of signs, and sweep your gaze across the market lanes. After a moment, you spot her: the same Twi’lek, standing behind her stall, adjusting a bolt of fabric. Her lekku are wrapped as before, the silver catchlight on her ear unmistakable. She glances up as you approach, her expression unreadable but not hostile. You have successfully located her—no misstep, no delay, no need to retrace your steps. The vendor is present and accessible, exactly as you believed she would be.";
    expect(() => assertMechanicalNarration(narratedTurn(result), failedPerception)).toThrow(/failed objective|failed.*success|failure/i);
  });

  it.each([
    'You have successfully located her behind the stall.',
    'After a moment, you spot her: the familiar vendor adjusts a bolt of fabric.',
  ])('rejects a failed search whose result says %s', (result) => {
    expect(() => assertMechanicalNarration(narratedTurn(result), failedPerception)).toThrow();
  });

  it('allows a concrete failed search with a visible obstacle and no located target', () => {
    const result = 'A cargo trolley blocks the lane. You fail to locate her in the crowd; the stall remains unattended. You can wait here or ask a neighboring seller.';
    expect(() => assertMechanicalNarration(narratedTurn(result), failedPerception)).not.toThrow();
  });

  it('does not treat future options as an accomplished discovery after failure', () => {
    const narration = narratedTurn('You cannot identify the vendor in the crowd. A trolley blocks the nearest lane.')
      .replace('A. Ask nearby vendors whether they have seen her.', 'A. If you successfully locate her on a later attempt, ask about the broker.');
    expect(() => assertMechanicalNarration(narration, failedPerception)).not.toThrow();
  });

  it('does not repair a failed fictional outcome by silently relabeling its result', () => {
    const failedDraft = narratedTurn('The clerk sees through your lie. No trust is extended.');
    const successfulDeception = { ...failedPerception, label: 'Deception', outcome: 'success', raw: 19, total: 19 };
    expect(() => assertMechanicalNarration(alignMechanicalResult(failedDraft, successfulDeception), successfulDeception)).toThrow();
    const mislabeledDraft = failedDraft.replace('RESULT: FAILURE', 'RESULT: SUCCESS');
    expect(() => assertResolvedOutcome(mislabeledDraft, successfulDeception)).toThrow();
  });
});

describe('reported sandbox dialogue regressions', () => {
  it.each([
    'How much?',
    'How much for a full month?',
    '"How much for a full month?"',
    '“How much for a full month?”',
    'How much is the housing?',
    'How many rooms are available?',
    'What are my options then?',
    'twll me about the private market',
  ])('keeps the NPC question in play: %s', (action) => {
    expect(classifyTurnMode(action)).toBe('play');
  });

  it.each([
    'GM, what is my current location?',
    'OOC: explain my last roll.',
    'How many credits do I have?',
    'What are my skills?',
    'im at the housing authority trying to get housing remember gm?',
  ])('keeps explicit table talk outside gameplay: %s', (action) => {
    expect(classifyTurnMode(action)).toBe('ooc');
  });
});

describe('reported sandbox location regressions', () => {
  it('rejects narration at the housing office while the ledger remains at the market', () => {
    expect(() => assertNarratedLocation(narratedTurn('The clerk quotes a monthly rate.', 'SUCCESS', HOUSING), {}, MARKET)).toThrow(/location/i);
  });

  it('rejects a stale market heading when the resolved travel ledger reaches Docking Bay 94', () => {
    expect(() => assertNarratedLocation(narratedTurn('You reach the docking bay entrance.'), { location: DOCK }, MARKET)).toThrow(/location/i);
  });

  it('allows declared travel when narration and committed location agree', () => {
    const delta = { location: DOCK };
    expect(() => assertLocationIntent(delta, 'Docking bay 94 i look for jax', MARKET, true)).not.toThrow();
    expect(() => assertNarratedLocation(narratedTurn('You reach the docking bay entrance.', 'SUCCESS', DOCK), delta, MARKET)).not.toThrow();
  });

  it('does not authorize a scene move merely to answer a monthly price question', () => {
    expect(() => assertLocationIntent({ location: HOUSING }, 'How much for a full month?', MARKET)).toThrow(/movement|moved/i);
    expect(() => assertNarratedLocation(narratedTurn('The clerk quotes a monthly rate.'), {}, MARKET)).not.toThrow();
  });
});
