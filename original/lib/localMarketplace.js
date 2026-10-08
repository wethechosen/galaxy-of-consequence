// Campaign retail prices, not securities quotes or a claim about rulebook prices.
// Availability is derived from the saved place; selecting a merchant never travels.
const GOODS = [
  { id: "medpac", name: "Medpac", category: "Medical", base: 200, venue: "bazaar" },
  { id: "comlink", name: "Encrypted comlink", category: "Communications", base: 350, venue: "bazaar" },
  { id: "slicer-kit", name: "Slicing kit", category: "Gear", base: 800, venue: "guild" },
  { id: "blaster", name: "Blaster pistol", category: "Weapon", base: 750, venue: "guild" },
  { id: "macrobinoculars", name: "Macrobinoculars", category: "Reconnaissance", base: 450, venue: "bazaar" },
  { id: "survival-kit", name: "Wilderness survival kit", category: "Survival", base: 600, venue: "guild" },
  { id: "civilian-tunic", name: "Civilian tunic", category: "Clothing", base: 50, venue: "bazaar" },
  { id: "travel-robe", name: "Heavy traveling robe", category: "Clothing", base: 120, venue: "bazaar" },
  { id: "ration", name: "Packaged meal", category: "Provisions", base: 12, venue: "cantina" },
  { id: "apartment", name: "Local apartment", category: "Property", base: 45000, venue: "property", ownership: "property" },
  { id: "home", name: "Local residence", category: "Property", base: 125000, venue: "property", ownership: "property" },
  { id: "speeder", name: "Used civilian landspeeder", category: "Vehicle", base: 6500, venue: "vehicles", ownership: "vehicle" },
  { id: "luxury-robe", name: "Tailored formal robe", category: "Clothing", base: 600, venue: "bazaar", luxury: true },
  { id: "luxury-speeder", name: "Luxury civilian landspeeder", category: "Vehicle", base: 32000, venue: "vehicles", ownership: "vehicle", luxury: true },
  { id: "hot-comlink", name: "Unregistered encrypted comlink", category: "Communications", base: 220, venue: "shadow", illicit: true },
  { id: "hot-speeder", name: "Landspeeder with disputed registration", category: "Vehicle", base: 4000, venue: "shadow", ownership: "vehicle", illicit: true },
];
const worlds = ["coruscant", "naboo", "corellia", "commenor", "bimmisaari", "bonadan", "tatooine", "nar shaddaa", "mandalore", "nal hutta", "nar kanji"];
const slug = text => String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function localMarketProfile(location, state = {}) {
  const text = String(location || "");
  const lower = text.toLowerCase();
  const planet = worlds.find(world => lower.includes(world));
  const confined = /prison|detention|infirmary|brig|cell block|custody/.test(lower);
  const remote = /substructure|transit route|maintenance (?:tunnel|junction)|deep wilderness|hyperspace|uninhabited/.test(lower);
  const merchant = state.sceneMerchant?.location === text ? state.sceneMerchant : null;
  const settlement = /market|bazaar|cantina|shop|store|concourse|district|city|theed|mos eisley|residential|spaceport|docking bay|broker|guild|guesthouse|hotel/.test(lower);
  const available = Boolean(planet && !confined && (!remote && settlement || merchant && !remote));
  const illicit = /black market|illegal|smuggl|underworld|shadow market|syndicate market/.test(lower);
  const luxury = /luxury|palace|noble|upper.city|lake country/.test(lower) || planet === "naboo" && /theed|boutique/.test(lower);
  const level = /\blevel\s+(\d+)/i.exec(text)?.[1] || null;
  const district = text.split(/\s[—–]\s/).slice(1).join(" — ") || "local district";
  const modifier = luxury ? 1.65 : illicit ? .85 : planet === "coruscant" ? 1.15 : planet === "naboo" ? 1.25 : 1;
  return { id: slug(text), planet: planet ? planet.replace(/\b\w/g, c => c.toUpperCase()) : "Unknown world", district, level,
    available, confined, illicit, luxury, modifier, merchant,
    name: `${luxury ? "Boutiques & local dealers" : illicit ? "Shadow bazaar" : "Local markets & services"}`,
    note: available ? (illicit ? "Unregistered and hot stock is marked. Ownership does not clear a disputed title or make stolen goods legal." : luxury ? "Local boutiques, brokers, and vehicle dealers reflect this district's luxury prices." : "Browse the vendors serving your current district. Purchases are recorded here, not on the stock exchange.") : "No accessible retail venue is established at your present location. Reach a settlement or meet a merchant through play." };
}

