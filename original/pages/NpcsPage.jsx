import { useEffect, useMemo, useState } from "react";
import { UsersRound, Search, ShieldCheck, Info } from "lucide-react";
import { useGame } from "@/original/lib/GameContext";
import { useAuth } from "@/original/lib/AuthContext";
import { Shell, TopBar, GlassCard } from "@/original/components/GalaxyUI";
export default function NpcsPage() {
  const { character, gameState } = useGame();
  const { user } = useAuth();
  const [roster, setRoster] = useState([]);
  const [query, setQuery] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/npcs", {signal:controller.signal}).then(r => {
      if (!r.ok) throw Error("NPC dossier service unavailable");
      return r.json();
    }).then(data => setRoster(data.roster || [])).catch(() => {});
    return () => controller.abort();
  }, []);
  const [group, setGroup] = useState("all");
  const [selected, setSelected] = useState(null);
  const shown = useMemo(() => roster.filter(item =>
    (group === "all" || item.category === group) &&
    [item.name,item.species,item.homeworld,item.designation].some(value => String(value || "").toLowerCase().includes(query.toLowerCase()))
  ), [query,group,roster]);

  return <Shell>
    <TopBar character={character} gameState={gameState} />
    <main className="flex-1 min-h-0 overflow-y-auto m-3 gc-glass rounded-2xl p-6">
      <p className="text-[10px] tracking-[0.2em] text-[#ff9b50] mb-2">GALACTIC PERSONNEL INDEX · 150 ABY</p>
      <h1 className="gc-display text-3xl font-bold text-[#f2f0ea]">NPC DOSSIERS</h1>
      <p className="mt-2 text-sm max-w-4xl text-[#a9adb8]">35 proposed GM-controlled characters: 10 independent test subjects and 25 adapted from campaign supplements. These are cast profiles, not completed playthroughs or registered player accounts.</p>
      <div className="flex flex-wrap gap-3 mt-5 mb-6">
        <span className="rounded-lg bg-white/[.035] px-3 py-2 text-xs border border-white/10 text-[#e8e7e2]">35 DOSSIERS</span>
        <span className="rounded-lg bg-white/[.035] px-3 py-2 text-xs border border-white/10 text-[#a9adb8]">0 FULL ENDINGS VERIFIED</span>
        <span className="rounded-lg bg-white/[.035] px-3 py-2 text-xs border border-white/10 text-[#a9adb8]">GM CONTROLLED</span>
      </div>
      <div className="flex flex-wrap gap-3 items-center mb-5">
        <label className="relative flex-1 min-w-[210px] max-w-xl"><Search size={15} className="absolute left-3 top-3 text-[#8b93a3]" /><input aria-label="Search NPC roster" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search name, species, world, affiliation..." className="gc-input w-full pl-9 pr-3 py-2.5 text-sm" /></label>
        <select aria-label="Filter NPC type" className="gc-input px-3 py-2.5 text-sm" value={group} onChange={event=>setGroup(event.target.value)}>
          <option value="all">All characters</option>
          <option value="test">Ten test characters</option>
          <option value="cast">Supplement cast</option>
        </select>
      </div>
      {selected && <GlassCard className="p-5 mb-5">
        <div className="flex justify-between items-start gap-4">
          <div><p className="text-[10px] tracking-[.2em] text-[#ff9b50]">DOSSIER · NOT A GAMEPLAY RECEIPT</p><h2 className="gc-display mt-2 text-xl text-[#f2f0ea]">{selected.name}</h2></div>
          <button className="gc-btn px-3 py-1.5 text-xs" onClick={()=>setSelected(null)}>CLOSE</button>
        </div>
        <div className="mt-3 text-xs text-[#8b93a3]">{selected.species} · {selected.homeworld} · {selected.era} ABY</div>
        <p className="mt-3 text-sm text-[#d2d0cc]">{selected.description}</p>
        <p className="mt-3 text-xs text-[#a9adb8]">Role: {selected.designation}. No ending, XP, talents or material gains are attested by a completed game campaign.</p>
      </GlassCard>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {shown.map(item => <button type="button" key={item.id} onClick={()=>setSelected(item)} className="text-left">
          <GlassCard className="h-full p-4">
            <div className="flex items-start gap-3"><UsersRound size={22} className="text-[#ff9b50] shrink-0" />
              <div className="min-w-0"><h3 className="font-semibold text-[#f2f0ea]">{item.name}</h3>
                <p className="mt-0.5 text-xs text-[#a9adb8]">{item.species} · {item.homeworld}</p>
                <p className="mt-2 text-xs text-[#d0cfc9]">{item.designation}</p>
              </div></div>
            <p className="mt-4 text-[10px] tracking-[.08em] text-[#8b93a3]">CAST PROFILE · PLAYTHROUGH PENDING</p>
          </GlassCard>
        </button>)}
      </div>
      {!shown.length && <p className="text-sm text-[#a9adb8]">No NPC matches that search.</p>}
      <p className="mt-6 text-xs text-[#737988]">The Players tab lists authenticated human-controlled accounts. NPC dossiers are kept separate from player campaigns. Hidden GM facts and combat builds are not exposed here.</p>
    </main>
  </Shell>;
}
