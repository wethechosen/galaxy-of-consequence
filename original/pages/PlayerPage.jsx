import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Radio, Terminal, Package, Home as HomeIcon, Rocket, Wallet, UserCog,
  Send, ChevronRight, Plus, Upload, Heart, MapPin, Skull, Download, Dice5, Sparkles,
} from "lucide-react";
import { useGame, useFlash, CREATION_STEPS, EMPTY_CHARACTER } from "@/original/lib/GameContext";
import { Shell, TopBar, GlassCard, EmptyNote, HudRow, MeterRow, StatCard } from "@/original/components/GalaxyUI";
import { InventoryView, PropertiesView, HangarView } from "@/original/components/CatalogViews";
import { HudOverlay } from "@/original/components/HudOverlay";
import { GALAXY_LOCATIONS, getTravelAccess, getTravelCost, getTravelTime } from "@/original/lib/galaxyLocations";
import { getEconomicSnapshot } from "@/original/lib/marketCatalog";
import { BankView } from "@/original/components/BankView";
import { MarketplaceView } from "@/original/components/MarketplaceView";
import { useAuth } from "@/original/lib/AuthContext";
import { cleanPlayerMessage, immersiveTurnError, parseImmersiveMessage } from "@/original/lib/immersiveChat";
import { currentPlayerOptions } from "@/original/lib/sceneDirections";
import { hitPointDisplay } from "@/original/lib/hitPoints";
import { buildCampaignRecap, campaignTranscript, sameCampaignLocation, shouldShowReturnRecap } from "@/original/lib/campaignResume";

const NAV_GROUPS = [
  { label: "Play", items: [{ key: "play", label: "Play", icon: Radio }] },
  { label: "Character", items: [{ key: "inventory", label: "Inventory", icon: Package }, { key: "properties", label: "Properties", icon: HomeIcon }, { key: "hangar", label: "Hangar Bay", icon: Rocket }] },
  { label: "Economy", items: [{ key: "economy", label: "Bank", icon: Wallet }, { key: "market", label: "Marketplace", icon: Wallet }, { key: "travel", label: "Travel", icon: MapPin }] },
  { label: "System", items: [{ key: "user", label: "User Controls", icon: UserCog }] },
];

