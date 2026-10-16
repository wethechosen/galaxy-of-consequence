import { afterEach, describe, expect, it, vi } from 'vitest';
import * as accounts from './accounts';
import type { Account } from './accounts';
import { openStorage } from './storage';
import { readDatapad, saveAuthoritativeDatapad, type DatapadSnapshot } from './datapad-save';
import { runGmTurn } from './gm';
import { currentTradeOffers } from './conversation-trade';
import { NvidiaProviderError, type NvidiaRequest } from './original-provider';

const provider = vi.hoisted(() => vi.fn());
vi.mock('./original-provider', async (importOriginal) => ({
  ...await importOriginal<typeof import('./original-provider')>(), invokeNvidia: provider,
}));

const databases: ReturnType<typeof openStorage>[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  provider.mockReset();
  databases.splice(0).forEach((db) => db.close());
});

const LOCATION = 'Coruscant — lower-city local market';
const QUESTION = 'How much for a full month?';
const GUESTHOUSE_SCENE = 'You stand at the guesthouse desk near the market entrance. The human proprietor watches from behind a scratched plasteel counter, her sleeves rolled above ink-stained wrists. A ceiling fan clicks over the registration terminal while warm light falls across your carried bag. She has offered a private room for seven nights and waits for your reply.';
const MONTHLY_SCENE = 'The proprietor draws a fresh rate card from beneath the desk and sets it alongside the weekly terms. Through a frosted partition, dishes clatter in the breakfast room; a wall clock ticks above the key cabinet. Your bag rests by your boots while she traces the thirty-night row with one finger and answers your question about the full month.';
const MONTHLY_OFFER = {
  sellerName: 'Market guesthouse proprietor', sellerSpecies: 'Human', totalCredits: 1800,
  items: [{ name: 'Private guesthouse room for 30 nights with breakfast', qty: 1, tag: 'service' }],
};

function narration(scene: string, result: string, delta: Record<string, unknown> = {}, location = LOCATION) {
  return `## LOCATION
${location}

## SCENE
${scene}

## GM ADJUDICATION
Asking the proprietor for a published lodging rate is ordinary conversation and requires no check. A quote does not accept a booking or authorize payment.

## GAMEPLAY RESULT
${result}

## SAGA CHECK
No check required.

## STATE UPDATE
${Object.keys(delta).length ? 'The lodging quote is recorded. No payment or booking occurs.' : 'No persistent change.'}

## PLAYER OPTIONS
A. Ask to see the room before deciding.
B. Ask the proprietor about check-in hours.
You may declare another action.
<!--STATE:${JSON.stringify(delta)}-->`;
}

function monthlyReply() {
  return {
    provider: 'nvidia', model: 'continuity-test', finishReason: 'stop',
    content: narration(MONTHLY_SCENE,
      'The proprietor says, “A full month is thirty nights: 1,800 credits for a private room with breakfast. Those terms are available if you decide to book.” The rate card stays on the desk; your credit chits remain with you.',
      { tradeOfferAdd: [MONTHLY_OFFER] }),
  };
}

function mockProvider(draft: (request: NvidiaRequest) => ReturnType<typeof monthlyReply> | Promise<ReturnType<typeof monthlyReply>>) {
  provider.mockImplementation(async (request: NvidiaRequest) => {
    if (!request.sourceQuery) {
      const declaration = request.messages.at(-1)?.content.split('\n\nPLAYER DECLARATION:\n')[1] || '';
      return { provider: 'nvidia', model: 'intent-test', finishReason: 'stop', content: JSON.stringify({
        intent: 'dialogue', canonicalAction: declaration, declaredSpan: declaration, checkNeeded: false, skill: null,
        rationale: 'An ordinary follow-up about the current guesthouse lodging offer.', travelTarget: null,
      }) };
    }
    return draft(request);
  });
}

