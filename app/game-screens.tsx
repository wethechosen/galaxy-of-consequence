"use client";
import { FormEvent, ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Crosshair, Shield, Radio, Send, Search, Wallet, Rocket, House, Plus, LockKeyhole, UserRound, Activity, MessageSquare, Globe, Sparkles } from "lucide-react";
import type { Account, ReviewRequest } from "@/lib/accounts";
import type { CampaignState } from "@/lib/types";
import type { GmProposal } from "@/lib/gm-provider";
import { accountApi } from "@/lib/client-api";
import { ActionInput, DiceResult, GMNarrativePanel } from "./player-components";

type Props = { campaign: CampaignState; navigate: (tab: string) => void; setStatus: (status: string) => void };
function values(event: FormEvent<HTMLFormElement>) { event.preventDefault(); return Object.fromEntries(new FormData(event.currentTarget)); }
const message = (error: unknown) => error instanceof Error ? error.message : "Request failed. Your save is preserved.";
export function DataPanel({ title, meta, children }: { title: string; meta?: string; children: ReactNode }) {
  return <section className="data-panel"><h3>{title}<small>{meta}</small></h3><div className="data-panel-body">{children}</div></section>;
}
function useRequests(campaignId: string) {
  const [requests, setRequests] = useState<ReviewRequest[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const reload = useCallback(async () => { const data = await accountApi(`/api/requests?campaignId=${encodeURIComponent(campaignId)}`); setRequests(data.requests); setError(""); }, [campaignId]);
  useEffect(() => { void reload().catch(e => setError(message(e))); }, [reload]);
  async function submit(category: string, detail: string) {
    if (locked.current) return false;
    locked.current = true; setBusy(true); setError("");
    try { const data = await accountApi("/api/requests", "POST", { campaignId, category, detail }); setRequests(data.requests); return true; }
    catch (e) { setError(message(e)); return false; }
    finally { locked.current = false; setBusy(false); }
  }
  return { requests, error, busy, submit, reload };
}
function RequestHistory({ requests, category }: { requests: ReviewRequest[]; category?: string }) {
  const entries = requests.filter(request => !category || request.category === category);
  return <>{entries.map(request => <article className="request-entry" key={request.id}><div><span className="eyebrow">{request.category}</span><span className={`request-state ${request.status}`}>{request.status}</span></div><p className="preserve-lines">{request.detail}</p>{request.response && <p className="gm-response"><strong>GM review</strong><br/>{request.response}</p>}<small>{new Date(request.createdAt).toLocaleString()}</small></article>)}</>;
}
export function PlayScreen({ campaign, navigate, setStatus }: Props) {
  const { requests, busy, error, submit } = useRequests(campaign.id);
  const [action, setAction] = useState("");
  const [preview, setPreview] = useState<GmProposal | null>(null);
  const [testing, setTesting] = useState(false);
  const transcriptRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const transcript = transcriptRef.current;
    if (transcript) transcript.scrollTo({ top: transcript.scrollHeight, behavior: "smooth" });
  }, [campaign.transcript?.length, campaign.rolls.length, preview, requests.length]);
  async function send(event: FormEvent) { event.preventDefault(); if (await submit("Action", action)) { setAction(""); setStatus("Intention saved for GM review. No game consequences applied."); } }
  async function test() {
    setTesting(true); try { const data = await accountApi("/api/preview", "POST", { action: action || "Look around the current scene" }); setPreview(data.preview); setStatus("Test response generated locally. Campaign unchanged."); }
    catch (e) { setStatus(message(e)); } finally { setTesting(false); }
  }
  return <div className="play-layout">
    <GMNarrativePanel scrollRef={transcriptRef}>
      <div className="scene-heading"><span className="eyebrow"><Radio size={14}/> CAMPAIGN CHANNEL</span><span className="request-state">RULES REVIEW PENDING</span></div>
      <article className="scene-message"><span className="eyebrow">GAME MASTER / ARCHIVE</span><h2>Your story starts here.</h2><p>{campaign.currentScene}</p><p className="muted">Live AI is disabled. You can save intentions for review or test the interface without changing your campaign.</p><button className="text-action" onClick={() => navigate("Character")}>Prepare your character dossier <ArrowRight size={16}/></button></article>
      {campaign.transcript?.map(entry => <article className="scene-message" key={entry.id}><span className="eyebrow">{entry.role}</span><p className="preserve-lines">{entry.text}</p></article>)}
      <RequestHistory requests={requests} category="Action" />
      {preview && <article className="scene-message test-message"><span className="eyebrow">ISOLATED TEST RESPONSE · NOT CAMPAIGN NARRATION</span><p className="preserve-lines">{preview.narration}</p><div className="actions">{preview.suggestions.map(suggestion => <button key={suggestion} onClick={() => setAction(suggestion)}>{suggestion}</button>)}</div></article>}
      {!!campaign.rolls.length && <DataPanel title="VISIBLE DICE RECORD">{campaign.rolls.map(roll => <DiceResult roll={roll} key={roll.id}/>)}</DataPanel>}
      {error && <p role="alert" className="form-error">{error}</p>}
    </GMNarrativePanel>
    <ActionInput action={action} busy={busy} testing={testing} onAction={setAction} onSubmit={send} onTest={() => void test()}/>
  </div>;
}