function NavRail({ tab, setTab }) {
  const { user } = useAuth();
  return (
    <div className="gc-player-rail w-full md:w-48 shrink-0 py-4 px-2.5 flex md:flex-col gap-3 gc-glass rounded-2xl overflow-x-auto md:overflow-y-auto">
      {NAV_GROUPS.filter((group) => group.label !== "System" || user?.role === "admin").map((group) => (
        <div key={group.label}>
          <p className="text-[9px] tracking-[0.2em] text-[#5c6370] px-3.5 mb-1">{group.label.toUpperCase()}</p>
          <div className="flex flex-col gap-1">
            {group.items.map(({ key, label, icon: Icon }) => {
              const active = tab === key;
              return (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className="gc-player-rail-action flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] tracking-wide text-left rounded-xl transition-all"
                  style={{ color: active ? "#0a0d12" : "#a9adb8", background: active ? "linear-gradient(135deg, var(--sig), var(--sig2))" : "transparent", boxShadow: active ? "0 4px 18px rgba(255,122,26,.35)" : "none", fontWeight: active ? 700 : 500 }}
                >
                  <Icon size={15} />{label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- character creation ---------- */

function CreationWizard() {
  const { creationStep: step, setCreationStep: setStep, draftChar: draft, setDraftChar: setDraft, finishCreation, initializeDmir, importLegacyCharacter, legacyDmirAvailable, sending, saveReady, saveError } = useGame();
  const total = CREATION_STEPS.length;
  const current = CREATION_STEPS[step];
  const done = step >= total;
  const [val, setVal] = useState(draft[current?.key] || "");
  useEffect(() => { setVal(draft[current?.key] || ""); }, [step]); // eslint-disable-line

  function next() {
    if (!val.trim() || !saveReady || sending) return;
    setDraft({ ...draft, [current.key]: val.trim() });
    setStep(step + 1 >= total ? total : step + 1);
  }

  if (done) {
    return (
      <div className="p-8 max-w-xl">
        <p className="text-[10px] tracking-[0.2em] mb-3" style={{ color: "var(--sig)" }}>DOSSIER COMPLETE</p>
        <p className="text-[#f2f0ea] mb-6 leading-relaxed">Character profile logged. Ready to enter the galaxy.</p>
        <button onClick={finishCreation} disabled={sending || !saveReady || Boolean(saveError)} className="gc-btn px-5 py-2.5 text-sm flex items-center gap-2 disabled:opacity-40">{sending ? "OPENING SCENE…" : "BEGIN SESSION"} <ChevronRight size={15} /></button>
        <button onClick={() => setStep(total - 1)} className="mt-3 text-xs underline">BACK TO DOSSIER</button>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-xl">
      {step === 0 && <GlassCard className="p-4 mb-6"><p className="text-sm text-[#f2f0ea] mb-2">D'mir Holloran · Infirmary awakening</p><p className="text-xs text-[#a9adb8] mb-3">Begin with your established character, history, and prison-riot opening.</p><button onClick={initializeDmir} disabled={sending || !saveReady || Boolean(saveError)} className="gc-btn px-4 py-2 text-xs disabled:opacity-40">BEGIN D'MIR'S CAMPAIGN</button>{legacyDmirAvailable && <button onClick={importLegacyCharacter} disabled={sending || !saveReady || Boolean(saveError)} className="block mt-3 text-xs underline disabled:opacity-40">RESTORE EXISTING D'MIR SAVE</button>}</GlassCard>}
      <p className="text-[10px] tracking-[0.2em] text-[#8b93a3] mb-1">CHARACTER CREATION — {step + 1} / {total}</p>
      <h2 className="gc-display text-xl font-bold mb-1 text-[#f2f0ea] tracking-wide">{current.label.toUpperCase()}</h2>
      <p className="text-[#a9adb8] text-sm mb-4">{current.hint}</p>
      {current.options ? (
        <div className="flex gap-2 mb-6">
          {current.options.map((opt) => (
            <button key={opt} onClick={() => setVal(opt)} className="px-4 py-2 text-sm rounded-xl transition-all"
              style={val === opt ? { background: "linear-gradient(135deg, var(--sig), var(--sig2))", color: "#0a0d12", fontWeight: 700 } : { border: "1px solid rgba(255,255,255,.12)", color: "#a9adb8" }}>
              {opt}
            </button>
          ))}
        </div>
      ) : (
        <input autoFocus value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && next()}
          className="gc-input w-full px-3.5 py-2.5 text-sm text-[#f2f0ea] mb-6" placeholder="Type here..." />
      )}
      <div className="flex gap-3">{step > 0 && <button onClick={() => setStep(step - 1)} className="text-xs underline">BACK</button>}<button onClick={next} disabled={!val.trim() || sending || !saveReady || Boolean(saveError)} className="gc-btn px-5 py-2.5 text-sm flex items-center gap-2 disabled:opacity-40">{step + 1 === total ? "FINISH" : "NEXT"} <ChevronRight size={15} /></button></div>
      <div className="flex gap-1 mt-6">
        {CREATION_STEPS.map((_, i) => <span key={i} className="h-1 flex-1 rounded-full" style={{ background: i <= step ? "var(--sig)" : "rgba(255,255,255,.1)" }} />)}
      </div>
    </div>
  );
}

/* ---------- play ---------- */

function NarrativeText({ text }) {
  return <div className="space-y-3">{String(text).split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => <p key={index} className="whitespace-pre-wrap">{paragraph.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) => part.startsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part.startsWith("*") ? <em key={i}>{part.slice(1, -1)}</em> : part)}</p>)}</div>;
}

function AssistantTurn({ content, onChoose, current = false, gameState = {}, character = {}, rolls = [] }) {
  const turn = parseImmersiveMessage(content);
  if (!turn.structured) return <NarrativeText text={turn.text} />;
  const location = current ? gameState.location : turn.location;
  const diceText = rolls.length ? rolls.join("\n\n") : turn.dice;
  const options = current
    ? currentPlayerOptions({ options: turn.options, state: gameState, character, scene: turn.scene, result: turn.gameplay })
    : turn.options;
  return (
    <div className="space-y-4 whitespace-normal">
      {location && <section><p className="text-[10px] tracking-[0.2em] text-[#22d3ee] mb-1">LOCATION</p><p className="text-sm font-semibold text-[#f2f0ea]">{location}</p></section>}
      {turn.scene && <section><p className="text-[10px] tracking-[0.2em] text-[#22d3ee] mb-2">{current ? "HERE AND NOW" : "SCENE"}</p><NarrativeText text={turn.scene} /></section>}
      {turn.adjudication && <section className="rounded-xl border border-[#ff9b50]/20 bg-[#ff9b50]/[.035] px-3 py-3"><p className="text-[10px] tracking-[0.2em] text-[#ff9b50] mb-2">GM INPUT</p><NarrativeText text={/the player has not declared an action/i.test(turn.adjudication) ? "You have not acted yet. No time passes." : turn.adjudication} /></section>}
      {turn.gameplay && <section><p className="text-[10px] tracking-[0.2em] text-[#f472b6] mb-2">GAMEPLAY</p><NarrativeText text={turn.gameplay} /></section>}
      {diceText && <section className="rounded-xl border border-[#22d3ee]/25 bg-[#22d3ee]/[.04] px-3 py-3 font-mono text-xs"><p className="text-[10px] tracking-[0.2em] text-[#22d3ee] mb-2 flex items-center gap-2"><Dice5 size={14} /> SAGA CHECK</p><NarrativeText text={diceText} /></section>}
      {turn.consequences.length > 0 && <section><p className="text-[10px] tracking-[0.2em] text-[#8b93a3] mb-2">PERSONAL RECORD</p><div className="flex flex-wrap gap-2">{turn.consequences.map((item) => <span key={item} className="rounded-full border border-[#22e5c5]/25 bg-[#22e5c5]/5 px-2.5 py-1 text-[11px] text-[#a8f7e8]">{item}</span>)}</div></section>}
      {current && options.length > 0 && <section><p className="text-[10px] tracking-[0.2em] text-[#a78bfa] mb-2">SUGGESTED APPROACHES</p><div className="grid gap-2 sm:grid-cols-2">{options.map((option) => <button type="button" key={`${option.label}-${option.text}`} onClick={() => onChoose(option.text)} className="rounded-xl border border-white/10 bg-white/[.025] px-3 py-2 text-left text-xs text-[#d8d6d0] transition hover:border-[#a78bfa]/50 hover:bg-[#a78bfa]/10"><span className="mr-2 font-bold text-[#a78bfa]">{option.label}</span>{option.text}</button>)}</div><p className="mt-2 text-[10px] text-[#737988]">These are possible attempts, not promised outcomes. Declare any other action.</p></section>}
    </div>
  );
}

function LiveHudStrip({ gameState, character }) {
  const healthFlash = useFlash(gameState.health);
  const creditsFlash = useFlash(gameState.credits);
  const critFlash = useFlash(gameState.creditsCriminal);
  const locFlash = useFlash(gameState.location);
  const xpFlash = useFlash(character?.experience || 0);
  const carried = (gameState.inventory || []).reduce((sum, item) => sum + Number(item.qty || 0), 0);
  const inventoryFlash = useFlash(carried);
  const hitPoints = hitPointDisplay(character, gameState);
  const healthColor = hitPoints.percent === null || hitPoints.percent > 60 ? "#4fd8e8" : hitPoints.percent > 30 ? "#ff7a1a" : "#e23b3b";
  return (
    <div className="px-5 py-3 flex flex-wrap items-center gap-4 text-xs" style={{ borderBottom: "1px solid rgba(255,255,255,.08)" }}>
      <div className={`flex items-center gap-2 rounded-lg px-2 py-1 ${healthFlash ? "gc-flash" : ""}`}>
        <Heart size={13} style={{ color: healthColor }} />
        {hitPoints.percent !== null && <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.08)" }}>
          <div className="h-full" style={{ width: `${hitPoints.percent}%`, background: healthColor }} />
        </div>}
        <span className="text-[#e7e5df]">{hitPoints.label}</span>
      </div>
      <div className={`flex items-center gap-1.5 rounded-lg px-2 py-1 ${creditsFlash ? "gc-flash" : ""}`}>
        <Wallet size={13} style={{ color: "var(--econ)" }} />                <span className="text-[#e7e5df]">{gameState.credits.toLocaleString()} galactic credits</span>
      </div>
      <div className={`flex items-center gap-1.5 rounded-lg px-2 py-1 ${critFlash ? "gc-flash" : ""}`}>
        <Skull size={13} style={{ color: "var(--force-dark)" }} />        <span className="text-[#e7e5df]">{gameState.creditsCriminal.toLocaleString()} underworld credits</span>
      </div>
      <div className={`flex items-center gap-1.5 rounded-lg px-2 py-1 ${locFlash ? "gc-flash" : ""}`}>
        <MapPin size={13} style={{ color: "var(--sig)" }} /><span className="text-[#e7e5df]">{gameState.location}</span>
      </div>
      <div className={`flex items-center gap-1.5 rounded-lg px-2 py-1 ${xpFlash ? "gc-flash" : ""}`}>
        <Sparkles size={13} style={{ color: "#a855f7" }} /><span className="text-[#e7e5df]">Level {character?.level || 1} · {Number(character?.experience || 0).toLocaleString()} XP</span>
      </div>
      <div className={`flex items-center gap-1.5 rounded-lg px-2 py-1 ${inventoryFlash ? "gc-flash" : ""}`}>
        <Package size={13} style={{ color: "#22e5c5" }} /><span className="text-[#e7e5df]">{carried} carried</span>
      </div>
    </div>
  );
}

function CombatStatus({ combat }) {
  if (!combat || combat.status !== "active") return null;
  const opponent = (combat.combatants || []).find((entry) => entry.side === "opposition" && Number(entry.hp) > 0);
  const actions = combat.playerActions || {};
  return (
    <div className="flex-shrink-0 px-5 py-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs" style={{ background: "linear-gradient(90deg, rgba(226,59,59,.12), rgba(255,122,26,.05))", borderBottom: "1px solid rgba(226,59,59,.28)" }}>
      <span className="font-bold tracking-[0.16em] text-[#ff7373]">COMBAT · ROUND {combat.round}</span>
      <span className="text-[#e7e5df]">{combat.activeSide === "player" ? "YOUR TURN" : "OPPOSITION TURN"}</span>
      {opponent && <span className="text-[#a9adb8]">{opponent.name}: <strong className="text-[#f2f0ea]">{opponent.hp}/{opponent.maxHp} HP</strong> · CT {opponent.conditionTrack || 0}</span>}
      <span className="text-[#a9adb8]">ACTIONS: <strong className="text-[#f2f0ea]">Standard {actions.standard || 0} · Move {actions.move || 0} · Swift {actions.swift || 0}</strong></span>
      <span className="text-[#8b93a3]">Declare an action, movement, or “end turn.”</span>
    </div>
  );
}

function ReturnRecap({ recap, onContinue }) {
  return <section aria-label="The story thus far" className="max-w-4xl rounded-2xl border border-[#22d3ee]/25 bg-[#11131e]/80 p-5 sm:p-7 space-y-5">
    <header><p className="text-[10px] tracking-[0.24em] text-[#22d3ee]">THE STORY THUS FAR</p><h2 className="gc-display mt-2 text-lg text-[#f2f0ea]">{recap.name}</h2><p className="mt-2 text-xs text-[#8b93a3]">Your saved journey. Returning does not advance time or change the galaxy.</p></header>
    {recap.milestones.length > 0 && <section><h3 className="text-[10px] tracking-[0.18em] text-[#a78bfa] mb-2">CHAPTERS OF YOUR JOURNEY</h3><ul className="list-disc pl-5 space-y-2 text-sm text-[#c7c4bc]">{recap.milestones.map((entry, index) => <li key={index}>{entry}</li>)}</ul></section>}
    {recap.timeline.length > 0 && <section><h3 className="text-[10px] tracking-[0.18em] text-[#a78bfa] mb-2">RECENT EVENTS · IN ORDER</h3><ol className="list-decimal pl-5 space-y-2 text-sm text-[#c7c4bc]">{recap.timeline.map((event) => <li key={event.id}>{event.summary}</li>)}</ol></section>}
    <section><h3 className="text-[10px] tracking-[0.18em] text-[#22d3ee] mb-2">WHERE YOU LEFT OFF</h3><p className="font-semibold text-sm text-[#f2f0ea] mb-3">{recap.location}</p>{recap.scene ? <div className="text-sm leading-relaxed text-[#d8d6d0]"><NarrativeText text={recap.scene} /></div> : <p className="text-sm text-[#a9adb8]">This is your saved location. Your last recorded exchange is preserved below; it does not move you to an earlier setting.</p>}{!recap.sceneIsCurrent && recap.lastOutcome && <h3 className="mt-4 text-[10px] tracking-[0.18em] text-[#ff9b50]">LAST CONFIRMED EXCHANGE</h3>}{recap.lastOutcome && <div className="mt-3 border-l-2 border-[#ff9b50]/40 pl-3 text-sm text-[#c7c4bc]"><NarrativeText text={recap.lastOutcome} /></div>}</section>
    {recap.objectives.length > 0 && <section><h3 className="text-[10px] tracking-[0.18em] text-[#ff9b50] mb-2">OPEN THREADS</h3><ul className="list-disc pl-5 text-sm text-[#c7c4bc] space-y-1">{recap.objectives.map((entry) => <li key={entry}>{entry}</li>)}</ul><p className="mt-2 text-xs text-[#8b93a3]">These remain possibilities—not instructions. Choose your own course.</p></section>}
    <section><h3 className="text-[10px] tracking-[0.18em] text-[#22e5c5] mb-2">FROM THE HOLONET</h3>{recap.news.length ? recap.news.map((entry, index) => <article className="mb-3 text-sm" key={index}><p className="text-[#f2f0ea]">{entry.title}</p>{entry.source && <p className="text-[10px] text-[#8b93a3]">{entry.source}</p>}<p className="mt-1 text-[#c7c4bc]">{entry.detail}</p></article>) : <p className="text-xs text-[#8b93a3]">No new public dispatches are recorded in this save.</p>}</section>
    <button type="button" onClick={onContinue} className="gc-btn px-4 py-2.5 text-xs">RESUME LAST SAVED SCENE</button>
  </section>;
}

function PlayView() {
  const { messages, sending, input, setInput, handleSend, scrollRef, gameState, character, saveReady, saveError, turnError, retryTurn, sendTurn, resetForNewGame, selectedAccountId } = useGame();
  const transcript = useMemo(() => campaignTranscript(messages), [messages]);
  const recap = useMemo(() => buildCampaignRecap({ messages, gameState, character }), [messages, gameState, character]);
  const [showRecap, setShowRecap] = useState(true);
  const [historyCount, setHistoryCount] = useState(0);
  const [showArchive, setShowArchive] = useState(false);
  const followLatest = useRef(true);
  const wasSending = useRef(false);
  const previousScene = useRef(null);
  const restoreHistoryPosition = useRef(null);
  const latestScene = transcript.latest?.sourceIndex;
  const mainMessages = transcript.latestExchange;
  const earlierMessages = transcript.confirmed.filter((message) => !mainMessages.includes(message));
  const visibleMessages = [...earlierMessages.slice(Math.max(0, earlierMessages.length - historyCount)), ...mainMessages, ...transcript.pending];
  useEffect(() => {
    const visitKey = `gc_play_last_visit:${selectedAccountId || "player"}`;
    let previous;
    try { previous = localStorage.getItem(visitKey); } catch { previous = null; }
    setShowRecap(shouldShowReturnRecap(previous));
    setHistoryCount(0); setShowArchive(false); followLatest.current = true;
    const markVisit = () => { try { localStorage.setItem(visitKey, String(Date.now())); } catch { /* Private browsing can disable storage. */ } };
    const onVisibility = () => { if (document.visibilityState === "hidden") markVisit(); else { try { if (shouldShowReturnRecap(localStorage.getItem(visitKey))) setShowRecap(true); } catch { /* Recap stays available manually. */ } } };
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") markVisit(); }, 60_000);
    document.addEventListener("visibilitychange", onVisibility);
    markVisit();
    return () => { markVisit(); window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisibility); };
  }, [selectedAccountId]);
  const rollsForAssistant = (assistantIndex) => {
    const rolls = [];
    for (let index = assistantIndex - 1; index >= 0 && messages[index]?.role === "roll"; index -= 1) rolls.unshift(cleanPlayerMessage(messages[index].content));
    return rolls;
  };
  async function submitAction() {
    if (/^\/?new game$/i.test(input.trim())) {
      if (!character || !window.confirm(`Restart from the beginning with ${character.name || "this saved character"} at level 1? The current campaign timeline will be reset.`)) return;
      setInput("");
      await resetForNewGame("level-one");
      return;
    }
    setShowRecap(false); followLatest.current = true;
    handleSend();
  }
  useEffect(() => {
    const pane = scrollRef.current;
    // Sync polling must not drag a player away from the passage they are reading.
    if (pane && !showRecap && followLatest.current) {
      const newlyResolved = !sending && latestScene !== previousScene.current;
      const latestNode = newlyResolved ? pane.querySelector(`[data-message-index="${latestScene}"]`) : null;
      // Begin at the narration, not below it at the options. Long replies must
      // remain readable without a scroll back through the entire transcript.
      if (latestNode) pane.scrollTop += latestNode.getBoundingClientRect().top - pane.getBoundingClientRect().top - 12;
      else if (sending && !wasSending.current) pane.scrollTop = pane.scrollHeight;
    }
    previousScene.current = latestScene;
    wasSending.current = sending;
  }, [messages.length, latestScene, sending, showRecap, scrollRef]);
  useEffect(() => {
    const pane = scrollRef.current, previous = restoreHistoryPosition.current;
    if (pane && previous) pane.scrollTop = previous.top + pane.scrollHeight - previous.height;
    restoreHistoryPosition.current = null;
  }, [historyCount, scrollRef]);
  function loadEarlier() {
    const pane = scrollRef.current;
    if (pane) restoreHistoryPosition.current = { top: pane.scrollTop, height: pane.scrollHeight };
    followLatest.current = false;
    setHistoryCount((count) => count + 20);
  }
  function resume() {
    setShowRecap(false); setShowArchive(false); setHistoryCount(0); followLatest.current = false;
    window.requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; });
  }
  return (
    <div className="gc-play-view flex flex-col h-full min-h-0 min-w-0">
      <LiveHudStrip gameState={gameState} character={character} />
      <CombatStatus combat={gameState.combat} />
      <div className="shrink-0 flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-2 text-[11px] text-[#8b93a3]"><button type="button" onClick={() => { setShowRecap(!showRecap); if (scrollRef.current) scrollRef.current.scrollTop = 0; }} className="hover:text-[#22d3ee]">{showRecap ? "Return to scene" : "The story thus far"}</button>{!showRecap && earlierMessages.length > 0 && <button type="button" onClick={() => { followLatest.current = false; setHistoryCount(historyCount ? 0 : 20); }} className="hover:text-[#22d3ee]">{historyCount ? "Close earlier chapters" : "Earlier chapters"}</button>}{transcript.archived.length > 0 && <button type="button" onClick={() => { setShowArchive(!showArchive); setShowRecap(false); followLatest.current = false; }} className="ml-auto hover:text-[#a9adb8]">{showArchive ? "Close archived transmissions" : "Archived transmissions"}</button>}</div>
      <div ref={scrollRef} data-gc-play-transcript role="region" aria-label="Campaign story" tabIndex={0} onScroll={(event) => { const pane = event.currentTarget; followLatest.current = pane.scrollHeight - pane.scrollTop - pane.clientHeight < 100; }} className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-5 space-y-4">
        {showRecap && messages.length > 0 ? <ReturnRecap recap={recap} onContinue={resume} /> : <>
        {showArchive && <section className="max-w-4xl rounded-xl border border-white/10 p-4 text-xs text-[#8b93a3]"><h2 className="tracking-wider mb-2">ARCHIVED TRANSMISSIONS</h2><p>Interrupted or unreliable replies are kept here for reference, outside the playable story. Nothing has been deleted from your save.</p>{transcript.archived.filter((message) => message.role !== "roll").slice(-30).map((message) => <details className="mt-3 border-t border-white/5 pt-2" key={message.sourceIndex}><summary>{message.role === "user" ? "Unresolved declaration" : "Interrupted transmission"}</summary><p className="mt-2 whitespace-pre-wrap break-words">{cleanPlayerMessage(message.content) || "No readable transmission."}</p></details>)}{transcript.archived.length > 30 && <p className="mt-3">Showing the latest 30 archived entries. The complete record is preserved in your save export.</p>}</section>}
        {transcript.confirmed.length === 0 && !sending && <div className="text-sm text-[#a9adb8]"><p>{messages.length ? "Your campaign is preserved. Open your surroundings to pick up the thread." : "Your dossier is ready. Open the current scene to begin play."}</p><button onClick={() => sendTurn(null)} disabled={!saveReady || Boolean(saveError)} className="gc-btn mt-3 px-4 py-2 text-xs disabled:opacity-40">OPEN CURRENT SCENE</button></div>}
        {historyCount > 0 && earlierMessages.length > historyCount && <button type="button" onClick={loadEarlier} className="text-xs text-[#22d3ee]">Load earlier chapters</button>}
        {visibleMessages.map((m) => m.role === "roll" ? null : (
          <div key={m.sourceIndex} data-message-index={m.sourceIndex} className={`gc-msg-in ${m.role === "user" ? "flex justify-end" : ""}`}>
            <div className={`${m.role === "assistant" ? "max-w-4xl" : "max-w-2xl"} px-4 py-3 text-sm leading-relaxed rounded-2xl whitespace-pre-wrap break-words [overflow-wrap:anywhere]`}
              style={m.role === "user" ? { background: "linear-gradient(135deg, rgba(255,122,26,.18), rgba(255,61,110,.12))", border: "1px solid rgba(255,122,26,.25)", color: "#f2f0ea" } : m.role === "roll" ? { color: "#d9fbff", background: "linear-gradient(135deg, rgba(34,211,238,.12), rgba(168,85,247,.08))", border: "1px solid rgba(34,211,238,.3)", borderLeft: "3px solid #22d3ee", fontFamily: "monospace", fontSize: "12px" } : { color: "#e7e5df", background: "rgba(255,255,255,.03)", borderLeft: "3px solid var(--force-light)" }}>
              {m.role === "assistant" ? <><p className="mb-3 text-[10px] tracking-widest text-[#8b93a3]">{m.sourceIndex === latestScene && !recap.sceneIsCurrent ? "LAST CONFIRMED EXCHANGE · RECORDED HISTORY" : ""}</p><AssistantTurn content={m.content} onChoose={setInput} current={recap.sceneIsCurrent && m.sourceIndex === latestScene && sameCampaignLocation(parseImmersiveMessage(m.content).location, gameState.location)} gameState={gameState} character={character} rolls={rollsForAssistant(m.sourceIndex)} /></> : <>{cleanPlayerMessage(m.content)}{transcript.pending.includes(m) && !sending && <span className="mt-2 block text-[10px] text-[#a9adb8]">Awaiting a resolved scene.</span>}</>}
            </div>
          </div>
        ))}
        {!sending && messages.length > 0 && <button type="button" onClick={() => sendTurn(null)} disabled={!saveReady || Boolean(saveError) || Boolean(turnError)} className="text-xs text-[#8b93a3] hover:text-[#22d3ee] disabled:opacity-40">Take in the current scene · no time passes</button>}
        {sending && <div className="flex items-center gap-2 text-[#8b93a3] text-[11px] tracking-widest pl-4 gc-dot-bounce">THE GALAXY RESPONDS <span>.</span><span>.</span><span>.</span></div>}
        </>}
      </div>
      {turnError && <div role="alert" className="flex-shrink-0 mx-4 mb-3 rounded-xl border border-[#e23b3b]/40 bg-[#e23b3b]/5 p-3 text-xs text-[#ff9b9b]"><p className="mb-1 text-[10px] font-bold tracking-[0.18em]">COMLINK STATIC</p><p className="text-[#d8d6d0]">{immersiveTurnError(turnError)}</p><button onClick={retryTurn} disabled={sending || !saveReady || Boolean(saveError)} className="gc-btn mt-2 px-3 py-2 disabled:opacity-40">RETRY SCENE</button></div>}
      <div className="flex-shrink-0 p-4 flex gap-2" style={{ borderTop: "1px solid rgba(255,255,255,.08)" }}>
        <input aria-label="Your character's action" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && submitAction()} disabled={sending || !saveReady || Boolean(saveError)} placeholder="What do you do?" className="gc-input flex-1 min-w-0 px-3.5 py-2.5 text-sm text-[#f2f0ea]" />
        <button aria-label="Send action" onClick={submitAction} disabled={sending || !input.trim() || !saveReady || Boolean(saveError)} className="gc-btn px-4 py-2.5 disabled:opacity-40"><Send size={16} /></button>
      </div>
    </div>
  );
}

/* ---------- HUD ---------- */

function HudView() {
  const { character, gameState } = useGame();
  const [overlayOpen, setOverlayOpen] = useState(false);
  const rep = gameState.factionRep;
  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] tracking-[0.2em]" style={{ color: "var(--sig)" }}>PLAYER CHARACTER FILE</p>
        <button type="button" onClick={() => setOverlayOpen((open) => !open)} className="text-[10px] tracking-widest px-3 py-2 rounded-lg" style={{ border: "1px solid rgba(34,211,238,.3)", color: "#22d3ee" }}>
          {overlayOpen ? "HIDE OVERLAY" : "SHOW OVERLAY"}
        </button>
      </div>
      {overlayOpen && <HudOverlay character={character} gameState={gameState} onClose={() => setOverlayOpen(false)} />}
      <GlassCard className="p-5 space-y-1">
        <HudRow label="Name" value={character.name} />
        <HudRow label="Species" value={character.species} />
        <HudRow label="Homeworld" value={character.homeworld} />
        <HudRow label="Location" value={gameState.location} />
        <HudRow label="Background" value={character.background} />
        <HudRow label="Allegiance" value={character.allegiance} />
        <HudRow label="Force Sensitive" value={character.forceSensitive} />
        <HudRow label="Force Alignment" value={character.forceAlignment} />
        <HudRow label="Appearance" value={character.appearance} />
        <HudRow label="Primary Weapon" value={character.equipPrimary} />
        <HudRow label="Secondary Weapon" value={character.equipSecondary} />
        <HudRow label="Armor / Clothing" value={character.equipArmor} />
        <HudRow label="Special Items" value={character.equipSpecial} />
        <HudRow label="Skills & Traits" value={character.skills} />
        <HudRow label="Personal Goal" value={character.goal} />
        <HudRow label="Contacts / Enemies" value={character.contacts} />
      </GlassCard>

      <p className="text-[10px] tracking-[0.2em] mt-6 mb-3" style={{ color: "var(--sig)" }}>VITALS & FINANCE</p>
      <div className="space-y-2 mb-2"><HudRow label="Hit Points" value={hitPointDisplay(character, gameState).label} /></div>
      <div className="grid grid-cols-2 gap-3 mb-2">
        <StatCard icon={Wallet} label="Standard Credits" value={`${gameState.credits.toLocaleString()} cr`} color="var(--econ)" />
        <StatCard icon={Skull} label="Underworld Credits" value={`${gameState.creditsCriminal.toLocaleString()} cr`} color="var(--force-dark)" />
      </div>

      <p className="text-[10px] tracking-[0.2em] mt-6 mb-3" style={{ color: "var(--sig)" }}>FACTION REPUTATION</p>
      <div className="space-y-2">
        <MeterRow label="Empire" value={rep.empire} color="var(--force-dark)" />
        <MeterRow label="Rebel Alliance" value={rep.rebellion} color="var(--sig)" />
        <MeterRow label="Corporate Sector Authority" value={rep.csa} color="var(--force-light)" />
      </div>

      <p className="text-[10px] tracking-[0.2em] mt-6 mb-3" style={{ color: "var(--sig)" }}>METERS</p>
      <MeterRow label="Notoriety" value={gameState.notoriety} color="var(--force-dark)" />
      <MeterRow label="Force Alignment (Dark ← → Light)" value={gameState.forceAlignment} color="var(--force-light)" />

      {gameState.flags.length > 0 && (
        <>
          <p className="text-[10px] tracking-[0.2em] mt-6 mb-3" style={{ color: "var(--sig)" }}>RECENT CONSEQUENCES</p>
          <ul className="text-sm text-[#a9adb8] space-y-1 list-disc list-inside">
            {gameState.flags.slice(-8).reverse().map((f, i) => <li key={i}>{f.note}</li>)}
          </ul>
        </>
      )}
    </div>
  );
}

