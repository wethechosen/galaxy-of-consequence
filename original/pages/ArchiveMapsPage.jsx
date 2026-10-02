import { useEffect, useState } from "react";
import { BookOpen, LockKeyhole, Map, Search } from "lucide-react";
import { Shell, TopBar, GlassCard } from "@/original/components/GalaxyUI";
import { useGame } from "@/original/lib/GameContext";
import { GALAXY_LOCATIONS, getTravelAccess } from "@/original/lib/galaxyLocations";
import { useAuth } from "@/original/lib/AuthContext";

export default function ArchiveMapsPage() {
  const { character, gameState } = useGame();
  const { user } = useAuth();
  const [maps, setMaps] = useState([]);
  const [selected, setSelected] = useState("galaxy-overview");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  function refreshMaps() { return fetch("/api/maps", { cache: "no-store" }).then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error || "Atlas unavailable."); setMaps(data.maps || []); if (data.maps?.length && !data.maps.some((entry) => entry.id === selected)) setSelected(data.maps[0].id); }); }
  useEffect(() => { refreshMaps().catch((reason) => setError(reason.message)); }, []); // eslint-disable-line
  async function importChart(file) {
    if (!file || !map) return;
    setImporting(true); setError("");
    try { const body = new FormData(); body.set("id", map.id); body.set("file", file); const response = await fetch("/api/maps", { method: "POST", body }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Chart import failed."); await refreshMaps(); }
    catch (reason) { setError(reason.message); }
    finally { setImporting(false); }
  }
  const map = maps.find((entry) => entry.id === selected);
  const destinations = GALAXY_LOCATIONS.filter((place) => `${place.name} ${place.region} ${place.tags.join(" ")}`.toLowerCase().includes(query.toLowerCase()));
  return <Shell><TopBar /><main className="gc-page-scroll flex-1 min-h-0 overflow-y-auto p-6 max-w-6xl mx-auto w-full">
    <p className="text-[10px] tracking-[0.25em] text-[var(--sig)]">ARCHIVE & NAVICOMPUTER // 155 ABY CAMPAIGN INDEX</p>
    <h1 className="gc-display text-3xl font-bold mt-2 text-[#f2f0ea]">GALACTIC ATLAS</h1>
    <p className="text-sm text-[#a9adb8] mt-2 max-w-3xl">Historical charts are reference material, not automatic character knowledge or a valid hyperspace route. The destination registry below is the campaign's reviewed 155 ABY travel layer.</p>
    <GlassCard className="p-5 mt-6">
      <div className="flex flex-wrap items-end gap-3"><label className="text-[10px] tracking-widest text-[#8b93a3]">CHART<select className="gc-input block px-3 py-2 mt-1 min-w-[260px]" value={selected} onChange={(event) => setSelected(event.target.value)}>{maps.map((entry) => <option key={entry.id} value={entry.id}>{entry.title}{entry.available ? "" : " — not imported"}</option>)}</select></label>{user?.role === "admin" && map && !map.available && <label className="gc-btn cursor-pointer px-3 py-2 text-[10px]">{importing ? "IMPORTING…" : "IMPORT SELECTED CHART"}<input className="sr-only" type="file" accept={map.file.endsWith(".png") ? "image/png" : "image/jpeg"} disabled={importing} onChange={(event) => importChart(event.target.files?.[0])}/></label>}<span className="text-xs text-[#8b93a3]">{map?.category} · {map?.note}</span></div>
      {error && <p role="alert" className="text-[#ff8a8a] mt-4">{error}</p>}
      {map?.available ? <div className="mt-4 max-h-[70vh] overflow-auto rounded-xl border border-white/10"><img src={`/api/maps?id=${encodeURIComponent(map.id)}`} alt={`${map.title}, historical galactic reference chart`} className="w-full h-auto" /></div> : map && <p className="text-sm text-[#8b93a3] mt-4">This chart has not been imported into the local atlas.{user?.role === "admin" ? ` Select the matching ${map.file} file above.` : " A GM must import the matching chart file."}</p>}
    </GlassCard>
    <section className="mt-8"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] tracking-widest text-[var(--sig)]">REVIEWED TRAVEL LAYER</p><h2 className="gc-display text-2xl font-bold text-[#f2f0ea] mt-1">DESTINATION REGISTRY</h2></div><label className="gc-input flex items-center gap-2 px-3 py-2"><Search size={15}/><input className="bg-transparent outline-none text-sm" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search worlds or regions" /></label></div>
      <div className="grid gap-3 md:grid-cols-2 mt-4">{destinations.map((place) => { const access = getTravelAccess(place, gameState, character); return <GlassCard key={place.id} className="p-4"><div className="flex justify-between gap-3"><div><h3 className="text-[#f2f0ea] font-semibold">{place.name}</h3><p className="text-[10px] tracking-widest text-[#ff7a1a]">{place.region.toUpperCase()}</p></div>{access.allowed ? <Map size={17} className="text-[#22e5c5]"/> : <LockKeyhole size={17} className="text-[#e56b6f]"/>}</div><p className="text-xs text-[#a9adb8] mt-3">{place.era}</p><p className="text-[10px] mt-3 text-[#8b93a3]">{access.label} · {access.allowed ? "route available" : access.reason}</p></GlassCard>; })}</div>
    </section>
    <GlassCard className="p-4 mt-8 flex gap-3"><BookOpen size={18} className="text-[var(--sig)] shrink-0"/><p className="text-xs text-[#8b93a3]">The private source library remains in the GM Console. Players can inspect public atlas material here without entering administrator controls.</p></GlassCard>
  </main></Shell>;
}
