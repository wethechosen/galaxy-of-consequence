import { useState } from "react";
import { Link } from "react-router-dom";
import { Home as HomeIcon, Radio, RotateCcw, Sparkles, Loader2 } from "lucide-react";
import { useGame } from "@/original/lib/GameContext";
import { Shell, TopBar } from "@/original/components/GalaxyUI";
import SourcebookView from "@/original/components/SourcebookView";
import { invokeNvidiaAssistant, NVIDIA_MODEL } from "@/original/lib/nvidia";

function NumberField({ label, value, onChange }) {
  return (
    <label className="text-sm">
      <span className="block text-[10px] tracking-widest text-[#8b93a3] mb-1">{label.toUpperCase()}</span>
      <input type="number" value={value} onChange={(e) => onChange(e.target.value)} className="gc-input w-full px-3 py-2 text-sm text-[#f2f0ea]" />
    </label>
  );
}
function TextField({ label, value, onChange }) {
  return (
    <label className="text-sm">
      <span className="block text-[10px] tracking-widest text-[#8b93a3] mb-1">{label.toUpperCase()}</span>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="gc-input w-full px-3 py-2 text-sm text-[#f2f0ea]" />
    </label>
  );
}

function GmConsoleBody() {
  const { directive, saveDirective, gameState, updateGameStateField, resetAll, sourcebooks, addSourcebook, deleteSourcebook, character, updateCharacterField } = useGame();
  const [text, setText] = useState(directive);
  const [savedFlash, setSavedFlash] = useState(false);
  const rep = gameState.factionRep;
  const flags = gameState.flags;
  const [flavorPrompt, setFlavorPrompt] = useState("Create three distinct NPC mannerisms and one Coruscant rumor for D'mir's current detention-infirmary scene. Keep them usable by the primary GM and consistent with 155 ABY.");
  const [flavorResult, setFlavorResult] = useState("");
  const [flavorLoading, setFlavorLoading] = useState(false);

  function save() {
    saveDirective(text);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1200);
  }

  async function generateFlavor() {
    setFlavorLoading(true);
    try {
      const references = sourcebooks.map((book) => `${book.title}: ${book.focus}`).join("\n\n");
      const result = await invokeNvidiaAssistant({
        model: NVIDIA_MODEL,
        messages: [
          {
            role: "system",
            content: "You are a secondary Star Wars world-building assistant for a human-administered campaign. Generate only optional NPC flavor, rumors, sensory detail, and setting ideas. Do not adjudicate rules, change player stats, award items or XP, override continuity, or speak as the primary Game Master. Use Saga Edition vocabulary and 155 ABY continuity. Treat the supplied references as grounding and do not quote them.",
          },
          {
            role: "user",
            content: `${flavorPrompt}\n\nACTIVE CAMPAIGN REFERENCES:\n${references}`,
          },
        ],
      });
      setFlavorResult(result);
    } catch (error) {
      setFlavorResult(`NVIDIA flavor service unavailable: ${error.message}`);
    } finally {
      setFlavorLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl space-y-8">
      <section id="directive">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] tracking-[0.2em]" style={{ color: "var(--sig)" }}>CORE GM DIRECTIVE</p>
          <button onClick={save} className="gc-btn text-xs px-3.5 py-1.5">{savedFlash ? "SAVED" : "SAVE DIRECTIVE"}</button>
        </div>
        <p className="text-xs text-[#8b93a3] mb-2">This is the live system prompt sent to the Game Master on every turn.</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={16}
          className="gc-input w-full p-3 text-xs text-[#f2f0ea]"
          style={{ fontFamily: "'Chakra Petch', monospace" }}
        />
      </section>

      <section id="sourcebooks">
        <SourcebookView sourcebooks={sourcebooks} onAdd={addSourcebook} onDelete={deleteSourcebook} />
      </section>

      <section id="flavor">
        <p className="text-[10px] tracking-[0.2em] mb-2" style={{ color: "var(--sig)" }}>NVIDIA FLAVOR LAB — OPTIONAL GM SUPPORT</p>
        <p className="text-xs text-[#8b93a3] mb-3">NVIDIA may suggest NPC color, rumors, and world texture. The primary Game Master remains the authority over rules, continuity, progression, and outcomes.</p>
        <textarea value={flavorPrompt} onChange={(e) => setFlavorPrompt(e.target.value)} rows={4} className="gc-input w-full p-3 text-sm text-[#f2f0ea]" />
        <button onClick={generateFlavor} disabled={flavorLoading || !flavorPrompt.trim()} className="gc-btn mt-3 px-4 py-2 text-xs flex items-center gap-2">
          {flavorLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} GENERATE OPTIONAL FLAVOR
        </button>
        {flavorResult && <pre className="mt-4 whitespace-pre-wrap rounded-xl p-4 text-xs leading-relaxed text-[#c7c4bc]" style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)" }}>{flavorResult}</pre>}
      </section>

      <section id="progression">
        <p className="text-[10px] tracking-[0.2em] mb-3" style={{ color: "var(--sig)" }}>PROGRESSION & STAT BLOCK — GM CONTROLLED</p>
        <p className="text-xs text-[#8b93a3] mb-3">Only the GM can award advancement, powers, abilities, upgrades, or item statistics.</p>
        <div className="grid grid-cols-2 gap-4">
          <NumberField label="Saga Level" value={character?.level || 1} onChange={(v) => updateCharacterField("level", Math.max(1, Number(v) || 1))} />
          <NumberField label="Experience" value={character?.experience || 0} onChange={(v) => updateCharacterField("experience", Math.max(0, Number(v) || 0))} />
        </div>
        <div className="space-y-3 mt-4">
          {[
            ["Saga Statistics", "sagaStats"],
            ["Talents", "talents"],
            ["Feats", "feats"],
            ["Force Powers", "forcePowers"],
            ["Upgrades", "upgrades"],
            ["Full-body portrait URL", "imageFullBody"],
            ["Headshot portrait URL", "imageHeadshot"],
          ].map(([label, key]) => (
            <TextField key={key} label={label} value={character?.[key] || ""} onChange={(v) => updateCharacterField(key, v)} />
          ))}
        </div>
      </section>

      <section id="world-state">
        <p className="text-[10px] tracking-[0.2em] mb-3" style={{ color: "var(--sig)" }}>WORLD STATE — DIRECT EDIT</p>
        <div className="grid grid-cols-2 gap-4">
          <NumberField label="Condition" value={gameState.health} onChange={(v) => updateGameStateField(["health"], v)} />
          <TextField label="Location" value={gameState.location} onChange={(v) => updateGameStateField(["location"], v)} />
          <NumberField label="Standard Credits" value={gameState.credits} onChange={(v) => updateGameStateField(["credits"], v)} />
          <NumberField label="Underworld Credits" value={gameState.creditsCriminal} onChange={(v) => updateGameStateField(["creditsCriminal"], v)} />
          <NumberField label="Notoriety" value={gameState.notoriety} onChange={(v) => updateGameStateField(["notoriety"], v)} />
          <NumberField label="Force Alignment" value={gameState.forceAlignment} onChange={(v) => updateGameStateField(["forceAlignment"], v)} />
          <NumberField label="Empire Rep" value={rep.empire} onChange={(v) => updateGameStateField(["factionRep", "empire"], v)} />
          <NumberField label="Rebel Alliance Rep" value={rep.rebellion} onChange={(v) => updateGameStateField(["factionRep", "rebellion"], v)} />
          <NumberField label="CSA Rep" value={rep.csa} onChange={(v) => updateGameStateField(["factionRep", "csa"], v)} />
        </div>
      </section>

      <section>
        <p className="text-[10px] tracking-[0.2em] mb-3" style={{ color: "var(--sig)" }}>CONSEQUENCE LOG</p>
        {flags.length === 0 ? (
          <p className="text-sm text-[#8b93a3]">No flags recorded yet.</p>
        ) : (
          <ul className="text-sm text-[#a9adb8] space-y-1">
            {flags.slice().reverse().map((f, i) => <li key={i} className="text-xs">{new Date(f.ts).toLocaleString()} — {f.note}</li>)}
          </ul>
        )}
      </section>

      <section>
        <p className="text-[10px] tracking-[0.2em] mb-3" style={{ color: "var(--force-dark)" }}>DANGER ZONE</p>
        <button
          onClick={resetAll}
          className="text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5"
          style={{ border: "1px solid var(--force-dark)", color: "var(--force-dark)" }}
        >
          <RotateCcw size={12} /> WIPE CHARACTER & WORLD STATE
        </button>
      </section>
    </div>
  );
}

export default function GmConsolePage() {
  const { character, gameState } = useGame();
  return (
    <Shell>
      <TopBar character={character} gameState={gameState} />
      <div className="flex-1 min-h-0 m-3 gc-glass rounded-2xl overflow-y-auto">
        <div id="overview" className="px-6 pt-5">
          <p className="text-[10px] tracking-[0.25em]" style={{ color: "var(--sig)" }}>GM CONTROL ROOM — PLAYER VIEW HIDDEN</p>
          <p className="text-xs text-[#8b93a3] mt-1">Changes to directives and sourcebooks are live for the next player turn. The AI Game Master connection is provided by the server.</p>
        </div>
        <GmConsoleBody />
      </div>
    </Shell>
  );
}
