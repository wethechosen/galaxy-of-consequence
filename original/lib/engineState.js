import { sagaLevelForExperience } from "@/original/lib/sagaAdvancement";
import { validateLeaseTerms, validatePriceComponents } from "@/original/lib/leaseTerms";

// Only this whitelist may cross from generated prose into the campaign ledger.
// Validate the whole response before committing any of its effects.
const MAX_MONEY = 1_000_000_000_000;
const MAX_QUANTITY = 1_000_000;
const MAX_HEALTH = 10_000;
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const bound = (value, low, high) => Math.max(low, Math.min(high, value));
const keyOf = (value) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
const defaultId = () => `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

function invalid(field) { throw new Error(`The GM returned an invalid world-state field (${field}). Retry this turn.`); }
function number(value, field, low, high, integer = false) {
  if (typeof value !== "number" && !(typeof value === "string" && value.trim() !== "")) invalid(field);
  const result = Number(value);
  if (!Number.isFinite(result) || (integer && !Number.isSafeInteger(result)) || result < low || result > high) invalid(field);
  return result;
}
function string(value, field, limit = 8000) {
  if (typeof value !== "string" || value.length > limit) invalid(field);
  return value.trim();
}
function strings(input, fields, context) {
  const result = {};
  for (const field of fields) if (own(input, field)) result[field] = string(input[field], `${context}.${field}`);
  return result;
}

const CHARACTER_TEXT = ["sagaStats", "talents", "feats", "forcePowers", "upgrades", "equipPrimary", "equipSecondary", "equipArmor", "equipSpecial"];
function characterPatch(value) {
  if (!record(value)) invalid("characterUpdate");
  // Level and experience are server-owned progression fields. Generated
  // character patches may describe choices already validated elsewhere, but
  // can never set either progression total directly.
  return strings(value, CHARACTER_TEXT, "characterUpdate");
}

function validateDelta(value) {
  if (!record(value)) invalid("STATE");
  const result = {};
  if (own(value, "health")) result.health = number(value.health, "health", -MAX_HEALTH, MAX_HEALTH, true);
  for (const field of ["notoriety", "forceAlignment", "credits", "creditsCriminal"]) {
    if (own(value, field)) result[field] = number(value[field], field, -MAX_MONEY, MAX_MONEY);
  }
  for (const field of ["conditionTrack", "forcePoints", "destinyPoints", "darkSideScore"]) {
    if (own(value, field)) result[field] = number(value[field], field, -100, 100, true);
  }
  if (own(value, "timeAdvanceMinutes")) result.timeAdvanceMinutes = number(value.timeAdvanceMinutes, "timeAdvanceMinutes", 0, 10080, true);
  for (const field of ["location", "note"]) if (own(value, field)) result[field] = string(value[field], field);
  if (own(value, "experienceAward")) result.experienceAward = number(value.experienceAward, "experienceAward", 0, 5000, true);
  if (own(value, "factionRep")) {
    if (!record(value.factionRep)) invalid("factionRep");
    result.factionRep = {};
    for (const field of ["empire", "rebellion", "csa"]) {
      if (own(value.factionRep, field)) result.factionRep[field] = number(value.factionRep[field], `factionRep.${field}`, -MAX_MONEY, MAX_MONEY);
    }
  }
  const arrayFields = ["inventoryAdd", "inventoryRemove", "propertyAdd", "shipAdd", "investmentAdd", "contactAdd", "publicNewsAdd"];
  for (const field of arrayFields) {
    if (!own(value, field)) continue;
    if (!Array.isArray(value[field]) || value[field].length > 100) invalid(field);
    result[field] = value[field].map((item) => {
      if (!record(item)) invalid(field);
      if (field === "publicNewsAdd") {
        const entry = strings(item, ["headline", "facts", "location", "source"], field);
        return entry.headline && entry.facts && entry.location ? entry : null;
      }
      const entry = strings(item, ["name"], field);
      // The prompt's empty example records mean no change.
      if (!entry.name) return null;
      if (field.startsWith("inventory")) {
        entry.qty = own(item, "qty") ? number(item.qty, `${field}.qty`, 0, MAX_QUANTITY, true) : 1;
        Object.assign(entry, strings(item, ["tag"], field));
      } else if (field === "contactAdd") {
        Object.assign(entry, strings(item, ["role", "location", "bio", "portrait"], field));
        entry.provider = "nvidia";
      } else {
        Object.assign(entry, strings(item, ["type", "class", "location", "risk"], field));
        for (const numeric of ["baseValue", "income", "upkeep", "amount", "coupon"]) {
          if (own(item, numeric)) entry[numeric] = number(item[numeric], `${field}.${numeric}`, 0, MAX_MONEY);
        }
      }
      return entry;
    }).filter(Boolean);
  }
  if (own(value, "characterUpdate")) result.characterUpdate = characterPatch(value.characterUpdate);
  if (own(value, "tradeOfferAdd")) {
    if (!Array.isArray(value.tradeOfferAdd) || value.tradeOfferAdd.length > 8) invalid("tradeOfferAdd");
    result.tradeOfferAdd = value.tradeOfferAdd.map((offer) => {
      if (!record(offer) || !Array.isArray(offer.items) || !offer.items.length || offer.items.length > 12) invalid("tradeOfferAdd");
      const sellerName = string(offer.sellerName, "tradeOfferAdd.sellerName", 160);
      if (!sellerName) invalid("tradeOfferAdd.sellerName");
      const entry = { sellerName, totalCredits: number(offer.totalCredits, "tradeOfferAdd.totalCredits", 1, MAX_MONEY, true) };
      if (own(offer, "lease")) {
        try { entry.lease = validateLeaseTerms(offer.lease, entry.totalCredits); }
        catch { invalid("tradeOfferAdd.lease"); }
      }
      if (own(offer, "priceComponents")) {
        try { entry.priceComponents = validatePriceComponents(offer.priceComponents, entry.totalCredits); }
        catch { invalid("tradeOfferAdd.priceComponents"); }
      }
      if (own(offer, "sellerSpecies")) {
        const species = string(offer.sellerSpecies, "tradeOfferAdd.sellerSpecies", 160);
        if (species) entry.sellerSpecies = species;
      }
      const seen = new Set();
      entry.items = offer.items.map((item) => {
        if (!record(item)) invalid("tradeOfferAdd.items");
        const name = string(item.name, "tradeOfferAdd.items.name", 160);
        if (!name || seen.has(keyOf(name))) invalid("tradeOfferAdd.items.name");
        seen.add(keyOf(name));
        return { name, qty: number(item.qty, "tradeOfferAdd.items.qty", 1, 100, true), tag: own(item, "tag") ? string(item.tag, "tradeOfferAdd.items.tag", 160) || "gear" : "gear" };
      });
      return entry;
    });
  }
  if (own(value, "travelAccessAdd")) {
    if (!Array.isArray(value.travelAccessAdd) || value.travelAccessAdd.length > 25) invalid("travelAccessAdd");
    result.travelAccessAdd = value.travelAccessAdd.map((item) => string(item, "travelAccessAdd", 80)).filter(Boolean);
  }
  const structured = {
    conditionAdd: ["name", "severity", "note"],
    decisionAdd: ["title", "detail", "consequence"],
    objectiveAdd: ["title", "detail", "status"],
    discoveryAdd: ["title", "detail", "source"],
    milestoneAdd: ["title", "detail"],
    storyDirectiveAdd: ["title", "detail", "status"],
    relationshipUpdate: ["name", "role", "disposition", "status", "note"],
    legacyAssetUpsert: ["name", "category", "status", "accessRequirements", "evidence"],
  };
  for (const [field, fields] of Object.entries(structured)) {
    if (!own(value, field)) continue;
    if (!Array.isArray(value[field]) || value[field].length > 50) invalid(field);
    result[field] = value[field].map((item) => {
      if (!record(item)) invalid(field);
      const entry = strings(item, fields, field);
      const identity = field === "conditionAdd" || field === "relationshipUpdate" || field === "legacyAssetUpsert" ? entry.name : entry.title;
      if (!identity) return null;
      if (field === "legacyAssetUpsert") {
        if (!new Set(["suspected", "inaccessible", "confirmed", "controlled"]).has(entry.status)) invalid(`${field}.status`);
        if (own(item, "estimatedValue")) entry.estimatedValue = number(item.estimatedValue, `${field}.estimatedValue`, 0, MAX_MONEY);
      }
      return entry;
    }).filter(Boolean);
  }
  for (const field of ["conditionRemove", "objectiveComplete"]) {
    if (!own(value, field)) continue;
    if (!Array.isArray(value[field]) || value[field].length > 50) invalid(field);
    result[field] = value[field].map((item) => string(record(item) ? item[field === "objectiveComplete" ? "title" : "name"] : item, field, 200)).filter(Boolean);
  }
  return result;
}

export function parseEngineResponse(text, { requireState = false } = {}) {
  if (typeof text !== "string" || !text.trim()) throw new Error("The GM returned an empty response. Retry this turn.");
  const blocks = [...text.matchAll(/<!--\s*STATE\s*:([\s\S]*?)-->/gi)];
  const markers = text.match(/<!--\s*STATE\b/gi) || [];
  if (blocks.length > 1 || markers.length !== blocks.length) throw new Error("The GM returned an incomplete or duplicate world-state block. Retry this turn.");
  if (!blocks.length) {
    // A play turn is not final until its ledger is explicit. Saving prose while
    // silently dropping XP, inventory, injuries, or location changes creates a
    // split-brain campaign, so require the provider to repair the response.
    if (requireState) throw new Error("The GM omitted the required world-state ledger. Retry this turn.");
    return { clean: text.trim(), delta: null };
  }
  let parsed;
  try { parsed = JSON.parse(blocks[0][1]); }
  catch { throw new Error("The GM returned malformed world-state JSON. Retry this turn."); }
  const delta = validateDelta(parsed);
  const clean = text.replace(blocks[0][0], "").replace(/```(?:json)?\s*```/gi, "").trim();
  if (!clean) throw new Error("The GM returned a ledger without a scene response. Retry this turn.");
  return { clean, delta };
}

const safeExistingNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const safeArray = (value) => Array.isArray(value) ? value.filter(record).map((item) => ({ ...item })) : [];
function addUnique(target, additions, create) {
  const names = new Set(target.filter((item) => typeof item.name === "string").map((item) => keyOf(item.name)));
  for (const entry of additions || []) {
    const name = keyOf(entry.name);
    if (!names.has(name)) { target.push(create(entry)); names.add(name); }
  }
}

export function applyEngineDelta(previous, delta, genId = defaultId) {
  const patch = validateDelta(delta);
  if (!record(previous)) invalid("previous ledger");
  const next = { ...previous };
  next.health = bound(safeExistingNumber(previous.health) + (patch.health || 0), 0, MAX_HEALTH);
  for (const field of ["notoriety", "forceAlignment", "credits", "creditsCriminal"]) {
    next[field] = bound(safeExistingNumber(previous[field]) + (patch[field] || 0), 0, field.startsWith("credits") ? MAX_MONEY : 100);
  }
  next.conditionTrack = bound(safeExistingNumber(previous.conditionTrack) + (patch.conditionTrack || 0), 0, 5);
  next.forcePoints = bound(safeExistingNumber(previous.forcePoints) + (patch.forcePoints || 0), 0, 100);
  next.destinyPoints = bound(safeExistingNumber(previous.destinyPoints) + (patch.destinyPoints || 0), 0, 100);
  next.darkSideScore = bound(safeExistingNumber(previous.darkSideScore) + (patch.darkSideScore || 0), 0, 100);
  next.campaignTimeMinutes = Math.max(0, Math.floor(safeExistingNumber(previous.campaignTimeMinutes)) + (patch.timeAdvanceMinutes || 0));
  if (patch.location) next.location = patch.location;
  next.factionRep = { ...(record(previous.factionRep) ? previous.factionRep : {}) };
  for (const field of ["empire", "rebellion", "csa"]) next.factionRep[field] = bound(safeExistingNumber(next.factionRep[field]) + (patch.factionRep?.[field] || 0), 0, 100);
  for (const field of ["inventory", "properties", "ships", "investments", "contacts", "publicNews", "flags", "conditions", "decisions", "objectives", "discoveries", "milestones", "storyDirectives", "relationships", "legacyAssets"]) next[field] = safeArray(previous[field]);
  next.travelAccess = Array.isArray(previous.travelAccess) ? previous.travelAccess.filter((item) => typeof item === "string") : [];
  next.inventory = next.inventory.filter((item) => typeof item.name === "string" && item.name.trim()).map((item) => ({ ...item, qty: bound(Math.floor(safeExistingNumber(item.qty)), 0, MAX_QUANTITY) }));
  for (const field of ["inventoryAdd", "inventoryRemove"]) {
    const seen = new Set();
    for (const item of patch[field] || []) {
      const fingerprint = `${keyOf(item.name)}:${item.qty}`;
      if (!item.qty || seen.has(fingerprint)) continue;
      seen.add(fingerprint);
      const existing = next.inventory.find((entry) => keyOf(entry.name) === keyOf(item.name));
      if (existing) existing.qty = bound(existing.qty + (field === "inventoryAdd" ? item.qty : -item.qty), 0, MAX_QUANTITY);
      else if (field === "inventoryAdd") next.inventory.push({ id: genId(), name: item.name, qty: item.qty, tag: item.tag || "misc" });
    }
  }
  next.inventory = next.inventory.filter((item) => item.qty > 0);
  addUnique(next.properties, patch.propertyAdd, (item) => ({ id: genId(), type: "property", location: "", baseValue: 0, income: 0, upkeep: 0, risk: "", ...item }));
  addUnique(next.ships, patch.shipAdd, (item) => ({ id: genId(), class: "unknown class", location: "", baseValue: 0, income: 0, upkeep: 0, risk: "", ...item }));
  addUnique(next.investments, patch.investmentAdd, (item) => ({ id: genId(), type: "stock", amount: 0, coupon: 0, risk: "", ...item }));
  addUnique(next.contacts, patch.contactAdd, (item) => ({ id: genId(), role: "contact", location: next.location, bio: "", portrait: "", ...item, channel: `npc:${genId()}`, provider: "nvidia" }));
  const headlines = new Set(next.publicNews.filter((item) => typeof item.headline === "string").map((item) => keyOf(item.headline)));
  for (const item of patch.publicNewsAdd || []) {
    if (!headlines.has(keyOf(item.headline))) { next.publicNews.push({ id: genId(), source: "unattributed public report", ...item, ts: Date.now() }); headlines.add(keyOf(item.headline)); }
  }
  next.publicNews = next.publicNews.slice(-12);
  for (const id of patch.travelAccessAdd || []) if (!next.travelAccess.some((entry) => keyOf(entry) === keyOf(id))) next.travelAccess.push(id);
  for (const item of patch.conditionAdd || []) {
    const existing = next.conditions.find((entry) => keyOf(entry.name) === keyOf(item.name));
    if (existing) Object.assign(existing, item, { status: "active", updatedAt: Date.now() });
    else next.conditions.push({ id: genId(), ...item, status: "active", updatedAt: Date.now() });
  }
  const removedConditions = new Set((patch.conditionRemove || []).map(keyOf));
  next.conditions = next.conditions.filter((entry) => !removedConditions.has(keyOf(String(entry.name || ""))));
  const decisionTitles = new Set(next.decisions.map((entry) => keyOf(String(entry.title || ""))));
  for (const item of patch.decisionAdd || []) if (!decisionTitles.has(keyOf(item.title))) {
    next.decisions.push({ id: genId(), ...item, decidedAt: Date.now() });
    decisionTitles.add(keyOf(item.title));
  }
  for (const item of patch.objectiveAdd || []) {
    const existing = next.objectives.find((entry) => keyOf(entry.title) === keyOf(item.title));
    if (existing) Object.assign(existing, item, { updatedAt: Date.now() });
    else next.objectives.push({ id: genId(), status: "active", ...item, createdAt: Date.now(), updatedAt: Date.now() });
  }
  const completedObjectives = new Set((patch.objectiveComplete || []).map(keyOf));
  for (const objective of next.objectives) if (completedObjectives.has(keyOf(String(objective.title || "")))) Object.assign(objective, { status: "completed", completedAt: Date.now(), updatedAt: Date.now() });
  const discoveryTitles = new Set(next.discoveries.map((entry) => keyOf(String(entry.title || ""))));
  for (const item of patch.discoveryAdd || []) if (!discoveryTitles.has(keyOf(item.title))) {
    next.discoveries.push({ id: genId(), ...item, discoveredAt: Date.now() });
    discoveryTitles.add(keyOf(item.title));
  }
  const milestoneTitles = new Set(next.milestones.map((entry) => keyOf(String(entry.title || ""))));
  for (const item of patch.milestoneAdd || []) if (!milestoneTitles.has(keyOf(item.title))) {
    next.milestones.push({ id: genId(), ...item, reachedAt: Date.now() });
    milestoneTitles.add(keyOf(item.title));
  }
  for (const item of patch.storyDirectiveAdd || []) {
    const existing = next.storyDirectives.find((entry) => keyOf(entry.title) === keyOf(item.title));
    if (existing) Object.assign(existing, item, { status: item.status || existing.status || "active", updatedAt: Date.now() });
    else next.storyDirectives.push({ id: genId(), status: "active", ...item, createdAt: Date.now(), updatedAt: Date.now() });
  }
  for (const item of patch.relationshipUpdate || []) {
    const existing = next.relationships.find((entry) => keyOf(entry.name) === keyOf(item.name));
    if (existing) Object.assign(existing, item, { updatedAt: Date.now() });
    else next.relationships.push({ id: genId(), ...item, updatedAt: Date.now() });
  }
  for (const item of patch.legacyAssetUpsert || []) {
    const existing = next.legacyAssets.find((entry) => keyOf(entry.name) === keyOf(item.name));
    if (existing) Object.assign(existing, item, { updatedAt: Date.now() });
    else next.legacyAssets.push({ id: genId(), ...item, updatedAt: Date.now() });
  }
  if (patch.note && !next.flags.some((item) => typeof item.note === "string" && keyOf(item.note) === keyOf(patch.note))) next.flags.push({ note: patch.note, ts: Date.now() });
  return next;
}

export function applyCharacterDelta(character, update) {
  if (update == null) return character;
  const patch = characterPatch(update);
  if (!record(character)) return character;
  return { ...character, ...patch };
}

export { sagaLevelForExperience };

export function applyExperienceAward(character, award) {
  if (!record(character)) return character;
  const earned = number(award ?? 0, "experienceAward", 0, 5000, true);
  const experience = Math.min(MAX_MONEY, Math.max(0, Math.floor(safeExistingNumber(character.experience))) + earned);
  // XP unlocks advancement; it never chooses the player's class, talent,
  // feat, ability increases, or hit-point roll. The level is committed only
  // by the validated advancement transaction.
  return { ...character, experience };
}
