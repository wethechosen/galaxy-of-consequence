export const GALAXY_LOCATIONS = [
  {
    id: "coruscant",
    name: "Coruscant",
    region: "Core Worlds",
    era: "The ecumenopolis remains the political and financial heart of the galaxy in 150 ABY.",
    description: "A world-city of senatorial towers, corporate enclaves, forgotten levels, and infrastructure older than many governments.",
    districts: ["Galactic City", "Level 1313", "The Works", "Uscru Entertainment District"],
    npcs: ["Corporate fixers", "sector security", "underworld brokers", "Jedi and Imperial observers"],
    mysteries: ["Who controls the abandoned lower-level transit arteries?", "Why are pre-Republic signals waking beneath the city?"],
    travel: "Dense traffic, customs scrutiny, and layered jurisdiction make discreet arrival difficult.",
    tags: ["Core", "Politics", "Underworld", "HoloNet"],
    access: { tier: "open", label: "PUBLIC ROUTE" },
  },
  {
    id: "mandalore",
    name: "Mandalore",
    region: "Outer Rim",
    era: "Mandalorian identity and sovereignty remain contested after generations of war, occupation, and reconstruction.",
    description: "A scarred world of beskar traditions, clans, domed settlements, and old battlefields where history is never politically neutral.",
    districts: ["Sundari", "Clan territories", "The glassed wastes", "Keldabe routes"],
    npcs: ["Clan protectors", "armourers", "mercenary captains", "political restorationists"],
    mysteries: ["Which clan holds the oldest surviving claim?", "What is moving beneath the ruined domes?"],
    travel: "A diplomatic invitation or a trusted clan contact is safer than arriving unannounced.",
    tags: ["Mandalorians", "War", "Tradition", "Outer Rim"],
    access: { tier: "invitation", label: "CLAN CLEARANCE", reason: "A recognized clan invitation, diplomatic warrant, or earned route contact is required." },
  },
  {
    id: "tatooine",
    name: "Tatooine",
    region: "Arkanis sector",
    era: "The desert world remains a crossroads for smugglers, moisture farmers, hunters, and competing syndicates.",
    description: "Two suns, old wreckage, hidden vaults, and settlements that survive by knowing exactly when not to ask questions.",
    districts: ["Mos Eisley", "Mos Espa", "Jundland Wastes", "Dune Sea"],
    npcs: ["Free traders", "Hutt agents", "Tusken clans", "bounty hunters"],
    mysteries: ["Which buried relic is drawing Force-sensitive scavengers?", "Who is buying the old Imperial coordinates?"],
    travel: "Open desert travel is dangerous without water, a guide, or a reliable transport.",
    tags: ["Smugglers", "Hutts", "Desert", "Relics"],
    access: { tier: "open", label: "PUBLIC ROUTE" },
  },
  {
    id: "nar-shaddaa",
    name: "Nar Shaddaa",
    region: "Hutt Space",
    era: "The Smuggler's Moon remains a vertical economy where every service has a price and every price has a hidden clause.",
    description: "A moon-spanning city of docking towers, casinos, syndicate enclaves, chop-shops, and neon-lit desperation.",
    districts: ["Vertical City", "The Promenade", "Red Sector", "Hutt freight warrens"],
    npcs: ["Kajidic representatives", "slicers", "information brokers", "indenture hunters"],
    mysteries: ["Who is laundering vanished reconstruction credits?", "Why are several syndicates hunting the same datapad?"],
    travel: "Docking fees, transponder scans, and syndicate tolls begin before disembarkation.",
    tags: ["Hutt Space", "Crime", "Trade", "Slicers"],
    access: { tier: "open", label: "PUBLIC / HIGH RISK" },
  },
  {
    id: "felucia",
    name: "Felucia",
    region: "Outer Rim",
    era: "The living world remains a place of dangerous abundance, local Force traditions, and scars from old wars.",
    description: "Immense fungal forests and shifting ecosystems conceal medicines, predators, ruins, and communities that resist outside control.",
    districts: ["Jungle canopy", "Settled clearings", "Separatist ruins", "Deep fungal sea"],
    npcs: ["Local guides", "healers", "mercenaries", "Force tradition keepers"],
    mysteries: ["What is poisoning the oldest root networks?", "Which ruins predate the known Republic?"],
    travel: "Routes change with the living terrain; a local guide is more valuable than a star chart.",
    tags: ["Force", "Jungle", "Ruins", "Outer Rim"],
    access: { tier: "permit", label: "GUIDE REQUIRED", reason: "A licensed guide, verified local contact, or campaign-earned route clearance is required." },
  },
  {
    id: "byss",
    name: "Byss",
    region: "Deep Core",
    era: "Byss was destroyed in the post-Endor conflicts. In 150 ABY its former system is a quarantined debris field, not an intact destination.",
    description: "A lethal Deep Core ruin zone associated with Palpatine's hidden regime, unstable approaches, wreckage, and claims that no responsible authority verifies.",
    districts: ["Quarantined approach", "Debris field", "Destroyed orbital works", "Unverified signal source"],
    npcs: ["Imperial remnants", "archivists", "dark-side adepts", "covert operatives"],
    mysteries: ["Which records survived the old devastations?", "Is the current signal a person, a machine, or a lure?"],
    travel: "No civilian landing exists. Reaching the destroyed system requires military-grade navigation data, a capable vessel, and explicit campaign access.",
    tags: ["Deep Core", "Destroyed", "Dark Side", "Quarantine"],
    access: { tier: "story", label: "QUARANTINED RUIN", reason: "No public route exists. Coordinates, a suitable vessel, and explicit GM-earned access are required." },
  },
  {
    id: "dathomir",
    name: "Dathomir",
    region: "Outer Rim",
    era: "Its witches, Nightsister legacies, and fractured traditions remain influential beyond the planet.",
    description: "A harsh world of red soil, predatory life, ancient strongholds, and Force traditions outsiders rarely understand.",
    districts: ["Swamps", "Mountain fortresses", "Burial grounds", "Old clan territories"],
    npcs: ["Witch clans", "mercenaries", "pilgrims", "relic hunters"],
    mysteries: ["Which voices answer from the old burial grounds?", "Who is rebuilding a vanished stronghold?"],
    travel: "Visitors are noticed quickly; surviving the welcome is not the same as earning permission.",
    tags: ["Force", "Witches", "Ancient", "Danger"],
    access: { tier: "invitation", label: "CLAN PERMISSION", reason: "A witch-clan invitation, trusted guide, or earned campaign clearance is required." },
  },
  {
    id: "ossus",
    name: "Ossus",
    region: "Outer Rim",
    era: "The Jedi homeworld's ruins remain a contested archive of knowledge, memory, and political symbolism.",
    description: "A damaged scholarly world where surviving libraries, temples, and ecological recovery attract seekers from every tradition.",
    districts: ["Jedi ruins", "Library vaults", "Restoration settlements", "Canyon archives"],
    npcs: ["Jedi scholars", "independent archaeologists", "pilgrims", "archive guardians"],
    mysteries: ["Which records were removed before the last purge?", "What is the Force preserving beneath the ruins?"],
    travel: "Access depends on trust, purpose, and whether the visitor appears to be a relic thief.",
    tags: ["Jedi", "Archives", "Force", "Ruins"],
    access: { tier: "permit", label: "ARCHIVE CLEARANCE", reason: "Restoration authorities or a trusted Jedi contact must authorize access beyond the public corridor." },
  },
  {
    id: "korriban",
    name: "Korriban",
    region: "Outer Rim",
    era: "The ancient Sith world remains a contested archaeological site under layers of surveillance, myth, and deliberate misinformation.",
    description: "Red deserts, tomb complexes, and forbidden excavation zones draw scholars, relic hunters, Sith claimants, and those who should know better.",
    districts: ["Valley of the Dark Lords", "Dreshdae ruins", "Imperial dig sites", "Orbital customs"],
    npcs: ["Sith antiquarians", "relic brokers", "Imperial archaeologists", "pilgrims"],
    mysteries: ["Which tomb has been opened without a recorded expedition?", "Who is moving holocron fragments through customs?"],
    travel: "A declared scholarly purpose or a credible patron is safer than an unregistered excavation team.",
    tags: ["Sith", "Tombs", "Relics", "Outer Rim"],
    travelCost: 1700,
    access: { tier: "story", label: "FORBIDDEN SITH ROUTE", reason: "Credits are not access. Korriban requires verified coordinates, a credible patron or expedition, a capable vessel, and explicit GM-earned clearance." },
    requiredLevel: 5,
  },
  {
    id: "naboo",
    name: "Naboo",
    region: "Mid Rim",
    era: "A cultured world of elected traditions, old royal houses, and careful neutrality amid renewed galactic pressure.",
    description: "Lake country, ancient ruins, and Theed's diplomatic circles conceal as many negotiations as the HoloNet ever reports.",
    districts: ["Theed", "Lake Country", "Gungan sacred places", "Swamps of Naboo"],
    npcs: ["Royal advisers", "senatorial envoys", "Gungan leaders", "independent traders"],
    mysteries: ["Which old trade compact is being quietly renegotiated?", "Why are sealed droid-war archives being requested?"],
    travel: "Visitors with business, introductions, or a legitimate trade manifest receive less scrutiny.",
    tags: ["Diplomacy", "Royal Houses", "Mid Rim", "Trade"],
    access: { tier: "open", label: "PUBLIC ROUTE" },
  },
  {
    id: "corellia",
    name: "Corellia",
    region: "Core Worlds",
    era: "Shipyards, hard-edged independence, and reconstruction politics make Corellia indispensable and difficult to govern.",
    description: "A starship-building powerhouse where yards, syndicates, freighter crews, and political factions compete for influence.",
    districts: ["Coronet City", "Corellian Engineering yards", "Tyrena", "Smuggler's Run approaches"],
    npcs: ["Shipwrights", "freighter captains", "corporate agents", "Corellian officials"],
    mysteries: ["Who is buying decommissioned warship components?", "Which shipyard ledger has vanished?"],
    travel: "Port fees and transponder checks are routine; forged credentials attract immediate attention.",
    tags: ["Shipyards", "Core", "Freighters", "Politics"],
    travelCost: 700,
    access: { tier: "open", label: "PUBLIC ROUTE" },
  },
  {
    id: "commenor",
    name: "Commenor",
    region: "Core Worlds",
    era: "A prosperous trade world balancing commerce, sovereignty, and the security demands of the post-war galaxy.",
    description: "Orbital commerce, diplomatic estates, and merchant houses make Commenor a quieter but influential crossroads.",
    districts: ["Hanna City", "Orbital trade ring", "Merchant estates", "Port districts"],
    npcs: ["Merchant houses", "diplomats", "customs officers", "corporate mediators"],
    mysteries: ["Who is buying reconstruction bonds through shell houses?", "Why are neutral couriers disappearing?"],
    travel: "A clean transponder and sufficient landing funds usually open the port; political baggage does not.",
    tags: ["Trade", "Diplomacy", "Core", "Banking"],
    access: { tier: "open", label: "PUBLIC ROUTE" },
  },
  {
    id: "bimmisaari",
    name: "Bimmisaari",
    region: "Mid Rim",
    era: "A known refuge for diplomacy and healing, still carrying the scars of earlier conflicts and displaced populations.",
    description: "A calm world of medical enclaves, refugee networks, and negotiations conducted away from the great powers.",
    districts: ["Haven districts", "Medical enclaves", "Refugee corridors", "Orbital sanctuary"],
    npcs: ["Healers", "refugee advocates", "neutral diplomats", "relief pilots"],
    mysteries: ["Who is diverting medical shipments?", "Which displaced community has found an old military cache?"],
    travel: "Humanitarian purpose helps; weapons, bounties, and active syndicate warrants do not.",
    tags: ["Neutral", "Medical", "Refugees", "Mid Rim"],
    access: { tier: "open", label: "PUBLIC ROUTE" },
  },
  {
    id: "nar-kanji",
    name: "Nar Kanji",
    region: "Hutt Space",
    era: "The Hutt-controlled world remains a major commercial node where corporate law and kajidic power overlap.",
    description: "A world of industrial contracts, private security, and Hutt-aligned commerce where every berth has an owner.",
    districts: ["Nar Kanji City", "Industrial belts", "Hutt compounds", "Freight orbital"],
    npcs: ["Kajidic factors", "industrial magnates", "bounty guild brokers", "port authorities"],
    mysteries: ["Which cartel is hoarding hyperdrive components?", "Why are Imperial inspectors being denied access?"],
    travel: "Landing guarantees, docking fees, and a recognized sponsor are commonly required.",
    tags: ["Hutt Space", "Industry", "Commerce", "Crime"],
    travelCost: 1350,
    access: { tier: "invitation", label: "SPONSOR REQUIRED", reason: "A recognized sponsor, landing guarantee, or campaign-earned freight contract is required." },
  },
  {
    id: "ruusan",
    name: "Ruusan",
    region: "Mid Rim",
    era: "A world remembered for the ancient Sith wars and the modern political uses of that memory.",
    description: "Battlefield memorials, settlements, and old Force scars draw historians, pilgrims, and opportunists.",
    districts: ["Thought Bomb memorial", "Ruusan plains", "Archive settlements", "Old battle sites"],
    npcs: ["Historians", "Jedi observers", "pilgrims", "relic hunters"],
    mysteries: ["Who is altering battlefield records?", "What is being excavated beneath the memorial grounds?"],
    travel: "Memorial authorities tolerate visitors; unauthorized excavation brings swift legal attention.",
    tags: ["History", "Sith", "Jedi", "Mid Rim"],
    access: { tier: "permit", label: "MEMORIAL PERMIT", reason: "Public memorial access is possible, but travel beyond it requires an excavation, pilgrimage, or local permit." },
  },
  {
    id: "exegol",
    name: "Exegol",
    region: "Unknown Regions",
    era: "Its existence is denied by most authorities; credible coordinates are among the galaxy's most dangerous commodities.",
    description: "A storm-wrapped world of Sith Eternal remnants, hidden shipyards, and secrets that should not be treated as ordinary tourism.",
    districts: ["Storm approaches", "Sith Eternal ruins", "Buried vaults", "Restricted orbital space"],
    npcs: ["Sith Eternal remnants", "grave robbers", "cult defectors", "unknown sentinels"],
    mysteries: ["Who still maintains the hidden beacons?", "What is being sold under the name of an Executor shell?"],
    travel: "Requires credible coordinates, a capable vessel, and GM-earned access; ordinary credits alone are insufficient.",
    tags: ["Unknown Regions", "Sith", "Restricted", "Danger"],
    travelCost: 2600,
    requiredLevel: 5,
    access: { tier: "story", label: "UNKNOWN / NO PUBLIC ROUTE", reason: "Ordinary charts and credits cannot reach Exegol. Earned coordinates, a pathfinder or beacon, and a capable vessel are mandatory." },
  },
  {
    id: "nal-hutta",
    name: "Nal Hutta",
    region: "Hutt Space",
    era: "The Hutt homeworld remains a center of kajidic power, extortion, and commercial arbitration.",
    description: "Swamps, palace districts, and polluted spaceports host the Hutt Cartel's political and financial machinery.",
    districts: ["Bilbosa", "Kajidic palaces", "Industrial marshes", "Smuggler ports"],
    npcs: ["Hutt kajidic officials", "gambling syndicates", "bounty brokers", "indenture agents"],
    mysteries: ["Which kajidic is funding the new privateer fleets?", "Who is challenging an old debt ruling?"],
    travel: "A sponsor, bribe, or valuable cargo may be necessary to leave the port alive.",
    tags: ["Hutt Space", "Cartels", "Politics", "Crime"],
    travelCost: 1300,
    access: { tier: "invitation", label: "KAJIDIC SPONSOR", reason: "A kajidic sponsor, valuable cargo contract, or campaign-earned invitation is required." },
  },
];

