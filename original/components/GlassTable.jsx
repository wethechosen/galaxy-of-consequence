import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

export const CYAN = "#22d3ee";
export const CYAN_SOFT = "rgba(34,211,238,0.25)";

export function Brackets({ color = CYAN }) {
  return (
    <>
      <span className="gc-brk gc-brk-tl" style={{ borderColor: color }} />
      <span className="gc-brk gc-brk-tr" style={{ borderColor: color }} />
      <span className="gc-brk gc-brk-bl" style={{ borderColor: color }} />
      <span className="gc-brk gc-brk-br" style={{ borderColor: color }} />
    </>
  );
}

export function GlassPanel({ title, subtitle, accent = CYAN, headerRight, columns, children }) {
  return (
    <div className="gc-table relative">
      <Brackets color={accent} />
      <div className="gc-table-bar" style={{ borderColor: `${accent}26` }}>
        <div className="flex items-baseline gap-3">
          <span className="text-[11px] tracking-[0.2em] font-semibold" style={{ color: accent }}>{title}</span>
          {subtitle && <span className="text-[10px] tracking-widest text-[#5c6370]">{subtitle}</span>}
        </div>
        {headerRight}
      </div>
      {columns && (
        <div className="gc-table-head" style={{ gridTemplateColumns: columns.map((column) => column.width || "1fr").join(" ") }}>
          {columns.map((column) => <span key={column.key}>{column.label}</span>)}
        </div>
      )}
      {children}
    </div>
  );
}

export function GlassRow({ columns, children, onDelete }) {
  return (
    <div className="gc-table-row" style={{ gridTemplateColumns: columns.map((column) => column.width || "1fr").join(" ") }}>
      {children}
      {onDelete && <button type="button" onClick={onDelete} className="gc-row-del flex items-center justify-center" title="Remove" aria-label="Remove"><Trash2 size={13} /></button>}
    </div>
  );
}

export function GlassAddForm({ fields, onSubmit, submitLabel = "ADD", accent = CYAN }) {
  const initial = Object.fromEntries(fields.map((field) => [field.key, ""]));
  const [form, setForm] = useState(initial);

  function submit(event) {
    event?.preventDefault();
    if (!form[fields[0]?.key]?.trim()) return;
    onSubmit(form);
    setForm(initial);
  }

  return (
    <GlassPanel title="ADD ENTRY" accent={accent}>
      <form onSubmit={submit} className="p-4 flex flex-wrap gap-3 items-end">
        {fields.map((field) => (
          <label key={field.key} className="flex flex-col gap-1.5 flex-1 min-w-[130px]">
            <span className="text-[9px] tracking-[0.15em] text-[#4a6a7a]">{field.placeholder.toUpperCase()}</span>
            <input placeholder={field.placeholder} value={form[field.key]} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })} className="gc-input px-3 py-2 text-sm" />
          </label>
        ))}
        <button type="submit" className="gc-btn px-5 py-2.5 text-xs flex items-center gap-1.5 whitespace-nowrap"><Plus size={13} /> {submitLabel}</button>
      </form>
    </GlassPanel>
  );
}
