import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Handshake, ShieldAlert, Coins, Radio } from "lucide-react";
import { useGame } from "@/original/lib/GameContext";
import { Shell, TopBar, GlassCard } from "@/original/components/GalaxyUI";
import { SYNDICATES, getSyndicateEconomy } from "@/original/lib/syndicateCatalog";

export default function SyndicatesPage() {
  const { character, gameState, interactWithSyndicate, sending, saveReady, saveError } = useGame();
  const navigate = useNavigate();
  const [pending, setPending] = useState("");
  const [selected, setSelected] = useState(SYNDICATES[0]);
  const economy = useMemo(() => getSyndicateEconomy(selected, gameState), [selected, gameState]);
  const canApproach = Boolean(character) && gameState.credits >= selected.accessCost;
  const locked = sending || Boolean(pending) || !saveReady || Boolean(saveError);
  async function interact(action) {
    setPending(action);
    try { await interactWithSyndicate(selected, action); navigate("/player"); }
    finally { setPending(""); }
  }

  return <Shell>
    <TopBar character={character} gameState={gameState} />
    <main className="flex-1 min-h-0 m-3 gc-glass rounded-2xl p-5 overflow-y-auto">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <p className="text-[10px] tracking-[0.2em] text-[#ff7a1a]">UNDERWORLD INTELLIGENCE</p>
          <h1 className="gc-display text-3xl font-bold text-[#f2f0ea] mt-2">SYNDICATES & POWER BLOCS</h1>
          <p className="text-sm text-[#a9adb8] mt-2 max-w-3xl">A public-facing intelligence brief on criminal networks, chartered authorities, and contract alliances active across the galaxy in 150 ABY. Rumor is not proof; every approach creates obligations.</p>
        </div>
        <div className="text-right text-xs text-[#a9adb8]"><span className="text-[#5c6370]">LIQUID CREDITS</span><br /><strong className="text-[#22e5c5]">{gameState.credits.toLocaleString()} cr</strong></div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[270px_1fr]">
        <aside className="space-y-2">{SYNDICATES.map((syndicate) => <button key={syndicate.id} onClick={() => setSelected(syndicate)} className="w-full text-left rounded-xl p-3 border transition-colors" style={{ borderColor: selected.id === syndicate.id ? syndicate.color : "rgba(255,255,255,.08)", background: selected.id === syndicate.id ? "rgba(255,255,255,.06)" : "transparent" }}><span className="block text-sm font-semibold text-[#f2f0ea]">{syndicate.name}</span><span className="block text-[10px] tracking-widest text-[#8b93a3] mt-1">{syndicate.type.toUpperCase()}</span></button>)}</aside>
        <section>
          <GlassCard className="p-5" style={{ borderLeft: `3px solid ${selected.color}` }}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><p className="text-[10px] tracking-widest text-[#8b93a3]">{selected.type.toUpperCase()}</p><h2 className="gc-display text-2xl font-bold text-[#f2f0ea] mt-2">{selected.name}</h2><p className="text-sm leading-relaxed text-[#c7c4bc] mt-3 max-w-2xl">{selected.description}</p></div>
              <span className="flex items-center gap-1 text-xs text-[#ff8a8a]"><ShieldAlert size={14} /> {selected.risk} RISK</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mt-5">
              <Metric icon={Handshake} label="ACCESS" value={`${economy.access}/100`} />
              <Metric icon={ShieldAlert} label="HEAT" value={`${Math.round(economy.heat)}/100`} />
              <Metric icon={Coins} label="WEEKLY VOLUME" value={`${economy.weeklyVolume.toLocaleString()} cr`} />
              <Metric icon={Radio} label="POSITION" value={economy.netPosition.toUpperCase()} />
            </div>
            <div className="grid gap-4 md:grid-cols-2 mt-5">
              <Info label="TERRITORIES" values={selected.territories} />
              <Info label="SPECIALTIES" values={selected.specialties} />
            </div>
            <div className="grid gap-4 md:grid-cols-2 mt-5">
              <Info label="CAMPAIGN PATTERNS" values={selected.storyPatterns} />
              <Info label="INTERNAL PRESSURE" values={[selected.internalConflict]} />
            </div>
            <div className="mt-5">
              <p className="text-[9px] tracking-widest text-[#5c6370]">KNOWN OPERATIVES & POWER BROKERS</p>
              <div className="grid gap-3 md:grid-cols-2 mt-3">
                {selected.npcs.map((npc) => (
                  <div key={npc.name} className="rounded-xl p-4 bg-white/[.03] border border-white/10">
                    <div className="flex items-start justify-between gap-3">
                      <div><p className="text-sm font-semibold text-[#f2f0ea]">{npc.name}</p><p className="text-[10px] tracking-widest text-[#8b93a3] mt-1">{npc.species.toUpperCase()} · {npc.role.toUpperCase()}</p></div>
                    </div>
                    <p className="text-xs leading-relaxed text-[#c7c4bc] mt-3"><strong className="text-[#a9adb8]">Purpose:</strong> {npc.purpose}</p>
                    <p className="text-xs leading-relaxed text-[#a9adb8] mt-2"><strong className="text-[#8b93a3]">Method:</strong> {npc.method}</p>
                    <p className="text-xs leading-relaxed text-[#a9adb8] mt-2"><strong className="text-[#8b93a3]">Pressure point:</strong> {npc.vulnerability}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-5 p-4 rounded-xl bg-white/[.03] border border-white/10"><p className="text-[10px] tracking-widest text-[#8b93a3]">ECONOMIC POSITION</p><p className="text-sm text-[#c7c4bc] mt-2">Estimated weekly flow reflects route access, market pressure, notoriety, and current faction conditions. It is intelligence, not a guaranteed payout. The GM may alter terms, seize assets, create debt, or expose a false lead.</p></div>
            <div className="flex flex-wrap gap-2 mt-5"><button disabled={!canApproach || locked} onClick={() => interact("approach")} className="gc-btn px-4 py-2 text-xs disabled:opacity-30">{pending === "approach" ? "GM RESOLVING…" : `APPROACH NETWORK · ${selected.accessCost} CR`}</button><button disabled={!character || locked} onClick={() => interact("seek-contract")} className="px-4 py-2 rounded-xl text-xs text-[#a9adb8] border border-white/10 hover:border-white/30 disabled:opacity-30">{pending === "seek-contract" ? "GM RESOLVING…" : "REQUEST CONTRACT"}</button><button disabled={!character || locked} onClick={() => interact("request-intelligence")} className="px-4 py-2 rounded-xl text-xs text-[#a9adb8] border border-white/10 hover:border-white/30 disabled:opacity-30">{pending === "request-intelligence" ? "GM RESOLVING…" : "REQUEST INTELLIGENCE"}</button></div>
            {character && <p className="text-xs text-[#8b93a3] mt-3">The response appears in Play. Access and fees depend on your current situation.</p>}
            {!character && <p className="text-xs text-[#e23b3b] mt-3">A character dossier is required before any faction approach can be made.</p>}
          </GlassCard>
        </section>
      </div>
    </main>
  </Shell>;
}

function Metric({ icon: Icon, label, value }) {
  return <div className="rounded-xl p-3 bg-white/[.03]"><Icon size={15} className="text-[#ff7a1a]" /><p className="text-[9px] tracking-widest text-[#5c6370] mt-2">{label}</p><p className="text-sm text-[#f2f0ea] mt-1">{value}</p></div>;
}

function Info({ label, values }) {
  return <div><p className="text-[9px] tracking-widest text-[#5c6370]">{label}</p><p className="text-sm leading-relaxed text-[#a9adb8] mt-2">{values.join(" · ")}</p></div>;
}
