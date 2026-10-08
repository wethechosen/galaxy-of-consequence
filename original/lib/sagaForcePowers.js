// The executable core suite. Advancement offers only powers that the shared
// server resolver implements; a descriptive name never grants an extra effect.
export const FORCE_POWER_CATALOG = Object.freeze([
  { id: "battle-strike", name: "Battle Strike", action: "swift", descriptors: [], page: 96, summary: "Focus the Force into your next attack." },
  { id: "force-grip", name: "Force Grip", action: "standard", descriptors: ["telekinetic"], page: 97, summary: "Hold and injure a target through telekinetic pressure." },
  { id: "force-lightning", name: "Force Lightning", action: "standard", descriptors: ["dark-side"], page: 97, summary: "Unleash destructive lightning; using it carries a Dark Side consequence." },
  { id: "force-slam", name: "Force Slam", action: "standard", descriptors: ["telekinetic"], page: 97, summary: "Strike creatures in a cone with a wave of telekinetic force." },
  { id: "force-stun", name: "Force Stun", action: "standard", descriptors: [], page: 98, summary: "Overwhelm a target and move it along the condition track." },
  { id: "force-thrust", name: "Force Thrust", action: "standard", descriptors: ["telekinetic"], page: 98, summary: "Push a creature or object away with the Force." },
  { id: "move-object", name: "Move Object", action: "standard", descriptors: ["telekinetic"], page: 98, summary: "Lift and move an object or creature within your power's limits." },
  { id: "negate-energy", name: "Negate Energy", action: "reaction", descriptors: [], page: 99, summary: "Attempt to absorb one incoming energy attack." },
  { id: "surge", name: "Surge", action: "free", descriptors: [], page: 100, summary: "Increase your speed and jumping capability briefly." },
].map(({ page, ...entry }) => Object.freeze({ ...entry, descriptors: Object.freeze(entry.descriptors), source: Object.freeze({ book: "Saga Edition Core Rulebook", page, pdfPage: page + 8, errataApplied: entry.id === "surge" }) })));

const normalize = value => String(value || "").trim().toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const empty = /^(?:none(?: known| recorded)?|unestablished|unknown)$/i;

export function forcePowerById(value) {
  const id = normalize(value);
  return FORCE_POWER_CATALOG.find(power => power.id === id || normalize(power.name) === id) || null;
}

export function legacyForcePowerNames(character = {}) {
  const value = character.forcePowers;
  return (Array.isArray(value) ? value.map(item => typeof item === "string" ? item : item?.name || item?.id || "") : String(value || "").split(/[,;|]/))
    .map(name => String(name).trim()).filter(name => name && !empty.test(name));
}

// Existing named powers are preserved as legacy suite entries. When a sheet
// also contains the structured representation, its display string does not
// create another use. Duplicate deliberate picks retain separate selectionIds.
export function forcePowerSelectionsForCharacter(character = {}) {
  const structured = Array.isArray(character.forcePowerSelections)
    ? character.forcePowerSelections.filter(item => item && typeof item === "object" && !Array.isArray(item) && item.id).map((item, index) => {
      const power = forcePowerById(item.id || item.name);
      return { ...item, id: power?.id || item.id, name: power?.name || item.name || item.id, selectionId: item.selectionId || `legacy-record:${power?.id || item.id}:${index}` };
    }) : [];
  const represented = new Map();
  for (const entry of structured) represented.set(normalize(entry.name), (represented.get(normalize(entry.name)) || 0) + 1);
  const seen = new Map();
  for (const name of legacyForcePowerNames(character)) {
    const power = forcePowerById(name);
    const key = normalize(power?.name || name);
    const occurrence = (seen.get(key) || 0) + 1;
    seen.set(key, occurrence);
    if (occurrence > (represented.get(key) || 0)) structured.push({ id: power?.id || key, name: power?.name || name, selectionId: `legacy-name:${power?.id || key}:${occurrence}`, source: "legacy-record" });
  }
  return structured;
}

export function forcePowerKnown(character, id) {
  const power = forcePowerById(id);
  return Boolean(power && forcePowerSelectionsForCharacter(character).some(entry => entry.id === power.id));
}
