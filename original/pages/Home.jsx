import { Link } from "react-router-dom";
import { Radio, Heart, Wallet, MapPin, Newspaper, Navigation, Shield, Globe2, Signal, Clock3 } from "lucide-react";
import { useGame } from "@/original/lib/GameContext";
import { useAuth } from "@/original/lib/AuthContext";
import { Shell, TopBar, GlassCard } from "@/original/components/GalaxyUI";
import { GALAXY_LOCATIONS } from "@/original/lib/galaxyLocations";

const NEWS_FEEDS = [
  {
    id: "holonet",
    name: "HoloNet News",
    subtitle: "GALACTIC SERVICE // SANCTIONED DISPATCH",
    icon: Signal,
    accent: "#4fd8e8",
    bias: "Official messaging, security notices, reconstruction bulletins, and carefully framed statements from recognized authorities.",
    headline: "SECURITY DIRECTORATES REAFFIRM ORDER THROUGHOUT THE CORE",
    copy: "Authorized correspondents report that stability measures remain in effect. Unverified claims of local unrest are being reviewed by the appropriate authorities.",
  },
  {
    id: "coruscant",
    name: "Coruscant News Network",
    subtitle: "CORUSCANT DESK // INNER-WORLD POLITICS",
    icon: Shield,
    accent: "#ff7a1a",
    bias: "Senate maneuvering, corporate influence, Coruscant security, and the politics of the capital's levels.",
    headline: "LOWER-LEVEL TRANSIT AUDIT RAISES QUESTIONS IN THE CAPITAL",
    copy: "A routine infrastructure review has drawn unusual attention from corporate committees and district representatives. Officials deny the audit is connected to recent detention-sector disturbances.",
  },
  {
    id: "galactic",
    name: "Galactic News Network",
    subtitle: "GNN // REGIONAL WIRE",
    icon: Globe2,
    accent: "#c48cff",
    bias: "Wide regional coverage, local witnesses, independent correspondents, and stories that official channels leave incomplete.",
    headline: "ROUTES, RELICS, AND RUMORS MOVE FASTER THAN THE AUTHORITIES",
    copy: "Reports from across the hyperlanes describe shifting syndicate traffic, contested archaeological sites, and a growing market for information no major network will yet confirm.",
  },
];

