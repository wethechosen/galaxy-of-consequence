import {useEffect,useMemo,useState} from "react";
import {useAuth} from "@/original/lib/AuthContext";
import {useGame} from "@/original/lib/GameContext";
import {Shell,TopBar,GlassCard} from "@/original/components/GalaxyUI";
import {Search,Landmark,Shield,Network,LockKeyhole,Globe2} from "lucide-react";
const TYPES=["all","federation","government","military","force-order","financial","covert","criminal","institution","corporation","independent"];
const LABELS={political:"POLITICAL",economic:"ECONOMIC",military:"MILITARY",intelligence:"INTELLIGENCE",logistics:"LOGISTICS"};
export default function FactionsPage(){
 const {user}=useAuth();
 const {character,gameState}=useGame();
 const [factions,setFactions]=useState([]);
 const [members,setMembers]=useState([]);
 const [hiddenLinks,setHiddenLinks]=useState([]);
 const [gm,setGm]=useState(false);
 const [error,setError]=useState("");
 const [query,setQuery]=useState("");
 const [kind,setKind]=useState("all");
 const [selectedId,setSelectedId]=useState("");
 useEffect(()=>{
   const controller=new AbortController();
   let live=true;
   const load=async()=>{
     try{
       const endpoint=user?.role==="admin"?"/api/factions/private":"/api/factions";
       const response=await fetch(endpoint,{signal:controller.signal,credentials:"same-origin"});
       if(!response.ok)throw Error("Faction registry service unavailable.");
       const data=await response.json();
       if(!live)return;
       setFactions(data.factions||[]);setMembers(data.members||[]);setHiddenLinks(data.hiddenLinks||[]);
       setGm(data.visibility==="gm-only");setError("");
     }catch(e){if(live&&!controller.signal.aborted)setError(e.message||"Registry currently unavailable.");}
   };
   load();
   return ()=>{live=false;controller.abort();};
 },[user?.role]);
 const factionById=useMemo(()=>new Map(factions.map(f=>[f.id,f])),[factions]);
 const selected=factionById.get(selectedId)||factions[0]||null;
 const filtered=useMemo(()=>factions.filter(f=>{
   if(kind!=="all"&&f.kind!==kind)return false;
   const words=[f.name,f.kind,f.headquarters,f.mandate,...(f.presence||[])].join(" ").toLowerCase();
   return words.includes(query.toLowerCase());
 }),[factions,query,kind]);
 const people=useMemo(()=>selected?members.filter(x=>x.factionId===selected.id):[],[members,selected]);
 const related=useMemo(()=>selected?hiddenLinks.filter(x=>x.factionId===selected.id):[],[hiddenLinks,selected]);
 return <Shell>
 <TopBar character={character} gameState={gameState}/>
 <main className="flex-1 min-h-0 m-3 gc-glass rounded-2xl p-5 overflow-y-auto">
 <div className="flex flex-wrap items-start justify-between gap-5">
 <div className="max-w-3xl">
 <p className="text-[10px] tracking-[.25em] text-[#ff9b50]">GALACTIC POWER STRUCTURES · 150 ABY</p>
 <h1 className="gc-display text-3xl text-[#f2f0ea] mt-2">FACTIONS & INSTITUTIONS</h1>
 <p className="mt-3 text-sm leading-relaxed text-[#a9adb8]">A political and economic atlas built from the same galaxy as the campaign. The Fel Empire, its Knights, the Alliance, Jedi, Hapes, the Corporate Sector and independent powers pursue distinct interests. Territory represents presence or influence, not automatic control of every inhabitant.</p>
 </div>
 <div className="flex gap-2 items-center text-xs text-[#bfc1c6]">
 <span className="rounded-lg px-3 py-2 border border-white/10">{factions.length} ORGANIZATIONS</span>
 <span className="rounded-lg px-3 py-2 border border-white/10 flex items-center gap-1">{gm?<LockKeyhole size={14}/>:<Globe2 size={14}/>} {gm?"GM PRIVATE":"PUBLIC ATLAS"}</span>
 </div></div>
 {error&&<p className="text-[#ff9b77] text-sm mt-5">{error}</p>}
 <div className="flex flex-wrap items-center gap-3 my-6">
 <label className="flex gap-2 items-center gc-input px-3 py-2 rounded-lg flex-1 min-w-[190px] max-w-xl"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} aria-label="Search galaxy factions" placeholder="Search institution, sector, objective..." className="bg-transparent outline-none w-full text-sm"/></label>
 <select className="gc-input px-3 py-2.5 rounded-lg text-sm" value={kind} aria-label="Filter faction kind" onChange={e=>setKind(e.target.value)}>{TYPES.filter(k=>k==="all"||factions.some(f=>f.kind===k)).map(k=><option key={k} value={k}>{k==="all"?"All powers":k.toUpperCase()}</option>)}</select>
 </div>
 <div className="grid grid-cols-1 lg:grid-cols-[265px_minmax(0,1fr)] gap-4">
 <aside className="max-h-[680px] overflow-auto space-y-2">
 {filtered.map(f=><button type="button" key={f.id} onClick={()=>setSelectedId(f.id)} aria-current={selected?.id===f.id?"true":undefined} className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${selected?.id===f.id?"bg-white/[.09] border-[#ff9b50]/60":"bg-white/[.02] border-white/10 hover:bg-white/[.06]"}`}>
 <span className="block text-sm font-semibold text-[#eceae6]">{f.name}</span>
 <span className="block text-[10px] tracking-widest uppercase text-[#8b93a3] mt-1">{f.kind}{f.parentId?" · branch":""}</span>
 </button>)}
 {!filtered.length&&<p className="text-xs text-[#8b93a3]">No matching factions.</p>}
 </aside>
 {selected&&<GlassCard className="p-5">
 <p className="text-[10px] tracking-[.2em] text-[#ff9b50]">{selected.kind.toUpperCase()} · {selected.headquarters}</p>
 <h2 className="gc-display text-2xl text-[#f2f0ea] mt-2">{selected.name}</h2>
 {selected.parentId&&<p className="text-xs text-[#8b93a3] mt-2">Institutional parent: {factionById.get(selected.parentId)?.name||selected.parentId}</p>}
 <p className="text-sm leading-relaxed text-[#d6d3cd] mt-4">{selected.mandate}</p>
 <div className="grid sm:grid-cols-2 gap-4 my-5">
 <section><h3 className="text-xs tracking-widest text-[#21dfc8]">HISTORICAL FOUNDATION</h3><p className="text-sm text-[#c4c2bc] mt-2">{selected.historicalFoundation}</p></section>
 <section><h3 className="text-xs tracking-widest text-[#21dfc8]">GOVERNANCE</h3><p className="text-sm text-[#c4c2bc] mt-2">{selected.government}</p></section>
 <section><h3 className="text-xs tracking-widest text-[#21dfc8]">ECONOMIC BASE</h3><p className="text-sm text-[#c4c2bc] mt-2">{selected.economicBase}</p></section>
 <section><h3 className="text-xs tracking-widest text-[#21dfc8]">AREAS OF PRESENCE</h3><p className="text-sm text-[#c4c2bc] mt-2">{(selected.presence||[]).join(" · ")}</p></section>
 </div>
 <div className="border-t border-white/10 pt-4">
 <h3 className="text-xs tracking-widest text-[#21dfc8] flex items-center gap-2"><Network size={14}/> DIVISIONS AND INSTITUTIONS</h3>
 <div className="mt-3 flex flex-wrap gap-2">{(selected.institutionalBranches||[]).map(x=><span key={x} className="text-xs rounded-lg border border-white/10 px-2.5 py-1.5 text-[#c6c3bc]">{x}</span>)}</div>
 </div>
 {!!selected.relations?.length&&<section className="border-t border-white/10 mt-5 pt-4">
 <h3 className="text-xs tracking-widest text-[#21dfc8]">DIPLOMATIC AND INSTITUTIONAL LINKS</h3>
 <div className="grid sm:grid-cols-2 gap-2 mt-3">{selected.relations.map(r=><div key={r.id} className="rounded-xl p-3 border border-white/10 bg-white/[.025]">
 <p className="text-sm font-medium text-[#e6e3db]">{factionById.get(r.id)?.name||r.id}</p>
 <p className="text-[10px] tracking-widest uppercase text-[#d9a875] mt-1">{r.stance}{r.secret?" · GM CONFIDENTIAL":""}</p>
 <p className="text-xs text-[#a9adb8] mt-2">{r.reason}</p>
 </div>)}</div></section>}
 {gm&&<section className="mt-5 border-t border-white/10 pt-4">
 <div className="flex items-center gap-2 text-[#ffaf82] text-xs tracking-widest"><LockKeyhole size={14}/> GM COMMAND INTELLIGENCE</div>
 <p className="mt-3 text-sm text-[#c9c5bd]">{selected.internalPressure}</p>
 <p className="mt-2 text-xs text-[#e1b393]">{selected.confidential}</p>
 <p className="mt-2 text-xs text-[#a9adb8]">Leadership: {selected.leaderRule}</p>
 <div className="mt-4 grid sm:grid-cols-5 gap-2">{Object.entries(LABELS).map(([key,label])=><div key={key} className="text-xs">
 <span className="block text-[#8b93a3] text-[9px]">{label}</span><span className="block text-[#d1c5af] mt-1">{selected.strengths?.[key]||0}/5</span>
 <div className="bg-white/10 h-1 mt-1 rounded-full overflow-hidden"><div className="bg-[#d4a36f] h-full" style={{width:`${(selected.strengths?.[key]||0)*20}%`}}/></div></div>)}</div>
 <p className="mt-2 text-[10px] text-[#828794]">Capability bands show GM planning capacity—not credits, fleet counts, or territorial ownership.</p>
 <h3 className="mt-5 text-xs tracking-widest text-[#21dfc8]">INDEPENDENT AGENDAS · UNRESOLVED</h3>
 <div className="space-y-2 mt-3">{(selected.objectives||[]).map(g=><div key={g.id} className="p-3 rounded-lg bg-white/[.025] border border-white/10">
 <p className="font-medium text-sm text-[#ece7de]">{g.intent}</p><p className="mt-1 text-xs text-[#a9adb8]">{g.arena} · {g.method} · {g.visibility} · requires {g.requiredCapacity}</p>
 <p className="mt-2 text-xs text-[#bdad94]">{g.stakes}</p></div>)}</div>
 <h3 className="mt-5 text-xs tracking-widest text-[#21dfc8]">NPC ASSOCIATIONS</h3>
 <div className="flex flex-wrap gap-2 mt-3">{people.map(p=><span key={p.personId} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-[#d5d1c7]">{p.name} · {p.standing}{p.visibility==="gm-only"?" · secret":""}</span>)}</div>
 {related.length>0&&<p className="text-xs text-[#e1b393] mt-3">Confidential cross-links: {related.map(x=>x.personId+" — "+x.knowledge).join("; ")}</p>}
 </section>}
 <p className="border-t border-white/10 pt-4 mt-5 text-xs text-[#8b93a3]">This is a faction reference, not a live victory report or authority to create purchases, battles, troop movements or appointments. Outcomes require GM adjudication and committed game state.</p>
 </GlassCard>}
 </div>
 </main></Shell>;
}
