import { useState, useEffect, useRef } from "react";
import { Circle, Heart, LogOut, Shield, UserRound } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/original/lib/AuthContext";
import { useFlash } from "@/original/lib/GameContext";
import { useGame } from "@/original/lib/GameContext";
import { HudOverlay } from "@/original/components/HudOverlay";

export function Shell({ children }) {
  const { character, gameState, settings, toggleHud, saveReady, saveStatus } = useGame();
  const { user } = useAuth();
  const shellRef = useRef(null);
  useEffect(() => {
    function closeOnOutside(event) {
      if (settings.hudVisible && !event.target.closest("[data-gc-hud]") && !event.target.closest("[data-gc-hud-toggle]")) toggleHud();
    }
    document.addEventListener("pointerdown", closeOnOutside);
    return () => document.removeEventListener("pointerdown", closeOnOutside);
  }, [settings.hudVisible, toggleHud]);
  return (
    <div ref={shellRef} className="original-game w-full h-[100dvh] max-h-[100dvh] flex flex-col relative overflow-hidden" style={{ minHeight: 0, background: "#07060b", color: "#e7e5df", "--sig": !user ? "#ff7a1a" : gameState.forceAlignment < 35 ? "#ed5266" : gameState.forceAlignment > 65 ? "#4fd8e8" : "#ff7a1a", "--sig2": !user ? "#ff9b50" : gameState.forceAlignment < 35 ? "#b92550" : gameState.forceAlignment > 65 ? "#75f5d0" : "#ff9b50" }}>
      <div className="gc-blobs"><div className="gc-blob b1" /><div className="gc-blob b2" /><div className="gc-blob b3" /></div>
      <div className="gc-starfield" />
      <div className="relative z-10 flex flex-col flex-1 min-h-0">
        {user && <CampaignStatus />}
        {user && !saveReady && saveStatus === "loading" ? <DatapadBoot characterName={character?.name} /> : children}
      </div>
      {user && character && settings.hudVisible && <div data-gc-hud><HudOverlay character={character} gameState={gameState} onClose={toggleHud} /></div>}
    </div>
  );
}

