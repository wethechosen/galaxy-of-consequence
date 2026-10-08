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
    expect(callsBeforeRetry).toBe(3); // One interpretation, two unavailable drafts.

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
    expect(interpretationContext.scene.summary).toBe(GUESTHOUSE_SCENE);
    expect(interpretationContext.sceneMerchant).toBeNull();
    expect(interpretationContext.recentInteraction).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'assistant', content: expect.stringContaining('guesthouse proprietor quotes five hundred credits') }),
    ]));
    expect(interpretationText).not.toContain('LEGACY OUTAGE RESET');
    expect(drafts).toHaveLength(1);
    const context = contextFrom(drafts[0]);
    expect(context.world.location).toBe(LOCATION);
    expect(context.world.scene.summary).toBe(GUESTHOUSE_SCENE);
    expect(context.world.merchant).toBeNull();
    expect(drafts[0].system).not.toContain('LEGACY OUTAGE RESET');
    expect(JSON.stringify(drafts[0].messages)).not.toContain('LEGACY OUTAGE RESET');
    expect(drafts[0].system).not.toContain('retain the stall scene');
    expect(result.narration).toContain('The proprietor says');
    expect(result.narration).not.toMatch(/clothing vendor|clothing rack|maintenance junction/i);
    expect(result.snapshot.gameState.scene).toMatchObject({ summary: MONTHLY_SCENE });
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
