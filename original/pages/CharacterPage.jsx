import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Eye, Home as HomeIcon, Shield, Sparkles } from "lucide-react";
import { useGame } from "@/original/lib/GameContext";
import { Shell, TopBar, GlassCard, EmptyNote, HudRow } from "@/original/components/GalaxyUI";
import { hitPointDisplay } from "@/original/lib/hitPoints";
import { HEROIC_CLASSES, TALENT_TREES, SAGA_ABILITY_OPTIONS, SAGA_LANGUAGE_OPTIONS, advancementChoiceContext, advancementRequirements, availableClassSkills, availableFeats, availableStartingFeats, availableTalents, foundationRequirements, progressionStatus } from "@/original/lib/sagaAdvancement";

function Portrait({ src, label, character }) {
  return (
    <div className="relative overflow-hidden rounded-2xl min-h-64 flex items-end" style={{ background: src ? `center / cover url("${src}")` : "radial-gradient(circle at 50% 25%, rgba(255,122,26,.35), transparent 25%), linear-gradient(145deg, #20202c, #090a10 70%)", border: "1px solid rgba(255,255,255,.1)" }}>
      {!src && <div className="absolute inset-0 flex items-center justify-center text-center p-6"><div><Sparkles className="mx-auto mb-3 text-[#ff7a1a]" size={28} /><p className="text-[10px] tracking-widest text-[#f2f0ea]">GM-GENERATED {label.toUpperCase()}</p><p className="text-xs text-[#8b93a3] mt-2">Portrait pending campaign generation or GM attachment.</p></div></div>}
      <div className="relative w-full px-4 py-3 bg-black/60"><p className="text-[9px] tracking-[0.2em] text-[#ff7a1a]">{label.toUpperCase()}</p><p className="text-sm text-[#f2f0ea]">{character.name || "Unnamed character"}</p></div>
    </div>
  );
}

