import { useEffect, useMemo, useState } from "react";
import { UsersRound, Search } from "lucide-react";
import { useGame } from "@/original/lib/GameContext";
import { Shell, TopBar, GlassCard } from "@/original/components/GalaxyUI";
import NpcVisualCard from "@/original/components/NpcVisualCard";
import NpcFullBodyCard from "@/original/components/NpcFullBodyCard";
export default function NpcsPage() {
  const { character, gameState } = useGame();
  const [roster, setRoster] = useState([]);
  const [query, setQuery] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/npcs", {signal:controller.signal}).then(r => {
      if (!r.ok) throw Error("NPC dossier service unavailable");
      return r.json();
    }).then(data => setRoster(data.canonicalRegistry || data.roster || [])).catch(() => {});
    return () => controller.abort();
  }, []);
  const [group, setGroup] = useState("all");
  const [selected, setSelected] = useState(null);
  const shown = useMemo(() => roster.filter(item =>
    (group === "all" || item.category === group) &&
    [item.name,item.species,item.homeworld,item.designation,item.faction].some(value => String(value || "").toLowerCase().includes(query.toLowerCase()))
  ), [query,group,roster]);

  return <Shell>
    <TopBar character={character} gameState={gameState} />
    <main className="flex-1 min-h-0 overflow-y-auto m-3 gc-glass rounded-2xl p-6">
      <p className="text-[10px] tracking-[0.2em] text-[#ff9b50] mb-2">GALACTIC PERSONNEL INDEX · 150 ABY</p>
      <h1 className="gc-display text-3xl font-bold text-[#f2f0ea]">NPC DOSSIERS</h1>
      <p className="mt-2 text-sm max-w-4xl text-[#a9adb8]">Private GM dossiers for the 150 ABY cast, isolated NPC simulation cases, and D'mir's story. All NPCs remain AI GM-controlled, never playable accounts. Hidden plots and unverified encounters remain confidential.</p>
      <div className="flex flex-wrap gap-3 mt-5 mb-6">
        <span className="rounded-lg bg-white/[.035] px-3 py-2 text-xs border border-white/10 text-[#e8e7e2]">{roster.length} DOSSIERS</span>
        <span className="rounded-lg bg-white/[.035] px-3 py-2 text-xs border border-white/10 text-[#a9adb8]">{roster.filter(n => n.auditedEnding?.status === "goal_complete").length} AUDITED LOCAL ENDING(S)</span>
        <span className="rounded-lg bg-white/[.035] px-3 py-2 text-xs border border-white/10 text-[#a9adb8]">GM CONTROLLED</span>
      </div>
      <div className="flex flex-wrap gap-3 items-center mb-5">
        <label className="relative flex-1 min-w-[210px] max-w-xl"><Search size={15} className="absolute left-3 top-3 text-[#8b93a3]" /><input aria-label="Search NPC roster" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search name, species, world, affiliation..." className="gc-input w-full pl-9 pr-3 py-2.5 text-sm" /></label>
        <select aria-label="Filter NPC type" className="gc-input px-3 py-2.5 text-sm" value={group} onChange={event=>setGroup(event.target.value)}>
          <option value="all">All characters</option>
          <option value="test">GM simulation scenarios</option>
          <option value="cast">Supplement cast</option>
          <option value="story">Dmir storyline</option>
          <option value="family">Documented family</option>
          <option value="sourcebook">Sourcebook candidates</option>
        </select>
      </div>
      {selected && <GlassCard className="p-5 mb-5">
        <div className="flex justify-between items-start gap-4">
          <div><p className="text-[10px] tracking-[.2em] text-[#ff9b50]">DOSSIER · NOT A GAMEPLAY RECEIPT</p><h2 className="gc-display mt-2 text-xl text-[#f2f0ea]">{selected.name}</h2></div>
          <button className="gc-btn px-3 py-1.5 text-xs" onClick={()=>setSelected(null)}>CLOSE</button>
        </div>
        <div className="mt-3 text-xs text-[#8b93a3]">{selected.species} · {selected.homeworld} · {selected.era} ABY · {selected.faction || "Unaffiliated"} · {selected.lifeStatus || "Unconfirmed status"}</div>
        <p className="mt-3 text-sm text-[#d2d0cc]">{selected.definitiveDossier?.biography || selected.description}</p>
        {selected.definitiveDossier && <div className="mt-4 rounded-xl border border-white/10 p-4 text-sm text-[#d2d0cc]" aria-label="Complete private 150 ABY character history">
          <h3 className="font-semibold text-[#21dfc8]">LIFE RECORD · {selected.definitiveDossier.birthplace} · BORN {selected.definitiveDossier.bornABY} ABY</h3>
          <p className="mt-2">Age in 150 ABY: {selected.definitiveDossier.ageIn150} · {selected.definitiveDossier.worldPresence}</p>
          <p className="mt-2"><strong>Appearance:</strong> {selected.definitiveDossier.appearance}</p>
          <p className="mt-2"><strong>Personality:</strong> {selected.definitiveDossier.personality}</p>
          <p className="mt-2"><strong>Weakness:</strong> {selected.definitiveDossier.flaw}</p>
          <p className="mt-2"><strong>Relationships:</strong> {selected.definitiveDossier.importantRelationships}</p>
          <p className="mt-2"><strong>Autonomous objective:</strong> {selected.definitiveDossier.objective}</p>
          <details className="mt-3"><summary className="cursor-pointer text-[#e9a873]">GM-only secrets and sources</summary>
            <p className="mt-2">{selected.definitiveDossier.gmPrivateKnowledge || "No established undisclosed information."}</p>
            <p className="mt-2 text-xs">{selected.definitiveDossier.canonProvenance}</p>
          </details>
        </div>}
        <p className="mt-3 text-xs text-[#a9adb8]">Prior-career XP and GM loadouts are baselines, not player-earned rewards or committed inventories.</p>
        <section className="mt-4 border-t border-white/10 pt-4" aria-label="NPC mechanics">
          <h3 className="text-sm text-[#21dfc8]">{selected.definitiveDossier ? "COMPLETE 150 ABY SAGA CAREER SHEET · GM PRIVATE" : selected.mechanics?.status === "validated-core-build" ? "VALIDATED SAGA CORE BUILD" : selected.mechanics?.status === "authored-saga-sheet" ? "AUTHORED SAGA SHEET · NOT YET ENGINE-CERTIFIED" : "MECHANICS PENDING VALIDATION"}</h3>
          {selected.definitiveDossier && <div className="mt-3 rounded-xl border border-white/10 p-4 text-sm" aria-label="Saga Edition definitive NPC abilities and inventory plan">
            <p><strong>Classes:</strong> {Object.entries(selected.definitiveDossier.combat.classLevels).map(([k,v])=>k+" "+v).join(" / ")} · Level {selected.definitiveDossier.combat.level} · Prior-career XP {selected.definitiveDossier.combat.careerXp.toLocaleString()}</p>
            <p className="mt-2">HP {selected.definitiveDossier.combat.maxHitPoints} · BAB {selected.definitiveDossier.combat.baseAttackBonus} · DT {selected.definitiveDossier.combat.damageThreshold} · Melee +{selected.definitiveDossier.combat.meleeAttack} · Ranged +{selected.definitiveDossier.combat.rangedAttack}</p>
            <p className="mt-2">Reflex {selected.definitiveDossier.combat.defenses.reflex} · Fortitude {selected.definitiveDossier.combat.defenses.fortitude} · Will {selected.definitiveDossier.combat.defenses.will}</p>
            <p className="mt-2">Abilities: {Object.entries(selected.definitiveDossier.combat.abilities).map(([k,v])=>k.toUpperCase()+" "+v).join(" · ")}</p>
            <p className="mt-2"><strong>Feats:</strong> {selected.definitiveDossier.combat.feats.join(", ")}</p>
            <p className="mt-2"><strong>Talents:</strong> {selected.definitiveDossier.combat.talents.join(", ")}</p>
            <p className="mt-2"><strong>Trained skills:</strong> {selected.definitiveDossier.combat.trainedSkills.join(", ")}</p>
            <p className="mt-2"><strong>Force-sensitive:</strong> {selected.definitiveDossier.combat.forceSensitive?"Yes":"No"} · Powers: {selected.definitiveDossier.combat.forcePowers.join(", ")||"None learned"}</p>
            <p className="mt-2"><strong>Languages:</strong> {selected.definitiveDossier.combat.languages.join(", ")}</p>
            <p className="mt-2"><strong>Prior-career starting loadout:</strong> {selected.definitiveDossier.equipment.baselineLoadout.join(", ")}</p>
            <details className="mt-2"><summary className="cursor-pointer text-[#21dfc8]">Skill modifiers and species rules</summary>
              <dl className="mt-2 grid grid-cols-2 gap-1">{Object.entries(selected.definitiveDossier.combat.skills).map(([skill,score])=><div key={skill}>{skill}: {score>=0?"+":""}{score}</div>)}</dl>
              <p className="mt-2 text-xs text-[#a9adb8]">{selected.definitiveDossier.combat.sourceCitation}</p>
              <p className="mt-2 text-xs">{(selected.definitiveDossier.combat.speciesTraits?.traits||[]).join("; ")}</p>
            </details>
            <p className="mt-3 text-xs text-[#e9a873]">Equipment is a proposed GM starting loadout; existing inventories and spent XP remain unchanged. Deceased characters are flashback-only.</p>
          </div>}
          {!selected.definitiveDossier && <p className="mt-2 text-xs text-[#a9adb8]">{selected.mechanics?.reason || selected.mechanics?.provenance || selected.design?.caveat || "A rules-validated character sheet is not yet recorded."}</p>}
          {!selected.definitiveDossier && <>
          {selected.design?.level != null && <p className="mt-2 text-xs text-[#a9adb8]">Prior-career proposal: Level {selected.design.level}, XP {selected.design.priorCareerXp?.toLocaleString()} (historical career allocation, NOT earned during D'mir gameplay). · {selected.design.mechanicalAuthority}</p>}
          {selected.design?.abilityScores && <p className="mt-2 text-xs text-[#a9adb8]">Proposed abilities: STR {selected.design.abilityScores.strength} · DEX {selected.design.abilityScores.dexterity} · CON {selected.design.abilityScores.constitution} · INT {selected.design.abilityScores.intelligence} · WIS {selected.design.abilityScores.wisdom} · CHA {selected.design.abilityScores.charisma}. Use only after Saga validation.</p>}
          {selected.design?.talentDirection && <p className="mt-2 text-xs text-[#a9adb8]">Talent direction: {selected.design.talentDirection} (not an awarded talent).</p>}
          {!!selected.design?.forcePowerDirection?.length && selected.mechanics?.status !== "validated-core-build" && <p className="mt-2 text-xs text-[#a9adb8]">Force-power proposal: {selected.design.forcePowerDirection.join(", ")} (not learned until validated).</p>}
          {selected.mechanics?.character && <>
            <p className="mt-3 text-sm">Level {selected.mechanics.character.level} · HP {selected.mechanics.character.maxHitPoints} · BAB {selected.mechanics.character.baseAttackBonus} · Damage threshold {selected.mechanics.character.damageThreshold}</p>
            <p className="mt-2 text-sm">Reflex {selected.mechanics.character.defenses?.reflex} · Fortitude {selected.mechanics.character.defenses?.fortitude} · Will {selected.mechanics.character.defenses?.will}</p>
            <p className="mt-2 text-xs">{selected.mechanics.character.sagaStats}</p>
            <p className="mt-2 text-xs">Feats: {Array.isArray(selected.mechanics.character.feats) ? selected.mechanics.character.feats.join(", ") : selected.mechanics.character.feats || "Refer to authored Saga sheet"}</p>
            <p className="mt-2 text-xs">Talents: {Array.isArray(selected.mechanics.character.talents) ? selected.mechanics.character.talents.map(t => t.name || t).join(", ") : selected.mechanics.character.talents || "Refer to authored Saga sheet"}</p>
            <p className="mt-2 text-xs">Force powers: {selected.mechanics.character.forcePowers || selected.mechanics.character.forcePowerSuite?.join(", ") || "None established"}</p>
            <dl className="mt-3 grid grid-cols-2 gap-1 text-xs">{Object.entries(selected.mechanics.skillModifiers || {}).map(([skill,modifier])=><div key={skill}><dt className="inline">{skill}: </dt><dd className="inline">{modifier >= 0 ? "+" : ""}{modifier}</dd></div>)}</dl>
          </>}
          </>}
          {selected.mechanics?.speciesTraits && <details className="mt-3 text-xs">
            <summary className="cursor-pointer text-[#21dfc8]">Species traits · {selected.mechanics.speciesTraits.name}</summary>
            <ul className="mt-2 space-y-1">{(selected.mechanics.speciesTraits.traits || []).map(trait => <li key={trait}>{trait}</li>)}</ul>
            <p className="mt-2 text-[#a9adb8]">{selected.mechanics.speciesTraits.source} · pages {(selected.mechanics.speciesTraits.pages || []).join(", ")}</p>
            <p className="mt-2 text-[#a9adb8]">{selected.mechanics.speciesTraits.mechanicalBoundary}</p>
          </details>}
          {selected.mechanics?.storyTraits && <details className="mt-3 text-xs">
            <summary className="cursor-pointer text-[#21dfc8]">Story traits · not mechanical bonuses</summary>
            <ul className="mt-2 space-y-1">{(selected.mechanics.storyTraits.traits || []).map(trait => <li key={trait}>{trait}</li>)}</ul>
            <p className="mt-2">Flaw: {selected.mechanics.storyTraits.flaw}</p>
            <p className="mt-2">Origin: {selected.mechanics.storyTraits.origin}</p>
          </details>}
          <p className="mt-3 text-xs text-[#ff9b50]">Equipment and attack loadout require a confirmed record. These statistics do not spawn the NPC or grant items.</p>
        </section>
        <div className="mt-3 grid gap-5 md:grid-cols-[minmax(0,420px)_minmax(0,1fr)] items-start">
          <div className="grid grid-cols-2 gap-2">
            <div><p className="mb-1 text-xs text-[#a9adb8]">Head reference</p><NpcVisualCard id={selected.id} name={selected.name} species={selected.species} role={selected.designation} wide /></div>
            <div><p className="mb-1 text-xs text-[#a9adb8]">Full-body costume study</p><NpcFullBodyCard id={selected.id} name={selected.name} /></div>
          </div>
          <div>
            <p className="text-xs text-[#8b93a3]">{selected.species} · {selected.homeworld} · {selected.era} ABY</p>
            <h3 className="text-sm font-semibold text-[#f2f0ea] mt-3">Physical description & visual direction</h3>
            <p className="mt-2 text-sm text-[#d2d0cc]">{selected.visualReference}</p>
            <h3 className="text-sm font-semibold text-[#f2f0ea] mt-4">History and motivations</h3>
            <p className="mt-2 text-sm text-[#d2d0cc]">{selected.description}</p>
            {selected.auditedEnding && <div className="mt-4 border border-[#c8a875]/40 rounded-lg p-3 text-xs text-[#dcc8a4]">
              <p className="font-semibold">Verified sandbox goal — {selected.auditedEnding.reviewedAt}</p>
              <p className="mt-2">{selected.auditedEnding.outcome}</p>
              <p className="mt-2">Evidence revision {selected.auditedEnding.evidenceRevision} · {selected.auditedEnding.evidenceTurnIds.length} corroborating turn IDs · hosted save not migrated</p>
            </div>}
            <p className="mt-3 text-xs text-[#a9adb8]">Role: {selected.designation}. Faction: {selected.faction || "unrecorded"}. Registry: {selected.sourceClass || "legacy"}. Separate provisional visual references, not final art. No unearned ending, XP, talents or gear.</p>
          </div>
        </div>
      </GlassCard>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {shown.map(item => <button type="button" key={item.id} onClick={()=>setSelected(item)} className="text-left">
          <GlassCard className="h-full p-4">
            <div className="flex items-start gap-3">
              <div className="w-[92px] shrink-0"><NpcVisualCard id={item.id} name={item.name} species={item.species} role={item.designation} /></div>
              <div className="min-w-0"><h3 className="font-semibold text-[#f2f0ea]">{item.name}</h3>
                <p className="mt-0.5 text-xs text-[#a9adb8]">{item.species} · {item.homeworld}</p>
                <p className="mt-2 text-xs text-[#d0cfc9]">{item.designation}</p>
              </div></div>
            <p className="mt-4 text-[10px] tracking-[.08em] text-[#8b93a3]">{item.auditedEnding ? "AUDITED LOCAL ENDING · SAVED PLAYTHROUGH" : "CAST PROFILE · PLAYTHROUGH PENDING"}</p>
          </GlassCard>
        </button>)}
      </div>
      {!shown.length && <p className="text-sm text-[#a9adb8]">No NPC matches that search.</p>}
      <p className="mt-6 text-xs text-[#737988]">Private GM index. Dossiers and validated builds are separate from earned campaign outcomes. Players receive only encounter-appropriate public information.</p>
    </main>
  </Shell>;
}
