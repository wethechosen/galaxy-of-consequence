"use client";
import { FormEvent, useEffect, useState } from "react";
import { Fingerprint, LockKeyhole, Radio, ArrowRight, ShieldCheck } from "lucide-react";
import type { Account } from "@/lib/accounts";
import Datapad from "./datapad";
import { accountApi } from "@/lib/client-api";
export default function AccountGate() {
  const [user, setUser] = useState<Account | null>(null);
  const [setup, setSetup] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function load() {
    try { const data = await accountApi("/api/auth"); setUser(data.user); setSetup(data.setupRequired); setLoaded(true); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Connection failed."); }
  }
  useEffect(() => { void load(); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const values = Object.fromEntries(new FormData(event.currentTarget)); setBusy(true); setError("");
    try { const data = await accountApi("/api/auth", "POST", { ...values, action: setup ? "setup" : "login" }); setUser(data.user); setSetup(false); }
    catch (e) { const message = e instanceof Error ? e.message : "Sign-in failed."; setError(message); if (message.includes("Owner already exists")) setSetup(false); }
    finally { setBusy(false); }
  }
  if (user) return <Datapad user={user} onProfile={setUser} onLogout={async () => { await accountApi("/api/auth", "POST", { action: "logout" }); setUser(null); }} />;
  return <main className="access-screen">
    <header className="access-brand"><Radio size={20} /><span>GALAXY OF CONSEQUENCE</span><small>150 ABY / CAMPAIGN COMLINK</small></header>
    <section className="access-card glass">
      <div className="access-mark"><Fingerprint size={48} strokeWidth={1.25} /></div>
      <p className="eyebrow">IDENTITY & ACCESS</p>
      <h1>{!loaded ? "Establishing uplink" : setup ? "Initialize your datapad" : "Welcome back"}</h1>
      <p className="access-intro">{setup ? "Create the owner account for this private campaign terminal. Your existing archive stays intact." : "Authenticate to access your character, campaign archive and personal datapad."}</p>
      {loaded && <form className="stack-form" onSubmit={submit}>
        {setup && <label>DISPLAY NAME<input name="displayName" autoComplete="nickname" required maxLength={80} placeholder="Your callsign" /></label>}
        <label>USERNAME<input name="username" autoComplete="username" minLength={3} maxLength={80} pattern="[a-zA-Z0-9_.@\-]+" required placeholder="Terminal identity" /></label>
        <label>PASSWORD<input name="password" type="password" autoComplete={setup ? "new-password" : "current-password"} required minLength={setup ? 12 : undefined} maxLength={128} placeholder={setup ? "At least 12 characters" : "Enter your password"} /></label>
        <button className="primary" disabled={busy}>{busy ? "Authenticating…" : setup ? "CREATE OWNER ACCOUNT" : "ACCESS DATAPAD"}<ArrowRight size={17} /></button>
      </form>}
      {error && <p role="alert" className="form-error">{error}</p>}
      <a href="/login">Sign in</a> · <a href="/">HoloNet home</a>
      {!loaded && error && <button onClick={() => void load()}>Retry connection</button>}
      <div className="access-security"><LockKeyhole size={15} /><span>LOCAL SAVES · PRIVATE SESSION · LIVE AI OFF</span></div>
      <p className="access-footnote"><ShieldCheck size={16} />{setup ? "The first account is the administrator. Additional player accounts are created in the GM console." : "D'mir — PLAYER is the account you use to play the story. GM Operator — ADMIN is for campaign administration and is separate from D'mir's character."}</p>
    </section>
    <footer>SAGA EDITION / A GALAXY SHAPED BY YOUR CHOICES</footer>
  </main>;
}
