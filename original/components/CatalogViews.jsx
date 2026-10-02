import { Package, Crosshair, Shield, Zap, Trash2 } from "lucide-react";
import { GlassPanel, GlassRow, GlassAddForm, CYAN } from "./GlassTable";

const TAG_ICON = { weapon: Crosshair, armor: Shield, gear: Shield, "force-relic": Zap, misc: Package };
const TAG_COLOR = { weapon: "#e23b3b", armor: "#22d3ee", gear: "#22e5c5", "force-relic": "#a855f7", misc: "#8b93a3" };

function SlotIcon({ tag }) {
  const Icon = TAG_ICON[tag] || Package;
  const color = TAG_COLOR[tag] || CYAN;
  return <Icon size={22} style={{ color, filter: `drop-shadow(0 0 6px ${color}66)` }} />;
}

export function ItemAddForm({ fields, onSubmit, submitLabel = "ADD" }) {
  return <GlassAddForm fields={fields} onSubmit={onSubmit} submitLabel={submitLabel} />;
}

export function InventoryView({ items, onAdd, onRemove, onUpdate, readOnly = false }) {
  const total = 24;
  const slots = [...items, ...Array.from({ length: Math.max(0, total - items.length) }, () => null)];
  return (
    <div className="p-6">
      <GlassPanel title="INVENTORY" subtitle={`${items.length}/${total} SLOTS`} headerRight={<span className="text-[10px] tracking-widest text-[#5c6370]">LIVE FROM PLAY</span>}>
        <div className="p-4 grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-6 gap-2.5">
          {slots.map((item, index) => item ? (
            <div key={item.id} className="gc-slot group" title={`${item.name} x${item.qty}`}>
              <SlotIcon tag={item.tag} />
              <span className="text-[10px] text-[#c7c4bc] mt-1.5 truncate max-w-full px-1 text-center">{item.name}</span>
              <span className="absolute bottom-1 right-1 text-[10px] font-bold px-1.5 rounded" style={{ background: "rgba(34,211,238,0.15)", color: CYAN, border: "1px solid rgba(34,211,238,0.3)" }}>x{item.qty}</span>
              {!readOnly && <button type="button" onClick={() => onRemove(item.id)} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-[#8b93a3] hover:text-[#e23b3b]" aria-label={`Remove ${item.name}`}>
                <Trash2 size={11} />
              </button>}
            </div>
          ) : <div key={`empty-${index}`} className="gc-slot gc-slot-empty" />)}
        </div>
      </GlassPanel>
      {!readOnly && <div className="mt-5">
        <GlassAddForm fields={[{ key: "name", placeholder: "Item name" }, { key: "qty", placeholder: "Qty" }, { key: "tag", placeholder: "Tag (weapon, gear...)" }]} onSubmit={(form) => onAdd({ name: form.name, qty: Number(form.qty) || 1, tag: form.tag || "misc" })} />
      </div>}
      {items.length > 0 && (
        <div className="mt-5">
          <GlassPanel title="ADJUST QUANTITIES" subtitle={`${items.length} ENTRIES`} columns={[{ key: "item", label: "ITEM", width: "2fr" }, { key: "tag", label: "TAG", width: "1fr" }, { key: "qty", label: "QTY", width: "90px" }]}>
            {items.map((item) => (
              <GlassRow key={item.id} columns={[{ width: "2fr" }, { width: "1fr" }, { width: "90px" }]}>
                <span className="text-[#f2f0ea] truncate pr-2">{item.name}</span>
                <span className="text-[10px] px-2 py-0.5 rounded text-[#a9adb8] inline-block w-fit" style={{ border: "1px solid rgba(255,255,255,.1)" }}>{item.tag || "misc"}</span>
                {readOnly ? <span className="text-xs text-[#f2f0ea]">{item.qty}</span> : <input type="number" min={0} value={item.qty} onChange={(event) => onUpdate(item.id, "qty", Number(event.target.value))} className="gc-input w-16 px-2 py-1 text-xs" aria-label={`Quantity for ${item.name}`} />}
              </GlassRow>
            ))}
          </GlassPanel>
        </div>
      )}
    </div>
  );
}

export function PropertiesView({ items, onAdd, onRemove, readOnly = false, economicItems = [] }) {
  return (
    <div className="p-6">
      <GlassPanel title="PROPERTIES" subtitle={`${items.length} HOLDINGS`} columns={[{ key: "name", label: "NAME", width: "2fr" }, { key: "type", label: "TYPE", width: "1fr" }, { key: "location", label: "LOCATION", width: "1.5fr" }, { key: "value", label: "VALUE", width: "1fr" }, { key: "actions", label: "", width: "50px" }]}>
        {items.length > 0 ? <>
          {items.map((item) => { const economic = economicItems.find((entry) => entry.id === item.id) || item; return <GlassRow key={item.id} columns={[{ width: "2fr" }, { width: "1fr" }, { width: "1.5fr" }, { width: "1fr" }, { width: "50px" }]} onDelete={!readOnly ? () => onRemove(item.id) : undefined}><span className="text-[#f2f0ea] truncate pr-2">{item.name}</span><span className="text-[10px] px-2 py-0.5 rounded text-[#a9adb8] inline-block w-fit" style={{ border: "1px solid rgba(255,255,255,.1)" }}>{item.type || "property"}</span><span className="text-[#a9adb8]">{item.location || "unknown"}</span><span className="text-[#22e5c5]">{economic.value?.toLocaleString() || "—"} cr</span></GlassRow>; })}
        </> : <p className="p-6 text-sm text-[#5c6370]">No holdings yet — significant acquisitions in Play will land here.</p>}
      </GlassPanel>
      {!readOnly && <div className="mt-5"><GlassAddForm fields={[{ key: "name", placeholder: "Property name" }, { key: "type", placeholder: "Type (apartment, warehouse...)" }, { key: "location", placeholder: "Location" }]} onSubmit={(form) => onAdd({ name: form.name, type: form.type || "property", location: form.location || "unknown" })} /></div>}
    </div>
  );
}

export function HangarView({ items, onAdd, onRemove, readOnly = false, economicItems = [] }) {
  return (
    <div className="p-6">
      <GlassPanel title="HANGAR BAY" subtitle={`${items.length} VESSELS`} columns={[{ key: "ship", label: "SHIP", width: "2fr" }, { key: "class", label: "CLASS", width: "1.5fr" }, { key: "location", label: "DOCKED AT", width: "1.5fr" }, { key: "value", label: "VALUE", width: "1fr" }, { key: "actions", label: "", width: "50px" }]}>
        {items.length > 0 ? <>
          {items.map((item) => { const economic = economicItems.find((entry) => entry.id === item.id) || item; return <GlassRow key={item.id} columns={[{ width: "2fr" }, { width: "1.5fr" }, { width: "1.5fr" }, { width: "1fr" }, { width: "50px" }]} onDelete={!readOnly ? () => onRemove(item.id) : undefined}><span className="text-[#f2f0ea] truncate pr-2">{item.name}</span><span className="text-[#a9adb8]">{item.class || "unknown class"}</span><span className="text-[#a9adb8]">{item.location || "unknown"}</span><span className="text-[#22e5c5]">{economic.value?.toLocaleString() || "—"} cr</span></GlassRow>; })}
        </> : <p className="p-6 text-sm text-[#5c6370]">Hangar bay is empty.</p>}
      </GlassPanel>
      {!readOnly && <div className="mt-5"><GlassAddForm fields={[{ key: "name", placeholder: "Ship name" }, { key: "class", placeholder: "Class (YT-1300...)" }, { key: "location", placeholder: "Docked at" }]} onSubmit={(form) => onAdd({ name: form.name, class: form.class || "unknown class", location: form.location || "unknown" })} /></div>}
    </div>
  );
}