function setup(polluted = false) {
  const db = accounts.accountStore(openStorage(':memory:'));
  databases.push(db);
  const actor: Account = { id: 'dmir-continuity', username: 'dmir@galaxy.local', displayName: "D'mir", role: 'player' };
  db.prepare("INSERT INTO accounts VALUES (?, ?, ?, ?, '', '')").run(actor.id, actor.username, actor.displayName, actor.role);
  vi.spyOn(accounts, 'accountStore').mockReturnValue(db);
  const initial: DatapadSnapshot = {
    character: { name: "D'mir Holloran", level: 1, experience: 500, equipArmor: 'Prison issue clothing' },
    gameState: {
      location: LOCATION, credits: 5000, health: 26, campaignTimeMinutes: 125, combat: { status: 'escaped' },
      inventory: [{ id: 'pistol', name: 'Blaster pistol', qty: 1, tag: 'weapon' }],
      scene: { id: 'guesthouse-scene', location: LOCATION, beat: 4, routeProgress: 2, action: 'I ask about paid lodging.', summary: GUESTHOUSE_SCENE },
      tradeOffers: [{ id: 'offer:weekly:0', sourceTurnId: 'weekly_quote', location: LOCATION, status: 'open',
        sellerName: 'Market guesthouse proprietor', sellerSpecies: 'Human', totalCredits: 500,
        items: [{ name: 'Private guesthouse room for seven nights', qty: 1, tag: 'service' }] }],
      turnEvents: [],
    },
    messages: [
      { role: 'user', content: 'I ask the guesthouse proprietor about paid lodging.' },
      { role: 'assistant', provider: 'nvidia', content: narration(GUESTHOUSE_SCENE, 'The guesthouse proprietor quotes five hundred credits for seven nights in a private room. No room is booked.') },
    ], comms: [], settings: {},
  };
  if (polluted) {
    const outageScene = "LEGACY OUTAGE RESET: Clothing hangs from rails at the stall. The Twi'lek clothing vendor directs you to the guesthouse again.";
    initial.gameState.scene = { ...(initial.gameState.scene as Record<string, unknown>), summary: outageScene };
    initial.gameState.sceneMerchant = { name: 'clothing vendor', species: "Twi'lek", location: LOCATION };
    initial.messages.push(
      { role: 'user', content: 'An older conversation was shown from another location.' },
      { role: 'assistant', provider: 'nvidia', content: narration('A dockmaster stands beneath the Docking Bay 94 departure board.', 'The dockmaster waits.', {}, 'Coruscant — Docking Bay 94') },
      { role: 'user', content: QUESTION },
      { role: 'assistant', provider: 'local-safe-fallback', fallbackReason: 'provider', content: narration(outageScene, 'LEGACY OUTAGE RESET: Return to the clothing vendor.') },
    );
  }
  saveAuthoritativeDatapad(actor, null, 0, initial, db);
  return { actor, db, initial };
}

function contextFrom(request: NvidiaRequest) {
  const context = request.system?.split('CURRENT AUTHORITATIVE CAMPAIGN STATE:\n')[1]?.split('\n\n')[0];
  expect(context).toBeTruthy();
  return JSON.parse(context!) as { world: { location: string; scene: { summary: string }; merchant: unknown } };
}

