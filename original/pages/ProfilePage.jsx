import { useAuth } from "@/original/lib/AuthContext";
import { useGame } from "@/original/lib/GameContext";
import { Shell, GlassCard } from "@/original/components/GalaxyUI";
import { TopBar } from "@/original/components/GalaxyUI";
import { Link } from "react-router-dom";

export default function ProfilePage() {
  const { user } = useAuth();
  const { character, gameState } = useGame();
  const isAdmin = user?.role === "admin";

  return (
    <Shell>
      <TopBar />
      <main className="gc-page-scroll flex-1 min-h-0 overflow-y-auto p-6 max-w-4xl mx-auto w-full">
        <p className="text-[10px] tracking-[0.2em] mb-2" style={{ color: "var(--sig)" }}>IDENTITY & ACCESS</p>
        <h1 className="gc-display text-3xl font-bold text-[#f2f0ea]">ACCOUNT PROFILE</h1>
        <p className="text-sm text-[#8b93a3] mt-2">This profile is separate from the campaign ledger and is scoped to the signed-in account.</p>

        <div className="grid gap-4 md:grid-cols-2 mt-6">
          <GlassCard className="p-5">
            <p className="text-[10px] tracking-widest text-[#8b93a3]">ACCOUNT</p>
            <p className="text-lg text-[#f2f0ea] mt-3">{user?.email}</p>
            <p className="text-xs text-[#22e5c5] mt-2">{isAdmin ? "GAME MASTER / OPERATOR" : "PLAYER ACCOUNT"}</p>
          </GlassCard>
          <GlassCard className="p-5">
            <p className="text-[10px] tracking-widest text-[#8b93a3]">RESPONSIBILITIES</p>
            {isAdmin ? (
              <p className="text-sm leading-relaxed text-[#c7c4bc] mt-3">Control the world ledger, directives, source references, progression, and campaign continuity. Choose a campaign account above to inspect its dossier or run a test turn.</p>
            ) : (
              <p className="text-sm leading-relaxed text-[#c7c4bc] mt-3">Control your character&apos;s choices, dialogue, preferences, communications, and earned relationships. Character statistics, rewards, and progression remain GM-managed.</p>
            )}
          </GlassCard>
        </div>

        {(
          <GlassCard className="p-5 mt-4">
            <p className="text-[10px] tracking-widest text-[#8b93a3]">PLAYER DOSSIER</p>
            <p className="text-xl text-[#f2f0ea] mt-3">{character?.name || "No character created"}</p>
            <p className="text-sm text-[#a9adb8] mt-2">{character ? `Level ${character.level || 1} · ${gameState.location}` : "Open Play to begin character creation."}</p>
            <Link to="/player" className="gc-btn inline-flex mt-4 px-4 py-2 text-xs">{character ? "CONTINUE PLAY" : "OPEN CHARACTER CREATION"}</Link>
          </GlassCard>
        )}
      </main>
    </Shell>
  );
}
