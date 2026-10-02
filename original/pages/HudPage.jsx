import { Link } from "react-router-dom";
import { Eye, EyeOff, Home as HomeIcon } from "lucide-react";
import { useGame } from "@/original/lib/GameContext";
import { Shell, TopBar, EmptyNote } from "@/original/components/GalaxyUI";

export default function HudPage() {
  const { character, gameState, settings, toggleHud } = useGame();
  return <Shell>
    <TopBar character={character} gameState={gameState} />
    <main className="gc-page-scroll relative flex-1 min-h-0 overflow-y-auto m-3 gc-glass rounded-2xl p-6">
      <div className="flex flex-wrap gap-3 items-center justify-between max-w-2xl"><div><p className="text-[10px] tracking-[0.2em] text-[#ff7a1a] mb-2">DATAPAD HUD</p><h1 className="gc-display text-2xl font-bold text-[#f2f0ea]">Status overlay</h1><p className="text-sm text-[#8b93a3] mt-1">The HUD follows you across the application. Click anywhere outside it to dismiss it.</p></div><button data-gc-hud-toggle onClick={toggleHud} disabled={!character} className="gc-btn px-3 py-2 text-xs flex items-center gap-2 disabled:opacity-40">{settings.hudVisible ? <EyeOff size={14} /> : <Eye size={14} />}{settings.hudVisible ? "HIDE HUD" : "SHOW HUD"}</button></div>
      <EmptyNote text={character ? (settings.hudVisible ? "HUD ACTIVE. It is visible in the upper-right corner." : "HUD HIDDEN. USE THE TOGGLE TO DISPLAY YOUR DATAPAD STATUS.") : "NO CHARACTER ON FILE."} />
    </main>
  </Shell>;
}
