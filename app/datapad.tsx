"use client";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import type { CampaignState } from "@/lib/types";
import type { GmProposal } from "@/lib/gm-provider";
import { ABILITIES, evaluatePointBuy, abilityModifier } from "@/lib/point-buy";
import MapAtlas from "./map-atlas";
import { datapadTheme } from "@/lib/datapad-theme";
import type { Account } from "@/lib/accounts";
import GameShell, { sectionName } from "./game-shell";
import SupplementalScreens, { PlayScreen } from "./game-screens";
import { CharacterDossier, InventoryPanel, RelationshipPanel, FinancialAssetsPanel } from "./player-components";

type Tab = string;
type Timeline = { id: string; title: string; era: string };
type Source = { id: string; title: string; authority: string; pages: number; status: string; reviewedPages: number };

async function api(path: string, method = "GET", body?: object) {
  const response = await fetch(path, { method, cache: "no-store", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error ?? "Request failed. Your last saved state is preserved.");
  return value;
}

export default function Datapad({ user, onProfile, onLogout }: { user: Account; onProfile: (user: Account) => void; onLogout: () => Promise<void> }) {
  const [campaign, setCampaign] = useState<CampaignState | null>(null);
  const [timelines, setTimelines] = useState<Timeline[]>([]);
  const [tab, setTab] = useState<Tab>("Scene");
  const [status, setStatus] = useState("Opening campaign archive…");
  const [busy, setBusy] = useState(false);
  const [displayPreview, setDisplayPreview] = useState("auto");
  const inFlight = useRef(false);
  const [sources, setSources] = useState<Source[]>([]);
  const [preview, setPreview] = useState<GmProposal | null>(null);
  const [previewAction, setPreviewAction] = useState("");
  const [journalFilter, setJournalFilter] = useState("active");
  const [scores, setScores] = useState({ strength: 8, dexterity: 8, constitution: 8, intelligence: 8, wisdom: 8, charisma: 8 });
  const refresh = useCallback(async () => {
    let data;
    do {
      data = await api("/api/campaign", "POST");
      setStatus(data.campaign.economyCatchUpPending ? "Processing saved economic catch-up…" : "Local archive synchronized");
    } while (data.campaign.economyCatchUpPending);
    setCampaign(data.campaign); setTimelines(data.timelines);
    setStatus("Local archive synchronized");
  }, []);
  useEffect(() => {
    const sync = () => { void refresh().catch(error => setStatus(error.message)); };
    sync();
    const visible = () => { if (document.visibilityState === "visible" && !inFlight.current) sync(); };
    document.addEventListener("visibilitychange", visible);
    return () => document.removeEventListener("visibilitychange", visible);
  }, [refresh]);
  useEffect(() => {
    if (tab === "Library") void api("/api/sources").then(data => setSources(data.sources)).catch(error => setStatus(error.message));
  }, [tab]);

  async function run(work: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try { await work(); }
    catch (error) { setStatus(error instanceof Error ? error.message : "Request failed"); }
    finally { inFlight.current = false; setBusy(false); }
  }
  async function command(body: object) {
    if (!campaign) return;
    const data = await api("/api/player", "POST", { ...body, campaignId: campaign.id, revision: campaign.revision });
    setCampaign(data.campaign); setStatus("Saved to local campaign history");
  }
  async function checkpointRequest(method: string, body: object) {
    if (!campaign) throw new Error("Campaign not loaded");
    return api("/api/checkpoints", method, { ...body, campaignId: campaign.id, revision: campaign.revision });
  }
  function formValues(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); return Object.fromEntries(new FormData(event.currentTarget));
  }
  if (!campaign) return <main className="loading-shell"><p role="status">{status}</p><button onClick={() => void run(refresh)} disabled={busy}>Retry archive connection</button></main>;
  const world = campaign.world!;
  const character = campaign.character;
  const automaticTheme = datapadTheme(character?.darkSideScore ?? null, campaign.rulesStatus === "verified");
  const theme = displayPreview === "auto" ? automaticTheme : datapadTheme(Number(displayPreview), true);
  const decisions = world.decisions.filter(d => d.status !== "resolved");
  const journal = world.journal.filter(j => journalFilter === "all" || (j.status !== "archived" && j.status !== "dismissed"));
  return <GameShell campaign={campaign} user={user} tab={tab} navigate={setTab} theme={theme} status={status} onLogout={onLogout}>
    <section className={`workspace ${tab === "Scene" ? "play-workspace" : ""}`} aria-label={sectionName(tab)} key={`${campaign.id}:${tab}`}>
      <SupplementalScreens tab={tab} campaign={campaign} user={user} onProfile={onProfile} navigate={setTab} setStatus={setStatus} />
      {tab === "Morality" && <><h2>The choices you carry</h2><p>Dark Side Score: <strong>{character?.darkSideScore ?? "Not established"}</strong></p><p>{automaticTheme.label}. The interface responds to verified character state; it never assigns morality from your account or a color selection.</p><div className="force-spectrum" aria-hidden="true"/><section className="data-panel"><h3>DISPLAY CALIBRATION</h3><div className="data-panel-body"><label>Palette preview<select value={displayPreview} onChange={event => setDisplayPreview(event.target.value)}><option value="auto">Automatic · recorded character state</option><option value="0">Preview · light / ice blue</option><option value="5">Preview · twilight / muted violet</option><option value="10">Preview · dark / crimson</option></select></label><p>Preview only. Your score and save are unchanged. Color intensity is an artistic scale, not a Saga alignment category.</p></div></section></>}
      {tab === "Atlas" && <MapAtlas busy={busy} saveNote={(title, detail) => run(() => command({ command: "add_note", title, detail }))} />}
      {tab === "Scene" && <PlayScreen campaign={campaign} navigate={setTab} setStatus={setStatus} />}
      {tab === "Character" && <>
        {character ? <CharacterDossier campaign={campaign}/> : <>
          <h2>Your character, your beginning</h2>
          <p>Save your background now. Species, training, equipment, starting location and point-buy scores require source review before becoming active campaign facts.</p>
          <details><summary>Verified point-buy calculator · preview only</summary><p>Organic characters: 25 points, before species modifiers. Core Rulebook p. 18 (PDF p. 19). This calculator does not create or modify your character.</p><div className="score-grid">{ABILITIES.map(ability => <label key={ability}>{ability}<select value={scores[ability]} onChange={event => setScores(previous => ({ ...previous, [ability]: Number(event.target.value) }))}>{Array.from({ length: 11 }, (_, i) => i + 8).map(score => <option key={score} value={score}>{score} ({abilityModifier(score) >= 0 ? "+" : ""}{abilityModifier(score)})</option>)}</select></label>)}</div><p role="status">{evaluatePointBuy(scores).remaining} points remaining{evaluatePointBuy(scores).withinBudget ? "" : " — exceeds budget"}</p></details>
          <form className="stack-form" key={campaign.id} onSubmit={event => { const values = formValues(event); void run(() => command({ command: "save_draft", ...values })); }}>
            <label>Name<input name="name" maxLength={80} required defaultValue={world.draft?.name ?? ""} /></label>
            <label>Preferred species<input name="species" maxLength={80} required defaultValue={world.draft?.species ?? ""} /></label>
            <label>Background or occupation<input name="background" maxLength={300} required defaultValue={world.draft?.background ?? ""} /></label>
            <label>Biography<textarea name="biography" maxLength={6000} rows={7} required defaultValue={world.draft?.biography ?? ""} /></label>
            <label>Preferred starting world or situation<input name="startingLocation" maxLength={200} required defaultValue={world.draft?.startingLocation ?? ""} /></label>
            <label>Personal ambitions<textarea name="aspirations" maxLength={1000} rows={3} defaultValue={world.draft?.aspirations ?? ""} /></label>
            <p>Ability method: point buy. No provisional stats will be assigned.</p><button disabled={busy}>Save biography draft</button>
          </form>{world.draft && <p className="empty">Draft saved · awaiting rules and lore review</p>}
        </>}
      </>}
      {tab === "Journal" && <>
        <h2>Leads & personal notes</h2><p>Tracking a lead never accepts a job or commits your character to it.</p>
        <label>Show <select value={journalFilter} onChange={e => setJournalFilter(e.target.value)}><option value="active">Active entries</option><option value="all">All, including archived</option></select></label>
        {journal.length ? journal.map(entry => <article className="record" key={entry.id}><h3>{entry.title}</h3><small>{entry.kind} · {entry.status}</small><p>{entry.detail}</p><div className="actions">{["discovered", "pursuing", "dismissed", "archived"].map(status => <button disabled={busy || entry.status === status} key={status} onClick={() => void run(() => command({ command: "journal_status", id: entry.id, status }))}>{status}</button>)}</div></article>) : <p className="empty">No active entries. Discovered opportunities will be recorded here during play.</p>}
        <form className="stack-form" onSubmit={event => { const values = formValues(event); const form = event.currentTarget; void run(async () => { await command({ command: "add_note", ...values }); form.reset(); }); }}><h3>Add a personal note</h3><label>Title<input name="title" maxLength={160} required /></label><label>Note<textarea name="detail" maxLength={4000} required rows={4} /></label><button disabled={busy}>Save note</button></form>
      </>}
      {tab === "Decisions" && <>
        <h2>Waiting for you</h2><p>Personal danger and major irreversible losses pause. Submitting your intention does not automatically resolve consequences.</p>
        {!decisions.length && <p className="empty">No decisions pending.</p>}{decisions.map(decision => <article className="record" key={decision.id}><h3>{decision.title}</h3><p>{decision.detail}</p><small>{decision.status}</small>{decision.status === "pending" ? <form className="stack-form" onSubmit={event => { const values = formValues(event); void run(() => command({ command: "decision_response", id: decision.id, ...values })); }}><label>Your intention<textarea name="response" maxLength={2000} required /></label><button disabled={busy}>Record response</button></form> : <p>Your response: {decision.response}<br />Awaiting validated GM adjudication.</p>}</article>)}
      </>}
      {tab === "Contacts" && <><h2>People you know</h2><p>Observed attitudes and known obligations appear here. Private agendas remain hidden.</p><RelationshipPanel world={world}/></>}
      {tab === "Assets" && <><h2>Inventory</h2><p>Equipment must be established through character creation or a recorded campaign event.</p><InventoryPanel character={character} world={world}/><button onClick={() => setTab("Marketplace")}>BROWSE MARKETPLACE</button></>}
      {tab === "Economy" && <>
        <h2>Credits & obligations</h2><p>Available credits: {character?.credits ?? "Not established"}</p><p>Only recorded, authorized contracts generate income or expenses. Insufficient funds pause the obligation for a decision.</p>
        <h3>Recurring transactions</h3>{world.cashflows.length ? world.cashflows.map(flow => <p key={flow.id}>{flow.label}: {flow.credits} credits · {flow.status}</p>) : <p className="empty">No recurring transactions.</p>}
        <h3>Contracts</h3>{world.contracts.map(contract => <article className="record" key={contract.id}><strong>{contract.title}</strong><p>{contract.terms}</p><small>{contract.status}</small></article>)}
        <FinancialAssetsPanel character={character} world={world}/><h3>Ledger</h3><div className="table-scroll"><table><thead><tr><th>Campaign day</th><th>Credits</th><th>Balance</th></tr></thead><tbody>{world.ledger.slice(-100).reverse().map(entry => <tr key={entry.id}><td>{(entry.campaignAtMs / 86400000).toFixed(2)}</td><td>{entry.credits}</td><td>{entry.balance}</td></tr>)}</tbody></table></div>
      </>}
      {tab === "Codex" && <><h2>Known information</h2>{campaign.loreFacts.map(fact => <article className="record" key={fact.id}><h3>{fact.label}</h3><p>{fact.detail}</p><details><summary>Source note</summary><p>{fact.source}</p><small>{fact.classification} · {fact.verified ? "Reviewed" : "Pending review"}</small></details></article>)}</>}
      {tab === "Saves" && <>
        <h2>Timeline archive</h2><label>Active timeline<select value={campaign.id} disabled={busy} onChange={event => { const timelineId = event.target.value; void run(async () => { await api("/api/campaign", "PUT", { timelineId }); await refresh(); }); }}>{timelines.map(timeline => <option key={timeline.id} value={timeline.id}>{timeline.title} · {timeline.era} · {timeline.id.slice(0, 8)}</option>)}</select></label>
        <form className="stack-form" onSubmit={event => { const values = formValues(event); void run(async () => { const data = await checkpointRequest("POST", values); setCampaign(data.campaign); setStatus("Checkpoint saved"); }); }}><label>Checkpoint name<input name="label" required maxLength={80} /></label><button disabled={busy}>Create checkpoint</button></form>
        {campaign.checkpoints.map(checkpoint => <article className="record" key={checkpoint.id}><h3>{checkpoint.label}</h3><p>{new Date(checkpoint.createdAt).toLocaleString()}</p><button disabled={busy} onClick={() => void run(async () => { await checkpointRequest("PUT", { checkpointId: checkpoint.id }); await refresh(); setStatus("Restored into a new timeline; original preserved"); })}>Restore into new timeline</button></article>)}
        <hr /><button disabled={busy} onClick={() => void run(async () => { await api("/api/campaign", "PATCH", { command: "new_campaign" }); await refresh(); setTab("Character"); })}>Create separate campaign</button><p className="empty">Existing timelines remain available. New campaigns start with no character.</p>
        <details><summary>Visible event history ({campaign.events.length})</summary>{campaign.events.slice(0, 100).map(event => <p key={event.id}><small>{event.createdAt}</small><br />{event.summary}</p>)}</details>
      </>}
      {tab === "Library" && <><h2>Private source library</h2><p>Extraction does not verify rules. Scanned pages require OCR and review. No sourcebook text is published to GitHub.</p>{!sources.length ? <p className="empty">No indexed books yet. Run the local source indexer.</p> : <div className="table-scroll"><table><thead><tr><th>Book</th><th>Authority</th><th>Pages</th><th>Reviewed</th><th>Status</th></tr></thead><tbody>{sources.map(source => <tr key={source.id}><td>{source.title}</td><td>{source.authority}</td><td>{source.pages}</td><td>{source.reviewedPages}</td><td>{source.status}</td></tr>)}</tbody></table></div>}</>}
      {tab === "Test console" && <><h2>Isolated provider preview</h2><p>This uses a deterministic test provider. It spends no AI credits and cannot change campaign history. It is not a playable Saga session.</p><form className="stack-form" onSubmit={event => { event.preventDefault(); void run(async () => { const data = await api("/api/preview", "POST", { action: previewAction }); setPreview(data.preview); setStatus("Preview complete; campaign unchanged"); }); }}><label>Test intention<textarea value={previewAction} onChange={event => setPreviewAction(event.target.value)} required maxLength={2000} rows={4} /></label><button disabled={busy}>Preview response</button></form>{preview && <article className="record"><p className="preserve-lines">{preview.narration}</p><div className="actions">{preview.suggestions.map(suggestion => <button key={suggestion} onClick={() => setPreviewAction(suggestion)}>{suggestion}</button>)}</div></article>}</>}
    </section>
  </GameShell>;
}
