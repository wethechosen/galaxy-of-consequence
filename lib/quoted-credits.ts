const small: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const scales: Record<string, number> = { thousand: 1000, million: 1000000, billion: 1000000000 };
const words = [...Object.keys(small), "hundred", ...Object.keys(scales)].join("|");
/** Read literal stated prices, including ordinary written-out credit amounts. */
export function quotedCreditAmounts(source: string): number[] {
  const amounts = [...source.matchAll(/\b([\d,]+)\s*(?:galactic\s+)?credits?\b/gi)].map(match => Number(match[1].replace(/,/g, "")));
  const written = new RegExp(`\\b((?:(?:${words})[ -]+)(?:(?:${words}|and)[ -]+)*)(?:galactic[ ]+)?credits?\\b`, "gi");
  for (const match of source.matchAll(written)) {
    let total = 0, group = 0;
    for (const word of match[1].toLowerCase().trim().split(/[ -]+/)) {
      if (word in small) group += small[word];
      else if (word === "hundred") group = (group || 1) * 100;
      else if (word in scales) { total += (group || 1) * scales[word]; group = 0; }
    }
    amounts.push(total + group);
  }
  return [...new Set(amounts.filter(value => Number.isSafeInteger(value) && value > 0))];
}
