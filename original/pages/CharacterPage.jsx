import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Eye, Home as HomeIcon, Shield, Sparkles } from "lucide-react";
import { useGame } from "@/original/lib/GameContext";
import { Shell, TopBar, GlassCard, EmptyNote, HudRow } from "@/original/components/GalaxyUI";
import { hitPointDisplay } from "@/original/lib/hitPoints";
import { HEROIC_CLASSES, TALENT_TREES, SAGA_ABILITY_OPTIONS, SAGA_LANGUAGE_OPTIONS, advancementChoiceContext, advancementFeatChoiceContext, availableFeatSkills, advancementRequirements, availableClassSkills, availableFeats, availableStartingFeats, availableTalents, foundationRequirements, progressionStatus, parseAbilityScores, SAGA_ADVANCEMENT_LIMITATIONS } from "@/original/lib/sagaAdvancement";
import { FORCE_POWER_CATALOG } from "@/original/lib/sagaForcePowers";

function Portrait({ src, label, character }) {
  return (
    <div className="relative overflow-hidden rounded-2xl min-h-64 flex items-end" style={{ background: src ? `center / cover url("${src}")` : "radial-gradient(circle at 50% 25%, rgba(255,122,26,.35), transparent 25%), linear-gradient(145deg, #20202c, #090a10 70%)", border: "1px solid rgba(255,255,255,.1)" }}>
      {!src && <div className="absolute inset-0 flex items-center justify-center text-center p-6"><div><Sparkles className="mx-auto mb-3 text-[#ff7a1a]" size={28} /><p className="text-[10px] tracking-widest text-[#f2f0ea]">GM-GENERATED {label.toUpperCase()}</p><p className="text-xs text-[#8b93a3] mt-2">Portrait pending campaign generation or GM attachment.</p></div></div>}
      <div className="relative w-full px-4 py-3 bg-black/60"><p className="text-[9px] tracking-[0.2em] text-[#ff7a1a]">{label.toUpperCase()}</p><p className="text-sm text-[#f2f0ea]">{character.name || "Unnamed character"}</p></div>
    </div>
  );
}

