import { Link, useNavigate } from "react-router-dom";
import { Radio, Heart, Wallet, MapPin, Newspaper, Navigation, Globe2, Signal, Clock3 } from "lucide-react";
import { useGame } from "@/original/lib/GameContext";
import { useAuth } from "@/original/lib/AuthContext";
import { Shell, TopBar, GlassCard } from "@/original/components/GalaxyUI";

import { buildNewsFeeds } from "@/original/lib/regionalNews";
export { getWorldEvent } from "@/original/lib/regionalNews";
export default function Home() {
  const { character, gameState, sendTurn, sending, saveReady, saveError } = useGame();
  const navigate = useNavigate();
  const { user } = useAuth();
  const newsFeeds = buildNewsFeeds(gameState);

  return (
    <Shell>
      <TopBar character={character} gameState={gameState} />
      <main className="gc-page-scroll flex-1 min-h-0 overflow-y-auto p-6 max-w-6xl mx-auto w-full">
        <p className="text-[10px] tracking-[0.3em] mb-3" style={{ color: "var(--sig)" }}>HOLONET NEWS // {gameState.location || "LOCATION UNESTABLISHED"} // 150 ABY</p>
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
          {character && <button type="button" className="gc-btn px-4 py-2 mb-4 text-xs disabled:opacity-40" disabled={sending || !saveReady || Boolean(saveError)} onClick={async () => { const resolved = await sendTurn(`I read the current publicly available HoloNet bulletins for ${gameState.location}, its surrounding region, and the galactic wire. Record any newly established public reports with their actual territory and attributed source.`); if (resolved) navigate("/player"); }}>{sending ? "READING TRANSMISSIONS…" : "READ LATEST PUBLIC BULLETINS"}</button>}
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] tracking-[0.25em] text-[#ff7a1a]">CURRENT AFFAIRS // 150 ABY</p>
              <p className="text-xs text-[#8b93a3] mt-1">Three windows on the same galaxy. None of them sees the whole truth.</p>
            </div>
            <span className="text-[10px] tracking-widest text-[#5c6370]"><Clock3 size={12} className="inline mr-1" />CAMPAIGN PUBLIC RECORD</span>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {newsFeeds.map((feed) => {
              const Icon = feed.id === "local" ? Signal : feed.id === "regional" ? Globe2 : Newspaper;
              return (
                <GlassCard key={feed.id} className="p-5" style={{ borderTop: `2px solid ${feed.accent}` }}>
                  <div className="flex items-center gap-2 mb-3" style={{ color: feed.accent }}>
                    <Icon size={17} />
                    <div><p className="text-sm font-semibold text-[#f2f0ea]">{feed.name}</p><p className="text-[8px] tracking-widest">{feed.subtitle}</p></div>
                  </div>
                  <p className="text-[10px] leading-relaxed text-[#8b93a3] mb-4">{feed.bias}</p>
                  <h2 className="text-sm font-semibold leading-snug text-[#f2f0ea]">{feed.headline}</h2>
                  <p className="text-xs leading-relaxed text-[#a9adb8] mt-3">{feed.copy}</p>
                  <p className="text-[10px] text-[#5c6370] mt-4 pt-3 border-t border-white/10">{feed.status} // {feed.location}{feed.publishedAt ? ` // ${new Date(feed.publishedAt).toLocaleString()}` : ""}</p>
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
