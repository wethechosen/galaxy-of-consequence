import { useRef } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, Upload, UserRound } from "lucide-react";
import { useAuth } from "@/original/lib/AuthContext";
import { useGame } from "@/original/lib/GameContext";
import { Shell, TopBar, GlassCard } from "@/original/components/GalaxyUI";

export default function PlayersPage() {
  const { registeredUsers, onlineUsers, user } = useAuth();
  const { character, gameState, updateCharacterField } = useGame();
  const fileRef = useRef(null);
  function uploadHeadshot(event) {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => updateCharacterField("imageHeadshot", reader.result);
    reader.readAsDataURL(file);
  }
  return <Shell>
    <TopBar character={character} gameState={gameState} />
    <main className="flex-1 overflow-y-auto m-3 gc-glass rounded-2xl p-6">
      <p className="text-[10px] tracking-[0.2em] text-[#ff7a1a] mb-2">CREW & CONTACTS</p>
      <h1 className="gc-display text-3xl font-bold text-[#f2f0ea]">PLAYER ROSTER</h1>
      <p className="text-sm text-[#8b93a3] mt-2 mb-6">Local test-session roster. Presence expires automatically when a browser session stops reporting.</p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {registeredUsers.filter((entry) => entry.role !== "admin").map((entry) => {
          const stored = (() => { try { return JSON.parse(localStorage.getItem(`gc_character:${entry.email}`) || "null"); } catch { return null; } })();
          const isCurrent = entry.email === user?.email;
          return <GlassCard key={entry.email} className="p-5">
            <div className="flex items-start gap-3">
              {stored?.imageHeadshot ? <img src={stored.imageHeadshot} alt={`${stored.name || entry.email} headshot`} className="w-16 h-16 rounded-xl object-cover" /> : <div className="w-16 h-16 rounded-xl bg-white/5 flex items-center justify-center"><UserRound size={25} className="text-[#5c6370]" /></div>}
              <div className="min-w-0 flex-1"><p className="font-semibold text-[#f2f0ea] truncate">{stored?.name || entry.email}</p><p className="text-xs text-[#8b93a3]">{stored?.species || "Character creation in progress"}</p><p className="text-[10px] mt-2"><span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${onlineUsers.includes(entry.email) ? "bg-[#22e5c5]" : "bg-[#5c6370]"}`} />{onlineUsers.includes(entry.email) ? "ONLINE" : "OFFLINE"}</p></div>
            </div>
            <p className="text-xs text-[#a9adb8] mt-4 line-clamp-3">{stored?.background || "No public bio has been recorded yet."}</p>
            {!isCurrent && <Link to={`/comms?channel=player:${[user.email, entry.email].sort().join("|")}`} className="gc-btn mt-4 px-3 py-2 text-xs flex items-center gap-2 w-fit"><MessageCircle size={13} /> OPEN COMMS</Link>}
            {isCurrent && <button onClick={() => fileRef.current?.click()} className="mt-4 text-xs text-[#ff9b50] flex items-center gap-2"><Upload size={13} /> UPLOAD HEADSHOT</button>}
          </GlassCard>;
        })}
      </div>
      <input ref={fileRef} type="file" accept="image/*" onChange={uploadHeadshot} className="hidden" />
    </main>
  </Shell>;
}
