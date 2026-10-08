/** Repair serialization only. Never evaluate model output or infer missing values. */
export function normalizeModelLedgerJson(source: string) {
  const input = source.replace(/[\u201c\u201d]/g, '"').replace(/[\u2018\u2019]/g, "'");
  let output = "", quoted = false, escaped = false;
  for (let index = 0; index < input.length; index++) {
    const char = input[index];
    if (quoted) {
      output += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') { quoted = true; output += char; continue; }
    if (char === "," && /^\s*[}\]]/.test(input.slice(index + 1))) continue;
    // Repair identifier-shaped keys only, never values or executable expressions.
    if (/[{,]\s*$/.test(output)) {
      const key = input.slice(index).match(/^([A-Za-z_][A-Za-z_0-9]*)\s*(?=:)/);
      if (key) { output += JSON.stringify(key[1]); index += key[0].length - 1; continue; }
    }
    output += char;
  }
  return output;
}
