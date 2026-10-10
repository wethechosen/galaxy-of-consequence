// Verified Core Rulebook presets. Retail prices and named residences are
// campaign records, not a claim that the rulebook sets their local prices.
const core = pages => ({ title: "Saga Edition Core Rulebook", pages, verified: true });
export const ITEM_STAT_PRESETS = {
  "blaster-pistol": { kind: "weapon", source: core("125–126"), stats: { Damage: "3d6 energy", "Stun damage": "2d6", "Rate of fire": "Single", Weight: "1 kg", Availability: "Restricted", "Base book cost": "500 cr", "Power pack": "100 shots" }, proficiency: "Weapon Proficiency (pistols)", notes: ["Attack bonuses come from the wielder's build; this is not an automatic hit."] },
  "armored-flight-suit": { kind: "armor", source: core("132–133"), stats: { Category: "Light armor", "Reflex armor bonus": "+5 (replaces heroic level unless a talent says otherwise)", "Fortitude equipment bonus": "+2 with proficiency", "Maximum Dexterity bonus": "+3", "Nonproficiency penalty": "−2 attacks and affected skills", Weight: "10 kg", "Life support": "Up to 10 hours with functioning sealed equipment", Availability: "Licensed", "Base book cost": "4,000 cr" }, proficiency: "Armor Proficiency (light)", notes: ["Possession does not equip armor. Equipment bonuses require proficiency; armor does not stack freely with heroic level."] },
  "encrypted-comlink": { kind: "gear", source: core("134"), stats: { Function: "Communications", Encryption: "+10 to the DC to intercept transmissions", "Recorded model": "Not yet established", "Short-range reference": "50 km / low orbit", "Long-range reference": "200 km / high orbit" }, notes: ["The saved item name establishes encryption, not whether this unit is short-range, long-range, video, or holo capable."] },
  medpac: { kind: "medical", source: core("138"), stats: { Function: "First aid using Treat Injury", Consumption: "Consumed when used, even if the check succeeds", "Patient limit": "One medpac benefit per 24 hours" }, notes: ["Does not heal merely by being carried."] },
  "bacta-tank": { kind: "medical", source: core("137"), stats: { Capacity: "One patient", "Minimum fill": "150 litres", "Typical capacity": "300 litres", "Bacta use": "1 litre per treatment hour", "Bacta cost": "100 cr per litre", "Successful surgery": "Adds healing equal to patient level", "Disease / poison / radiation": "+5 equipment bonus to Treat Injury" }, notes: ["Requires the relevant Treat Injury procedure, supplies and a qualified operator. A tank is not passive full healing and is not included in every home."] },
  "x34-landspeeder": { kind: "vehicle", source: core("176"), stats: { Model: "SoroSuub X-34", Size: "Large", "Base HP": 40, DR: 5, "Damage threshold": 19, "Stock Reflex": "14 (flat-footed 10)", "Stock Fortitude": 14, Speed: "12 squares; maximum 330 km/h", Cover: "+5", Crew: 1, Passengers: 1, Cargo: "30 kg", Consumables: "1 day", Weapons: "None", Availability: "Licensed", "Base book cost": "10,550 cr new / 2,500 cr used" }, notes: ["Stock pilot/crew values are a reference, not the player's Pilot modifier. Damage and upgrades require recorded changes."] },
  "tie-interceptor": { kind: "vehicle", source: core("180"), stats: { Model: "TIE Interceptor", Size: "Huge starfighter", "Base HP": 90, DR: 10, "Damage threshold": 34, "Stock Reflex": "18 (flat-footed 11)", "Stock Fortitude": 24, Speed: "Fly 16 squares / 5 starship-scale", "Maximum velocity": "1,250 km/h", Weapons: "Laser cannons: 6d10 ×2", Crew: 1, Passengers: 0, Cargo: "75 kg", Consumables: "2 days", Availability: "Military", "Base book cost": "120,000 cr new / 50,000 cr used" }, notes: ["No hyperdrive is established in this stock block. Access, pilot skill and weapon attacks remain separate checks."] },
};
const names = [
  [/^blaster pistol$/i, "blaster-pistol"],
  [/^(?:armored (?:spacer['’]s )?flight suit|flight suit, armored)$/i, "armored-flight-suit"],
  [/^(?:unregistered )?encrypted comlink$/i, "encrypted-comlink"],
  [/^medpac$/i, "medpac"], [/^bacta tank$/i, "bacta-tank"],
  [/^(?:SoroSuub )?X-34(?: landspeeder)?$/i, "x34-landspeeder"],
  [/^TIE Interceptor$/i, "tie-interceptor"],
];
export function itemPreset(item = {}) {
  // Only known immutable IDs or exact names select a verified rule preset.
  const id = ITEM_STAT_PRESETS[item.rulesId] ? item.rulesId : names.find(([pattern]) => pattern.test(String(item.name || item.class || "")))?.[1];
  return id ? { id, ...ITEM_STAT_PRESETS[id] } : null;
}
export function itemStatBlock(item = {}, character = {}, state = {}) {
  const preset = itemPreset(item);
  const property = item.ownership === "property" || /lease|apartment|residence|home|warehouse/i.test(String(item.type || item.category || ""));
  const kind = preset?.kind || (property ? "residence" : item.ownership === "vehicle" || item.class ? "vehicle" : item.tag === "force-relic" ? "artifact" : "gear");
  const feats = [...(Array.isArray(character.featSelections) ? character.featSelections : []), ...(Array.isArray(character.feats) ? character.feats : String(character.feats || "").split(/[,;|]/))].map(feat => String(typeof feat === "string" ? feat : feat.name || feat.id).trim().toLowerCase());
  const proficient = !preset?.proficiency ? null : feats.includes(preset.proficiency.toLowerCase()) || feats.includes(preset.proficiency.toLowerCase().replace(/[()]/g, "").replace(/\s+/g, "-"));
  const lease = item.lease || {};
  const savedStats = item.stats && typeof item.stats === "object" && !Array.isArray(item.stats) ? item.stats : null;
  const stats = property ? {
    Tenure: item.type === "lease" || item.status === "leased" ? "Leased, not owned outright" : item.status || "Recorded holding",
    Location: item.location || "Unestablished",
    ...(lease.months ? { "Term": `${lease.months} months` } : {}),
    ...(lease.rentCredits != null ? { Rent: `${Number(lease.rentCredits).toLocaleString()} cr` } : {}),
    ...(lease.depositCredits != null ? { "Refundable deposit": `${Number(lease.depositCredits).toLocaleString()} cr` } : {}),
    Recovery: "8 consecutive uninterrupted hours: natural healing equal to level, once per 24 hours; persistent conditions prevent it",
    Facilities: (item.facilities || []).map(facility => typeof facility === "string" ? facility : facility.name).join(", ") || "Only recorded facilities are available",
  } : preset?.stats || savedStats || { Identification: "No verified mechanical preset recorded", Quantity: item.qty ?? 1, "Mechanical bonus": "None established" };
  return { name: item.name || "Unidentified item", kind, source: preset?.source || { title: property ? "Campaign holding; recovery: Core Rulebook pp. 148–149" : "Campaign record — mechanics not identified", verified: property }, stats,
    proficiency: preset?.proficiency || null, proficient,
    location: item.location || null, currentHitPoints: item.hp ?? item.health ?? null,
    earned: item.acquisition || item.provenance || null,
    upgrades: Array.isArray(item.upgrades) ? item.upgrades : [],
    notes: [...(preset?.notes || []), ...(item.requirements ? [`Requirements: ${Array.isArray(item.requirements) ? item.requirements.join(", ") : item.requirements}`] : []), "Items do not automatically level with the character. Only saved upgrades, identified properties and earned rewards change their effects.", ...(kind === "artifact" ? ["An earned artifact may exceed retail availability. Ownership does not bypass a power's actual use prerequisites; its identified effects, sacrifices, injuries, costs and provenance must be recorded before use."] : [])],
  };
}