export function localMarket(location, _level = 1, state = {}) {
  const area = localMarketProfile(location, state);
  const venues = [
    ["bazaar", area.luxury ? "Clothiers & outfitters" : "Bazaar stalls", "Clothing, medicine, and everyday supplies"],
    ["cantina", "Cantinas & provisions", "Food for the road; ask in play about rooms and local conversation"],
    ["guild", "Trade guild suppliers", "Tools and commonly traded equipment"],
    ["property", "Local property brokers", "Apartments and residences in this district"],
    ["vehicles", "Speeder dealers", "Civilian vehicles held locally"],
    ...(area.illicit ? [["shadow", "Unregistered traders", "Hot stock, disputed titles, and black-market goods"]] : []),
  ];
  const merchants = venues.map(([kind, name, description]) => ({ id: `${area.id}:${kind}`, kind, name, description, location }));
  const goods = GOODS.filter(good => (!good.luxury || area.luxury) && (!good.illicit || area.illicit))
    .map(good => ({ ...good, minLevel: 1, marketId: area.id, merchantId: `${area.id}:${good.venue}`, location,
      name: good.ownership === "property" ? `${good.name} — ${area.district}` : good.name,
      price: Math.max(1, Math.round(good.base * area.modifier)), legality: good.illicit ? "Disputed / hot" : "Ordinary retail" }));
  // A same-scene seller may only display their own saved offers, never invented stock.
  const offers = (state.tradeOffers || []).filter(offer => offer && offer.status !== "accepted" && offer.status !== "expired" && offer.location === location);
  return { area, merchants, goods, offers, npcMarket: null, exchange: { ...area, modifier: area.modifier } };
}

export function localTradeAccess(location, character, state, good = null) {
  const area = localMarketProfile(location, state);
  const samePlace = !good || (!good.location || good.location === location) && (!good.marketId || good.marketId === area.id);
  const affordable = !good || Number.isSafeInteger(Number(good.price)) && Number(state?.credits || 0) >= Number(good.price);
  const owned = Boolean(good?.ownership === "property" && (state?.properties || []).some(property => property.listingId === `${area.id}:${good.id}`));
  const reasons = [];
  if (!area.available) reasons.push(area.note);
  if (!samePlace) reasons.push("That listing belongs to another district. Reopen the local market.");
  if (!affordable) reasons.push("Spendable credits do not cover this price. Withdraw funds from your bank if needed.");
  if (owned) reasons.push("You already own this listed property.");
  return { direct: area.available && samePlace && affordable && !owned, publicMarket: area.available, confined: area.confined,
    levelReady: true, affordable, owned, reason: reasons.join(" ") || "Purchase and payment will be recorded together." };
}

export function localSellQuote(item, location) {
  if (!item?.name || item.legality === "Disputed / hot" && !localMarketProfile(location).illicit) return null;
  const catalog = GOODS.find(good => good.name.toLowerCase() === String(item.name).toLowerCase() && !good.ownership);
  if (!catalog || catalog.illicit && !localMarketProfile(location).illicit) return null;
  const price = Math.max(1, Math.round(catalog.base * localMarketProfile(location).modifier));
  return { good: catalog, price: Math.max(1, Math.round(price * .55)) };
}