describe('authoritative GM continuity and unavailable drafting', () => {
  it.skipIf(process.env.GOC_LIVE_NVIDIA !== '1')('live NVIDIA arrival commits and reloads in an isolated fixture', async () => {
    vi.stubEnv('CAMPAIGN_DB_PATH', ':memory:');
    const { actor, db, initial } = setup();
    const location = 'Taris → Bonadan — aboard the YT-1300 freighter';
    initial.gameState.location = location;
    initial.gameState.tradeOffers = [];
    initial.gameState.journey = { confirmed: true, origin: 'Taris', destination: 'Bonadan', status: 'in_transit' };
    initial.gameState.scene = { location, summary: 'You are aboard a passenger freighter in hyperspace from Taris to Bonadan. Passage is already authorized. You are resting on the bunk. Arrival is the next scheduled event.', beat: 4 };
    initial.messages = [];
    saveAuthoritativeDatapad(actor, null, 1, initial, db);
    const actual = await vi.importActual<typeof import('./original-provider')>('./original-provider');
    provider.mockImplementation(actual.invokeNvidia);
    const result = await runGmTurn(actor, { turnId: 'live-bonadan-fixture', revision: 2, action: 'I sleep until we arrive.' });
    expect(result.snapshot.gameState.location).toMatch(/^Bonadan\b/);
    expect(Number(result.snapshot.gameState.campaignTimeMinutes)).toBeGreaterThan(125);
    expect(result.snapshot.gameState.journey).toMatchObject({ status: 'arrived' });
    expect(result.snapshot.gameState.credits).toBe(5000);
    expect(readDatapad(actor, null, db).snapshot).toEqual(result.snapshot);
  }, 110_000);

  it('rewrites the broken sleep result, commits arrival, and replays without advancing twice', async () => {
    const { actor, db, initial } = setup();
    const location = 'Taris → Bonadan — aboard the YT-1300 freighter';
    initial.gameState.location = location;
    initial.gameState.journey = { confirmed: true, origin: 'Taris', destination: 'Bonadan', status: 'in_transit' };
    initial.gameState.scene = { location, summary: 'You are aboard the freighter departing Taris for Bonadan.', beat: 4 };
    initial.messages = [];
    saveAuthoritativeDatapad(actor, null, 1, initial, db);
    let drafts = 0;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockProvider(() => ({ provider: 'nvidia', model: 'travel-test', finishReason: 'stop', content: ++drafts === 1
      ? narration('You lie on your bunk in the passenger compartment, listening to the engines and the distant voices of the crew as the cabin lights fade for the journey.', 'You sleep until arrival. When you wake, the freighter is still docked, departure imminent.', {}, location)
      : narration('The cabin lights brighten over your bunk as the engine note changes. Through the narrow port you see the industrial planet below, and the pilot announces the landing approach while you gather your belongings.', 'The freighter arrives at Bonadan. You wake as it docks at the passenger terminal.', { location: 'Bonadan — Passenger terminal', timeAdvanceMinutes: 240 }, 'Bonadan — Passenger terminal') }));
    const input = { turnId: 'bonadan-wait-regression', revision: 2, action: 'i sleep until we arrive' };
    const result = await runGmTurn(actor, input);
    expect(drafts).toBe(2);
    expect(result.snapshot.gameState.location).toBe('Bonadan — Passenger terminal');
    expect(result.snapshot.gameState.campaignTimeMinutes).toBe(365);
    expect(result.snapshot.gameState.journey).toMatchObject({ status: 'arrived', destination: 'Bonadan' });
    expect(result.snapshot.gameState.credits).toBe(5000);
    expect(readDatapad(actor, null, db).snapshot).toEqual(result.snapshot);
    const replay = await runGmTurn(actor, input);
    expect(replay.revision).toBe(result.revision);
    expect(drafts).toBe(2);
    expect(readDatapad(actor, null, db).snapshot?.gameState.campaignTimeMinutes).toBe(365);
  });

  it('answers a continuity correction without changing scene, clock, or resources', async () => {
    const { actor, db } = setup();
    const before = readDatapad(actor, null, db).snapshot!;
    provider.mockResolvedValue({ provider: 'nvidia', model: 'correction-test', finishReason: 'stop', content: 'Your correction is a continuity question. The saved location remains the market; no action has been performed.' });
    const result = await runGmTurn(actor, { turnId: 'correction-regression', revision: 1, action: 'are you broken? we were on Taris, Jax is taking me to Bonadan.' });
    expect(result.snapshot.gameState.scene).toEqual(before.gameState.scene);
    expect(result.snapshot.gameState.campaignTimeMinutes).toBe(before.gameState.campaignTimeMinutes);
    expect(result.snapshot.gameState.credits).toBe(before.gameState.credits);
    expect(result.roll).toBeNull();
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it('preserves a provider timeout without three repeated drafting requests or a save change', async () => {
    const { actor, db } = setup();
    const before = readDatapad(actor, null, db);
    mockProvider(() => { throw new NvidiaProviderError('NVIDIA took too long to respond. No outcome was applied; retry the turn.', 504); });
    await expect(runGmTurn(actor, { turnId: 'timeout-preservation-01', revision: 1, action: QUESTION })).rejects.toMatchObject({ status: 504 });
    expect(provider).toHaveBeenCalledTimes(2); // One interpretation, one bounded draft.
    expect(readDatapad(actor, null, db)).toEqual(before);
    const draft = provider.mock.calls.map(([request]) => request as NvidiaRequest).find(request => request.sourceQuery);
    expect(draft?.timeout_ms).toBeGreaterThan(24_000);
  });

  it('keeps gameplay connected when the third safe draft only repeats scene framing', async () => {
    const { actor, db } = setup();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockProvider(() => ({
      provider: 'nvidia', model: 'freshness-recovery-test', finishReason: 'stop',
      content: narration(
        GUESTHOUSE_SCENE,
        'The proprietor waits without changing anything.',
      ),
    }));

    const result = await runGmTurn(actor, { turnId: 'freshness-recovery-01', revision: 1, action: QUESTION });
    expect(result.revision).toBe(2);
    expect(result.provider).toBe('nvidia');
    expect(result.fallbackReason).toBeNull();
    expect(result.snapshot.gameState.credits).toBe(5000);
    expect(result.snapshot.gameState.turnEvents).toEqual([expect.objectContaining({ turnId: 'freshness-recovery-01' })]);
    expect(readDatapad(actor, null, db).snapshot).toEqual(result.snapshot);
    expect(provider).toHaveBeenCalledTimes(4); // Interpretation plus three rewritten drafts.
  });

  it('repairs an empty ledger from the same monthly quote without rerolling or rewriting the scene', async () => {
    const { actor } = setup();
    const requests: NvidiaRequest[] = [];
    mockProvider(request => {
      requests.push(request);
      if (request.messages[0]?.content.startsWith('PLAYER ACTION:')) return {
        provider: 'nvidia', model: 'ledger-test', finishReason: 'stop',
        content: `<!--STATE:${JSON.stringify({ tradeOfferAdd: [MONTHLY_OFFER] })}-->`,
      };
      const reply = monthlyReply();
      return { ...reply, content: reply.content.replace(/<!--STATE:[\s\S]*?-->/, '<!--STATE:{}-->') };
    });
    const result = await runGmTurn(actor, { turnId: 'missing-month-quote', revision: 1, action: QUESTION });
    expect(requests).toHaveLength(2);
    expect(result.fallbackReason).toBeNull();
    expect(result.roll).toBeNull();
    expect(result.snapshot.gameState.credits).toBe(5000);
    expect(currentTradeOffers(result.snapshot.gameState).find(offer => offer.sourceTurnId === 'missing-month-quote')).toMatchObject(MONTHLY_OFFER);
    expect(result.narration).toContain('1,800 credits for a private room with breakfast');
  });

  it('does not label a successfully retried provider response as fallback history', async () => {
    const { actor } = setup();
    let drafts = 0;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockProvider(() => {
      if (++drafts === 1) throw new NvidiaProviderError('Temporary outage.', 503);
      return monthlyReply();
    });
    const result = await runGmTurn(actor, { turnId: 'recovered-draft', revision: 1, action: QUESTION });
    expect(result.fallbackReason).toBeNull();
    expect(result.snapshot.messages.at(-1)).toMatchObject({ provider: 'nvidia', fallbackReason: null });
  });

  it('leaves the save untouched on provider outage and retries the same turn once without duplication', async () => {
    const { actor, db, initial } = setup();
    const before = readDatapad(actor, null, db);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockProvider(() => { throw new NvidiaProviderError('Draft service unavailable during test.', 503); });
    const input = { turnId: 'continuity-retry-01', revision: 1, action: QUESTION };

    await expect(runGmTurn(actor, input)).rejects.toMatchObject({ status: 503 });
    expect(readDatapad(actor, null, db)).toEqual(before);
    expect(db.prepare('SELECT status, result FROM gm_turn_attempts WHERE account_id = ? AND turn_id = ?').get(actor.id, input.turnId))
      .toMatchObject({ status: 'pending', result: null });
    const callsBeforeRetry = provider.mock.calls.length;
    expect(callsBeforeRetry).toBe(4); // One interpretation, three unavailable drafts.

    mockProvider(() => monthlyReply());
    const completed = await runGmTurn(actor, input);
    expect(completed.revision).toBe(2);
    expect(completed.provider).toBe('nvidia');
    expect(provider).toHaveBeenCalledTimes(callsBeforeRetry + 1); // Reuse the stored interpretation.
    expect(completed.snapshot.gameState.campaignTimeMinutes).toBe(125);
    expect(completed.snapshot.gameState.credits).toBe(5000);
    expect(completed.snapshot.character).toMatchObject({ level: 1, experience: 500 });
    expect(completed.snapshot.gameState.scene).toMatchObject({ beat: 5, location: LOCATION, action: QUESTION });
    expect(completed.snapshot.gameState.turnEvents).toHaveLength(1);
    expect(completed.snapshot.messages).toHaveLength(initial.messages.length + 2);
    expect(currentTradeOffers(completed.snapshot.gameState).filter((offer) => offer.sourceTurnId === input.turnId)).toHaveLength(1);
    expect(db.prepare('SELECT status FROM gm_turn_attempts WHERE account_id = ? AND turn_id = ?').get(actor.id, input.turnId))
      .toMatchObject({ status: 'complete' });

    const callsBeforeReplay = provider.mock.calls.length;
    expect(await runGmTurn(actor, input)).toEqual(completed);
    expect(provider).toHaveBeenCalledTimes(callsBeforeReplay);
    expect(readDatapad(actor, null, db).revision).toBe(2);
    expect(readDatapad(actor, null, db).snapshot).toEqual(completed.snapshot);
  });

  it('recovers the guesthouse interaction for both the interpreter and narrator at the saved location', async () => {
    const { actor } = setup(true);
    const drafts: NvidiaRequest[] = [];
    mockProvider((request) => { drafts.push(request); return monthlyReply(); });
    const result = await runGmTurn(actor, { turnId: 'continuity-context-01', revision: 1, action: QUESTION });

    const interpretationRequests = provider.mock.calls.map(([request]) => request as NvidiaRequest).filter((request) => !request.sourceQuery);
    expect(interpretationRequests).toHaveLength(1);
    const interpretationText = interpretationRequests[0].messages[0].content;
    const interpretationContext = JSON.parse(interpretationText.split('CURRENT SCENE CONTEXT:\n')[1].split('\n\nPLAYER DECLARATION:\n')[0]);
    expect(interpretationContext.scene.summary).toContain('guesthouse proprietor quotes five hundred credits');
    expect(interpretationContext.sceneMerchant).toBeNull();
    expect(interpretationContext.recentInteraction).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'assistant', content: expect.stringContaining('guesthouse proprietor quotes five hundred credits') }),
    ]));
    expect(interpretationText).not.toContain('LEGACY OUTAGE RESET');
    expect(drafts).toHaveLength(1);
    const context = contextFrom(drafts[0]);
    expect(context.world.location).toBe(LOCATION);
    expect(context.world.scene.summary).toContain('guesthouse proprietor quotes five hundred credits');
    expect(context.world.merchant).toBeNull();
    expect(drafts[0].system).not.toContain('LEGACY OUTAGE RESET');
    expect(JSON.stringify(drafts[0].messages)).not.toContain('LEGACY OUTAGE RESET');
    expect(drafts[0].system).not.toContain('retain the stall scene');
    expect(result.narration).toContain('The proprietor says');
    expect(result.narration).not.toMatch(/clothing vendor|clothing rack|maintenance junction/i);
    expect(result.snapshot.gameState.scene).toMatchObject({ summary: expect.stringContaining('A full month is thirty nights') });
  });

  it('answers the unquoted monthly question as NPC dialogue and persists exact service terms without a debit', async () => {
    const { actor, db, initial } = setup();
    const drafts: NvidiaRequest[] = [];
    mockProvider((request) => { drafts.push(request); return monthlyReply(); });
    const result = await runGmTurn(actor, { turnId: 'continuity-month-01', revision: 1, action: QUESTION });

    expect(result.roll).toBeNull();
    expect(drafts).toHaveLength(1);
    expect(drafts[0].messages.at(-1)).toMatchObject({ role: 'user', content: QUESTION });
    expect(contextFrom(drafts[0]).world.scene.summary).toBe(GUESTHOUSE_SCENE);
    expect(result.narration).toContain('1,800 credits for a private room with breakfast');
    expect(result.snapshot.gameState.credits).toBe(initial.gameState.credits);
    expect(result.snapshot.gameState.inventory).toEqual(initial.gameState.inventory);
    expect(result.snapshot.gameState.campaignTimeMinutes).toBe(initial.gameState.campaignTimeMinutes);
    expect(result.snapshot.gameState.location).toBe(LOCATION);
    expect(result.snapshot.character).toMatchObject({ level: 1, experience: 500 });
    expect(result.snapshot.gameState.tradeReceipts || []).toHaveLength(0);
    const offers = currentTradeOffers(result.snapshot.gameState);
    expect(offers).toHaveLength(2);
    expect(offers.find((offer) => offer.sourceTurnId === 'continuity-month-01')).toEqual({
      ...MONTHLY_OFFER, id: 'offer:continuity-month-01:0', sourceTurnId: 'continuity-month-01', location: LOCATION, status: 'open',
    });
    expect(readDatapad(actor, null, db).snapshot).toEqual(result.snapshot);
  });
});

