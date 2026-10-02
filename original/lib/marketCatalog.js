export const BASE_GOODS = [
  { id: "medpac", name: "Medpac", category: "Medical", base: 200, minLevel: 1, tags: ["Core", "Outer Rim"] },
  { id: "comlink", name: "Encrypted comlink", category: "Communications", base: 350, minLevel: 1, tags: ["Core", "Outer Rim", "Hutt Space"] },
  { id: "slicer-kit", name: "Slicing kit", category: "Gear", base: 800, minLevel: 2, tags: ["Core", "Hutt Space"] },
  { id: "blaster", name: "Blaster pistol", category: "Weapon", base: 750, minLevel: 1, tags: ["Core", "Outer Rim"] },
  { id: "macrobinoculars", name: "Macrobinoculars", category: "Reconnaissance", base: 450, minLevel: 1, tags: ["Core", "Outer Rim"] },
  { id: "survival-kit", name: "Wilderness survival kit", category: "Survival", base: 600, minLevel: 2, tags: ["Outer Rim", "Deep Core"] },
  { id: "beskar-plate", name: "Beskar-reinforced plate", category: "Armor", base: 6200, minLevel: 4, tags: ["Mandalore", "Outer Rim"] },
];

const EXCHANGE_ZONES = [
  { id: "bonadan", name: "Bonadan Stock Exchange", match: ["bonadan", "corporate sector"], modifier: 1.08, note: "Corporate Sector freight and industrial futures dominate the ticker." },
  { id: "coruscant", name: "Coruscanti Stock Exchange", match: ["coruscant", "galactic city"], modifier: 1.15, note: "Core-world liquidity is high; regulation and information asymmetry are higher." },
  { id: "outer-rim", name: "Outer Rim Exchange Network", match: ["tatooine", "nar shaddaa", "felucia", "dathomir", "mandalore"], modifier: 0.92, note: "Prices move with convoy risk, syndicate tolls, and local scarcity." },
  { id: "deep-core", name: "Deep Core Restricted Markets", match: ["byss", "exegol", "korriban", "ossus"], modifier: 1.32, note: "Restricted routes, relic claims, and secrecy premiums distort every quote." },
];

export const EXCHANGE_TICKER = EXCHANGE_ZONES.map((exchange, index) => ({
  ...exchange,
  signal: index % 2 === 0 ? "▲" : "▼",
  change: `${index % 2 === 0 ? "+" : "-"}${(exchange.modifier * 3.2).toFixed(1)}%`,
}));

const SECURITIES = [
  { symbol: "CSA-F", name: "Corporate Sector Freight Combine", exchange: "bonadan", base: 68.4, sector: "Logistics" },
  { symbol: "BON-IND", name: "Bonadan Industrial Authority", exchange: "bonadan", base: 88.6, sector: "Heavy Industry" },
  { symbol: "IGF-B", name: "IGFED Settlement Bond Series B", exchange: "bonadan", base: 100.0, sector: "Reserve / Settlement", instrument: "bond", coupon: 4.75 },
  { symbol: "VMI", name: "Vonn Meridian Interstellar", exchange: "coruscant", base: 184.2, sector: "Finance / Infrastructure" },
  { symbol: "KDY", name: "Kuat Drive Yards", exchange: "coruscant", base: 276.8, sector: "Shipbuilding" },
  { symbol: "COR-UTIL", name: "Coruscant Utilities Trust", exchange: "coruscant", base: 121.5, sector: "Utilities", instrument: "bond", coupon: 5.1 },
  { symbol: "HUTT", name: "Kajidic Trade Holdings", exchange: "outer-rim", base: 91.7, sector: "Freight / Entertainment" },
  { symbol: "MAL", name: "MandalMotors Reconstruction Group", exchange: "outer-rim", base: 119.3, sector: "Armor / Vehicles" },
  { symbol: "TAT-W", name: "Tatooine Water Cooperative Notes", exchange: "outer-rim", base: 74.8, sector: "Water / Agriculture", instrument: "bond", coupon: 6.2 },
  { symbol: "OSS-ARC", name: "Ossus Restoration Trust", exchange: "deep-core", base: 52.1, sector: "Archives / Restoration" },
  { symbol: "BYSS-SEC", name: "Byss Security Infrastructure", exchange: "deep-core", base: 163.4, sector: "Security / Defense" },
  { symbol: "KOR-REL", name: "Korriban Relic Recovery Bonds", exchange: "deep-core", base: 39.6, sector: "Archaeology / Recovery", instrument: "bond", coupon: 7.4 },
];