const catalog = [
  { name: "DL-44 Heavy Blaster Pistol", maker: "BlasTech Industries", category: "Weapons", tags: ["RANGED"], description: "A sidearm reference for your equipment request.", icon: Crosshair },
  { name: "E-11 Blaster Rifle", maker: "BlasTech Industries", category: "Weapons", tags: ["RANGED", "MILITARY"], description: "Request a source-checked rifle entry and local availability.", icon: Crosshair },
  { name: "Vibroblade", maker: "Equipment reference", category: "Weapons", tags: ["MELEE"], description: "A close-combat equipment request. Statistics require review.", icon: Crosshair },
  { name: "Lightsaber", maker: "Provenance unestablished", category: "Weapons", tags: ["FORCE", "RESTRICTED"], description: "Ownership, construction and availability need GM adjudication.", icon: Crosshair },
  { name: "Armor", maker: "Equipment reference", category: "Armor", tags: ["ARMOR"], description: "Specify the model and intended use in your request.", icon: Shield },
  { name: "Field equipment", maker: "Equipment reference", category: "Tech", tags: ["SURVIVAL"], description: "Request tools, supplies or communications equipment.", icon: Shield },
  { name: "Starship", maker: "Vessel registry", category: "Ships", tags: ["TRANSPORT"], description: "Record a vessel request without granting ownership.", icon: Rocket },
  { name: "Property", maker: "Holdings registry", category: "Property", tags: ["HOLDING"], description: "Propose a residence, workspace or business location.", icon: House },
];
function Marketplace({ campaign, setStatus }: Props) {
  const [filter, setFilter] = useState("All"); const [search, setSearch] = useState("");
  const { requests, busy, error, submit } = useRequests(campaign.id);
  const visible = catalog.filter(item => (filter === "All" || item.category === filter) && `${item.name} ${item.maker}`.toLowerCase().includes(search.toLowerCase()));
  return <><div className="category-tabs" aria-label="Marketplace categories">{["All", "Weapons", "Armor", "Tech", "Ships", "Property"].map(category => <button key={category} aria-pressed={filter === category} onClick={() => setFilter(category)}>{category}</button>)}</div>
    <div className="market-toolbar"><label><Search size={18}/><input aria-label="Search marketplace" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search this category…" /></label><small>{visible.length} REFERENCES</small></div>
    <p className="notice">Reference catalog · prices and availability await source review. Requests do not spend credits or grant items.</p>
    <div className="market-grid">{visible.map(item => <article className={`market-card ${item.tags.includes("RESTRICTED") ? "restricted" : ""}`} key={item.name}><div className="market-art"><item.icon size={56} strokeWidth={1.7}/><div>{item.tags.map(tag => <span key={tag}>{tag}</span>)}</div></div><div className="market-details"><h2>{item.name}</h2><small>{item.maker}</small><p>{item.description}</p><div className="market-price"><strong>Quote required</strong><small>UNVERIFIED</small></div><button className="primary" disabled={busy} onClick={() => void submit("Marketplace", `Please review availability, rules and pricing for: ${item.name}.`).then(ok => { if (ok) setStatus(`${item.name}: request saved for GM review.`); })}>REQUEST REVIEW</button></div></article>)}</div>
    {!visible.length && <p className="empty">No matching references. Try another category or search.</p>}{error && <p role="alert">{error}</p>}<details><summary>My marketplace requests</summary><RequestHistory requests={requests} category="Marketplace"/></details></>;
}
function Holdings({ campaign, setStatus, kind }: Props & { kind: "Properties" | "Hangar Bay" }) {
  const { requests, busy, error, submit } = useRequests(campaign.id);
  const assets = campaign.world!.assets.filter(asset => kind === "Hangar Bay" ? asset.kind === "ship" : ["property", "business"].includes(asset.kind));
  return <><DataPanel title={kind.toUpperCase()} meta={`${assets.length} ${kind === "Hangar Bay" ? "VESSELS" : "HOLDINGS"}`}>
    {assets.length ? <div className="table-scroll"><table><thead><tr><th>Name</th><th>Type</th><th>Details</th></tr></thead><tbody>{assets.map(asset => <tr key={asset.id}><td>{asset.name}</td><td>{asset.kind}</td><td>{asset.description}</td></tr>)}</tbody></table></div> : <p className="empty">{kind === "Hangar Bay" ? "Hangar bay is empty." : "No holdings yet — established acquisitions will appear here."}</p>}</DataPanel>
    <DataPanel title="REQUEST AN ENTRY"><form className="entry-form" onSubmit={event => { const data = values(event); const form = event.currentTarget; void submit(kind, `${data.name}\nClass / type: ${data.type}\nLocation: ${data.location}`).then(ok => { if (ok) { form.reset(); setStatus("Entry request saved. Ownership has not changed."); } }); }}><label>{kind === "Hangar Bay" ? "SHIP NAME" : "PROPERTY NAME"}<input name="name" required maxLength={120} placeholder={kind === "Hangar Bay" ? "Ship name" : "Property name"}/></label><label>CLASS / TYPE<input name="type" required maxLength={120} placeholder={kind === "Hangar Bay" ? "Class [YT-1300…]" : "Apartment, warehouse…"}/></label><label>LOCATION<input name="location" required maxLength={200} placeholder={kind === "Hangar Bay" ? "Docked at" : "Location"}/></label><button className="primary" disabled={busy}><Plus size={18}/>REQUEST</button></form><p className="muted">The GM must verify acquisitions before they become campaign assets.</p></DataPanel>
    {error && <p role="alert">{error}</p>}<RequestHistory requests={requests} category={kind}/></>;
}
function BankRequests({ campaign, setStatus }: Props) {
  const { requests, submit, busy, error } = useRequests(campaign.id);
  return <><div className="two-columns"><DataPanel title="RECORDED CREDITS"><Wallet size={22}/><strong className="balance">{campaign.character ? `${campaign.character.credits.toLocaleString()}cr` : "UNASSIGNED"}</strong></DataPanel><DataPanel title="LEDGER AUTHORITY"><p>Only recorded campaign transactions change your balance. No invented income, interest or separate criminal balance.</p></DataPanel></div><DataPanel title="REQUEST AN INVESTMENT OR CORRECTION"><form className="entry-form" onSubmit={event => { const body = values(event); const form = event.currentTarget; void submit("Bank", `${body.name}\nProposed amount: ${body.amount}cr\nTerms: ${body.terms}`).then(ok => { if (ok) { form.reset(); setStatus("Financial request saved. Balance unchanged."); } }); }}><label>ENTRY NAME<input name="name" required maxLength={120} placeholder="Investment or correction"/></label><label>PROPOSED AMOUNT [CR]<input name="amount" type="number" required min={0} max={1000000000} step={1} placeholder="Amount [cr]"/></label><label>TERMS / REASON<input name="terms" required maxLength={2000} placeholder="Explain the proposed entry"/></label><button className="primary" disabled={busy}><Plus size={17}/>REQUEST</button></form></DataPanel>{error && <p role="alert">{error}</p>}<details><summary>Financial review requests</summary><RequestHistory requests={requests} category="Bank"/></details></>;
}
function Profile({ user, onProfile, campaign, navigate, setStatus }: Props & { user: Account; onProfile: (user: Account) => void }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  return <><p className="eyebrow">IDENTITY & ACCESS</p><h2>Account profile</h2><p>Your account identity is separate from the character dossier.</p><div className="two-columns"><DataPanel title="ACCOUNT"><UserRound size={32}/><h3>{user.displayName}</h3><p>{user.username}</p><span className="request-state">{user.role === "admin" ? "ADMINISTRATOR / GM" : "PLAYER ACCOUNT"}</span></DataPanel><DataPanel title="RESPONSIBILITIES"><p>{user.role === "admin" ? "Manage local player accounts and review submitted intentions. Campaign statistics remain governed by verified Saga rules." : "Record your character’s intentions, biography, notes and preferences. Campaign statistics and rewards require validated GM adjudication."}</p><p className="muted">This private terminal uses one shared campaign archive. Accounts are not separate multiplayer worlds.</p></DataPanel></div>
    <DataPanel title="PERSONAL IDENTITY"><form className="stack-form" onSubmit={event => { const data = values(event); setBusy(true); setError(""); void accountApi("/api/auth", "PATCH", data).then(result => { onProfile(result.user); setStatus("Account profile saved."); }).catch(e => setError(message(e))).finally(() => setBusy(false)); }}><label>DISPLAY NAME<input name="displayName" defaultValue={user.displayName} required maxLength={80}/></label><button className="primary" disabled={busy}>SAVE PROFILE</button>{error && <p role="alert">{error}</p>}</form></DataPanel>
    <DataPanel title="LINKED CHARACTER"><h3>{campaign.character?.name ?? campaign.world?.draft?.name ?? "Character pending"}</h3><p>{campaign.character ? `${campaign.character.species} · Level ${campaign.character.level}` : "Draft and source review required"}</p><button onClick={() => navigate("Character")}>OPEN DOSSIER <ArrowRight size={16}/></button>{user.role === "admin" && <button onClick={() => navigate("GM Console")}>OPEN GM CONSOLE <Shield size={16}/></button>}</DataPanel></>;
}
function AdminConsole({ campaign, navigate, setStatus }: Props) {
  const [data, setData] = useState<{ accounts: Account[]; readiness: { ready: boolean; liveAi: boolean; blockers: string[] } } | null>(null);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const { requests, reload } = useRequests(campaign.id);
  const load = useCallback(async () => { setData(await accountApi("/api/admin")); }, []);
  useEffect(() => { void load().catch(e => setError(message(e))); }, [load]);
  async function action(body: object, form: HTMLFormElement) { setBusy(true); setError(""); try { await accountApi("/api/admin", "POST", body); await Promise.all([load(), reload()]); form.reset(); setStatus("GM console update saved."); } catch (e) { setError(message(e)); } finally { setBusy(false); } }
  return <><p className="eyebrow">ADMINISTRATOR / CAMPAIGN CONTROL</p><h2>GM console</h2>{error && <p role="alert" className="form-error">{error}</p>}
    <div className="two-columns"><DataPanel title="ENGINE STATUS"><p><LockKeyhole size={18}/> {data?.readiness.ready ? "Ready" : "Gameplay locked"}</p><p>Live AI: {data?.readiness.liveAi ? "Enabled" : "Disabled — no paid calls"}</p><ul>{data?.readiness.blockers.map(blocker => <li key={blocker}>{blocker}</li>)}</ul></DataPanel><DataPanel title="ARCHIVE TOOLS"><p>Review sources and create a checkpoint before campaign maintenance.</p><div className="actions"><button onClick={() => navigate("Library")}>SOURCE LIBRARY</button><button onClick={() => navigate("Saves")}>SAVE ARCHIVE</button><button onClick={() => navigate("Test console")}>TEST PROVIDER</button></div></DataPanel></div>
    <DataPanel title="REVIEW QUEUE" meta={`${requests.filter(r => r.status === "pending").length} PENDING`}><p className="muted">Responses are review notes only. They do not grant items, move credits, resolve combat or bypass rule verification.</p>{!requests.length && <p className="empty">No requests yet.</p>}{requests.map(request => <article className="request-entry" key={request.id}><span className="eyebrow">{request.category} / {request.status}</span><p>{request.detail}</p>{request.status === "pending" ? <form className="review-form" onSubmit={event => { const body = values(event); void action({ action: "review", id: request.id, ...body }, event.currentTarget); }}><label>GM response<textarea name="response" required maxLength={4000} rows={2}/></label><label>Disposition<select name="status"><option value="answered">Answered — no rule changes</option><option value="declined">Declined</option></select></label><button className="primary" disabled={busy}>SAVE REVIEW</button></form> : <p className="gm-response">{request.response}</p>}</article>)}</DataPanel>
    <DataPanel title="LOCAL ACCOUNTS"><div className="table-scroll"><table><thead><tr><th>Display name</th><th>Username</th><th>Access</th></tr></thead><tbody>{data?.accounts.map(account => <tr key={account.id}><td>{account.displayName}</td><td>{account.username}</td><td>{account.role}</td></tr>)}</tbody></table></div><h3>Create player account</h3><p className="muted">Player accounts can use this same private campaign archive. They cannot enter the GM console or create administrators.</p><form className="entry-form" onSubmit={event => { const body = values(event); void action({ ...body, action: "create_player" }, event.currentTarget); }}><label>DISPLAY NAME<input name="displayName" required maxLength={80} autoComplete="off"/></label><label>USERNAME<input name="username" required minLength={3} maxLength={80} autoComplete="off"/></label><label>INITIAL PASSWORD<input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password"/></label><button className="primary" disabled={busy}>CREATE PLAYER</button></form></DataPanel></>;
}
function Comms({ campaign, setStatus }: Props) {
  const contacts = campaign.world!.contacts; const [selected, setSelected] = useState(contacts[0]?.id ?? "");
  const contact = contacts.find(c => c.id === selected); const { requests, submit, busy, error } = useRequests(campaign.id);
  return <div className="comms-layout"><section className="comms-list"><span className="eyebrow">COMLINKS</span>{contacts.length ? contacts.map(c => <button key={c.id} aria-pressed={selected === c.id} onClick={() => setSelected(c.id)}><MessageSquare size={18}/>{c.name}</button>) : <p>No established comlinks. Contacts appear after verified encounters.</p>}</section><section><p className="eyebrow">ACTIVE CHANNEL</p><h2>{contact?.name ?? "No established comlink"}</h2><p>{contact?.description ?? "A connection must be established during the campaign before you can send a message."}</p>{contact && <form className="stack-form" onSubmit={event => { const body = values(event); const form = event.currentTarget; void submit("Comms", `To ${contact.name}: ${body.text}`).then(ok => { if (ok) { form.reset(); setStatus("Message intention queued for GM review, not delivered to an NPC."); } }); }}><label>MESSAGE INTENTION<textarea name="text" required maxLength={3000}/></label><button className="primary" disabled={busy}>QUEUE FOR REVIEW <Send size={16}/></button></form>}{error && <p role="alert">{error}</p>}<RequestHistory requests={requests} category="Comms"/></section></div>;
}
function Intelligence({ campaign, setStatus, tab }: Props & { tab: "Syndicates" | "Exchanges" }) {
  const [query, setQuery] = useState(""); const [selected, setSelected] = useState(""); const { requests, submit, busy, error } = useRequests(campaign.id);
  const terms = tab === "Syndicates" ? /syndicate|cartel|black sun|mandalorian|corporate sector|guild/i : /exchange|market|bank|trade|credit/i;
  const facts = campaign.loreFacts.filter(fact => terms.test(`${fact.label} ${fact.detail}`) && `${fact.label} ${fact.detail}`.toLowerCase().includes(query.toLowerCase()));
  const fact = facts.find(f => f.id === selected);
  return <><p className="eyebrow">{tab === "Syndicates" ? "UNDERWORLD INTELLIGENCE" : "ECONOMIC INTELLIGENCE"}</p><h2>{tab === "Syndicates" ? "Syndicates & power blocs" : "Galactic exchanges"}</h2><p>Only information established in your campaign appears here. Rumor is not proof.</p><label className="search-field"><Search size={18}/><input aria-label={`Search ${tab}`} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search known information…"/></label><div className="intelligence-list">{facts.map(f => <button key={f.id} aria-pressed={selected === f.id} onClick={() => setSelected(f.id)}>{f.label}</button>)}</div>{fact && <DataPanel title={fact.label}><p>{fact.detail}</p><small>{fact.source}</small></DataPanel>}{!facts.length && <DataPanel title="NO ESTABLISHED RECORDS"><p>No matching campaign intelligence. Unverified stock tickers, balances and faction ratings are not simulated as facts.</p></DataPanel>}<form className="stack-form" onSubmit={event => { const body = values(event); const form = event.currentTarget; void submit(tab === "Exchanges" ? "Bank" : "Syndicates", String(body.detail)).then(ok => { if (ok) { form.reset(); setStatus("Intelligence request saved for review."); } }); }}><label>REQUEST INTELLIGENCE<textarea name="detail" required maxLength={3000} placeholder="What would you like to investigate?"/></label><button className="primary" disabled={busy}>REQUEST GM REVIEW</button></form>{error && <p role="alert">{error}</p>}<RequestHistory requests={requests} category={tab === "Exchanges" ? "Bank" : "Syndicates"}/></>;
}
export default function SupplementalScreens(props: Props & { tab: string; user: Account; onProfile: (user: Account) => void }) {
  const { tab, campaign, user, navigate } = props;
  if (tab === "Marketplace") return <Marketplace {...props}/>;
  if (tab === "Properties" || tab === "Hangar Bay") return <Holdings {...props} kind={tab}/>;
  if (tab === "Profile") return <Profile {...props}/>;
  if (tab === "GM Console") return user.role === "admin" ? <AdminConsole {...props}/> : <p>Administrator access required.</p>;
  if (tab === "Comms") return <Comms {...props}/>;
  if (tab === "Syndicates" || tab === "Exchanges") return <Intelligence {...props} tab={tab}/>;
  if (tab === "Home") return <><p className="eyebrow">HOLONET / PERSONAL TRANSMISSIONS / {campaign.era}</p><h2>The galaxy is waiting.</h2><p>Your campaign transmissions, recorded developments and discoveries arrive here.</p><DataPanel title="CURRENT POSITION"><h3>{campaign.character?.name ?? campaign.world?.draft?.name ?? user.displayName}</h3><p>{campaign.currentLocation}</p><button className="primary" onClick={() => navigate("Scene")}><Radio size={17}/>RETURN TO PLAY</button></DataPanel><div className="two-columns"><DataPanel title="CAMPAIGN WIRE"><Activity size={24}/>{campaign.events.length ? campaign.events.slice(0, 5).map(event => <article className="news-entry" key={event.id}><p>{event.summary}</p><small>{new Date(event.createdAt).toLocaleString()}</small></article>) : <p>No recorded developments yet.</p>}</DataPanel><DataPanel title="KNOWN GALAXY"><Globe size={24}/><p>{campaign.loreFacts.length} lore records · {campaign.world!.contacts.length} established contacts</p><div className="actions"><button onClick={() => navigate("Atlas")}>OPEN GALAXY MAP</button><button onClick={() => navigate("Codex")}>BROWSE CODEX</button></div></DataPanel></div></>;
  if (tab === "Character") return <div className="portrait-grid">{["FULL-BODY PORTRAIT", "HEADSHOT PORTRAIT"].map(label => <div className="portrait-slot" key={label}><Sparkles size={30}/><strong>{label}</strong><p>Portrait not attached.</p></div>)}</div>;
  if (tab === "Economy") return <BankRequests {...props}/>;
  return null;
}
