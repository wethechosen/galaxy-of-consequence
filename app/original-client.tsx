"use client";
import dynamic from "next/dynamic";
function DatapadConnection() {
  return <main className="original-game fixed inset-0 flex items-center justify-center px-6" style={{ background: "radial-gradient(circle at 80% 85%, rgba(34,211,238,.12), transparent 38%), radial-gradient(circle at 20% 5%, rgba(255,122,26,.12), transparent 36%), #07060b", color: "#e7e5df" }}><div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[.025] px-7 py-8 text-center"><p className="mb-3 text-[10px] tracking-[0.28em] text-[#22d3ee]">SECURE DATAPAD LINK</p><h1 className="text-xl font-bold tracking-wide">CONNECTING TO YOUR CAMPAIGN</h1><div className="mx-auto mt-5 h-1.5 max-w-xs overflow-hidden rounded-full bg-white/[.07]"><div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-[#22d3ee] to-[#a78bfa]" /></div><p className="mt-4 text-xs text-[#8b93a3]">Opening the latest confirmed record…</p></div></main>;
}
const OriginalApp = dynamic(() => import("@/original/App"), { ssr: false, loading: DatapadConnection });
export default OriginalApp;