function AdvancementPanel({ character, gameState, advanceCharacter, sending }) {
  const status = progressionStatus(character);
  const [classId, setClassId] = useState("jedi");
  const [talentId, setTalentId] = useState("");
  const [classBonusFeatId, setClassBonusFeatId] = useState("");
  const [generalFeatId, setGeneralFeatId] = useState("");
  const [humanBonusFeatId, setHumanBonusFeatId] = useState("");
  const [startingFeatId, setStartingFeatId] = useState("");
  const [abilityIncreases, setAbilityIncreases] = useState([]);
  const [trainedSkillIds, setTrainedSkillIds] = useState([]);
  const [languageIds, setLanguageIds] = useState([]);
  const [committing, setCommitting] = useState(false);
  const rules = useMemo(() => advancementRequirements(character, classId, { abilityIncreases, startingFeatId, classBonusFeatId, generalFeatId }), [character, classId, abilityIncreases, startingFeatId, classBonusFeatId, generalFeatId]);
  const choiceContext = useMemo(() => advancementChoiceContext(character, classId, { abilityIncreases, trainedSkillIds, generalFeatId, humanBonusFeatId, startingFeatId, classBonusFeatId }), [character, classId, abilityIncreases, trainedSkillIds, generalFeatId, humanBonusFeatId, startingFeatId, classBonusFeatId]);
  const talents = useMemo(() => availableTalents(choiceContext, classId, gameState).flatMap(tree => tree.talents.map(item => ({ ...item, label: `${tree.name} — ${item.name}` }))), [choiceContext, classId, gameState]);
  const classFeatContext = useMemo(() => advancementChoiceContext(character, classId, { abilityIncreases, trainedSkillIds, generalFeatId, humanBonusFeatId, startingFeatId }), [character, classId, abilityIncreases, trainedSkillIds, generalFeatId, humanBonusFeatId, startingFeatId]);
  const classFeats = useMemo(() => availableFeats(classFeatContext, classId, true), [classFeatContext, classId]);
  // Choice context includes selected feats for talent prerequisites. Exclude
  // the current slot itself when populating its selector.
  const generalFeatContext = useMemo(() => advancementChoiceContext(character, classId, { abilityIncreases, trainedSkillIds, startingFeatId, classBonusFeatId }), [character, classId, abilityIncreases, trainedSkillIds, startingFeatId, classBonusFeatId]);
  const generalFeats = useMemo(() => availableFeats(generalFeatContext, classId, false), [generalFeatContext, classId]);
  const humanBonusFeats = useMemo(() => availableFeats({ ...generalFeatContext, featSelections: [...(generalFeatContext.featSelections || []), ...(generalFeatId ? [{ id: generalFeatId }] : [])] }, classId, false), [generalFeatContext, classId, generalFeatId]);
  const startingFeatContext = useMemo(() => advancementChoiceContext(character, classId, { abilityIncreases, trainedSkillIds, generalFeatId, humanBonusFeatId, classBonusFeatId }), [character, classId, abilityIncreases, trainedSkillIds, generalFeatId, humanBonusFeatId, classBonusFeatId]);
  const startingFeats = useMemo(() => availableStartingFeats(startingFeatContext, classId), [startingFeatContext, classId]);
  const xpFloor = status.level <= 1 ? 0 : Number(character.level) >= 20 ? 190000 : [0, 1000, 3000, 6000, 10000, 15000, 21000, 28000, 36000, 45000, 55000, 66000, 78000, 91000, 105000, 120000, 136000, 153000, 171000, 190000][status.level - 1];
  const progress = status.nextLevelXp == null ? 100 : Math.max(0, Math.min(100, ((status.experience - xpFloor) / Math.max(1, status.nextLevelXp - xpFloor)) * 100));
  const foundation = status.foundationRequired;
  const human = /^human$/i.test(String(character.species || "").trim());
  const foundationRules = foundationRequirements(character, classId, { generalFeatId, humanBonusFeatId });
  const selectionRules = foundation ? foundationRules : rules;
  const knownSkills = Array.isArray(character.trainedSkills) ? character.trainedSkills : String(character.trainedSkills || "").split(/[,;|]/).map(value => value.trim()).filter(Boolean);
  const skills = availableClassSkills(choiceContext, classId).filter(skill => foundation || !knownSkills.some(known => [skill.id, skill.name].some(value => String(known).toLowerCase() === value.toLowerCase())));
  const chooseClass = value => { setClassId(value); setTalentId(""); setClassBonusFeatId(""); setGeneralFeatId(""); setHumanBonusFeatId(""); setStartingFeatId(""); setAbilityIncreases([]); setTrainedSkillIds([]); setLanguageIds([]); };
  const toggleAbility = id => setAbilityIncreases(current => current.includes(id) ? current.filter(item => item !== id) : current.length < 2 ? [...current, id] : current);
  const ready = foundation
    ? Boolean(foundationRules.abilityScoresEstablished && talentId && generalFeatId && (!human || humanBonusFeatId) && trainedSkillIds.length === foundationRules.trainedSkillCount && languageIds.length === foundationRules.bonusLanguageCount)
    : status.advancementAvailable && (!rules.talentRequired || talentId) && (!rules.classBonusFeatRequired || classBonusFeatId)
      && (!rules.generalFeatRequired || generalFeatId) && (!rules.multiclassStartingFeatRequired || startingFeatId)
      && abilityIncreases.length === rules.abilityIncreasesRequired;
  const choicesComplete = ready && trainedSkillIds.length === selectionRules.trainedSkillCount && languageIds.length === selectionRules.bonusLanguageCount;
  const commit = async () => {
    if (!choicesComplete || committing) return;
    setCommitting(true);
    const ok = await advanceCharacter({ foundation, classId, talentId, classBonusFeatId, generalFeatId, humanBonusFeatId, startingFeatId, abilityIncreases, trainedSkillIds, languageIds });
    if (ok) { setTalentId(""); setClassBonusFeatId(""); setGeneralFeatId(""); setHumanBonusFeatId(""); setStartingFeatId(""); setAbilityIncreases([]); setTrainedSkillIds([]); setLanguageIds([]); }
    setCommitting(false);
  };
  const selectClass = "w-full rounded-lg border border-white/10 bg-[#0b0c13] px-3 py-2 text-sm text-[#f2f0ea]";
  return <GlassCard className="p-5 mt-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] tracking-[0.2em] text-[#22e5c5] mb-2">SAGA ADVANCEMENT</p><p className="text-sm text-[#f2f0ea]">Level {status.level} · {status.experience.toLocaleString()} XP</p><p className="text-xs text-[#8b93a3] mt-1">{status.nextLevelXp == null ? "Maximum heroic level reached." : `${status.nextLevelXp.toLocaleString()} XP required for level ${status.level + 1}.`}</p></div><span className={`rounded-full border px-3 py-1 text-[10px] tracking-widest ${status.advancementAvailable || status.foundationRequired ? "border-[#22e5c5]/50 text-[#8fffea]" : "border-white/10 text-[#8b93a3]"}`}>{status.foundationRequired ? "BUILD CHOICES REQUIRED" : status.advancementAvailable ? `${status.levelsAvailable} LEVEL${status.levelsAvailable === 1 ? "" : "S"} EARNED` : "IN PROGRESS"}</span></div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5"><div className="h-full bg-[#22e5c5] transition-all" style={{ width: `${progress}%` }} /></div>
    {(foundation || status.advancementAvailable) && <div className="mt-5 rounded-xl border border-[#22e5c5]/25 bg-[#22e5c5]/5 p-4">
      <p className="text-xs text-[#d7d4cc] mb-4">{foundation ? "Dossier migration found no structured level-1 class or talent. Establish the existing build below; this records legal starting choices without adding XP or another level." : `XP has unlocked level ${status.level + 1}. Choose the legal Saga options below. The server rolls hit points and commits the complete level once.`}</p>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-xs text-[#8b93a3]">Class level<select className={`${selectClass} mt-1`} value={classId} onChange={event => chooseClass(event.target.value)}>{Object.values(HEROIC_CLASSES).map(item => <option key={item.id} value={item.id}>{item.name} · d{item.hitDie} HP</option>)}</select></label>
        {!foundation && rules.multiclassStartingFeatRequired && <label className="text-xs text-[#8b93a3]">New-class starting feat<select className={`${selectClass} mt-1`} value={startingFeatId} onChange={event => setStartingFeatId(event.target.value)}><option value="">Choose one</option>{startingFeats.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
        {(foundation || rules.talentRequired) && <label className="text-xs text-[#8b93a3]">Class talent<select className={`${selectClass} mt-1`} value={talentId} onChange={event => setTalentId(event.target.value)}><option value="">Choose one</option>{talents.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>}
        {rules.classBonusFeatRequired && <label className="text-xs text-[#8b93a3]">Class bonus feat<select className={`${selectClass} mt-1`} value={classBonusFeatId} onChange={event => setClassBonusFeatId(event.target.value)}><option value="">Choose one</option>{classFeats.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
        {(foundation || rules.generalFeatRequired) && <label className="text-xs text-[#8b93a3]">{foundation ? "1st-level feat" : "Character-level feat"}<select className={`${selectClass} mt-1`} value={generalFeatId} onChange={event => { setGeneralFeatId(event.target.value); setHumanBonusFeatId(""); }}><option value="">Choose one</option>{generalFeats.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
        {foundation && human && <label className="text-xs text-[#8b93a3]">Human bonus feat<select className={`${selectClass} mt-1`} value={humanBonusFeatId} onChange={event => setHumanBonusFeatId(event.target.value)}><option value="">Choose a different feat</option>{humanBonusFeats.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      </div>
      {(foundation || selectionRules.trainedSkillCount > 0 || selectionRules.bonusLanguageCount > 0) && <div className="mt-4 space-y-4">
        {!foundationRules.abilityScoresEstablished && <p className="text-xs text-[#ffad66]">Your six Saga ability scores are missing from the original sheet. Gameplay and earned XP can continue. Advancement needs the reviewed starting sheet first; it will not invent scores or replace your story, health, possessions or location.</p>}
        {(foundation || selectionRules.trainedSkillCount > 0) && <fieldset><legend className="text-xs text-[#8b93a3] mb-2">Trained class skills · choose {selectionRules.trainedSkillCount ?? "after ability scores"}</legend><div className="flex flex-wrap gap-2">{skills.map(skill => <label key={skill.id} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-[#d7d4cc]"><input type="checkbox" className="mr-2" checked={trainedSkillIds.includes(skill.id)} onChange={() => setTrainedSkillIds(current => current.includes(skill.id) ? current.filter(id => id !== skill.id) : current.length < Number(selectionRules.trainedSkillCount || 0) ? [...current, skill.id] : current)} />{skill.name}</label>)}</div></fieldset>}
        {selectionRules.bonusLanguageCount > 0 && <fieldset><legend className="text-xs text-[#8b93a3] mb-2">Bonus languages · choose {selectionRules.bonusLanguageCount}</legend><div className="flex flex-wrap gap-2">{SAGA_LANGUAGE_OPTIONS.filter(language => language.id !== "basic" && !(Array.isArray(character.languages) ? character.languages : []).some(known => String(known).toLowerCase() === language.name.toLowerCase())).map(language => <label key={language.id} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-[#d7d4cc]"><input type="checkbox" className="mr-2" checked={languageIds.includes(language.id)} onChange={() => setLanguageIds(current => current.includes(language.id) ? current.filter(id => id !== language.id) : current.length < selectionRules.bonusLanguageCount ? [...current, language.id] : current)} />{language.name}</label>)}</div></fieldset>}
      </div>}
      {rules.abilityIncreasesRequired > 0 && <div className="mt-4"><p className="text-xs text-[#8b93a3] mb-2">Increase two different ability scores</p><div className="flex flex-wrap gap-2">{SAGA_ABILITY_OPTIONS.map(item => <button type="button" key={item.id} onClick={() => toggleAbility(item.id)} className={`rounded-lg border px-3 py-2 text-xs ${abilityIncreases.includes(item.id) ? "border-[#22e5c5] bg-[#22e5c5]/15 text-[#8fffea]" : "border-white/10 text-[#a9adb8]"}`}>{item.name}</button>)}</div></div>}
      <button type="button" disabled={!choicesComplete || committing || sending} onClick={commit} className="gc-btn mt-5 px-4 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40">{committing ? "RECORDING ADVANCEMENT…" : foundation ? "ESTABLISH LEVEL 1 BUILD" : `ADVANCE TO LEVEL ${status.level + 1}`}</button>
    </div>}
    <details className="mt-5 border-t border-white/5 pt-4"><summary className="cursor-pointer text-[10px] tracking-[0.18em] text-[#a855f7]">CORE HEROIC TALENT TREES</summary><div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">{Object.values(HEROIC_CLASSES).map(heroic => <div key={heroic.id} className="rounded-xl border border-white/10 bg-white/[.02] p-3"><p className="text-sm text-[#f2f0ea]">{heroic.name}</p><p className="text-xs text-[#8b93a3] mt-1">{(TALENT_TREES[heroic.id] || []).map(tree => tree.name).join(" · ")}</p></div>)}</div><p className="mt-3 text-[11px] text-[#5c6370]">Prerequisites are enforced by the server. Unavailable talents remain hidden until their prerequisite talent or feat is recorded.</p></details>
    {Array.isArray(gameState.advancementHistory) && gameState.advancementHistory.length > 0 && <div className="mt-5 border-t border-white/5 pt-4"><p className="text-[9px] tracking-[0.18em] text-[#8b93a3] mb-2">ADVANCEMENT HISTORY</p>{gameState.advancementHistory.slice(-5).reverse().map(entry => <p key={entry.advancementId} className="text-xs text-[#d7d4cc] mb-2">Level {entry.toLevel} · {HEROIC_CLASSES[entry.classId]?.name || entry.classId} {entry.classLevel} · +{entry.hitPointGain} HP{entry.talent ? ` · ${entry.talent.name}` : ""}</p>)}</div>}
  </GlassCard>;
}

export default function CharacterPage() {
  const { character, gameState, advanceCharacter, sending } = useGame();
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
        <AdvancementPanel character={character} gameState={gameState} advanceCharacter={advanceCharacter} sending={sending} />
        <GlassCard className="p-5 mt-4"><p className="text-[10px] tracking-[0.2em] text-[#ff7a1a] mb-3">EQUIPMENT & CURRENT STATUS</p><div className="grid gap-3 md:grid-cols-2"><HudRow label="Primary Weapon" value={character.equipPrimary} /><HudRow label="Secondary Weapon" value={character.equipSecondary} /><HudRow label="Armor / Clothing" value={character.equipArmor} /><HudRow label="Special Items" value={character.equipSpecial} /><HudRow label="Current Location" value={gameState.location} /><HudRow label="Hit Points" value={hitPointDisplay(character, gameState).label} /></div>{conditions.length > 0 && <div className="mt-4"><p className="text-[9px] tracking-[0.18em] text-[#8b93a3] mb-2">ACTIVE INJURIES & CONDITIONS</p><ul className="space-y-1 text-sm text-[#d7d4cc]">{conditions.map((condition) => <li key={condition.id || condition.name}>{condition.name}{condition.severity ? ` · ${condition.severity}` : ""}{condition.note ? ` — ${condition.note}` : ""}</li>)}</ul></div>}</GlassCard>
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
