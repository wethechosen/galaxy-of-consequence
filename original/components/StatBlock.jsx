import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, FileText } from "lucide-react";
import { useGame } from "@/original/lib/GameContext";
import { itemStatBlock } from "@/original/lib/itemStats";

export function StatBlockButton({ item }) {
  const { character, gameState } = useGame();
  const [open, setOpen] = useState(false);
  const button = useRef(null), dialog = useRef(null);
  const title = useId();
  const block = itemStatBlock(item, character || {}, gameState);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    dialog.current?.focus();
    function key(event) {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
      if (event.key === "Tab") {
        const targets = dialog.current?.querySelectorAll('button, a[href], input, select, [tabindex="0"]');
        if (!targets?.length) return;
        const first = targets[0], last = targets[targets.length - 1];
        if (event.shiftKey && [first, dialog.current].includes(document.activeElement)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("keydown", key); previous?.focus(); };
  }, [open]);
  return <><button ref={button} type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 rounded-lg border border-[#22e5c5]/30 px-2 py-1.5 text-[10px] text-[#8fffea] hover:bg-[#22e5c5]/10" aria-label={`Inspect ${block.name} stat block`}><FileText size={12}/>STATS</button>{open && createPortal(<div className="fixed inset-0 z-[100] flex justify-end bg-black/70 p-2 sm:p-5" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}><section ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={title} className="w-full max-w-lg overflow-y-auto rounded-2xl border border-[#22e5c5]/40 bg-[#101019] p-5 shadow-2xl outline-none"><header className="flex items-start justify-between gap-3"><div><p className="text-[10px] tracking-widest text-[#22e5c5]">{block.kind.toUpperCase()} · DATAPAD RECORD</p><h2 id={title} className="gc-display mt-2 text-xl text-[#f2f0ea]">{block.name}</h2></div><button type="button" onClick={() => setOpen(false)} aria-label="Close stat block" className="p-2 text-[#a9adb8]"><X size={20}/></button></header><p className="mt-3 text-xs text-[#a9adb8]">{block.source.title}{block.source.pages ? ` · pp. ${block.source.pages}` : ""}</p><dl className="mt-5 divide-y divide-white/10">{Object.entries(block.stats).map(([label, value]) => <div key={label} className="grid grid-cols-[1fr_1.4fr] gap-4 py-3 text-sm"><dt className="text-[#8b93a3]">{label}</dt><dd className="text-[#f2f0ea]">{String(value)}</dd></div>)}</dl>{block.currentHitPoints != null && <p className="mt-3 text-sm text-[#22e5c5]">Saved current HP: {block.currentHitPoints}</p>}{block.proficiency && <p className="mt-4 rounded-xl border border-[#ff7a1a]/30 p-3 text-sm text-[#ffad66]">{block.proficiency} · {block.proficient ? "recorded" : "not recorded in your build"}</p>}<section className="mt-5 text-xs text-[#a9adb8] space-y-3"><h3 className="text-[#e2c2ff]">ACQUISITION & DEVELOPMENT</h3><p>{block.earned ? typeof block.earned === "string" ? block.earned : JSON.stringify(block.earned) : "Acquisition is governed by the saved transaction or campaign event; this panel grants nothing."}</p>{block.upgrades.map((upgrade, index) => <p key={index}>{typeof upgrade === "string" ? upgrade : JSON.stringify(upgrade)}</p>)}{block.notes.map(note => <p key={note}>{note}</p>)}</section></section></div>, document.body)}</>;
}
