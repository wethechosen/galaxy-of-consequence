"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { mapPoint, type MapEntry } from "@/lib/maps";

export default function MapAtlas({ saveNote, busy }: { saveNote: (title: string, detail: string) => Promise<void>; busy: boolean }) {
  const [maps, setMaps] = useState<MapEntry[]>([]);
  const [status, setStatus] = useState("Loading private atlas…");
  const [selected, setSelected] = useState("galaxy-overview");
  const [zoom, setZoom] = useState(1);
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const [label, setLabel] = useState("");
  const [failed, setFailed] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/maps", { cache: "no-store", signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("Atlas unavailable. Reopen this tab to retry.");
      const data = await response.json(); setMaps(data.maps); setStatus("");
    }).catch(error => { if (error.name !== "AbortError") setStatus(error.message); });
    return () => controller.abort();
  }, []);
  const map = maps.find(item => item.id === selected);
  function reset() { setZoom(1); viewport.current?.scrollTo(0, 0); }
  return <>
    <h2>Galactic atlas</h2>
    <p>Out-of-character reference library. Reading a chart does not reveal it to your character, start a journey, or advance time.</p>
    <p className="map-caution">Historical charts, not a verified 150 ABY political map. Borders, population, world status and navigable routes need separate review. Printed labels cannot be hidden individually in these images.</p>
    {status && <p role="status">{status}</p>}
    <div className="map-controls">
      <label>Chart<select value={selected} onChange={event => { setSelected(event.target.value); setPoint(null); setLabel(""); setFailed(false); reset(); }}>{maps.map(item => <option key={item.id} value={item.id}>{item.title}{item.available ? "" : " — not imported"}</option>)}</select></label>
      <button disabled={zoom <= 1} onClick={() => setZoom(value => Math.max(1, value - .5))}>Zoom out</button>
      <span aria-live="polite">{Math.round(zoom * 100)}%</span>
      <button disabled={zoom >= 5} onClick={() => setZoom(value => Math.min(5, value + .5))}>Zoom in</button>
      <button onClick={reset}>Fit width</button>
    </div>
    {map && <>
      <p><strong>{map.category}</strong> · {map.note}</p>
      {map.available && !failed ? <>
        <p className="empty" id="map-help">Scroll or swipe to explore; focus the chart and use arrow keys to scroll. Click a location to mark a reference point. Zoom enlarges the original; it cannot add missing detail.</p>
        <div ref={viewport} className="map-viewport" tabIndex={0} role="region" aria-label={`${map.title} scrollable chart`} aria-describedby="map-help">
          <div className="map-sheet" style={{ width: `${zoom * 100}%` }} onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); setPoint(mapPoint(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height)); }}>
            <Image key={map.id} src={`/api/maps?id=${map.id}`} alt={`${map.title}. Historical reference chart; use the source image's printed labels.`} width={map.width} height={map.height} unoptimized draggable={false} onError={() => setFailed(true)} style={{ width: "100%", height: "auto", display: "block" }} />
            {point && <span aria-hidden="true" className="map-pin" style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}>⊕</span>}
          </div>
        </div>
        <form className="stack-form" onSubmit={event => {
          event.preventDefault();
          const reference = point ? `Image reference: ${(point.x * 100).toFixed(2)}% from left, ${(point.y * 100).toFixed(2)}% from top.` : "Whole-chart reference; no point selected.";
          void saveNote(label.trim(), `Atlas: ${map.title} [${map.id}]\n${reference}\nPersonal research note, not verified lore, character knowledge, a route, or a travel action.`);
        }}>
          <p>{point ? `Selected reference: ${(point.x * 100).toFixed(2)}% across / ${(point.y * 100).toFixed(2)}% down.` : "No point selected. You can still save a whole-chart note using the keyboard."}</p>
          {point && <button type="button" onClick={() => setPoint(null)}>Clear reference point</button>}
          <label>Personal map note<input value={label} onChange={event => setLabel(event.target.value)} maxLength={160} required placeholder="For example: Research work near the Celanon Spur" /></label>
          <button disabled={busy || !label.trim()}>Save reference to journal</button>
        </form>
      </> : <p role="status">{failed ? "The image could not be loaded. Reopen the atlas to retry." : "This chart has not been imported."} Run the local map importer described in README.</p>}
    </>}
  </>;
}