const GALACTIC_NEWS_EVENTS = [
  {
    id: "coruscant-transit",
    location: "Coruscant",
    headline: "LOWER-LEVEL TRANSIT RESTORATION ENTERS SECOND PHASE",
    facts: "The Fel Restoration Authority has awarded a new contract to reopen three abandoned maglev lines beneath the old industrial levels. Officials say the work will improve emergency response and freight movement.",
    angle: {
      holonet: "The Restoration Authority describes the project as a measured return of essential services.",
      coruscant: "Senators and district prefects are questioning the contract's security clauses and reconstruction costs.",
      galactic: "Residents report that survey crews arrived with armed escorts and sealed portions of the old lines before dawn.",
    },
  },
  {
    id: "coruscant-reserve",
    location: "Coruscant",
    headline: "IGFED RESERVE DESK HOLDS GALACTIC CREDIT GUIDANCE STEADY",
    facts: "The InterGalactic Federal Reserve has left its published reserve guidance unchanged while warning recognized banks about irregular settlement delays on several Outer Rim routes.",
    angle: {
      holonet: "IGFED officials call the delays temporary and contained.",
      coruscant: "Financial committees are requesting a hearing on reserve access and reconstruction lending.",
      galactic: "Independent freight houses say the delays are already raising insurance rates beyond the Core.",
    },
  },
  {
    id: "nar-shaddaa-freight",
    location: "Nar Shaddaa",
    headline: "HUTT FREIGHT LANES TIGHTEN AFTER THREE CONVOYS MISS ARRIVAL WINDOWS",
    facts: "Kajidic representatives have increased transponder inspections and docking fees after three contracted freighters failed to reach their scheduled berths.",
    angle: {
      holonet: "Authorities advise licensed carriers to observe revised routing and identification requirements.",
      coruscant: "Corporate insurers are reviewing whether the missed arrivals qualify as piracy, fraud, or contract breach.",
      galactic: "Dockworkers say the missing cargoes were ordinary reconstruction shipments, but no manifest has been released.",
    },
  },
  {
    id: "tatooine-water",
    location: "Tatooine",
    headline: "MOISTURE FARMERS REPORT A SHARP DROP IN DEEP-WELL YIELDS",
    facts: "Settlements near the Dune Sea are rationing water after several deep wells produced less than forecast. Local councils are seeking outside technicians and guarded replacement equipment.",
    angle: {
      holonet: "Officials caution against panic buying and say relief shipments are being negotiated.",
      coruscant: "Trade houses are watching the price of water rights and desert transport contracts.",
      galactic: "Free traders claim a private buyer is purchasing drilling equipment faster than relief crews can acquire it.",
    },
  },
  {
    id: "mandalore-forge",
    location: "Mandalore",
    headline: "CLAN DELEGATES REOPEN DISPUTE OVER BESKAR EXTRACTION RIGHTS",
    facts: "Delegates meeting near Sundari have postponed a decision on outside access to several damaged mining zones. The delay has affected armorers, prospectors, and reconstruction contractors.",
    angle: {
      holonet: "Imperial envoys urge a lawful settlement that protects Mandalorian sovereignty.",
      coruscant: "Industrial insurers warn that unresolved claims may interrupt contracted reconstruction shipments.",
      galactic: "Clan representatives accuse outside firms of treating ancestral territory as an unclaimed resource.",
    },
  },
  {
    id: "ossus-archive",
    location: "Ossus",
    headline: "RESTORATION SCHOLARS ANNOUNCE A NEWLY SECURED ARCHIVE VAULT",
    facts: "Researchers overseeing the Ossus restoration have sealed a damaged archive complex after recovering catalog fragments and intact environmental controls. The contents will not be identified until the site is stabilized.",
    angle: {
      holonet: "Officials emphasize that the vault remains under lawful custodianship and is not open to relic hunters.",
      coruscant: "Scholarly institutions are petitioning for supervised access and independent preservation review.",
      galactic: "Pilgrims and private collectors are already arriving despite warnings from the restoration council.",
    },
  },
];

function getWorldEvent(place, gameState) {
  const publicEvent = (gameState?.publicNews || [])
    .filter((event) => event.location && place.name.toLowerCase().includes(event.location.toLowerCase()))
    .slice(-1)[0];
  if (publicEvent) {
    return {
      id: publicEvent.id,
      location: publicEvent.location,
      headline: publicEvent.headline,
      facts: `${publicEvent.facts} Source: ${publicEvent.source}.`,
      angle: {
        holonet: "Officials have issued no further statement beyond the confirmed public record.",
        coruscant: "Political and security offices are disputing what the incident means for local authority.",
        galactic: "Independent correspondents are seeking witnesses and checking the official account.",
      },
    };
  }
  const matches = GALACTIC_NEWS_EVENTS.filter((event) => place.name.toLowerCase().includes(event.location.toLowerCase()));
  const pool = matches.length ? matches : GALACTIC_NEWS_EVENTS;
  const day = Math.floor(Date.now() / 86400000);
  return pool[day % pool.length];
}

function buildNewsFeeds(gameState) {
  const place = GALAXY_LOCATIONS.find((entry) => (gameState.location || "").toLowerCase().includes(entry.name.toLowerCase())) || {
    name: gameState.location || "Unregistered position",
    districts: [gameState.location || "Unknown coordinates"],
    npcs: ["local contacts"],
    mysteries: ["The local situation has not yet entered the campaign archive."],
  };
  const event = getWorldEvent(place, gameState);

  return NEWS_FEEDS.map((feed) => {
    return { ...feed, location: event.location, headline: event.headline, copy: `${event.facts} ${event.angle[feed.id]}` };
  });
}