function DatapadBoot({ characterName }) {
  return (
    <main className="flex flex-1 min-h-0 items-center justify-center px-6" aria-label="Restoring datapad record">
      <div className="gc-glass-tight w-full max-w-xl rounded-2xl border border-[#22d3ee]/25 px-7 py-8 text-center shadow-[0_0_50px_rgba(34,211,238,.08)]">
        <p className="mb-3 text-[10px] tracking-[0.28em] text-[#22d3ee]">SECURE DATAPAD LINK</p>
        <h1 className="gc-display text-xl font-bold tracking-wide text-[#f2f0ea]">RESTORING YOUR CAMPAIGN RECORD</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#a9adb8]">
          Reopening {characterName ? `${characterName}'s` : "your"} latest confirmed scene and synchronizing the local record.
        </p>
        <div className="mx-auto mt-6 h-1.5 max-w-sm overflow-hidden rounded-full bg-white/[.07]">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-[#22d3ee] to-[#a78bfa]" />
        </div>
        <p className="mt-4 text-[10px] tracking-[0.15em] text-[#737988]">IDENTITY VERIFIED · RECORD LINK IN PROGRESS</p>
      </div>
    </main>
  );
}

function CampaignStatus() {
  const { user, registeredUsers } = useAuth();
  const { saveReady, saveStatus, saveError, retrySave, loadSavedVersion, exportGame, selectedAccountId, selectAccount, sending } = useGame();
  return <div className="mx-3 mt-3 rounded-xl border border-white/10 px-4 py-2 flex flex-wrap items-center gap-3 text-xs" role="status" aria-live="polite">
    {user?.role === "admin" && <label className="flex items-center gap-2 text-[#a9adb8]">CAMPAIGN ACCOUNT<select aria-label="Campaign account" disabled={!saveReady || sending || saveStatus === "error"} value={selectedAccountId} onChange={event => selectAccount(event.target.value)} className="gc-input max-w-[260px] px-2 py-1 text-xs text-[#f2f0ea]">{registeredUsers.map(account => <option key={account.id} value={account.id}>{account.email}{account.id === user.id ? " (operator test)" : ""}</option>)}</select></label>}
    <span className={saveStatus === "error" ? "text-[#ff8a8a]" : "text-[#8b93a3]"}>{saveStatus === "saved" ? "DATAPAD RECORD SECURE" : saveStatus === "saving" ? "SYNCHRONIZING DATAPAD…" : saveStatus === "error" ? "DATAPAD LINK INTERRUPTED" : "RESTORING CAMPAIGN RECORD…"}</span>
    {saveStatus === "error" && <><span className="sr-only">{saveError}</span><button type="button" onClick={retrySave} className="gc-btn px-3 py-1">REESTABLISH LINK</button><button type="button" onClick={exportGame} className="underline">BACK UP CURRENT RECORD</button><button type="button" onClick={() => { if (window.confirm("Restore the last secure datapad record? Changes that have not synchronized will be replaced. Back up the current record first if you need it.")) loadSavedVersion(); }} className="underline">RESTORE LAST SECURE RECORD</button></>}
  </div>;
}

export function Gauge({ label, value, color }) {
  const flash = useFlash(value);
  const segments = 10;
  const filled = Math.round((value / 100) * segments);
  return (
    <span className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${flash ? "gc-flash" : ""}`}>
      <span>{label}</span>
      <span className="flex gap-[2px]">
        {Array.from({ length: segments }).map((_, i) => (
          <span key={i} style={{ width: 5, height: 10, borderRadius: 2, background: i < filled ? color : "rgba(255,255,255,.08)", boxShadow: i < filled ? `0 0 6px ${color}` : "none", transform: "skewX(-12deg)" }} />
        ))}
      </span>
    </span>
  );
}

export function TopBar({ character, gameState, right }) {
  const campaign = useGame();
  character = character ?? campaign.character;
  gameState = gameState ?? campaign.gameState;
  const meter = gameState.forceAlignment;
  const { user, logout, isPlayerOnline } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <div className="m-3 mb-0 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 gc-glass rounded-2xl">
      <div className="flex items-baseline gap-3">
        <span className="gc-display gc-title-flicker font-bold tracking-[0.06em] text-lg" style={{ background: "linear-gradient(90deg, var(--sig), var(--sig2))", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
          GALAXY OF CONSEQUENCE
        </span>
        <span className="flex items-center gap-1.5 text-[10px] tracking-[0.2em] text-[#8b93a3]">
          <Circle size={7} fill={user?.role === "admin" ? (isPlayerOnline ? "#4fd8e8" : "#5c6370") : "#4fd8e8"} stroke="none" className="gc-pulse-dot" /> {user?.role === "admin" ? (isPlayerOnline ? "PLAYER LINK ACTIVE" : "GM CHANNEL STANDBY") : "COMLINK ONLINE"}
        </span>
      </div>
      <div className="flex flex-wrap min-w-0 items-center gap-3 max-w-full">
        <nav className="gc-primary-nav flex flex-wrap items-center gap-1.5 text-[11px] tracking-wide" aria-label="Primary navigation">
          <Link to="/" className={`px-2.5 py-1.5 rounded-lg ${location.pathname === "/" ? "bg-white/10 text-[#f2f0ea]" : "text-[#8b93a3] hover:text-[#f2f0ea]"}`}>HOME</Link>
          <Link to="/player" className={`px-2.5 py-1.5 rounded-lg ${location.pathname === "/player" ? "bg-white/10 text-[#f2f0ea]" : "text-[#8b93a3] hover:text-[#f2f0ea]"}`}>{user?.role === "admin" ? "TEST PLAY" : "PLAY"}</Link>
          <Link to="/character" className={`px-2.5 py-1.5 rounded-lg ${location.pathname === "/character" ? "bg-white/10 text-[#f2f0ea]" : "text-[#8b93a3] hover:text-[#f2f0ea]"}`}>DOSSIER</Link>
          <Link data-gc-hud-toggle to="/hud" className={`px-2.5 py-1.5 rounded-lg ${location.pathname === "/hud" ? "bg-white/10 text-[#f2f0ea]" : "text-[#8b93a3] hover:text-[#f2f0ea]"}`}>HUD</Link>
          {user?.role !== "admin" && <Link to="/players" className={`px-2.5 py-1.5 rounded-lg ${location.pathname === "/players" ? "bg-white/10 text-[#f2f0ea]" : "text-[#8b93a3] hover:text-[#f2f0ea]"}`}>PLAYERS</Link>}
          {user?.role !== "admin" && <Link to="/comms" className={`px-2.5 py-1.5 rounded-lg ${location.pathname === "/comms" ? "bg-white/10 text-[#f2f0ea]" : "text-[#8b93a3] hover:text-[#f2f0ea]"}`}>COMMS</Link>}
          <Link to="/exchanges" className={`px-2.5 py-1.5 rounded-lg ${location.pathname === "/exchanges" ? "bg-white/10 text-[#f2f0ea]" : "text-[#8b93a3] hover:text-[#f2f0ea]"}`}>EXCHANGES</Link>
          <Link to="/syndicates" className={`px-2.5 py-1.5 rounded-lg ${location.pathname === "/syndicates" ? "bg-white/10 text-[#f2f0ea]" : "text-[#8b93a3] hover:text-[#f2f0ea]"}`}>SYNDICATES</Link>
          <Link to="/profile" className={`px-2.5 py-1.5 rounded-lg ${location.pathname === "/profile" ? "bg-white/10 text-[#f2f0ea]" : "text-[#8b93a3] hover:text-[#f2f0ea]"}`}>PROFILE</Link>
          <Link to="/archive" className={`px-2.5 py-1.5 rounded-lg ${location.pathname === "/archive" ? "bg-white/10 text-[#f2f0ea]" : "text-[#8b93a3] hover:text-[#f2f0ea]"}`}>ARCHIVE & MAPS</Link>
          {user?.role === "admin" && <>
            <Link to="/gm#overview" className="px-2.5 py-1.5 rounded-lg text-[#8b93a3] hover:text-[#f2f0ea]">CONSOLE</Link>
            <Link to="/gm#directive" className="px-2.5 py-1.5 rounded-lg text-[#8b93a3] hover:text-[#f2f0ea]">DIRECTIVE</Link>
            <Link to="/gm#sourcebooks" className="px-2.5 py-1.5 rounded-lg text-[#8b93a3] hover:text-[#f2f0ea]">SOURCES</Link>
            <Link to="/gm#world-state" className="px-2.5 py-1.5 rounded-lg text-[#8b93a3] hover:text-[#f2f0ea]">WORLD</Link>
            <Link to="/gm#progression" className="px-2.5 py-1.5 rounded-lg text-[#8b93a3] hover:text-[#f2f0ea]">PROGRESSION</Link>
            <Link to="/gm#flavor" className="px-2.5 py-1.5 rounded-lg flex items-center gap-1 text-[#8b93a3] hover:text-[#f2f0ea]"><Shield size={12} /> FLAVOR</Link>
            <Link to="/players" className="px-2.5 py-1.5 rounded-lg text-[#8b93a3] hover:text-[#f2f0ea]">PLAYERS</Link>
            <Link to="/comms" className="px-2.5 py-1.5 rounded-lg text-[#8b93a3] hover:text-[#f2f0ea]">COMMS</Link>
          </>}
          <span className="hidden sm:flex items-center gap-1 px-2 text-[#5c6370]" title={user?.email}><UserRound size={12} /> {user?.role === "admin" ? "ADMIN" : "PLAYER"}</span>
          <button disabled={campaign.sending || campaign.saveStatus === "saving"} onClick={async () => { if (campaign.saveStatus === "error" && !window.confirm("There are unsaved campaign changes. Log out anyway? Export the current draft first to keep a copy.")) return; await logout(); navigate("/login"); }} className="px-2 py-1.5 text-[#8b93a3] hover:text-[#f2f0ea] disabled:opacity-40" title="Log out" aria-label="Log out"><LogOut size={13} /></button>
        </nav>
        {character && (
          <div className="hidden xl:flex items-center gap-6 text-[11px] tracking-wide text-[#c7c4bc]">
            <span className="text-[#f2f0ea]">{character.name || "UNNAMED"}</span>
            <span className="flex items-center gap-1.5 text-[#a9adb8]" title="Light gameplay HUD"><Heart size={12} style={{ color: gameState.health > 30 ? "var(--force-light)" : "var(--force-dark)" }} /> {gameState.health} HP</span>
            <Gauge label="NOTORIETY" value={gameState.notoriety} color="var(--force-dark)" />
            <Gauge label="FORCE" value={meter} color={meter >= 50 ? "var(--force-light)" : "var(--force-dark)"} />
          </div>
        )}
        {right}
      </div>
    </div>
  );
}

export function EmptyNote({ text }) { return <div className="p-8 text-[#8b93a3] text-xs tracking-wide">{text}</div>; }
export function GlassCard({ children, className = "", style = {} }) { return <div className={`gc-glass-tight rounded-2xl ${className}`} style={style}>{children}</div>; }

export function HudRow({ label, value }) {
  return (
    <div className="flex justify-between py-2 text-sm" style={{ borderBottom: "1px solid rgba(255,255,255,.06)" }}>
      <span className="text-[#8b93a3] text-[10px] tracking-widest">{label.toUpperCase()}</span>
      <span className="text-[#f2f0ea] text-right">{value ?? "—"}</span>
    </div>
  );
}

export function MeterRow({ label, value, color }) {
  const flash = useFlash(value);
  return (
    <div className={`flex items-center gap-3 text-sm rounded-lg px-1 ${flash ? "gc-flash" : ""}`}>
      <span className="text-[#a9adb8] w-56 shrink-0 text-[10px] tracking-widest">{label.toUpperCase()}</span>
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.07)" }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${value}%`, backgroundColor: color, boxShadow: `0 0 8px ${color}` }} />
      </div>
      <span className="w-8 text-right text-[10px] text-[#f2f0ea]">{value}</span>
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, color }) {
  const flash = useFlash(value);
  return (
    <GlassCard className={`p-4 ${flash ? "gc-flash" : ""}`}>
      <div className="flex items-center gap-2 mb-1"><Icon size={14} style={{ color }} /><span className="text-[10px] tracking-widest text-[#8b93a3]">{label.toUpperCase()}</span></div>
      <p className="text-xl font-bold" style={{ color }}>{value}</p>
    </GlassCard>
  );
}

export function ItemAddForm({ fields, onSubmit, submitLabel = "ADD" }) {
  const initial = {}; fields.forEach((f) => (initial[f.key] = ""));
  const [form, setForm] = useState(initial);
  function submit() {
    if (!form[fields[0].key]?.trim()) return;
    onSubmit(form);
    setForm(initial);
  }
  return (
    <GlassCard className="p-4 mb-5 max-w-2xl">
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${fields.length}, 1fr)` }}>
        {fields.map((f) => (
          <input key={f.key} placeholder={f.placeholder} value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} className="gc-input px-3 py-2 text-sm text-[#f2f0ea]" />
        ))}
      </div>
      <button onClick={submit} className="gc-btn px-4 py-2 text-xs mt-3">{submitLabel}</button>
    </GlassCard>
  );
}
