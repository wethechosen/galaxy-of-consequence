import { Wallet, Skull, MapPin, X } from "lucide-react";
import { alignmentBand } from "@/original/lib/galaxy";

function MiniMeter({ label, value, color }) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div>
      <div className="flex justify-between text-[9px] tracking-widest mb-1">
        <span className="text-[#8b93a3]">{label.toUpperCase()}</span>
        <span className="text-[#f2f0ea]">{safeValue}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.07)" }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${safeValue}%`, backgroundColor: color, boxShadow: `0 0 6px ${color}` }} />
      </div>
    </div>
  );
}

export function HudOverlay({ character, gameState, onClose }) {
  const band = alignmentBand(gameState.forceAlignment);
  const accent = band === "Dark" ? "#e23b3b" : band === "Light" ? "#4fd8e8" : "#ff7a1a";
  return (
    <div className="fixed top-[68px] right-4 z-40 w-72 gc-glass-tight rounded-2xl p-4" style={{ "--gc-accent": accent, boxShadow: "0 16px 48px rgba(0,0,0,0.6)" }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] tracking-[0.2em]" style={{ color: accent }}>HUD OVERLAY</span>
        <button type="button" onClick={onClose} aria-label="Close HUD overlay" className="text-[#5c6370] hover:text-[#f2f0ea] transition-colors"><X size={14} /></button>
      </div>
      <div className="flex items-center gap-2 mb-3 text-sm">
        <span className="text-[#f2f0ea] font-semibold">{character?.name || "UNNAMED"}</span>
        <span className="text-[9px] tracking-widest px-1.5 py-0.5 rounded-full" style={{ border: `1px solid ${accent}`, color: accent }}>{band.toUpperCase()}</span>
      </div>
      <div className="space-y-2 mb-3">
        <MiniMeter label="Hit Points" value={gameState.health} color="#4fd8e8" />
        <MiniMeter label="Notoriety" value={gameState.notoriety} color="#e23b3b" />
        <MiniMeter label="Force" value={gameState.forceAlignment} color={accent} />
      </div>
      <div className="grid grid-cols-2 gap-2 text-[11px] mb-2">
        <div className="flex items-center gap-1.5"><Wallet size={12} style={{ color: "#22e5c5" }} /><span className="text-[#a9adb8]">{gameState.credits.toLocaleString()}cr</span></div>
        <div className="flex items-center gap-1.5"><Skull size={12} style={{ color: "#e23b3b" }} /><span className="text-[#a9adb8]">{gameState.creditsCriminal.toLocaleString()}cr</span></div>
      </div>
      <div className="flex items-center gap-1.5 text-[11px] text-[#a9adb8] pt-2" style={{ borderTop: "1px solid rgba(255,255,255,.06)" }}>
        <MapPin size={12} style={{ color: accent }} /> {gameState.location}
      </div>
    </div>
  );
}
