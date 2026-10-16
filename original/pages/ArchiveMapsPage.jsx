import { useEffect, useState } from "react";
import { BookOpen, Search } from "lucide-react";
import { Shell, TopBar, GlassCard } from "@/original/components/GalaxyUI";
import { useGame } from "@/original/lib/GameContext";
import { GALAXY_LOCATIONS } from "@/original/lib/galaxyLocations";
import { useAuth } from "@/original/lib/AuthContext";
import { useNavigate } from "react-router-dom";
import { TravelView } from "./PlayerPage";
import { RegistryMap } from "@/original/components/RegistryMap";
import { campaignTranscript } from "@/original/lib/campaignResume";
import { cleanPlayerMessage } from "@/original/lib/immersiveChat";

export default function ArchiveMapsPage() {
  const { character, gameState, messages } = useGame();
  const navigate = useNavigate();
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
    <p className="text-[10px] tracking-[0.25em] text-[var(--sig)]">ARCHIVE & NAVICOMPUTER // 150 ABY CAMPAIGN INDEX</p>
    <h1 className="gc-display text-3xl font-bold mt-2 text-[#f2f0ea]">ATLAS, TRAVEL & ARCHIVES</h1>
    <p className="text-sm text-[#a9adb8] mt-2 max-w-3xl">150 ABY homebrew continuity follows Legends-era history, with compatible canon imports. Historical facts and present campaign arrangements are distinct; old charts do not establish current borders or safe routes.</p>
    <RegistryMap currentLocation={gameState.location} onSelect={place => { setQuery(place.name); document.getElementById("travel-registry")?.scrollIntoView({ behavior: "smooth" }); }}/>
    <GlassCard className="p-5 mt-6">
      <div className="flex flex-wrap items-end gap-3"><label className="text-[10px] tracking-widest text-[#8b93a3]">CHART<select className="gc-input block px-3 py-2 mt-1 min-w-[260px]" value={selected} onChange={(event) => setSelected(event.target.value)}>{maps.map((entry) => <option key={entry.id} value={entry.id}>{entry.title}{entry.available ? "" : " — not imported"}</option>)}</select></label>{user?.role === "admin" && map && !map.available && <label className="gc-btn cursor-pointer px-3 py-2 text-[10px]">{importing ? "IMPORTING…" : "IMPORT SELECTED CHART"}<input className="sr-only" type="file" accept={map.file.endsWith(".png") ? "image/png" : "image/jpeg"} disabled={importing} onChange={(event) => importChart(event.target.files?.[0])}/></label>}<span className="text-xs text-[#8b93a3]">{map?.category} · {map?.note}</span></div>
      {error && <p role="alert" className="text-[#ff8a8a] mt-4">{error} <button type="button" className="underline" onClick={() => { setError(""); refreshMaps().catch(reason => setError(reason.message)); }}>Retry chart library</button></p>}
      {map?.available ? <div className="mt-4 max-h-[70vh] overflow-auto rounded-xl border border-white/10"><img src={`/api/maps?id=${encodeURIComponent(map.id)}`} alt={`${map.title}, historical galactic reference chart`} className="w-full h-auto" onError={() => setError("The imported chart image is unavailable. The system directory and travel registry remain available above and below.")} /></div> : map && <p className="text-sm text-[#8b93a3] mt-4">This optional historical chart is not installed on this server. The interactive system directory and destination dossiers are available independently.</p>}
    </GlassCard>
    <section id="travel-registry" className="mt-8"><label className="gc-input flex items-center gap-2 px-3 py-2"><Search size={15}/><input className="bg-transparent outline-none text-sm w-full" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search worlds or regions" /></label><TravelView places={destinations} setTab={() => navigate("/player")}/>{!destinations.length && <p className="p-4 text-[#a9adb8]">No reviewed registry match. This does not mean the world was destroyed; its identity and continuity need verification.</p>}</section>
    <section className="mt-8"><h2 className="gc-display text-xl text-[#f2f0ea]">CAMPAIGN ARCHIVE</h2><p className="text-xs text-[#8b93a3] mt-2">Latest recorded transmissions; older records remain in Play's archived transmissions.</p>{campaignTranscript(messages).confirmed.slice(-20).map((message, index) => <details key={message.turnId || index} className="mt-3 p-3 border border-white/10 rounded-xl"><summary className="cursor-pointer text-sm text-[#22e5c5]">{message.role === "user" ? "Your declaration" : message.role === "roll" ? "Recorded check" : "GM transmission"} · {message.turnId || `Record ${index + 1}`}</summary><pre className="mt-3 whitespace-pre-wrap font-sans text-xs text-[#a9adb8]">{cleanPlayerMessage(message.content)}</pre></details>)}</section>
    <GlassCard className="p-4 mt-8 flex gap-3"><BookOpen size={18} className="text-[var(--sig)] shrink-0"/><p className="text-xs text-[#8b93a3]">The private source library remains in the GM Console. Players can inspect public atlas material here without entering administrator controls.</p></GlassCard>
  </main></Shell>;
}