/* ---------- Travel ---------- */

function TravelView({ setTab }) {
  const { gameState, character, travelToLocation, sending, saveReady, saveError } = useGame();
  const [selected, setSelected] = useState(null);
  const [district, setDistrict] = useState("");
  return (
    <div className="p-6">
      <div className="flex items-end justify-between gap-4 mb-5">
        <div>
          <p className="text-[10px] tracking-[0.2em] mb-2" style={{ color: "var(--sig)" }}>GALACTIC TRAVEL NETWORK</p>
          <h2 className="gc-display text-2xl font-bold text-[#f2f0ea]">DESTINATIONS & DOSSIERS</h2>
          <p className="text-sm text-[#8b93a3] mt-2 max-w-2xl">A living travel index. The GM decides what routes, invitations, permits, debts, and dangers make a destination reachable.</p>
        </div>
        <div className="text-right text-xs text-[#a9adb8]"><MapPin size={15} className="inline mr-1 text-[#ff7a1a]" />CURRENTLY IN<br /><strong className="text-[#f2f0ea]">{gameState.location}</strong><br /><span className="text-[#22e5c5]">{gameState.credits.toLocaleString()} cr available</span></div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {GALAXY_LOCATIONS.map((place) => (
          <GlassCard key={place.id} className="p-5">
            {(() => {
              const fare = getTravelCost(place, gameState.location);
              const access = getTravelAccess(place, gameState, character);
              const unavailable = !access.allowed || sending || !saveReady || Boolean(saveError);
              return (
                <>
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-lg font-semibold text-[#f2f0ea]">{place.name}</p><p className="text-[10px] tracking-widest text-[#ff7a1a] mt-1">{place.region.toUpperCase()}</p></div>
              <span className="text-[10px] text-[#8b93a3]">155 ABY · {access.label}</span>
            </div>
            <p className="text-xs leading-relaxed text-[#c7c4bc] mt-4">{place.description}</p>
            <p className="text-xs leading-relaxed text-[#8b93a3] mt-3">{place.era}</p>
            <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
              <div><p className="text-[9px] tracking-widest text-[#5c6370] mb-1">KNOWN AREAS</p><p className="text-[#a9adb8]">{place.districts.join(" · ")}</p></div>
              <div><p className="text-[9px] tracking-widest text-[#5c6370] mb-1">LIKELY CONTACTS</p><p className="text-[#a9adb8]">{place.npcs.join(" · ")}</p></div>
            </div>
            <div className="mt-4 pt-3 border-t border-white/10"><p className="text-[9px] tracking-widest text-[#ff7a1a] mb-1">MYSTERIES</p><p className="text-xs text-[#c7c4bc]">{place.mysteries.join(" ")}</p><p className="text-xs text-[#8b93a3] mt-2"><strong className="text-[#a9adb8]">Route note:</strong> {place.travel}</p></div>
            <div className="flex flex-wrap gap-1.5 mt-4">{place.tags.map((tag) => <span key={tag} className="rounded-full px-2 py-1 text-[9px] tracking-wide text-[#8b93a3] bg-white/5">{tag}</span>)}</div>
            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-3 text-xs">
              <div><span className="text-[#5c6370]">PASSAGE </span><strong className={unavailable ? "text-[#e23b3b]" : "text-[#22e5c5]"}>{fare === 0 ? "LOCAL TRANSIT" : `${fare.toLocaleString()} cr`}</strong><br /><span className="text-[#8b93a3]">{getTravelTime(place, gameState.location)}</span></div>
              {character && <button disabled={unavailable} title={access.reason} onClick={() => { setSelected(place); setDistrict(place.districts[0]); }} className="gc-btn px-3 py-2 text-xs flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"><MapPin size={13} /> {!access.routeEarned ? "ACCESS REQUIRED" : !access.levelReady ? "LEVEL LOCKED" : !access.affordable ? "INSUFFICIENT CREDITS" : fare === 0 ? "ENTER" : "PLOT COURSE"}</button>}
            </div>
            {!access.allowed && <p role="note" className="mt-3 text-[10px] leading-relaxed text-[#e5a26f]"><strong>ROUTE LOCKED:</strong> {access.reason}</p>}
                </>
              );
            })()}
          </GlassCard>
        ))}
      </div>
      {selected && <div className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-black/70" onClick={() => setSelected(null)}>
        <div className="gc-glass rounded-2xl p-6 max-w-md w-full" onClick={(event) => event.stopPropagation()}>
          <p className="text-[10px] tracking-[0.2em] text-[#ff7a1a] mb-2">ASTROGATION CONFIRMATION</p>
          <h3 className="gc-display text-2xl font-bold text-[#f2f0ea]">{selected.name}</h3>
          <p className="text-sm text-[#a9adb8] mt-2">Passage will cost {getTravelCost(selected, gameState.location).toLocaleString()} credits. The GM will place you there and begin the scene with the route, risks, and local situation in force.</p>
          <select value={district} onChange={(event) => setDistrict(event.target.value)} className="gc-input w-full px-3 py-2 mt-4 text-sm text-[#f2f0ea]">
            {selected.districts.map((area) => <option key={area} value={area}>{area}</option>)}
          </select>
          <p className="mt-3 text-xs text-[#a9adb8]">The GM resolves route access, confinement, and payment in Play. This request does not guarantee arrival.</p>
          <div className="flex justify-end gap-2 mt-5"><button onClick={() => setSelected(null)} disabled={sending} className="px-3 py-2 text-xs text-[#8b93a3]">CANCEL</button><button disabled={sending || !saveReady || Boolean(saveError)} onClick={async () => { await travelToLocation(selected, district); setSelected(null); setTab("play"); }} className="gc-btn px-4 py-2 text-xs disabled:opacity-40">{sending ? "GM RESOLVING…" : "REQUEST PASSAGE"}</button></div>
        </div>
      </div>}
    </div>
  );
}

/* ---------- User Controls ---------- */

function UserControlsView() {
  const { settings, saveSettings, character, exportGame, resetForNewGame } = useGame();
  const [newGameOpen, setNewGameOpen] = useState(false);
  const update = (key, value) => saveSettings({ ...settings, [key]: value });
  return (
    <div className="p-6 max-w-xl space-y-8">
      <section>
        <p className="text-[10px] tracking-[0.2em] mb-3" style={{ color: "var(--sig)" }}>GAME MASTER CONNECTION</p>
        <p className="text-sm leading-relaxed text-[#a9adb8]">
          <span className="text-[#22e5c5]">NVIDIA GAME MASTER</span> — NVIDIA Nemotron controls the GM, world state, NPC conversations, and scene flavor during this test. Your choices and campaign consequences are saved between sessions.
        </p>
      </section>

      <section>
        <p className="text-[10px] tracking-[0.2em] mb-3" style={{ color: "var(--sig)" }}>PLAYER SETTINGS</p>
        <div className="space-y-4">
          <label className="block text-sm"><span className="block text-[10px] tracking-widest text-[#8b93a3] mb-1">PLAYER ALIAS</span><input value={settings.playerName || ""} onChange={(event) => update("playerName", event.target.value)} placeholder="How should the GM address you?" className="gc-input w-full px-3 py-2 text-sm text-[#f2f0ea]" /></label>
          <label className="block text-sm"><span className="block text-[10px] tracking-widest text-[#8b93a3] mb-1">PREFERRED TONE</span><select value={settings.tone || "cinematic"} onChange={(event) => update("tone", event.target.value)} className="gc-input w-full px-3 py-2 text-sm text-[#f2f0ea]"><option value="cinematic">Cinematic and immersive</option><option value="gritty">Gritty and dangerous</option><option value="mysterious">Mysterious and Force-haunted</option><option value="fast">Fast-paced and concise</option></select></label>
          <label className="block text-sm"><span className="block text-[10px] tracking-widest text-[#8b93a3] mb-1">SCENE PACE</span><select value={settings.pacing || "balanced"} onChange={(event) => update("pacing", event.target.value)} className="gc-input w-full px-3 py-2 text-sm text-[#f2f0ea]"><option value="balanced">Balanced</option><option value="roleplay">More roleplay and dialogue</option><option value="action">More action and urgency</option><option value="investigation">More investigation and discovery</option></select></label>
          <div className="text-sm"><span className="block text-[10px] tracking-widest text-[#8b93a3] mb-1">NPC COMMS ENGINE</span><p className="text-[#a9adb8]">NVIDIA Nemotron · active test engine</p><p className="text-[10px] text-[#8b93a3] mt-1">Comms handle conversations. Trades, combat, travel, and other world changes are resolved in Play.</p></div>
          <label className="block text-sm"><span className="block text-[10px] tracking-widest text-[#8b93a3] mb-1">IMMERSION INTERESTS</span><textarea value={settings.interests || ""} onChange={(event) => update("interests", event.target.value)} placeholder="NPC relationships, starship travel, politics, Force mysteries..." rows={3} className="gc-input w-full p-3 text-sm text-[#f2f0ea]" /></label>
          <label className="block text-sm"><span className="block text-[10px] tracking-widest text-[#8b93a3] mb-1">BOUNDARIES & CONTENT PREFERENCES</span><textarea value={settings.boundaries || ""} onChange={(event) => update("boundaries", event.target.value)} placeholder="Tell the GM what to fade out, avoid, or handle carefully." rows={3} className="gc-input w-full p-3 text-sm text-[#f2f0ea]" /></label>
        </div>
      </section>

      {character && (
        <section>
          <p className="text-[10px] tracking-[0.2em] mb-3" style={{ color: "var(--sig)" }}>GM-MANAGED DOSSIER</p>
          <div className="space-y-3">
            {Object.keys(EMPTY_CHARACTER).map((key) => (
              <label key={key} className="block text-sm">
                <span className="block text-[10px] tracking-widest text-[#8b93a3] mb-1">{key.toUpperCase()}</span>
                <p className="text-sm text-[#a9adb8]">{character[key] || "—"}</p>
              </label>
            ))}
          </div>
        </section>
      )}

      <section>
        <p className="text-[10px] tracking-[0.2em] mb-3" style={{ color: "var(--sig)" }}>DATA</p>
        <div className="flex gap-3">
          <button onClick={exportGame} className="text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 hover:bg-white/5" style={{ border: "1px solid rgba(255,255,255,.12)", color: "#a9adb8" }}><Download size={12} /> EXPORT SAVE FILE</button>
          <p className="text-sm text-[#8b93a3]">Character resets, advancement, and changes are controlled by the Game Master.</p>
        </div>
      </section>

      <section>
        <p className="text-[10px] tracking-[0.2em] mb-3" style={{ color: "var(--sig)" }}>CAMPAIGN</p>
        <button onClick={() => setNewGameOpen(true)} className="gc-btn px-3.5 py-2 text-xs">
          NEW GAME
        </button>
        <p className="text-xs text-[#8b93a3] mt-2">Reset the current campaign and choose whether to keep this character at level 1 or begin character creation again.</p>
      </section>

      {newGameOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-black/70" onClick={() => setNewGameOpen(false)}>
          <div className="gc-glass rounded-2xl p-6 max-w-lg w-full" onClick={(event) => event.stopPropagation()}>
            <p className="text-[10px] tracking-[0.2em] text-[#ff7a1a] mb-2">NEW GAME INITIALIZATION</p>
            <h3 className="gc-display text-2xl font-bold text-[#f2f0ea]">Reset campaign?</h3>
            <p className="text-sm leading-relaxed text-[#a9adb8] mt-3">The current scene, ledger, communications, inventory, credits, contacts, and progression will be reset.</p>
            <div className="grid gap-3 mt-5 sm:grid-cols-2">
              {character && (
                <button onClick={async () => { await resetForNewGame("level-one"); setNewGameOpen(false); }} className="text-left rounded-xl p-4 border border-white/10 hover:border-[#ff7a1a]/60">
                  <strong className="block text-sm text-[#f2f0ea]">KEEP CHARACTER — LEVEL 1</strong>
                  <span className="block text-xs text-[#a9adb8] mt-2">Keep {character.name || "this character"} and return them to level 1 with a fresh campaign.</span>
                </button>
              )}
              <button onClick={() => { resetForNewGame("character-creation"); setNewGameOpen(false); }} className="text-left rounded-xl p-4 border border-white/10 hover:border-[#ff7a1a]/60">
                <strong className="block text-sm text-[#f2f0ea]">BEGIN CHARACTER CREATION</strong>
                <span className="block text-xs text-[#a9adb8] mt-2">Erase the current character record and build a new dossier.</span>
              </button>
            </div>
            <button onClick={() => setNewGameOpen(false)} className="block ml-auto mt-5 px-3 py-2 text-xs text-[#8b93a3]">CANCEL</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- page shell ---------- */

function PlayerPageBody() {
  const { character, gameState } = useGame();
  const { user } = useAuth();
  const [tab, setTab] = useState("play");
  const economy = getEconomicSnapshot(gameState);

  return (
    <div className="gc-page-row gc-player-workspace flex flex-col md:flex-row flex-1 min-h-0 gap-3 px-3 pb-3">
      <NavRail tab={tab} setTab={setTab} />
      <div key={tab} data-player-tab={tab} className={`gc-player-panel flex-1 min-w-0 min-h-0 gc-glass rounded-2xl ${tab === "play" && character ? "overflow-hidden" : "overflow-y-auto"}`} role="region" aria-label={tab === "economy" ? "Bank" : tab === "market" ? "Marketplace" : "Player workspace"} tabIndex={tab === "play" ? undefined : 0}>
        {tab === "play" && (!character ? <CreationWizard /> : <PlayView />)}
        {tab === "inventory" && (character ? <InventoryView items={gameState.inventory} readOnly /> : <EmptyNote text="NO CHARACTER ON FILE." />)}
        {tab === "properties" && (character ? <PropertiesView items={gameState.properties} economicItems={economy.properties} readOnly /> : <EmptyNote text="NO CHARACTER ON FILE." />)}
        {tab === "hangar" && (character ? <HangarView items={gameState.ships} economicItems={economy.ships} readOnly /> : <EmptyNote text="NO CHARACTER ON FILE." />)}
        {tab === "economy" && (character ? <BankView /> : <EmptyNote text="NO CHARACTER ON FILE." />)}
        {tab === "market" && (character ? <MarketplaceView setTab={setTab} /> : <EmptyNote text="NO CHARACTER ON FILE." />)}
        {tab === "travel" && <TravelView setTab={setTab} />}
        {tab === "user" && (user?.role === "admin" ? <UserControlsView /> : <EmptyNote text="ADMINISTRATOR ACCESS REQUIRED." />)}
      </div>
    </div>
  );
}

export default function PlayerPage() {
  const { character, gameState } = useGame();
  return (
    <Shell>
      <TopBar
        character={character}
        gameState={gameState}
      />
      <PlayerPageBody />
    </Shell>
  );
}
