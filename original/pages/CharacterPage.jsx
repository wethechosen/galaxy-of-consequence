import { Link } from "react-router-dom";
import { BookOpen, Eye, Home as HomeIcon, Shield, Sparkles } from "lucide-react";
import { useGame } from "@/original/lib/GameContext";
import { Shell, TopBar, GlassCard, EmptyNote, HudRow } from "@/original/components/GalaxyUI";

function Portrait({ src, label, character }) {
  return (
    <div className="relative overflow-hidden rounded-2xl min-h-64 flex items-end" style={{ background: src ? `center / cover url("${src}")` : "radial-gradient(circle at 50% 25%, rgba(255,122,26,.35), transparent 25%), linear-gradient(145deg, #20202c, #090a10 70%)", border: "1px solid rgba(255,255,255,.1)" }}>
      {!src && <div className="absolute inset-0 flex items-center justify-center text-center p-6"><div><Sparkles className="mx-auto mb-3 text-[#ff7a1a]" size={28} /><p className="text-[10px] tracking-widest text-[#f2f0ea]">GM-GENERATED {label.toUpperCase()}</p><p className="text-xs text-[#8b93a3] mt-2">Portrait pending campaign generation or GM attachment.</p></div></div>}
      <div className="relative w-full px-4 py-3 bg-black/60"><p className="text-[9px] tracking-[0.2em] text-[#ff7a1a]">{label.toUpperCase()}</p><p className="text-sm text-[#f2f0ea]">{character.name || "Unnamed character"}</p></div>
    </div>
  );
}