describe('Nuvorren commission appointment regression', () => {
  it('answers a clerk without an invented roll, a duplicate LOCATION, or repeated retries', async () => {
    const { actor, db, initial } = setup();
    const savedLocation = 'Bonadan — Nuvorren Design House, front counter';
    const question = 'How do I set an appointment for commission?';
    initial.gameState.location = savedLocation;
    initial.gameState.tradeOffers = [];
    initial.gameState.scene = {
      id: 'nuvorren-counter', location: savedLocation, beat: 7,
      action: 'I speak to the clerk',
      summary: 'D\'mir approaches the front counter at Nuvorren Design House to ask about commissioning a bespoke cortosis-weave executive garment.',
    };
    initial.messages = [{ role: 'user', content: 'I approach the clerk.' }];
    saveAuthoritativeDatapad(actor, null, 1, initial, db);
    const before = readDatapad(actor, null, db);
    provider.mockImplementation(async (request: NvidiaRequest) => {
      if (!request.sourceQuery) {
        return {
          provider: 'nvidia', model: 'intent-test', finishReason: 'stop',
          content: JSON.stringify({ intent: 'dialogue', canonicalAction: question, declaredSpan: question, checkNeeded: true, skill: 'Persuasion', rationale: 'Incorrectly classified by draft model.', travelTarget: null }),
        };
      }
      return {
        provider: 'nvidia', model: 'nuvorren-dialogue-test', finishReason: 'stop',
        content: `## LOCATION
Bonadan — Nuvorren Design House, rear workroom

## LOCATION
Bonadan — Nuvorren Design House, front hallway

## SCENE
D'mir stands directly across the polished counter from the clerk. A commission ledger lies open beside fine cloth swatches, and an assistant works behind a frosted glass partition. The clerk pauses to address his question without moving him from the counter.

## GM ADJUDICATION
Asking for an appointment procedure is ordinary conversation. No check is required, and the player has not booked a service or paid any credits.

## GAMEPLAY RESULT
The clerk explains that a client first submits the intended design and a preferred appointment day, after which the director confirms whether a bespoke consultation can be scheduled. No appointment is booked yet.

## SAGA CHECK
No check required.

## STATE UPDATE
No persistent change.

## PLAYER OPTIONS
A. Ask the clerk to forward the design for review.
B. Request the commission director's available days.
You may declare another action.
<!--STATE:{}-->`,
      };
    });
    const input = { turnId: 'nuvorren-appointment-regression', revision: 2, action: question };
    const result = await runGmTurn(actor, input);
    expect(result.roll).toBeNull();
    expect(result.narration).toContain(`## LOCATION\n${savedLocation}`);
    expect(result.narration.match(/^## LOCATION$/gm)).toHaveLength(1);
    expect(result.narration).toContain('client first submits the intended design');
    expect(result.snapshot.gameState.location).toBe(savedLocation);
    expect(result.snapshot.gameState.credits).toBe(before.snapshot!.gameState.credits);
    expect(result.snapshot.gameState.inventory).toEqual(before.snapshot!.gameState.inventory);
    expect(result.snapshot.gameState.campaignTimeMinutes).toBe(before.snapshot!.gameState.campaignTimeMinutes);
    expect(result.snapshot.character?.experience).toBe(before.snapshot!.character?.experience);
    expect(provider).toHaveBeenCalledTimes(2); // One interpreter and one GM draft, not 3 failed drafts.
    expect(readDatapad(actor, null, db).revision).toBe(3);
    expect(await runGmTurn(actor, input)).toEqual(result);
    expect(provider).toHaveBeenCalledTimes(2);
  });
});

describe('service-dialogue validation exhaustion', () => {
  it('commits a safe procedural answer after three unusable service drafts, without currency or XP changes', async () => {
    const { actor, db } = setup();
    const question = 'How do I set an appointment for commission?';
    const before = readDatapad(actor, null, db);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    provider.mockImplementation(async (request: NvidiaRequest) => {
      if (!request.sourceQuery) return {
        provider: 'nvidia', model: 'intent-test', finishReason: 'stop',
        content: JSON.stringify({ intent: 'dialogue', canonicalAction: question, declaredSpan: question, checkNeeded: false, skill: null, rationale: 'A simple booking procedure inquiry.', travelTarget: null }),
      };
      return { provider: 'nvidia', model: 'broken-service-draft', finishReason: 'stop',
        content: '## LOCATION\nWrong rear workroom\n\n## SCENE\nThe clerk notices the question.\n<!--STATE:{}-->' };
    });
    const input = { turnId: 'service-inquiry-safe-exhaustion', revision: 1, action: question };
    const result = await runGmTurn(actor, input);
    expect(result.provider).toBe('local-safe-fallback');
    expect(result.model).toBe('service-inquiry-receipt');
    expect(result.fallbackReason).toBe('validation');
    expect(result.narration).toContain('person responsible for scheduling');
    expect(result.roll).toBeNull();
    expect(result.snapshot.gameState.credits).toBe(before.snapshot!.gameState.credits);
    expect(result.snapshot.gameState.inventory).toEqual(before.snapshot!.gameState.inventory);
    expect(result.snapshot.gameState.location).toBe(before.snapshot!.gameState.location);
    expect(result.snapshot.character?.experience).toBe(before.snapshot!.character?.experience);
    expect(result.snapshot.gameState.tradeReceipts || []).toHaveLength(0);
    expect(provider).toHaveBeenCalledTimes(4); // One interpretation, three failed drafts, no fourth model call.
    expect(readDatapad(actor, null, db).revision).toBe(2);
    expect(await runGmTurn(actor, input)).toEqual(result);
    expect(provider).toHaveBeenCalledTimes(4);
  });
});