export default function Home() {
  const { character, gameState } = useGame();
  const { user } = useAuth();
  const newsFeeds = buildNewsFeeds(gameState);

  return (
    <Shell>
      <TopBar character={character} gameState={gameState} />
      <main className="gc-page-scroll flex-1 min-h-0 overflow-y-auto p-6 max-w-3xl mx-auto w-full">
        <p className="text-[10px] tracking-[0.3em] mb-3" style={{ color: "var(--sig)" }}>HOLONET NEWS // CORUSCANT DESK // 150 ABY</p>
        <h1 className="gc-display text-3xl md:text-4xl font-bold mb-4 text-[#f2f0ea]">
          THE GALAXY IS MOVING.
        </h1>
        <p className="text-[#a9adb8] mb-8 max-w-xl leading-relaxed">
        Public transmissions, regional developments, market movement, and verified disturbances arrive here. The galaxy does not know everything—and neither does every news desk.
        </p>

        {user?.role === "admin" ? (
          <GlassCard className="p-5 mb-8 max-w-md">
            <p className="text-[10px] tracking-widest text-[#8b93a3] mb-3"><Newspaper size={13} className="inline mr-2" />GALACTIC DISPATCH</p>
            <p className="text-sm text-[#a9adb8]">The GM console controls campaign conditions while the HoloNet frontage keeps the operator aware of the current galaxy.</p>
          </GlassCard>
        ) : character ? (
          <GlassCard className="p-5 mb-8 max-w-md">
            <p className="text-[10px] tracking-widest text-[#8b93a3] mb-3"><Navigation size={13} className="inline mr-2" />CURRENT POSITION // {gameState.location}</p>
            <p className="text-lg font-semibold text-[#f2f0ea] mb-3">{character.name}</p>
            <div className="flex flex-wrap gap-4 text-xs text-[#a9adb8]">
              <span className="flex items-center gap-1.5"><Heart size={13} style={{ color: "var(--force-light)" }} /> {gameState.health} HP</span>
              <span className="flex items-center gap-1.5"><Wallet size={13} style={{ color: "var(--econ)" }} /> {gameState.credits.toLocaleString()}cr</span>
              <span className="flex items-center gap-1.5"><MapPin size={13} style={{ color: "var(--sig)" }} /> {gameState.location}</span>
            </div>
          </GlassCard>
        ) : (
          <GlassCard className="p-5 mb-8 max-w-md">
            <p className="text-sm text-[#a9adb8]">No character dossier is recorded yet. Open Play to begin character creation; your campaign record will resume here after that.</p>
          </GlassCard>
        )}

        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] tracking-[0.25em] text-[#ff7a1a]">CURRENT AFFAIRS // 150 ABY</p>
              <p className="text-xs text-[#8b93a3] mt-1">Three windows on the same galaxy. None of them sees the whole truth.</p>
            </div>
            <span className="text-[10px] tracking-widest text-[#5c6370]"><Clock3 size={12} className="inline mr-1" />LIVE TRANSMISSION</span>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {newsFeeds.map((feed) => {
              const Icon = feed.icon;
              return (
                <GlassCard key={feed.id} className="p-5" style={{ borderTop: `2px solid ${feed.accent}` }}>
                  <div className="flex items-center gap-2 mb-3" style={{ color: feed.accent }}>
                    <Icon size={17} />
                    <div><p className="text-sm font-semibold text-[#f2f0ea]">{feed.name}</p><p className="text-[8px] tracking-widest">{feed.subtitle}</p></div>
                  </div>
                  <p className="text-[10px] leading-relaxed text-[#8b93a3] mb-4">{feed.bias}</p>
                  <h2 className="text-sm font-semibold leading-snug text-[#f2f0ea]">{feed.headline}</h2>
                  <p className="text-xs leading-relaxed text-[#a9adb8] mt-3">{feed.copy}</p>
                  <p className="text-[10px] text-[#5c6370] mt-4 pt-3 border-t border-white/10">PUBLIC REPORT // {feed.location}</p>
                </GlassCard>
              );
            })}
          </div>
        </section>

        <div className="flex flex-wrap gap-3">
          {user?.role === "admin" && <Link to="/player" className="gc-btn px-5 py-3 text-sm flex items-center gap-2"><Radio size={16} /> TEST PLAY SELECTED CAMPAIGN</Link>}
          <Link to={user?.role === "admin" ? "/gm" : "/player"} className="gc-btn px-5 py-3 text-sm flex items-center gap-2">
            <Radio size={16} /> {user?.role === "admin" ? "OPEN GM CONSOLE" : (character ? "CONTINUE PLAYING" : "BEGIN CHARACTER CREATION")}
          </Link>
        </div>
      </main>
    </Shell>
  );
}