export default function CharacterPage() {
  const { character, gameState } = useGame();
  if (!character) return <Shell><TopBar character={null} gameState={gameState} /><div className="m-3 gc-glass rounded-2xl flex-1"><EmptyNote text="NO CHARACTER DOSSIER ON FILE. CREATE YOUR CHARACTER FROM PLAY." /></div></Shell>;
  const decisions = Array.isArray(gameState.flags) ? gameState.flags.slice(-12).reverse() : [];
  const inventory = Array.isArray(gameState.inventory) ? gameState.inventory.filter((item) => item?.name && Number(item.qty) > 0) : [];
  const objectives = Array.isArray(gameState.objectives) ? gameState.objectives : [];
  const relationships = Array.isArray(gameState.relationships) ? gameState.relationships : [];
  const discoveries = Array.isArray(gameState.discoveries) ? gameState.discoveries.slice(-8).reverse() : [];
  const milestones = Array.isArray(gameState.milestones) ? gameState.milestones.slice(-8).reverse() : [];
  const legacyAssets = Array.isArray(gameState.legacyAssets) ? gameState.legacyAssets : [];
  const conditions = Array.isArray(gameState.conditions) ? gameState.conditions : [];
  const storyDirectives = Array.isArray(gameState.storyDirectives) ? gameState.storyDirectives : [];
  const level = Math.max(1, Number(character.level) || 1);
  const nextLevelXp = level >= 20 ? null : (1000 * level * (level + 1)) / 2;
  return (
    <Shell>
      <TopBar character={character} gameState={gameState} />
      <main className="flex-1 overflow-y-auto m-3 gc-glass rounded-2xl p-6">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6"><div><p className="text-[10px] tracking-[0.2em] text-[#ff7a1a] mb-2">PLAYER CHARACTER DOSSIER</p><h1 className="gc-display text-3xl font-bold text-[#f2f0ea]">{character.name}</h1><p className="text-sm text-[#8b93a3] mt-1">{character.species} · {character.homeworld}</p></div><Link to="/hud" className="gc-btn px-3 py-2 text-xs flex items-center gap-2"><Eye size={14} /> OPEN HUD</Link></div>
        <div className="grid gap-4 md:grid-cols-2 mb-6"><Portrait src={character.imageFullBody} label="Full-body portrait" character={character} /><Portrait src={character.imageHeadshot} label="Headshot portrait" character={character} /></div>
        <div className="grid gap-4 lg:grid-cols-2">
          <GlassCard className="p-5"><p className="text-[10px] tracking-[0.2em] text-[#ff7a1a] mb-3">BIOGRAPHY & IDENTITY</p><HudRow label="Background" value={character.background} /><HudRow label="Allegiance" value={character.allegiance} /><HudRow label="Force Sensitive" value={character.forceSensitive} /><HudRow label="Appearance" value={character.appearance} /><HudRow label="Personal Goal" value={character.goal} /><HudRow label="Contacts / Enemies" value={character.contacts} /></GlassCard>
          <GlassCard className="p-5"><p className="text-[10px] tracking-[0.2em] text-[#ff7a1a] mb-3">SAGA EDITION STAT BLOCK</p><HudRow label="Character Level" value={character.level} /><HudRow label="Experience Points" value={character.experience} /><HudRow label="Saga Statistics" value={character.sagaStats} /><HudRow label="Talents" value={character.talents} /><HudRow label="Feats" value={character.feats} /><HudRow label="Force Powers" value={character.forcePowers} /><HudRow label="Force Points" value={gameState.forcePoints ?? "Unestablished"} /><HudRow label="Destiny Points" value={gameState.destinyPoints ?? "Unestablished"} /><HudRow label="Dark Side Score" value={gameState.darkSideScore ?? 0} /><HudRow label="Condition Track" value={`${gameState.conditionTrack || 0}/5`} /><HudRow label="Upgrades" value={character.upgrades} />{gameState.levelUpAvailable && <p className="mt-3 rounded-lg border border-[#22e5c5]/40 bg-[#22e5c5]/10 p-3 text-xs text-[#8fffea]">LEVEL-UP AVAILABLE — choose class, feats, talents, ability increases, and Force options through player advancement.</p>}</GlassCard>
        </div>
        <GlassCard className="p-5 mt-4"><p className="text-[10px] tracking-[0.2em] text-[#ff7a1a] mb-3">EQUIPMENT & CURRENT STATUS</p><div className="grid gap-3 md:grid-cols-2"><HudRow label="Primary Weapon" value={character.equipPrimary} /><HudRow label="Secondary Weapon" value={character.equipSecondary} /><HudRow label="Armor / Clothing" value={character.equipArmor} /><HudRow label="Special Items" value={character.equipSpecial} /><HudRow label="Current Location" value={gameState.location} /><HudRow label="Hit Points" value={`${gameState.health}/100`} /></div>{conditions.length > 0 && <div className="mt-4"><p className="text-[9px] tracking-[0.18em] text-[#8b93a3] mb-2">ACTIVE INJURIES & CONDITIONS</p><ul className="space-y-1 text-sm text-[#d7d4cc]">{conditions.map((condition) => <li key={condition.id || condition.name}>{condition.name}{condition.severity ? ` · ${condition.severity}` : ""}{condition.note ? ` — ${condition.note}` : ""}</li>)}</ul></div>}</GlassCard>
        <div className="grid gap-4 lg:grid-cols-2 mt-4">
          <GlassCard className="p-5">
            <p className="text-[10px] tracking-[0.2em] text-[#ff7a1a] mb-3">LIVE CAMPAIGN LEDGER</p>
            <HudRow label="Standard Credits" value={`${Number(gameState.credits || 0).toLocaleString()} cr`} />
            <HudRow label="Underworld Credits" value={`${Number(gameState.creditsCriminal || 0).toLocaleString()} cr`} />
            <HudRow label="Experience" value={`${Number(character.experience || 0).toLocaleString()} XP`} />
            <HudRow label="Next Level" value={nextLevelXp == null ? "Maximum level" : `${nextLevelXp.toLocaleString()} XP`} />
            <div className="mt-4"><p className="text-[9px] tracking-[0.18em] text-[#8b93a3] mb-2">CURRENT INVENTORY</p>{inventory.length ? <ul className="space-y-1 text-sm text-[#d7d4cc]">{inventory.map((item) => <li key={item.id || item.name}>{item.name} ×{item.qty}</li>)}</ul> : <p className="text-sm text-[#5c6370]">No carried items recorded.</p>}</div>
          </GlassCard>
          <GlassCard className="p-5">
            <p className="text-[10px] tracking-[0.2em] text-[#ff7a1a] mb-3">MAJOR DECISIONS & STORY PROGRESS</p>
            {decisions.length ? <ol className="space-y-3 text-sm text-[#d7d4cc]">{decisions.map((entry, index) => <li key={`${entry.ts || index}-${index}`} className="border-b border-white/5 pb-3 last:border-0"><p>{entry.note}</p>{entry.ts && <p className="text-[9px] tracking-widest text-[#5c6370] mt-1">{new Date(entry.ts).toLocaleString()}</p>}</li>)}</ol> : <p className="text-sm text-[#5c6370]">No major campaign decisions recorded yet.</p>}
          </GlassCard>
        </div>
        <div className="grid gap-4 lg:grid-cols-2 mt-4">
          <GlassCard className="p-5">
            <p className="text-[10px] tracking-[0.2em] text-[#ff7a1a] mb-3">OBJECTIVES</p>
            {objectives.length ? <div className="space-y-3">{objectives.map((objective) => <div key={objective.id || objective.title} className="border-b border-white/5 pb-3 last:border-0"><p className="text-sm text-[#f2f0ea]">{objective.title}</p><p className="text-[10px] tracking-widest uppercase mt-1" style={{ color: objective.status === "completed" ? "#22e5c5" : objective.status === "future" ? "#8b93a3" : "#ff7a1a" }}>{objective.status || "active"}</p>{objective.detail && <p className="text-xs text-[#8b93a3] mt-1">{objective.detail}</p>}</div>)}</div> : <p className="text-sm text-[#5c6370]">No campaign objectives recorded.</p>}
          </GlassCard>
          <GlassCard className="p-5">
            <p className="text-[10px] tracking-[0.2em] text-[#ff7a1a] mb-3">RELATIONSHIPS & DISCOVERIES</p>
            {relationships.length ? <div className="space-y-2">{relationships.map((relationship) => <div key={relationship.id || relationship.name}><p className="text-sm text-[#f2f0ea]">{relationship.name} <span className="text-[#8b93a3]">· {relationship.disposition || relationship.status || "established"}</span></p>{relationship.note && <p className="text-xs text-[#8b93a3]">{relationship.note}</p>}</div>)}</div> : <p className="text-sm text-[#5c6370]">No structured relationships recorded.</p>}
            {discoveries.length > 0 && <div className="mt-4 border-t border-white/5 pt-3"><p className="text-[9px] tracking-[0.18em] text-[#8b93a3] mb-2">CONFIRMED DISCOVERIES</p>{discoveries.map((discovery) => <p key={discovery.id || discovery.title} className="text-xs text-[#d7d4cc] mb-2"><strong>{discovery.title}</strong>{discovery.detail ? ` — ${discovery.detail}` : ""}</p>)}</div>}
          </GlassCard>
        </div>
        <GlassCard className="p-5 mt-4">
          <p className="text-[10px] tracking-[0.2em] text-[#a855f7] mb-3">D'MIR STORY DIRECTION</p>
          <p className="text-xs text-[#8b93a3] mb-4">Creator direction shapes future opportunities. Creating one grants nothing automatically; completing it through Saga gameplay awards and persists normal XP, rewards, and advancement.</p>
          {storyDirectives.length ? <div className="space-y-3">{storyDirectives.map((directive) => <div key={directive.id || directive.title} className="rounded-xl border border-[#a855f7]/20 bg-[#a855f7]/5 p-4"><div className="flex justify-between gap-3"><p className="text-sm text-[#f2f0ea]">{directive.title}</p><span className="text-[9px] tracking-widest uppercase text-[#c084fc]">{directive.status || "active"}</span></div>{directive.detail && <p className="text-xs text-[#a9adb8] mt-2">{directive.detail}</p>}</div>)}</div> : <p className="text-sm text-[#5c6370]">No creator-directed arc has been recorded through play yet.</p>}
        </GlassCard>
        <GlassCard className="p-5 mt-4">
          <p className="text-[10px] tracking-[0.2em] text-[#ff7a1a] mb-3">KELVEK LEGACY & FINANCIAL CLAIMS</p>
          <p className="text-xs text-[#8b93a3] mb-4">Liquid credits remain separate. Suspected, inaccessible, and confirmed assets do not enter D'mir's spendable balance until control and transfer are established in play.</p>
          {legacyAssets.length ? <div className="grid gap-3 md:grid-cols-2">{legacyAssets.map((asset) => <div key={asset.id || asset.name} className="rounded-xl border border-white/10 bg-white/[.03] p-4"><div className="flex justify-between gap-3"><p className="text-sm text-[#f2f0ea]">{asset.name}</p><span className="text-[9px] tracking-widest uppercase text-[#ff7a1a]">{asset.status || "suspected"}</span></div><p className="text-xs text-[#8b93a3] mt-2">{asset.category || "financial interest"}{asset.estimatedValue != null ? ` · estimated ${Number(asset.estimatedValue).toLocaleString()} cr` : ""}</p>{asset.accessRequirements && <p className="text-xs text-[#d7d4cc] mt-2">Access: {asset.accessRequirements}</p>}</div>)}</div> : <p className="text-sm text-[#5c6370]">No legacy assets confirmed or suspected.</p>}
          {milestones.length > 0 && <div className="mt-5 border-t border-white/5 pt-4"><p className="text-[9px] tracking-[0.18em] text-[#8b93a3] mb-2">STORY MILESTONES</p>{milestones.map((milestone) => <p key={milestone.id || milestone.title} className="text-xs text-[#d7d4cc] mb-2"><strong>{milestone.title}</strong>{milestone.detail ? ` — ${milestone.detail}` : ""}</p>)}</div>}
        </GlassCard>
      </main>
    </Shell>
  );
}
