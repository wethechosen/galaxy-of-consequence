import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MessageCircle, Send, Radio } from "lucide-react";
import { useAuth } from "@/original/lib/AuthContext";
import { useGame } from "@/original/lib/GameContext";
import { Shell, TopBar, GlassCard } from "@/original/components/GalaxyUI";

export default function CommsPage() {
  const { user, registeredUsers } = useAuth();
  const { character, gameState, comms, sendCommsMessage } = useGame();
  const [params] = useSearchParams();
  const [channel, setChannel] = useState(params.get("channel") || "npc:local-contact");
  const [text, setText] = useState("");
  const channels = useMemo(() => [
    ...(gameState.contacts || []).map((contact) => ({ id: contact.channel, label: contact.name, kind: "NPC", detail: `${contact.role} · ${contact.location || "unknown location"}`, portrait: contact.portrait })),
    ...registeredUsers.filter((entry) => entry.email !== user?.email && entry.role !== "admin").map((entry) => ({ id: `player:${[user.email, entry.email].sort().join("|")}`, label: entry.email, kind: "PLAYER" })),
  ], [gameState.contacts, registeredUsers, user?.email]);
  const visible = comms.filter((entry) => entry.channel === channel);
  useEffect(() => { if (!channels.some((entry) => entry.id === channel)) setChannel(channels[0]?.id || ""); }, [channels, channel]);
  async function submit(event) { event.preventDefault(); if (!text.trim()) return; const value = text; setText(""); await sendCommsMessage(channel, value); }
  return <Shell>
    <TopBar character={character} gameState={gameState} />
    <main className="gc-page-row flex-1 min-h-0 m-3 gc-glass rounded-2xl flex flex-col md:flex-row gap-3 p-3 overflow-hidden">
      <aside className="gc-comms-rail w-full md:w-56 max-h-36 md:max-h-none shrink-0 gc-glass-tight rounded-2xl p-3 overflow-x-auto md:overflow-y-auto"><p className="text-[10px] tracking-[0.2em] text-[#ff7a1a] mb-3">COMLINKS</p>{channels.length === 0 && <p className="p-2 text-xs leading-relaxed text-[#8b93a3]">No player or NPC commlinks are established yet. The GM adds contacts when your character encounters and earns their trust.</p>}{channels.map((item) => <button key={item.id} onClick={() => setChannel(item.id)} className="w-full text-left px-3 py-2.5 rounded-xl mb-1 text-xs" style={{ background: channel === item.id ? "rgba(255,122,26,.18)" : "transparent", color: channel === item.id ? "#f2f0ea" : "#a9adb8" }}><span className="block text-[9px] tracking-widest text-[#5c6370]">{item.kind}</span>{item.label}<span className="block text-[9px] text-[#5c6370] mt-1">{item.detail || ""}</span></button>)}</aside>
      <section className="flex-1 min-w-0 flex flex-col">
        <div className="p-3 border-b border-white/10"><p className="text-[10px] tracking-[0.2em] text-[#ff7a1a]">ACTIVE CHANNEL</p><h1 className="text-lg font-semibold text-[#f2f0ea]">{channels.find((item) => item.id === channel)?.label || "No established comlink"}</h1></div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">{!channel && <GlassCard className="p-4 text-sm text-[#8b93a3]">The GM will add NPC and player channels as your character encounters people and forms associations.</GlassCard>}{channel && visible.length === 0 && <GlassCard className="p-4 text-sm text-[#8b93a3]">The channel is quiet. Send a transmission to begin.</GlassCard>}{visible.map((message) => <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : ""}`}><div className="max-w-2xl rounded-2xl px-4 py-3 text-sm" style={{ background: message.role === "user" ? "rgba(255,122,26,.16)" : "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)" }}><p className="text-[9px] tracking-widest text-[#8b93a3] mb-1">{message.author}</p>{message.content}</div></div>)}</div>
        {channel && <form onSubmit={submit} className="p-3 border-t border-white/10 flex gap-2"><input value={text} onChange={(event) => setText(event.target.value)} placeholder="Transmit on this comlink..." className="gc-input flex-1 px-3 py-2.5 text-sm text-[#f2f0ea]" /><button className="gc-btn px-4" type="submit"><Send size={15} /></button></form>}
      </section>
    </main>
  </Shell>;
}