const CLASS_THEMES = {
  jedi: "Explore a Force-oriented path. This class is not membership of the Jedi Order; sensitivity alone grants no power suite.",
  noble: "Develop influence, leadership and connections. Kelvek's lessons can inform how you use that leverage.",
  scoundrel: "Develop underworld cunning, deception and opportunism. Your gang history informs this path, not your next moral choice.",
  scout: "Develop awareness, stealth and survival. Notice a way through and live to tell the story.",
  soldier: "Develop discipline, weapons and close combat. Your father's unarmed lessons can inform this path."
};
function AdvancementPanel({ character, gameState, advanceCharacter, sending, turnError, saveError }) {
  const status = progressionStatus(character);
  const [classId, setClassId] = useState("");
  const [step, setStep] = useState(0);
  const [talentId, setTalentId] = useState("");
  const [classBonusFeatId, setClassBonusFeatId] = useState("");
  const [generalFeatId, setGeneralFeatId] = useState("");
  const [humanBonusFeatId, setHumanBonusFeatId] = useState("");
  const [startingFeatId, setStartingFeatId] = useState("");
  const [abilityIncreases, setAbilityIncreases] = useState([]);
  const [trainedSkillIds, setTrainedSkillIds] = useState([]);
  const [languageIds, setLanguageIds] = useState([]);
  const [forcePowerIds, setForcePowerIds] = useState([]);
  const [committing, setCommitting] = useState(false);
  const [saveAttempted, setSaveAttempted] = useState(false);
  const [featSkillChoices, setFeatSkillChoices] = useState({});
  const draftChoices = { abilityIncreases, trainedSkillIds, generalFeatId, humanBonusFeatId, startingFeatId, classBonusFeatId, ...featSkillChoices };
  const rules = useMemo(() => advancementRequirements(character, classId, { abilityIncreases, startingFeatId, classBonusFeatId, generalFeatId }), [character, classId, abilityIncreases, startingFeatId, classBonusFeatId, generalFeatId]);
  const choiceContext = advancementChoiceContext(character, classId, draftChoices);
  const talents = useMemo(() => availableTalents(choiceContext, classId, gameState).flatMap(tree => tree.talents.map(item => ({ ...item, label: `${tree.name} — ${item.name}` }))), [choiceContext, classId, gameState]);
  const classFeatContext = advancementFeatChoiceContext(character, classId, draftChoices, "classBonusFeatId");
  const classFeats = useMemo(() => availableFeats(classFeatContext, classId, true), [classFeatContext, classId]);
  // Choice context includes selected feats for talent prerequisites. Exclude
  // the current slot itself when populating its selector.
  const generalFeatContext = advancementFeatChoiceContext(character, classId, draftChoices, "generalFeatId");
  const generalFeats = useMemo(() => availableFeats(generalFeatContext, classId, false), [generalFeatContext, classId]);
  const humanBonusFeats = availableFeats(advancementFeatChoiceContext(character, classId, draftChoices, "humanBonusFeatId"), classId, false);
  const startingFeatContext = advancementFeatChoiceContext(character, classId, draftChoices, "startingFeatId");
  const startingFeats = useMemo(() => availableStartingFeats(startingFeatContext, classId), [startingFeatContext, classId]);
  const xpFloor = status.level <= 1 ? 0 : Number(character.level) >= 20 ? 190000 : [0, 1000, 3000, 6000, 10000, 15000, 21000, 28000, 36000, 45000, 55000, 66000, 78000, 91000, 105000, 120000, 136000, 153000, 171000, 190000][status.level - 1];
  const progress = status.nextLevelXp == null ? 100 : Math.max(0, Math.min(100, ((status.experience - xpFloor) / Math.max(1, status.nextLevelXp - xpFloor)) * 100));
  const foundation = status.foundationRequired;
  const human = /^human$/i.test(String(character.species || "").trim());
  const foundationRules = foundationRequirements(character, classId, { generalFeatId, humanBonusFeatId });
  const selectionRules = foundation ? foundationRules : rules;
  const knownSkills = Array.isArray(character.trainedSkills) ? character.trainedSkills : String(character.trainedSkills || "").split(/[,;|]/).map(value => value.trim()).filter(Boolean);
  const skills = availableClassSkills(choiceContext, classId).filter(skill => foundation || !knownSkills.some(known => [skill.id, skill.name].some(value => String(known).toLowerCase() === value.toLowerCase())));
  const chooseClass = value => { setClassId(value); setTalentId(""); setClassBonusFeatId(""); setGeneralFeatId(""); setHumanBonusFeatId(""); setStartingFeatId(""); setAbilityIncreases([]); setTrainedSkillIds([]); setLanguageIds([]); setForcePowerIds([]); setFeatSkillChoices({}); };
  const toggleAbility = id => { setForcePowerIds([]); setAbilityIncreases(current => current.includes(id) ? current.filter(item => item !== id) : current.length < 2 ? [...current, id] : current); };
  const ready = foundation
    ? Boolean(foundationRules.abilityScoresEstablished && talentId && generalFeatId && (!human || humanBonusFeatId) && trainedSkillIds.length === foundationRules.trainedSkillCount && languageIds.length === foundationRules.bonusLanguageCount)
    : status.advancementAvailable && (!rules.talentRequired || talentId) && (!rules.classBonusFeatRequired || classBonusFeatId)
      && (!rules.generalFeatRequired || generalFeatId) && (!rules.multiclassStartingFeatRequired || startingFeatId)
      && abilityIncreases.length === rules.abilityIncreasesRequired;
  const forcePowerChoicesComplete = forcePowerIds.length === (selectionRules.forcePowerCount || 0) && forcePowerIds.every(id => FORCE_POWER_CATALOG.some(power => power.id === id));
  const legalSelection = (id, options) => !id || options.some(option => option.id === id);
  const featSlots = [
    ["startingFeatId", startingFeatId, startingFeats],
    ["classBonusFeatId", classBonusFeatId, classFeats],
    ["generalFeatId", generalFeatId, generalFeats],
    ["humanBonusFeatId", humanBonusFeatId, humanBonusFeats]
  ].map(([slot, id, options]) => ({ slot, id, feat: options.find(item => item.id === id), field: slot.replace(/Id$/, "SkillId"), skills: availableFeatSkills(advancementFeatChoiceContext(character, classId, draftChoices, slot), classId, id) }));
  const missingFeatSkills = featSlots.filter(entry => entry.feat?.skillChoice && !entry.skills.some(skill => skill.id === featSkillChoices[entry.field]));
  const invalidSelections = [
    !legalSelection(talentId, talents) && "Your selected talent no longer meets its prerequisites; choose another talent",
    !legalSelection(generalFeatId, generalFeats) && "Choose an eligible character feat",
    !legalSelection(humanBonusFeatId, humanBonusFeats) && "Choose an eligible Human bonus feat",
    !legalSelection(classBonusFeatId, classFeats) && "Choose an eligible class bonus feat",
    !legalSelection(startingFeatId, startingFeats) && "Choose an eligible new-class starting feat",
    trainedSkillIds.some(id => !skills.some(skill => skill.id === id)) && "Update skills that are no longer available to this build"
  ].filter(Boolean);
  const choicesComplete = Boolean(classId) && ready && invalidSelections.length === 0 && missingFeatSkills.length === 0 && trainedSkillIds.length === selectionRules.trainedSkillCount && languageIds.length === selectionRules.bonusLanguageCount && forcePowerChoicesComplete;
  const selectedClass = HEROIC_CLASSES[classId];
  const scores = parseAbilityScores(character);
  const conModifier = scores.constitution == null ? null : Math.floor((scores.constitution - 10) / 2);
  const startingHp = selectedClass && conModifier != null ? 3 * selectedClass.hitDie + conModifier + ([generalFeatId, humanBonusFeatId].includes("toughness") ? 1 : 0) : null;
  const allOptions = [...talents, ...generalFeats, ...humanBonusFeats, ...startingFeats, ...classFeats];
  const selectedNames = [talentId, generalFeatId, humanBonusFeatId, classBonusFeatId, startingFeatId].filter(Boolean).map(id => allOptions.find(item => item.id === id)?.name || id);
  const missing = [
    ...missingFeatSkills.map(entry => `Choose the skill for ${entry.feat.name}`),
    ...invalidSelections,
    !classId && "Choose a class path",
    (foundation || rules.talentRequired) && !talentId && "Choose a talent",
    (foundation || rules.generalFeatRequired) && !generalFeatId && "Choose the character feat",
    foundation && human && !humanBonusFeatId && "Choose the Human bonus feat",
    rules.classBonusFeatRequired && !classBonusFeatId && "Choose the class bonus feat",
    !foundation && rules.multiclassStartingFeatRequired && !startingFeatId && "Choose the new-class starting feat",
    trainedSkillIds.length !== selectionRules.trainedSkillCount && "Finish trained skill choices",
    languageIds.length !== selectionRules.bonusLanguageCount && "Finish language choices",
    !forcePowerChoicesComplete && "Finish the Force power suite",
    abilityIncreases.length !== (foundation ? 0 : Number(rules.abilityIncreasesRequired || 0)) && "Choose two different ability increases",
    !status.abilityScoresEstablished && "Recover your six starting ability scores"
  ].filter(Boolean);
  const commit = async () => {
    if (!choicesComplete || committing) return;
    setSaveAttempted(true);
    setCommitting(true);
    const activeSkillChoices = Object.fromEntries(featSlots.filter(entry => entry.feat?.skillChoice).map(entry => [entry.field, featSkillChoices[entry.field]]));
    const ok = await advanceCharacter({ foundation, classId, talentId, classBonusFeatId, generalFeatId, humanBonusFeatId, startingFeatId, abilityIncreases, trainedSkillIds, languageIds, forcePowerIds, ...activeSkillChoices });
    if (ok) { setStep(0); chooseClass(""); setSaveAttempted(false); }
    setCommitting(false);
  };
  const selectClass = "w-full rounded-lg border border-white/10 bg-[#0b0c13] px-3 py-2 text-sm text-[#f2f0ea]";
  return <section id="advancement" aria-label="Character advancement"><GlassCard className="p-5 mb-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] tracking-[0.2em] text-[#22e5c5] mb-2">SAGA ADVANCEMENT</p><p className="text-sm text-[#f2f0ea]">Level {status.level} · {status.experience.toLocaleString()} XP</p><p className="text-xs text-[#8b93a3] mt-1">{status.nextLevelXp == null ? "Maximum heroic level reached." : `${status.nextLevelXp.toLocaleString()} XP required for level ${status.level + 1}.`}</p></div><span className={`rounded-full border px-3 py-1 text-[10px] tracking-widest ${status.advancementAvailable || status.foundationRequired ? "border-[#22e5c5]/50 text-[#8fffea]" : "border-white/10 text-[#8b93a3]"}`}>{status.foundationRequired ? "BUILD CHOICES REQUIRED" : status.advancementAvailable ? `${status.levelsAvailable} LEVEL${status.levelsAvailable === 1 ? "" : "S"} EARNED` : "IN PROGRESS"}</span></div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5"><div className="h-full bg-[#22e5c5] transition-all" style={{ width: `${progress}%` }} /></div>
    {(saveError || (saveAttempted && turnError)) && <div role="alert" className="mt-4 rounded-xl border border-[#e23b3b]/40 bg-[#e23b3b]/5 p-4 text-sm text-[#ffadad]"><p className="font-semibold mb-1">Build not saved</p><p>{saveError || turnError}</p><p className="mt-2 text-xs">Your choices are still here. Review the issue and confirm again; no level is granted twice.</p></div>}
    {(foundation || status.advancementAvailable) && <div className="mt-5 rounded-xl border border-[#22e5c5]/25 bg-[#22e5c5]/5 p-4">
      <h2 className="gc-display text-xl text-[#f2f0ea] mb-2">{foundation ? "Who have you become?" : "Your next chapter"}</h2>
      <p className="text-sm text-[#d7d4cc] mb-4">{foundation ? "Your history is established, but your starting build is missing. Choose how those experiences translate into Saga abilities. This records level 1 without spending XP; then complete your earned level." : "Develop your existing path or take a new one. Nothing is granted until you review and confirm."}</p>
      <p className="text-xs text-[#8fffea] mb-4">Gameplay pauses while an earned level is pending. Your story remains readable and no build is chosen for you.</p>
      <nav aria-label="Advancement steps" className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">{["Choose your path", "Skills & abilities", "Talents & feats", "Review & confirm"].map((label, index) => <button key={label} type="button" aria-current={step === index ? "step" : undefined} onClick={() => setStep(index)} className={`rounded-lg border px-3 py-3 text-xs text-left ${step === index ? "border-[#22e5c5] bg-[#22e5c5]/10 text-[#8fffea]" : "border-white/10 text-[#a9adb8]"}`}>{index + 1}. {label}</button>)}</nav>
      {step === 0 && <div className="grid gap-3 md:grid-cols-2">{Object.values(HEROIC_CLASSES).map(item => <button type="button" key={item.id} aria-pressed={classId === item.id} onClick={() => chooseClass(item.id)} className={`rounded-xl border p-4 text-left ${classId === item.id ? "border-[#22e5c5] bg-[#22e5c5]/10" : "border-white/10 bg-black/10 hover:border-[#22e5c5]/50"}`}><span className="block text-base text-[#f2f0ea]">{item.name}{classId === item.id ? " · SELECTED" : ""}</span><span className="block mt-2 text-xs leading-relaxed text-[#a9adb8]">{CLASS_THEMES[item.id]}</span><span className="block mt-3 text-[11px] text-[#8fffea]">{foundation ? `${foundationRequirements(character, item.id).trainedSkillCount ?? "?"} starting trained skills` : `Next class level: ${Number(character.classLevels?.[item.id] || 0) + 1}`} · d{item.hitDie} HP</span><span className="block mt-1 text-[11px] text-[#8b93a3]">{(TALENT_TREES[item.id] || []).map(tree => tree.name).join(" · ")}</span></button>)}</div>}
      {step > 0 && !classId && <p className="rounded-lg border border-[#ff7a1a]/30 p-4 text-sm text-[#ffad66]">Start by choosing your path in step 1. No class is selected for you.</p>}
      <div className={`grid gap-4 md:grid-cols-2 ${step !== 2 || !classId ? "hidden" : ""}`}>
        {!foundation && rules.multiclassStartingFeatRequired && <label className="text-xs text-[#8b93a3]">New-class starting feat<select className={`${selectClass} mt-1`} value={startingFeatId} onChange={event => { setStartingFeatId(event.target.value); setForcePowerIds([]); }}><option value="">Choose one</option>{startingFeats.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
        {(foundation || rules.talentRequired) && <fieldset className="md:col-span-2"><legend className="text-xs text-[#8b93a3] mb-2">Choose one talent · legal options for your draft</legend><div className="grid gap-2 md:grid-cols-3">{talents.map(item => <button key={item.id} type="button" aria-pressed={talentId === item.id} onClick={() => setTalentId(item.id)} className={`rounded-lg border p-3 text-left ${talentId === item.id ? "border-[#a855f7] bg-[#a855f7]/15 text-[#e2c2ff]" : "border-white/10 text-[#d7d4cc]"}`}><span className="block text-[10px] tracking-wide text-[#a9adb8]">{item.label.split(" — ")[0]}</span><span className="block mt-1 text-sm">{item.name}</span>{item.requires?.length > 0 && <span className="block mt-2 text-[10px]">Prerequisites satisfied: {item.requires.join(", ")}</span>}</button>)}</div></fieldset>}
        {rules.classBonusFeatRequired && <label className="text-xs text-[#8b93a3]">Class bonus feat<select className={`${selectClass} mt-1`} value={classBonusFeatId} onChange={event => { setClassBonusFeatId(event.target.value); setForcePowerIds([]); }}><option value="">Choose one</option>{classFeats.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
        {(foundation || rules.generalFeatRequired) && <label className="text-xs text-[#8b93a3]">{foundation ? "1st-level feat" : "Character-level feat"}<select className={`${selectClass} mt-1`} value={generalFeatId} onChange={event => { setGeneralFeatId(event.target.value); setHumanBonusFeatId(""); setForcePowerIds([]); }}><option value="">Choose one</option>{generalFeats.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
        {foundation && human && <label className="text-xs text-[#8b93a3]">Human bonus feat<select className={`${selectClass} mt-1`} value={humanBonusFeatId} onChange={event => { setHumanBonusFeatId(event.target.value); setForcePowerIds([]); }}><option value="">Choose an eligible feat</option>{humanBonusFeats.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      </div>
      {step === 2 && classId && <div className="mt-4 grid gap-3 md:grid-cols-2">{featSlots.filter(entry => entry.feat?.skillChoice).map(entry => <label key={entry.slot} className="rounded-xl border border-[#22e5c5]/30 p-3 text-xs text-[#8fffea]">{entry.feat.name} · choose a skill<select className={`${selectClass} mt-2`} value={featSkillChoices[entry.field] || ""} onChange={event => setFeatSkillChoices(current => ({ ...current, [entry.field]: event.target.value }))}><option value="">Choose an eligible skill</option>{entry.skills.map(skill => <option key={skill.id} value={skill.id}>{skill.name}</option>)}</select><span className="block mt-2 text-[#a9adb8]">{entry.feat.skillChoice === "trained" ? "Focus adds its bonus only to this trained skill." : "Training applies only to this eligible untrained class skill."}</span></label>)}</div>}
      {step === 1 && classId && (foundation || selectionRules.trainedSkillCount > 0 || selectionRules.bonusLanguageCount > 0) && <div className="mt-4 space-y-4">
        {!foundationRules.abilityScoresEstablished && <p className="text-xs text-[#ffad66]">Your six Saga ability scores are missing from the original sheet. Recover the reviewed starting sheet before completing advancement; it will not invent scores or replace your story, health, possessions or location.</p>}
        {(foundation || selectionRules.trainedSkillCount > 0) && <fieldset><legend className="text-xs text-[#8b93a3] mb-2">Trained class skills · choose {selectionRules.trainedSkillCount ?? "after ability scores"}</legend><div className="flex flex-wrap gap-2">{skills.map(skill => <label key={skill.id} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-[#d7d4cc]"><input type="checkbox" className="mr-2" checked={trainedSkillIds.includes(skill.id)} onChange={() => setTrainedSkillIds(current => current.includes(skill.id) ? current.filter(id => id !== skill.id) : current.length < Number(selectionRules.trainedSkillCount || 0) ? [...current, skill.id] : current)} />{skill.name}</label>)}</div></fieldset>}
        {selectionRules.bonusLanguageCount > 0 && <fieldset><legend className="text-xs text-[#8b93a3] mb-2">Bonus languages · choose {selectionRules.bonusLanguageCount}</legend><div className="flex flex-wrap gap-2">{SAGA_LANGUAGE_OPTIONS.filter(language => language.id !== "basic" && !(Array.isArray(character.languages) ? character.languages : []).some(known => String(known).toLowerCase() === language.name.toLowerCase())).map(language => <label key={language.id} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-[#d7d4cc]"><input type="checkbox" className="mr-2" checked={languageIds.includes(language.id)} onChange={() => setLanguageIds(current => current.includes(language.id) ? current.filter(id => id !== language.id) : current.length < selectionRules.bonusLanguageCount ? [...current, language.id] : current)} />{language.name}</label>)}</div></fieldset>}
      </div>}
      {step === 1 && !foundation && rules.abilityIncreasesRequired > 0 && <div className="mt-4"><p className="text-xs text-[#8b93a3] mb-2">Increase two different ability scores</p><div className="flex flex-wrap gap-2">{SAGA_ABILITY_OPTIONS.map(item => <button type="button" key={item.id} onClick={() => toggleAbility(item.id)} className={`rounded-lg border px-3 py-2 text-xs ${abilityIncreases.includes(item.id) ? "border-[#22e5c5] bg-[#22e5c5]/15 text-[#8fffea]" : "border-white/10 text-[#a9adb8]"}`}>{item.name}</button>)}</div></div>}
      {step === 2 && selectionRules.forcePowerCount > 0 && <fieldset className="mt-5 rounded-xl border border-[#a855f7]/30 bg-[#a855f7]/5 p-4"><legend className="px-1 text-xs text-[#c084fc]">Force power suite · choose {selectionRules.forcePowerCount}</legend><p className="text-xs text-[#a9adb8] mb-3">Each new Force Training feat gives {selectionRules.powersPerFeat} power{selectionRules.powersPerFeat === 1 ? "" : "s"}.{selectionRules.wisdomPowerCount > 0 ? ` Your Wisdom increase adds ${selectionRules.wisdomPowerCount} more from existing Force Training.` : ""} You may choose the same power more than once for separate uses. Powers are recorded with this build; none is selected for you.</p><div className="grid gap-3 md:grid-cols-2">{Array.from({ length: selectionRules.forcePowerCount }, (_, index) => <label key={index} className="text-xs text-[#8b93a3]">Power {index + 1}<select className={`${selectClass} mt-1`} value={forcePowerIds[index] || ""} onChange={event => setForcePowerIds(current => Array.from({ length: selectionRules.forcePowerCount }, (_, slot) => slot === index ? event.target.value : current[slot] || ""))}><option value="">Choose one</option>{FORCE_POWER_CATALOG.map(power => <option key={power.id} value={power.id}>{power.name}{power.descriptors.includes("dark-side") ? " · Dark Side" : ""}</option>)}</select>{forcePowerIds[index] && <span className="mt-1 block text-[11px] text-[#a9adb8]">{FORCE_POWER_CATALOG.find(power => power.id === forcePowerIds[index])?.summary}</span>}</label>)}</div></fieldset>}
      {step === 1 && classId && <div className="mt-4"><p className="text-xs text-[#a9adb8] mb-3">Skills are not a free point pool every level. Initial training, increased Intelligence and eligible feats determine new training. Saga's character-level contribution still improves skill checks.</p><div className="flex flex-wrap gap-2">{SAGA_ABILITY_OPTIONS.map(item => <span key={item.id} className="rounded-lg border border-white/10 p-3 text-xs text-[#d7d4cc]">{item.name}: {scores[item.id] ?? "Unestablished"}</span>)}</div>{!foundation && !rules.trainedSkillCount && !rules.bonusLanguageCount && !rules.abilityIncreasesRequired && <p className="text-sm text-[#8fffea] mt-4">No new trained skill, language or ability-score choice is due. Continue to your feat or talent choices.</p>}</div>}
      {step === 2 && classId && <p className="text-xs text-[#a9adb8] mt-4">Latent sensitivity is not Force Training. A power suite requires the Force Training feat and its prerequisites. Your appearance and violent history do not auto-grant feats, powers or a numerical Dark Side Score.</p>}
      {step === 3 && <div className="rounded-xl border border-[#a855f7]/30 p-4 space-y-3 text-sm text-[#d7d4cc]"><h3 className="text-[#e2c2ff]">Review your next chapter</h3><p>{selectedClass?.name || "No class selected"} · {foundation ? "Establish level 1, then complete the earned level-2 choices" : `Level ${status.level} → ${status.level + 1}`}</p><p>Choices: {selectedNames.join(" · ") || "None selected yet"}</p><p>Trained skills: {skills.filter(item => trainedSkillIds.includes(item.id)).map(item => item.name).join(", ") || "No new skills selected"}</p><p>Languages: {languageIds.join(", ") || "None added"} · Powers: {forcePowerIds.join(", ") || "None added"}</p><p>{foundation ? `Starting maximum HP: ${startingHp ?? "choose a class"}. Current HP is capped to the legal maximum; no rest or healing is granted.` : `HP gain: d${selectedClass?.hitDie || "?"} + ${conModifier ?? "?"} Constitution modifier (minimum 1), rolled once by the server.`}</p><p>XP stays {status.experience.toLocaleString()}. No equipment, location or Dark Side Score changes. Credits change only if a selected Wealth talent grants its rule benefit.</p>{missing.length > 0 ? <div role="status" className="text-xs text-[#ffad66]"><p>Still to choose:</p><ul className="mt-2 list-disc pl-5 space-y-1">{missing.map(item => <li key={item}>{item}</li>)}</ul></div> : <p className="text-xs text-[#8fffea]">Choices complete. The server validates them again before saving.</p>}<button type="button" disabled={!choicesComplete || committing || sending} onClick={commit} className="gc-btn mt-5 px-4 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40">{committing ? "RECORDING ADVANCEMENT…" : foundation ? "CONFIRM STARTING BUILD" : `CONFIRM LEVEL ${status.level + 1}`}</button></div>}
      <div className="mt-5 flex justify-between gap-3"><button type="button" disabled={step === 0 || committing} onClick={() => setStep(current => Math.max(0, current - 1))} className="text-xs text-[#a9adb8] disabled:opacity-30">BACK</button>{step < 3 && <button type="button" disabled={!classId} onClick={() => setStep(current => Math.min(3, current + 1))} className="gc-btn px-4 py-2 text-xs disabled:opacity-40">{step === 2 ? "REVIEW BUILD" : "CONTINUE"}</button>}</div>
    </div>}
    <details className="mt-5 border-t border-white/5 pt-4"><summary className="cursor-pointer text-[10px] tracking-[0.18em] text-[#a855f7]">CORE HEROIC TALENT TREES</summary><div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">{Object.values(HEROIC_CLASSES).map(heroic => <div key={heroic.id} className="rounded-xl border border-white/10 bg-white/[.02] p-3"><p className="text-sm text-[#f2f0ea]">{heroic.name}</p><p className="text-xs text-[#8b93a3] mt-1">{(TALENT_TREES[heroic.id] || []).map(tree => tree.name).join(" · ")}</p></div>)}</div><p className="mt-3 text-[11px] text-[#5c6370]">Prerequisites are enforced by the server. Unavailable talents remain hidden until their prerequisite talent or feat is recorded.</p></details>
    {Array.isArray(gameState.advancementHistory) && gameState.advancementHistory.length > 0 && <div className="mt-5 border-t border-white/5 pt-4"><p className="text-[9px] tracking-[0.18em] text-[#8b93a3] mb-2">ADVANCEMENT HISTORY</p>{gameState.advancementHistory.slice(-5).reverse().map(entry => <p key={entry.advancementId} className="text-xs text-[#d7d4cc] mb-2">Level {entry.toLevel} · {HEROIC_CLASSES[entry.classId]?.name || entry.classId} {entry.classLevel} · +{entry.hitPointGain} HP{entry.talent ? ` · ${entry.talent.name}` : ""}</p>)}</div>}
    <details className="mt-4 text-xs text-[#8b93a3]"><summary className="cursor-pointer">Catalog coverage & rule limits</summary><ul className="list-disc pl-5 mt-2 space-y-2">{SAGA_ADVANCEMENT_LIMITATIONS.map(item => <li key={item}>{item}</li>)}</ul></details>
  </GlassCard></section>;
}

export default function CharacterPage() {
  const { character, gameState, advanceCharacter, sending, turnError, saveError } = useGame();
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
        <AdvancementPanel character={character} gameState={gameState} advanceCharacter={advanceCharacter} sending={sending} turnError={turnError} saveError={saveError} />
        <div className="grid gap-4 md:grid-cols-2 mb-6"><Portrait src={character.imageFullBody} label="Full-body portrait" character={character} /><Portrait src={character.imageHeadshot} label="Headshot portrait" character={character} /></div>
        {Array.isArray(gameState.creatorCanon) && gameState.creatorCanon.length > 0 && <GlassCard className="p-5 mb-5"><h2 className="text-[10px] tracking-widest text-[#a855f7] mb-3">ESTABLISHED CHARACTER HISTORY</h2><p className="text-xs text-[#8b93a3] mb-3">Your history guides the GM. Mechanical training and powers are chosen separately.</p>{gameState.creatorCanon.map((entry, index) => <p className="text-sm text-[#d7d4cc] mb-3" key={entry.id || index}>{entry.detail}</p>)}</GlassCard>}
        <div className="grid gap-4 lg:grid-cols-2">
          <GlassCard className="p-5"><p className="text-[10px] tracking-[0.2em] text-[#ff7a1a] mb-3">BIOGRAPHY & IDENTITY</p><HudRow label="Background" value={character.background} /><HudRow label="Allegiance" value={character.allegiance} /><HudRow label="Force Sensitive" value={character.forceSensitive} /><HudRow label="Appearance" value={character.appearance} /><HudRow label="Personal Goal" value={character.goal} /><HudRow label="Contacts / Enemies" value={character.contacts} /></GlassCard>
          <GlassCard className="p-5"><p className="text-[10px] tracking-[0.2em] text-[#ff7a1a] mb-3">SAGA EDITION STAT BLOCK</p><HudRow label="Character Level" value={character.level} /><HudRow label="Experience Points" value={character.experience} /><HudRow label="Saga Statistics" value={character.sagaStats} /><HudRow label="Talents" value={character.talents} /><HudRow label="Feats" value={character.feats} /><HudRow label="Force Powers" value={character.forcePowers} /><HudRow label="Force Points" value={gameState.forcePoints ?? "Unestablished"} /><HudRow label="Destiny Points" value={gameState.destinyPoints ?? "Unestablished"} /><HudRow label="Dark Side Score" value={gameState.darkSideScore ?? 0} /><HudRow label="Condition Track" value={`${gameState.conditionTrack || 0}/5`} /><HudRow label="Upgrades" value={character.upgrades} />{gameState.levelUpAvailable && <p className="mt-3 rounded-lg border border-[#22e5c5]/40 bg-[#22e5c5]/10 p-3 text-xs text-[#8fffea]">LEVEL-UP AVAILABLE — choose class, feats, talents, ability increases, and Force options through player advancement.</p>}</GlassCard>
        </div>
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
