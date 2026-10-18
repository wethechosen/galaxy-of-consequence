"use client";
import { useState } from "react";
import type { CampaignState } from "@/lib/types";
import { playerKnownContacts, playerVisibleChronology } from "@/lib/visual-page-projections";

// Widgets are inserted on their existing pages; none may send gameplay mutations.
export function AtlasLocationContext({ location }: { location: string }) {
  return <section className="data-panel"><h3>RECORDED CURRENT POSITION <small>READ ONLY</small></h3><div className="data-panel-body">
    <p><strong>{location || "Location unconfirmed"}</strong></p>
    <p className="muted">Your recorded location comes from the campaign controller. Inspecting a chart or placing a reference marker does not initiate travel, reveal new destinations, or advance time. Travel remains a declared action for the GM to resolve.</p>
  </div></section>;
}

export function KnownFactionContacts({ campaign }: { campaign: CampaignState }) {
  const known = playerKnownContacts(campaign.world?.contacts ?? []);
  return <section className="data-panel"><h3>KNOWN PEOPLE & CONNECTIONS <small>{known.length} ESTABLISHED</small></h3><div className="data-panel-body">
    <p className="muted">Only direct encounters and observations appear. Faction memberships or links are not invented from proximity or speculation.</p>
    {known.length ? known.map(person => <details key={person.id} className="page-inspector">
      <summary>{person.name} · {person.observedAttitude || "Attitude unconfirmed"}</summary>
      <p>{person.description}</p>
      {person.knownObligations.length > 0 && <p>Known obligations: {person.knownObligations.join("; ")}</p>}
    </details>) : <p className="empty">No confirmed known connections yet.</p>}
  </div></section>;
}

export function EconomyStateSummary({ campaign }: { campaign: CampaignState }) {
  const world = campaign.world;
  const balance = campaign.character?.credits;
  const holds = world?.assets.filter(a => a.kind !== "equipment") ?? [];
  const pending = world?.contracts.filter(c => c.status === "awaiting_decision") ?? [];
  return <section className="data-panel"><h3>RECORDED ACCOUNTS & OBLIGATIONS <small>GM-LEDGER ONLY</small></h3><div className="data-panel-body">
    <div className="stat-grid">
      <div><small>SPENDABLE CREDITS</small><strong>{balance === undefined ? "Unverified" : balance.toLocaleString()}</strong></div>
      <div><small>CONFIRMED ASSET RECORDS</small><strong>{holds.length}</strong></div>
      <div><small>PENDING CONTRACT DECISIONS</small><strong>{pending.length}</strong></div>
    </div>
    <p className="muted">Only saved amounts appear. Separate bank deposits, physical chips, inheritance access rights and ownership are not inferred from this site's limited character model. The authoritative GPT asset ledger must remain reconciled before displaying those balances here.</p>
  </div></section>;
}

export function CampaignChronology({ campaign }: { campaign: CampaignState }) {
  const [filter, setFilter] = useState("all");
  const confirmed = playerVisibleChronology(campaign.events);
  const visible = filter === "all" ? confirmed : confirmed.filter(event => event.kind === filter);
  return <section className="data-panel"><h3>CAMPAIGN CHRONOLOGY <small>{confirmed.length} PLAYER-VISIBLE RECORDS</small></h3><div className="data-panel-body">
    <p className="muted">Committed campaign events only; no speculative NPC plans or retroactively generated outcomes.</p>
    <label>Event type <select aria-label="Filter campaign event history" value={filter} onChange={event => setFilter(event.target.value)}>
      <option value="all">All records</option><option value="scene">Scenes</option><option value="state_update">State updates</option>
      <option value="roll">Dice rolls</option><option value="checkpoint">Checkpoints</option><option value="restore">Restores</option>
    </select></label>
    <div aria-live="polite">{visible.length ? visible.map(event => <article className="dossier-entry" key={event.id}>
      <strong>{event.summary}</strong><small>{event.kind.toUpperCase()} · {new Date(event.createdAt).toLocaleString()}</small>
      {event.rollId && <small>Roll reference: {event.rollId}</small>}
    </article>) : <p className="empty">No matching committed events.</p>}</div>
  </div></section>;
}

export function LedgerExplorer({ campaign }: { campaign: CampaignState }) {
  const [direction, setDirection] = useState("all");
  const [search, setSearch] = useState("");
  const entries = (campaign.world?.ledger ?? []).slice().reverse().filter(entry =>
    (direction === "all" || (direction === "in" ? entry.credits > 0 : entry.credits < 0)) &&
    [entry.flowId, entry.credits, entry.balance].some(value =>
      String(value).toLowerCase().includes(search.trim().toLowerCase())));
  return <section className="data-panel"><h3>TRANSACTION EXPLORER <small>RECORDED TRANSACTIONS ONLY</small></h3><div className="data-panel-body">
    <div className="ledger-filters">
      <label>Flow <select value={direction} onChange={event => setDirection(event.target.value)}>
        <option value="all">All</option><option value="in">Inflow</option><option value="out">Outflow</option>
      </select></label>
      <label>Search <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Filter transactions" aria-label="Search transactions" /></label>
    </div>
    <div className="table-scroll"><table><thead><tr><th>Campaign day</th><th>Entry ID</th><th>Credits</th><th>Balance</th></tr></thead>
      <tbody>{entries.slice(0,150).map(entry=><tr key={entry.id}>
        <td>{(entry.campaignAtMs/86400000).toFixed(2)}</td>
        <td><code title={entry.flowId}>{entry.flowId.slice(0,12)}</code></td>
        <td>{entry.credits > 0 ? "+" : ""}{entry.credits.toLocaleString()}</td><td>{entry.balance.toLocaleString()}</td>
      </tr>)}</tbody>
    </table></div>
    {!entries.length && <p className="empty">No recorded transactions match these filters.</p>}
    {entries.length > 150 && <p className="muted">Showing the most recent 150 matching records.</p>}
    <p className="muted">Filters are display-only. They cannot post transfers, change ownership, create liabilities, or modify balances.</p>
  </div></section>;
}
