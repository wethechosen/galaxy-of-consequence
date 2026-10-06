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
});
