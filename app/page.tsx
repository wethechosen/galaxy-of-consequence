"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { CampaignState, GmTurnResponse, RollRecord } from "@/lib/types";

function RuleLock({ status }: { status: CampaignState["rulesStatus"] }) {
  return status === "verified" ? null : (
    <div className="rule-lock" role="status">
      <span>Rules lock</span>
      Gameplay is locked until the Saga Edition Core Rulebook is indexed and verified. You can inspect the prototype and create checkpoints.
    </div>
  );
}

function CharacterPanel({ campaign }: { campaign: CampaignState }) {
  const { character } = campaign;
  return (
    <aside className="panel character-panel" aria-label="Character sheet">
      <div className="eyebrow">Character dossier</div>
      <h2>{character.name}</h2>
      <p className="muted">{character.species} · {character.heroicClass} · Level {character.level}</p>
      <div className="vitals">
        <div><span>Vitality</span><strong>{character.hitPoints.current} / {character.hitPoints.maximum}</strong></div>
        <div><span>Condition</span><strong>{character.condition}</strong></div>
        <div><span>Credits</span><strong>{character.credits.toLocaleString()}</strong></div>
      </div>
      <dl className="defenses">
        <div><dt>Reflex</dt><dd>{character.defenses.reflex}</dd></div>
        <div><dt>Fortitude</dt><dd>{character.defenses.fortitude}</dd></div>
        <div><dt>Will</dt><dd>{character.defenses.will}</dd></div>
      </dl>
      <div className="mini-section"><span>Trained skills</span><p>{character.trainedSkills.join(" · ")}</p></div>
      <div className="mini-section"><span>On hand</span><p>{character.inventory.join(" · ")}</p></div>
    </aside>
  );
}

function RollLine({ roll }: { roll: RollRecord }) {
  const result = roll.outcome === "success" ? "success" : roll.outcome === "failure" ? "failure" : "pending";
  return <li><span className={`roll-dot ${result}`} /><strong>{roll.total}</strong><span>{roll.formula} · {roll.reason.replace("Provisional ", "")}</span></li>;
}

function Sidebar({ campaign, onCheckpoint }: { campaign: CampaignState; onCheckpoint: () => void }) {
  return (
    <aside className="sidebar">
      <section className="panel">
        <div className="eyebrow">Current objectives</div>
        <ul className="objectives">{campaign.objectives.map((objective) => <li key={objective}>{objective}</li>)}</ul>
      </section>
      <section className="panel">
        <div className="section-row"><div className="eyebrow">Dice record</div><span className="secure">secure</span></div>
        {campaign.rolls.length ? <ul className="rolls">{campaign.rolls.slice(0, 4).map((roll) => <RollLine key={roll.id} roll={roll} />)}</ul> : <p className="empty">No uncertain action has required a roll.</p>}
      </section>
      <section className="panel checkpoint-panel">
        <div className="eyebrow">Campaign memory</div>
        <p>{campaign.checkpoints.length} named checkpoint{campaign.checkpoints.length === 1 ? "" : "s"} · {campaign.events.length} recorded events</p>
        <button className="secondary-button" onClick={onCheckpoint}>Create checkpoint</button>
      </section>
    </aside>
  );
}

export default function Home() {
  const [campaign, setCampaign] = useState<CampaignState | null>(null);
  const [action, setAction] = useState("");
  const [narration, setNarration] = useState("");
  const [status, setStatus] = useState("Connecting to campaign archive…");
  const [submitting, setSubmitting] = useState(false);

  const refreshCampaign = useCallback(async () => {
    const response = await fetch("/api/campaign", { cache: "no-store" });
    const data = (await response.json()) as { campaign: CampaignState };
    setCampaign(data.campaign);
    setNarration(data.campaign.currentScene);
    setStatus("Campaign archive synchronized");
  }, []);

  useEffect(() => { void refreshCampaign(); }, [refreshCampaign]);

  async function submitAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action.trim() || submitting) return;
    setSubmitting(true);
    setStatus("Resolving your action…");
    try {
      const response = await fetch("/api/gm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const data = (await response.json()) as GmTurnResponse & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "The GM route could not resolve that action.");
      setCampaign(data.campaign);
      setNarration(data.narration);
      setAction("");
      setStatus(data.source === "nemotron" ? "Nemotron narration recorded" : "Local lore-safe narration recorded");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Something interrupted the transmission.");
    } finally { setSubmitting(false); }
  }

  async function createCheckpoint() {
    const label = window.prompt("Name this checkpoint", `After event ${campaign?.events.length ?? 0}`);
    if (label === null) return;
    const response = await fetch("/api/checkpoints", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label }) });
    const data = (await response.json()) as { campaign: CampaignState };
    setCampaign(data.campaign);
    setStatus("Checkpoint sealed in the campaign timeline.");
  }

  if (!campaign) return <main className="loading-shell"><p>{status}</p></main>;

  return (
    <main>
      <header className="topbar">
        <div><div className="eyebrow">200 ABY · Legends-first continuity</div><h1>Galaxy <em>of</em> Consequence</h1></div>
        <div className="archive-status"><span className="signal" /> {status}</div>
      </header>
      <RuleLock status={campaign.rulesStatus} />
      <section className="worldline"><span>Campaign</span><strong>{campaign.title}</strong><i /> <span>{campaign.currentLocation}</span></section>
      <div className="game-grid">
        <CharacterPanel campaign={campaign} />
        <section className="story-panel">
          <div className="scene-meta"><span className="eyebrow">Present scene</span><span className="adaptation">Lore-governed</span></div>
          <article className="narration"><p>{narration}</p></article>
          <form onSubmit={submitAction} className="action-form">
            <label htmlFor="action">What do you do?</label>
            <textarea id="action" value={action} onChange={(event) => setAction(event.target.value)} placeholder="Describe your intention. The GM controls the world; you control your character." rows={3} maxLength={2000} />
            <div className="form-footer"><span>Only verified mechanics may enter play.</span><button type="submit" disabled={campaign.rulesStatus !== "verified" || submitting || !action.trim()}>{submitting ? "Resolving…" : "Commit action"}</button></div>
          </form>
        </section>
        <Sidebar campaign={campaign} onCheckpoint={createCheckpoint} />
      </div>
      <footer>Private campaign console · Lore facts are classified before they enter play · No hidden model reasoning is shown</footer>
    </main>
  );
}
