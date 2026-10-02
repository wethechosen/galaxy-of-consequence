"use client";
import { CSSProperties, ReactNode, useEffect, useRef, useState } from "react";
import { Radio, Terminal, ShoppingBag, Box, House, Rocket, Wallet, Scale, UserRoundCog, BookOpen, Map, Save, Library, Shield, MessageSquare, Users, Globe, ListChecks, ScrollText, Heart, MapPin, X, LogOut, Menu, Gauge } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { CampaignState } from "@/lib/types";
import type { Account } from "@/lib/accounts";

export const navigation: { group: string; entries: [string, string, LucideIcon][] }[] = [
  { group: "PLAY", entries: [["Scene", "Play", Radio], ["HUD", "HUD", Terminal]] },
  { group: "MARKETPLACE", entries: [["Marketplace", "Marketplace", ShoppingBag]] },
  { group: "CHARACTER", entries: [["Assets", "Inventory", Box], ["Properties", "Properties", House], ["Hangar Bay", "Hangar Bay", Rocket]] },
  { group: "ECONOMY", entries: [["Economy", "Bank", Wallet]] },
  { group: "MORALITY", entries: [["Morality", "Morality", Scale]] },
  { group: "SYSTEM", entries: [["Profile", "User Controls", UserRoundCog]] },
  { group: "GALAXY & ARCHIVES", entries: [["Home", "HoloNet", Globe], ["Character", "Dossier", UserRoundCog], ["Journal", "Journal", ScrollText], ["Decisions", "Decisions", ListChecks], ["Contacts", "Contacts", Users], ["Comms", "Comms", MessageSquare], ["Exchanges", "Exchanges", Gauge], ["Syndicates", "Syndicates", Shield], ["Atlas", "Galaxy map", Map], ["Codex", "Codex", BookOpen], ["Saves", "Save archive", Save], ["Library", "Source library", Library]] },
];
export function sectionName(tab: string) { return navigation.flatMap(group => group.entries).find(item => item[0] === tab)?.[1] ?? tab; }
export default function GameShell({ campaign, user, tab, navigate, theme, status, onLogout, children }: { campaign: CampaignState; user: Account; tab: string; navigate: (tab: string) => void; theme: { accent: string; label: string }; status: string; onLogout: () => Promise<void>; children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const character = campaign.character;
  const name = character?.name ?? campaign.world?.draft?.name ?? "Character pending";
  const [logoutError, setLogoutError] = useState("");
  function go(target: string) { if (target === "HUD") dialog.current?.showModal(); else navigate(target); setMenuOpen(false); }
  useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, []);
  return <main className="datapad-shell game-ui" style={{ "--accent-rgb": theme.accent } as CSSProperties}>
    <header className="game-header glass">
      <button className="menu-toggle icon-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation" aria-expanded={menuOpen}><Menu size={22} /></button>
      <button className="wordmark" onClick={() => go("Home")}>GALAXY OF CONSEQUENCE</button>
      <span className="connection-label"><i />LIVE AI OFF</span><span className="alignment-chip" title={theme.label}>{character && campaign.rulesStatus === "verified" ? `DSS ${character.darkSideScore}` : "UNASSIGNED"}</span>
      <button className="character-link" onClick={() => go("Character")}>{name}</button>
      <div className="header-meter"><span>FORCE POINTS</span><strong>{character?.forcePoints ?? "—"}</strong></div>
      <button className="header-action" onClick={() => go("HUD")}><Gauge size={14} />HUD</button>
      {user.role === "admin" && <button className="header-action" onClick={() => go("GM Console")}><Shield size={14} />GM CONSOLE</button>}
    </header>
    <div className="game-body">
      <aside className={`game-nav glass ${menuOpen ? "is-open" : ""}`}><nav aria-label="Datapad sections">{navigation.map(group => <div className="nav-group" key={group.group}><p>{group.group}</p>{group.entries.map(([key, label, Icon]) => <button key={key} aria-current={tab === key ? "page" : undefined} onClick={() => go(key)}><Icon size={19} strokeWidth={1.7} /><span>{label}</span>{key === "Decisions" && !!campaign.world?.decisions.filter(d => d.status !== "resolved").length && <small>{campaign.world.decisions.filter(d => d.status !== "resolved").length}</small>}</button>)}</div>)}</nav>
      <div className="nav-account"><button onClick={() => go("Profile")}><UserRoundCog size={17}/><span>{user.displayName}<small>{user.role === "admin" ? "OWNER / GM" : "PLAYER"}</small></span></button><button className="icon-button" aria-label="Sign out" onClick={() => void onLogout().catch(e => setLogoutError(e.message))}><LogOut size={17} /></button></div>{logoutError && <p role="alert">{logoutError}</p>}</aside>
      <div className="game-content glass">
        {tab === "Scene" && <div className="vitals-strip"><span><Heart size={17} />{character ? `${character.hitPoints.current} / ${character.hitPoints.maximum} HP` : "HP unassigned"}</span><span><Wallet size={17}/>{character ? `${character.credits.toLocaleString()}cr` : "Credits unassigned"}</span><span><MapPin size={17}/>{campaign.currentLocation}</span><span className="era-chip">{campaign.era}</span></div>}
        {children}
        <div className="terminal-status" role="status" aria-live="polite"><span>{status}</span><span>PRIVATE LOCAL ARCHIVE</span></div>
      </div>
    </div>
    <dialog ref={dialog} className="hud-dialog glass" aria-labelledby="hud-title" onClick={event => { if (event.target === dialog.current) dialog.current.close(); }}>
      <div className="hud-heading"><span className="eyebrow">PERSONAL DATAPAD / STATUS</span><button className="icon-button" aria-label="Close HUD" onClick={() => dialog.current?.close()}><X size={20}/></button></div>
      <h2 id="hud-title">{name}</h2><p>{character ? `${character.species} · ${character.heroicClass} · Level ${character.level}` : "Biography and character creation pending"}</p>
      <div className="stat-grid">{[["HIT POINTS", character ? `${character.hitPoints.current}/${character.hitPoints.maximum}` : "—"], ["CREDITS", character?.credits ?? "—"], ["FORCE POINTS", character?.forcePoints ?? "—"], ["DARK SIDE SCORE", character?.darkSideScore ?? "—"]].map(([label, value]) => <div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div>
      <p><MapPin size={16}/>{campaign.currentLocation}</p><p className="muted">{theme.label}. Appearance does not change game statistics.</p>
      <button className="primary" onClick={() => { dialog.current?.close(); go("Character"); }}>OPEN DOSSIER</button>
    </dialog>
  </main>;
}