export function getSecuritiesTicker(now = Date.now(), gameState = {}) {
  const interval = Math.floor(now / 30000);
  const pressure = Number(gameState.notoriety || 0) + Number(gameState.factionRep?.csa || 0);
  return SECURITIES.map((security, index) => {
    const wave = Math.sin(interval / 3 + index * 1.7);
    const eventPressure = ((pressure % 11) - 5) * 0.08;
    const percent = Number((wave * 1.35 + eventPressure).toFixed(2));
    const price = Number((security.base * (1 + percent / 100)).toFixed(2));
    return {
      ...security,
      instrument: security.instrument || "stock",
      price,
      change: percent,
      rising: percent >= 0,
    };
  });
}

export function getSecuritiesForExchange(exchangeId, now = Date.now(), gameState = {}) {
  return getSecuritiesTicker(now, gameState).filter((security) => security.exchange === exchangeId);
}

function hashText(value) {
  return [...String(value || "")].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

export function getEconomicSnapshot(gameState = {}, now = Date.now()) {
  const securities = getSecuritiesTicker(now, gameState);
  const cycle = Math.floor(now / 3600000);
  const location = (gameState.location || "").toLowerCase();
  const factionPressure = Number(gameState.factionRep?.csa || 0) + Number(gameState.factionRep?.empire || 0) - Number(gameState.notoriety || 0);
  const factor = ((Math.sin(cycle / 5) * 1.5) + (factionPressure % 7) * 0.12) / 100;
  const propertyHoldings = (gameState.properties || []).map((property) => {
    const base = property.baseValue || ((property.type || "").toLowerCase().includes("warehouse") ? 85000 : 45000);
    const change = Number((factor + ((hashText(property.name) % 9) - 4) / 100).toFixed(2));
    return { ...property, value: Math.max(1000, Math.round(base * (1 + change))), change, income: property.income || Math.round(base * 0.002), upkeep: property.upkeep || Math.round(base * 0.001), risk: property.risk || (location.includes(String(property.location || "").toLowerCase()) ? "LOW" : "TRAVEL EXPOSURE") };
  });
  const shipHoldings = (gameState.ships || []).map((ship) => {
    const base = ship.baseValue || ((ship.class || "").toLowerCase().includes("freighter") ? 120000 : 70000);
    const change = Number((factor + ((hashText(ship.name) % 11) - 5) / 100).toFixed(2));
    return { ...ship, value: Math.max(1000, Math.round(base * (1 + change))), change, income: ship.income || 0, upkeep: ship.upkeep || Math.round(base * 0.003), risk: ship.risk || "MAINTENANCE / SEIZURE EXPOSURE" };
  });
  const investmentHoldings = (gameState.investments || []).map((holding) => {
    const principal = Number(holding.amount) || 0;
    const change = Number((factor + ((hashText(holding.name) % 13) - 6) / 100).toFixed(2));
    const isBond = (holding.type || "").toLowerCase().includes("bond");
    return { ...holding, instrument: isBond ? "bond" : "stock", value: Math.max(0, Math.round(principal * (1 + change))), change, income: isBond ? Math.round(principal * ((holding.coupon || 4.75) / 100) / 12) : 0, risk: holding.risk || (isBond ? "ISSUER / DEFAULT RISK" : "MARKET / POLITICAL RISK") };
  });
  return { securities, properties: propertyHoldings, ships: shipHoldings, investments: investmentHoldings, cycle };
}

export const IGFED = {
  name: "Intergalactic Federal Reserve",
  abbreviation: "IGFED",
  mandate: "Stabilizes the galactic credit, clears recognized interstellar settlements, and publishes reserve guidance for participating banking institutions.",
  status: "MONETARY AUTHORITY // 155 ABY",
  reserveRate: "4.75%",
  creditStandard: "Galactic credit backed by recognized reserve guarantees and settlement ledgers",
  bulletin: "Reserve officials caution that blockades, counterfeit credits, sanctions, and fragmented jurisdiction can create local spreads even when the central credit remains stable.",
  notices: [
    "Outer Rim settlement risk remains elevated along contested hyperlanes.",
    "Restricted relic markets are not IGFED-cleared venues.",
    "Local banks may impose identity, source-of-funds, or faction-screening requirements.",
  ],
};

const NPC_MARKETS = [
  { match: "exegol", name: "Sith Eternal quartermaster", goods: ["Executor shell components", "Encrypted Sith Eternal transponder", "Cult logistics manifest"], minLevel: 8, note: "A dangerous black-market contact; availability requires an earned encounter." },
  { match: "korriban", name: "Sith lord's relic broker", goods: ["Sith holocron (sealed)", "Ritual inscription fragment", "Ancient tomb access token"], minLevel: 6, note: "These are not ordinary merchandise. The GM controls authenticity, cost, and consequence." },
  { match: "nar shaddaa", name: "Hutt kajidic broker", goods: ["Forged identity package", "Syndicate route intelligence", "Restricted cargo contract"], minLevel: 2, note: "Every transaction creates a debt, obligation, or witness." },
];

export function getExchange(location) {
  const lower = (location || "").toLowerCase();
  return EXCHANGE_ZONES.find((exchange) => exchange.match.some((term) => lower.includes(term))) || {
    id: "regional",
    name: "Regional Trade Board",
    modifier: 1,
    note: "Local prices are provisional until a recognized exchange confirms the route.",
  };
}

export function getMarket(location, level = 1) {
  const exchange = getExchange(location);
  const goods = BASE_GOODS
    .filter((good) => good.minLevel <= Math.max(1, Number(level) || 1))
    .filter((good) => good.tags.some((tag) => location?.toLowerCase().includes(tag.toLowerCase())) || good.tags.includes("Outer Rim"))
    .map((good) => ({ ...good, price: Math.max(1, Math.round(good.base * exchange.modifier)) }));
  const npcMarket = NPC_MARKETS.find((market) => (location || "").toLowerCase().includes(market.match) && level >= market.minLevel);
  return { exchange, goods, npcMarket };
}

const CONFINEMENT_TERMS = ["prison", "detention", "infirmary", "brig", "cell block", "custody"];
const PUBLIC_MARKET_TERMS = [
  "coruscant", "corellia", "commenor", "naboo", "bimmisaari", "bonadan",
  "tatooine", "nar shaddaa", "mandalore", "nal hutta", "nar kanji",
];

export function getTradeAccess(location, character, gameState, good = null) {
  const lower = String(location || "").toLowerCase();
  const level = Math.max(1, Number(character?.level) || 1);
  const confined = CONFINEMENT_TERMS.some((term) => lower.includes(term));
  const publicMarket = !confined && PUBLIC_MARKET_TERMS.some((term) => lower.includes(term));
  const levelReady = !good || level >= Number(good.minLevel || 1);
  const affordable = !good || Number(gameState?.credits || 0) >= Number(good.price || good.base || 0);
  const reasons = [];
  if (confined) reasons.push("You cannot complete an ordinary retail transaction while confined.");
  else if (!publicMarket) reasons.push("No verified public market is available at the current location.");
  if (!levelReady) reasons.push(`Character level ${good.minLevel} is required for this item.`);
  if (!affordable) reasons.push("Available credits do not cover the listed price.");
  return {
    direct: publicMarket && levelReady && affordable,
    publicMarket,
    confined,
    levelReady,
    affordable,
    reason: reasons.join(" ") || "Public retail purchase is available at the listed price.",
  };
}

export function getSellQuote(item, location) {
  if (!item?.name) return null;
  const catalog = BASE_GOODS.find((good) => good.name.toLowerCase() === String(item.name).toLowerCase());
  if (!catalog) return null;
  const exchange = getExchange(location);
  const currentPrice = Math.max(1, Math.round(catalog.base * exchange.modifier));
  return { good: catalog, price: Math.max(1, Math.round(currentPrice * 0.55)) };
}
