import { describe, expect, it } from 'vitest';
import { alignMerchantIdentity, isRoutineCommerce, sceneMerchant } from './scene-commerce';

describe('market conversation continuity', () => {
  it('ordinary stock, payment and lodging questions do not need a social check', () => {
    const place = 'Coruscant — lower-city local market';
    for (const action of ['I approach the clothing vendor and ask for a black robe.', 'I grab the suit and the tunic. Know where I can get some rest?', "Ain’t looking for free, I say."]) expect(isRoutineCommerce(action, place)).toBe(true);
    expect(isRoutineCommerce('I intimidate the vendor for a discount', place)).toBe(false);
    expect(isRoutineCommerce('I steal the suit', place)).toBe(false);
  });
  it('keeps the first seller identity and excludes technical fallback text', () => {
    const snapshot: any = { character: {}, gameState: { location: 'market' }, messages: [
      { role: 'assistant', provider: 'nvidia', content: "LOCATION\nmarket\nThe vendor, a gaunt Twi’lek with faded tattoos, unfolds the suit." },
      { role: 'assistant', provider: 'nvidia', content: 'LOCATION\nmarket\nThe vendor, a wiry Rodian, bundles it.' },
    ] };
    const merchant = sceneMerchant(snapshot);
    expect(merchant?.species).toBe("Twi'lek");
    expect(alignMerchantIdentity('The vendor, a wiry Rodian, bundles it.', merchant)).toBe("The vendor, a wiry Twi'lek, bundles it.");
    expect(alignMerchantIdentity('A Rodian customer walks past.', merchant)).toBe('A Rodian customer walks past.');
  });
  it('retains species before vendor and leaves distinct stalls and customers alone', () => {
    const snapshot: any = { gameState: { location: 'market' }, messages: [
      { role: 'assistant', provider: 'nvidia', content: 'LOCATION\nmarket\nThe Twi’lek vendor produces the flight suit.' },
      { role: 'assistant', provider: 'nvidia', content: 'LOCATION\nmarket\nThe Rodian vendor gives you a once-over.' },
    ] };
    const merchant = sceneMerchant(snapshot);
    expect(merchant?.species).toBe("Twi'lek");
    expect(alignMerchantIdentity('The Rodian vendor gives you a once-over.', merchant)).toBe("The Twi'lek vendor gives you a once-over.");
    const otherStall = 'A Rodian vendor two stalls over sells armor. The Rodian armor dealer waves. A Rodian customer walks past.';
    expect(alignMerchantIdentity(otherStall, merchant)).toBe(otherStall);
  });

  it('clears the clothing merchant at the active guesthouse desk within the same market', () => {
    const snapshot: any = { gameState: {
      location: 'market', sceneMerchant: { name: 'clothing vendor', species: "Twi'lek", location: 'market' },
      scene: { location: 'market', summary: 'You stand at the guesthouse desk. The human clerk quotes five hundred credits for seven nights.' },
    }, messages: [
      { role: 'assistant', provider: 'nvidia', content: "LOCATION\nmarket\nSCENE\nThe Twi'lek clothing vendor unfolds the suit.\nGM ADJUDICATION\nAn ordinary purchase." },
    ] };
    expect(sceneMerchant(snapshot)).toBeNull();
    const lodging = "SCENE\nYou stand at the guesthouse desk. The human clerk serves you while the Rodian vendor walks past outside.\nGM ADJUDICATION\nA price question.";
    expect(alignMerchantIdentity(lodging, snapshot.gameState.sceneMerchant)).toBe(lodging);
  });

  it('uses the latest authored clerk interaction when an outage template reset the scene', () => {
    const snapshot: any = { gameState: {
      location: 'market', sceneMerchant: { name: 'clothing vendor', species: "Twi'lek", location: 'market' },
      scene: { location: 'market', summary: "The Twi'lek clothing vendor turns toward the rack." },
    }, messages: [
      { role: 'assistant', provider: 'nvidia', content: "LOCATION\nmarket\nThe Twi'lek clothing vendor unfolds the suit." },
      { role: 'assistant', provider: 'nvidia', content: 'LOCATION\nmarket\nSCENE\nThe clerk behind the desk listens to your housing request.\nGM ADJUDICATION\nDialogue.' },
      { role: 'assistant', provider: 'local-safe-fallback', fallbackReason: 'validation', content: "LOCATION\nmarket\nThe Twi'lek clothing vendor turns toward the rack." },
    ] };
    expect(sceneMerchant(snapshot)).toBeNull();
  });

  it('retains a seller during a lodging referral without treating suggestions as the active scene', () => {
    const snapshot: any = { gameState: { location: 'market' }, messages: [
      { role: 'assistant', provider: 'nvidia', content: "LOCATION\nmarket\nSCENE\nThe Twi'lek vendor points toward the guesthouse desk. “Ask the clerk there for a room,” she says.\nGM ADJUDICATION\nA public question.\nPLAYER OPTIONS\nA. Visit the housing authority office." },
    ] };
    expect(sceneMerchant(snapshot)?.species).toBe("Twi'lek");
  });

  it('starts a new merchant identity after an intervening conversation', () => {
    const snapshot: any = { gameState: { location: 'market', sceneMerchant: { name: 'clothing vendor', species: "Twi'lek", location: 'market' } }, messages: [
      { role: 'assistant', provider: 'nvidia', content: "LOCATION\nmarket\nThe Twi'lek clothing vendor unfolds the suit." },
      { role: 'assistant', provider: 'nvidia', content: 'LOCATION\nmarket\nYou stand at the guesthouse desk. The clerk greets you.' },
      { role: 'assistant', provider: 'nvidia', content: 'LOCATION\nmarket\nNara, the Rodian clothing vendor, shows you her stock.' },
      { role: 'assistant', provider: 'nvidia', content: 'LOCATION\nmarket\nThe human vendor quotes a price.' },
    ] };
    const merchant = sceneMerchant(snapshot);
    expect(merchant).toEqual({ name: 'Nara', species: 'Rodian', location: 'market' });
    expect(alignMerchantIdentity('Nara, the Human clothing vendor, folds a tunic.', merchant)).toBe('Nara, the Rodian clothing vendor, folds a tunic.');
    expect(alignMerchantIdentity("Pello, the Twi'lek clothing vendor, waves.", merchant)).toBe("Pello, the Twi'lek clothing vendor, waves.");
  });

  it('does not import merchant identity across a location or a declared new stall', () => {
    const old = { role: 'assistant', provider: 'nvidia', content: "LOCATION\nmarket\nThe Twi'lek vendor unfolds the suit." };
    expect(sceneMerchant({ gameState: { location: 'housing authority' }, messages: [old] } as any)).toBeNull();
    const snapshot: any = { gameState: { location: 'market' }, messages: [old,
      { role: 'assistant', provider: 'nvidia', content: 'LOCATION\nmarket\nYou approach another vendor. The Rodian vendor greets you.' },
    ] };
    expect(sceneMerchant(snapshot)?.species).toBe('Rodian');
    const nextStall = 'You approach another vendor. The Rodian vendor greets you.';
    expect(alignMerchantIdentity(nextStall, { name: 'clothing vendor', species: "Twi'lek", location: 'market' })).toBe(nextStall);
  });
});
