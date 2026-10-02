"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function RecoverPage() {
  const router = useRouter();
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const data = new FormData(event.currentTarget), password = String(data.get("password") || ""), confirm = String(data.get("confirm") || "");
    if (password !== confirm) { setError("The passwords do not match."); setBusy(false); return; }
    const token = new URL(window.location.href).searchParams.get("token") || "";
    const response = await fetch("/api/auth/recover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
    const result = await response.json();
    if (!response.ok) { setError(result.error || "Password recovery failed."); setBusy(false); return; }
    router.replace("/player");
  }
  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"radial-gradient(circle at 20% 10%,#32190e,#05070d 55%)",color:"#f2f0ea",fontFamily:"sans-serif"}}>
    <form onSubmit={submit} style={{width:"min(92vw,520px)",padding:40,border:"1px solid #164e63",borderRadius:28,background:"rgba(12,13,22,.96)",boxShadow:"0 24px 80px rgba(0,0,0,.5)"}}>
      <p style={{color:"#ff7a24",letterSpacing:3,fontSize:12}}>LOCAL DATAPAD RECOVERY</p><h1 style={{fontSize:32,margin:"12px 0"}}>Set a new access code</h1>
      <p style={{color:"#a9adb8",lineHeight:1.6}}>This one-time link preserves the existing account and campaign. It expires after one hour.</p>
      {error && <p role="alert" style={{padding:14,borderRadius:12,background:"#3a1720",color:"#ff9aa7"}}>{error}</p>}
      <label style={{display:"grid",gap:8,marginTop:24,fontSize:12,letterSpacing:1}}>NEW PASSWORD<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required style={{padding:15,borderRadius:12,border:"1px solid #334155",background:"#10131d",color:"white"}} /></label>
      <label style={{display:"grid",gap:8,marginTop:18,fontSize:12,letterSpacing:1}}>CONFIRM PASSWORD<input name="confirm" type="password" autoComplete="new-password" minLength={12} maxLength={128} required style={{padding:15,borderRadius:12,border:"1px solid #334155",background:"#10131d",color:"white"}} /></label>
      <button disabled={busy} style={{width:"100%",marginTop:24,padding:16,border:0,borderRadius:12,background:"linear-gradient(90deg,#ff7a24,#ff426f)",fontWeight:800,cursor:"pointer"}}>{busy ? "RESETTING…" : "RESET PASSWORD & CONTINUE"}</button>
    </form>
  </main>;
}
