import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { interpretSagaAction, buildSemanticSagaCheck } from './saga-action-plan';

// Opt-in read-only model checks. These never open or mutate a real campaign.
if (process.env.GOC_LIVE_TESTS === '1' && existsSync('.env.local')) process.loadEnvFile('.env.local');
const configured = Boolean(process.env.NVIDIA_API_KEY && process.env.NVIDIA_API_KEY !== '[SENSITIVE]');
describe.skipIf(process.env.GOC_LIVE_TESTS !== '1' || !configured)('live sandbox intent interpretation (requires a real server key)', () => {
  const character = { name: "D'mir Holloran", level: 1, sagaStats: 'STR 12 | DEX 14 | CON 10 | INT 12 | WIS 10 | CHA 11', trainedSkills: ['Use Computer'], feats: 'None', forcePowers: 'None' };
  const state = { location: 'Coruscant — lower-city local market', credits: 2000, scene: { summary: "A Twi'lek clothing vendor has laid out an armored spacer suit and tunic at the counter." }, tradeOffers: [{ status: 'open', sellerName: 'clothing vendor', totalCredits: 1500, items: [{ name: "Armored spacer's flight suit", qty: 1 }, { name: 'Plain tunic', qty: 1 }] }] };
  it('understands slang, shopping, ordinary directions and travel without trigger words', async () => {
    const declarations = [
      ['Credits on the counter. Wrap that outfit for me, and tell me where I can pay for a room.', 'commerce'],
      ["Ain't looking for free, I say. Somewhere with a door that locks would do.", 'dialogue'],
      ['Enough of this place. Up to the street markets, by the nearest public lift.', 'travel'],
    ];
    const results = await Promise.all(declarations.map(async ([action, intent]) => ({ action, intent, result: await interpretSagaAction(action, character, state) })));
    for (const { result, intent } of results) {
      expect(result.fallbackReason).toBeNull();
      expect(result.semantic?.intent).toBe(intent);
      expect(result.semantic?.checkNeeded).toBe(false);
      expect(buildSemanticSagaCheck(result.semantic!, character, state)).toBeNull();
    }
  }, 90_000);
  it('recognizes contested slicing even without the word hack', async () => {
    const result = await interpretSagaAction('I work around the access restrictions on this locked computer so I can read its file index.', character, { ...state, scene: { summary: 'A locked computer terminal requests credentials.' } });
    expect(result.fallbackReason).toBeNull();
    expect(result.semantic?.skill).toBe('Use Computer');
    expect(buildSemanticSagaCheck(result.semantic!, character, state)).toMatchObject({ label: 'Use Computer', modifier: 6 });
  }, 90_000);
});