const REGION_FARES = {
  "Core Worlds": 650,
  "Deep Core": 1100,
  "Colonies": 800,
  "Inner Rim": 950,
  "Mid Rim": 1150,
  "Outer Rim": 1450,
  "Hutt Space": 1250,
  "Unknown Regions": 2200,
};

export function getTravelCost(place, currentLocation = "") {
  if (!place) return Number.POSITIVE_INFINITY;
  const origin = String(currentLocation).trim().toLowerCase();
  const destination = place.name.toLowerCase();
  if (origin && (origin === destination || origin.startsWith(`${destination} —`) || origin.startsWith(`${destination},`) || origin.includes(`${destination} level`))) return 0;
  return place.travelCost || REGION_FARES[place.region] || 1500;
}

export function getTravelTime(place, currentLocation = "") {
  if (!place) return "Unknown";
  if (getTravelCost(place, currentLocation) === 0) return "Local transit";
  if (place.region === "Core Worlds" || place.region === "Deep Core") return "Several hours to one standard day";
  if (place.region === "Outer Rim" || place.region === "Hutt Space" || place.region === "Unknown Regions") return "One to several standard days";
  return "One to two standard days";
}

export function getTravelAccess(place, gameState = {}, character = null) {
  if (!place) return { allowed: false, known: false, reason: "Unknown destination." };
  const fare = getTravelCost(place, gameState.location);
  const level = Math.max(1, Number(character?.level) || 1);
  const earned = new Set((Array.isArray(gameState.travelAccess) ? gameState.travelAccess : []).map((id) => String(id).toLowerCase()));
  const policy = place.access || { tier: "open", label: "PUBLIC ROUTE" };
  const routeEarned = policy.tier === "open" || earned.has(place.id.toLowerCase());
  const levelReady = !place.requiredLevel || level >= place.requiredLevel;
  const affordable = Number(gameState.credits || 0) >= fare;
  const atDestination = fare === 0;
  const confined = /prison|detention|brig|cell block|custody/i.test(String(gameState.location || ""));
  const reasons = [];
  if (!routeEarned) reasons.push(policy.reason || "This route must be earned during play.");
  if (!levelReady) reasons.push(`Campaign level ${place.requiredLevel} or an explicit GM exception is required.`);
  if (!affordable) reasons.push(`Passage costs ${fare.toLocaleString()} credits; available balance is ${Number(gameState.credits || 0).toLocaleString()}.`);
  if (confined && !atDestination) reasons.push("Confinement must be resolved before departure, even on a public route.");
  return {
    allowed: atDestination || (routeEarned && levelReady && affordable && !confined),
    known: policy.tier !== "story" || routeEarned,
    routeEarned,
    levelReady,
    affordable,
    confined,
    fare,
    tier: policy.tier,
    label: policy.label,
    reason: reasons.join(" ") || (atDestination ? "You are already at this destination." : "Route, clearance, and fare are available."),
  };
}
