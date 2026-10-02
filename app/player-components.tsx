"use client";

import type { FormEvent, ReactNode } from "react";
import { Heart, MapPin, Send, Shield, Sparkles, Wallet } from "lucide-react";
import type { CampaignState, CharacterState, RollRecord } from "@/lib/types";
import type { WorldState } from "@/lib/world";

export function PlayerHUD({ character, location }: { character: CharacterState; location: string }) {
  const stats = [
    ["LEVEL", character.level], ["XP", character.experience], ["HP", `${character.hitPoints.current}/${character.hitPoints.maximum}`],
    ["REF", character.defenses.reflex], ["FORT", character.defenses.fortitude], ["WILL", character.defenses.will],
    ["FORCE", character.forcePoints], ["DESTINY", character.destinyPoints], ["DSS", character.darkSideScore],
  ];
  return <section className="player-hud" aria-label="Player status">
    <div className="player-hud-identity"><span className="eyebrow"><Sparkles size={14}/> PLAYER DOSSIER</span><h2>{character.name}</h2><p>{character.species} · {character.heroicClass}</p></div>
    <div className="player-hud-stats">{stats.map(([label, value]) => <div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div>
    <div className="player-hud-context"><span><MapPin size={15}/>{location}</span><span><Wallet size={15}/>{character.credits.toLocaleString()}cr</span><span><Heart size={15}/>Condition {character.condition}</span></div>
  </section>;
}

function DossierPanel({ title, meta, children }: { title: string; meta?: string; children: ReactNode }) {
  return <section className="data-panel dossier-panel"><h3>{title}{meta && <small>{meta}</small>}</h3><div className="data-panel-body">{children}</div></section>;
}

export function RelationshipPanel({ world }: { world: WorldState }) {
  const contacts = world.contacts.filter(contact => contact.playerKnown);
  return <DossierPanel title="RELATIONSHIPS" meta={`${contacts.length} KNOWN`}>
    {contacts.length ? contacts.map(contact => <article className="dossier-entry" key={contact.id}><strong>{contact.name}{contact.companion ? " · Companion" : ""}</strong><p>{contact.description}</p><small>{contact.observedAttitude}</small>{contact.knownObligations.length > 0 && <ul>{contact.knownObligations.map(item => <li key={item}>{item}</li>)}</ul>}</article>) : <p className="empty">No confirmed relationships recorded.</p>}
  </DossierPanel>;
}

export function ObjectivePanel({ campaign, world }: { campaign: CampaignState; world: WorldState }) {
  const active = campaign.objectives;
  const completed = world.journal.filter(entry => entry.kind === "goal" && entry.status === "archived");
  return <DossierPanel title="OBJECTIVES" meta={`${active.length} ACTIVE`}>
    {active.length ? <ul className="dossier-list">{active.map(objective => <li key={objective}>{objective}</li>)}</ul> : <p className="empty">No confirmed objectives.</p>}
    {completed.length > 0 && <><h4>COMPLETED</h4><ul className="dossier-list completed">{completed.map(entry => <li key={entry.id}>{entry.title}</li>)}</ul></>}
  </DossierPanel>;
}

export function InventoryPanel({ character, world }: { character: CharacterState | null; world: WorldState }) {
  const equipment = world.assets.filter(asset => asset.kind === "equipment");
  const carried = character?.inventory ?? [];
  return <DossierPanel title="INVENTORY" meta={`${carried.length + equipment.length} RECORDED`}>
    {!carried.length && !equipment.length && <p className="empty">No established equipment.</p>}
    {carried.length > 0 && <><h4>CARRIED ITEMS</h4><ul className="dossier-list">{carried.map(item => <li key={item}>{item}</li>)}</ul></>}
    {equipment.length > 0 && <><h4>NOTABLE EQUIPMENT</h4>{equipment.map(asset => <article className="dossier-entry" key={asset.id}><strong>{asset.name}</strong><p>{asset.description}</p></article>)}</>}
  </DossierPanel>;
}

export function FinancialAssetsPanel({ character, world }: { character: CharacterState | null; world: WorldState }) {
  const holdings = world.assets.filter(asset => asset.kind !== "equipment");
  return <DossierPanel title="FINANCIAL / KELVEK LEGACY" meta="CONFIRMED STATE ONLY">
    <div className="financial-summary"><small>LIQUID CREDITS</small><strong>{character ? `${character.credits.toLocaleString()}cr` : "UNASSIGNED"}</strong></div>
    <h4>CONFIRMED HOLDINGS</h4>
    {holdings.length ? holdings.map(asset => <article className="dossier-entry" key={asset.id}><strong>{asset.name}</strong><small>{asset.kind}</small><p>{asset.description}</p></article>) : <p className="empty">No confirmed holdings or accessible legacy assets.</p>}
    <p className="muted">Suspected or inaccessible assets appear only after the campaign records them.</p>
  </DossierPanel>;
}

export function CampaignMilestones({ campaign }: { campaign: CampaignState }) {
  const milestones = campaign.events.filter(event => event.playerVisible && event.kind === "checkpoint");
  return <DossierPanel title="CAMPAIGN MILESTONES" meta={`${milestones.length} CONFIRMED`}>
    {milestones.length ? milestones.slice().reverse().map(event => <article className="dossier-entry" key={event.id}><strong>{event.summary}</strong><small>{new Date(event.createdAt).toLocaleString()}</small></article>) : <p className="empty">No major campaign milestones recorded.</p>}
  </DossierPanel>;
}

export function CharacterDossier({ campaign }: { campaign: CampaignState }) {
  const character = campaign.character;
  const world = campaign.world!;
  if (!character) return null;
  return <div className="character-dossier">
    <PlayerHUD character={character} location={campaign.currentLocation}/>
    <div className="dossier-grid">
      <DossierPanel title="BIOGRAPHY"><p className="preserve-lines">{world.draft?.biography || "No confirmed biography recorded."}</p></DossierPanel>
      <DossierPanel title="INJURIES & CONDITIONS"><p>{character.condition === 0 ? "No recorded conditions." : `Condition track: ${character.condition}`}</p></DossierPanel>
      <ObjectivePanel campaign={campaign} world={world}/>
      <RelationshipPanel world={world}/>
      <InventoryPanel character={character} world={world}/>
      <FinancialAssetsPanel character={character} world={world}/>
      <CampaignMilestones campaign={campaign}/>
      <DossierPanel title="FACTION STANDING"><p className="empty">No confirmed faction standing recorded.</p></DossierPanel>
    </div>
  </div>;
}

export function DiceResult({ roll }: { roll: RollRecord }) {
  return <article className={`dice-result ${roll.outcome}`}><Shield size={16}/><div><strong>{roll.formula} = {roll.total}</strong><span>{roll.reason} · {roll.outcome}</span></div></article>;
}

export function GMNarrativePanel({ children, scrollRef }: { children: ReactNode; scrollRef: React.RefObject<HTMLDivElement | null> }) {
  return <section className="gm-narrative-panel" aria-label="Game transcript" ref={scrollRef}>{children}</section>;
}

export function ActionInput({ action, busy, testing, onAction, onSubmit, onTest }: { action: string; busy: boolean; testing: boolean; onAction: (value: string) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onTest: () => void }) {
  return <form className="scene-composer action-input" onSubmit={onSubmit}><div><label className="sr-only" htmlFor="player-action">Your intention</label><textarea id="player-action" value={action} onChange={event => onAction(event.target.value)} placeholder="What do you do?" maxLength={4000} rows={2} required/><button className="primary icon-button" aria-label="Save intention for GM review" disabled={busy}><Send size={21}/></button></div><div className="composer-note"><span>Sent intentions await GM review. Gameplay is not enabled yet.</span><button type="button" onClick={onTest} disabled={testing}>{testing ? "Testing…" : "TRY TEST RESPONSE"}</button></div></form>;
}
