import { useEffect, useRef, useState } from "react";
import { BookOpen, Plus, Trash2, Upload } from "lucide-react";
import { GlassCard } from "@/original/components/GalaxyUI";

export default function SourcebookView({ sourcebooks, onAdd, onDelete }) {
  const [form, setForm] = useState({ title: "", author: "", focus: "", tags: "" });
  const [adding, setAdding] = useState(false);
  const [uploadNote, setUploadNote] = useState("");
  const fileRef = useRef(null);
  const [documents, setDocuments] = useState([]);
  const [hits, setHits] = useState([]);
  const [query, setQuery] = useState("");
  const queryRef = useRef("");
  const [selected, setSelected] = useState(null);
  const [authority, setAuthority] = useState("setting");
  const [busy, setBusy] = useState(false);
  const [libraryNote, setLibraryNote] = useState("");

  async function refresh(search = query) {
    const response = await fetch(`/api/sourcebooks${search ? `?q=${encodeURIComponent(search)}` : ""}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load library.");
    setDocuments(data.documents || []);
    setHits(data.hits || []);
  }

  useEffect(() => {
    refresh("").catch((error) => setLibraryNote(error.message));
    const timer = setInterval(() => refresh(queryRef.current).catch(() => {}), 12000);
    return () => clearInterval(timer);
  }, []);

  async function uploadFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setLibraryNote(`Indexing ${file.name}… scanned pages may take a moment.`);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("authority", authority);
      const response = await fetch("/api/sourcebooks", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Import failed.");
      setLibraryNote(`${data.document.title}: ${data.document.indexedPages}/${data.document.pages} pages indexed. ${data.note}`);
      await refresh();
    } catch (error) { setLibraryNote(error.message); }
    finally { setBusy(false); }
  }

  async function reviewPage(reviewed) {
    if (!selected) return;
    const response = await fetch("/api/sourcebooks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selected.documentId, page: selected.page, reviewed }) });
    const data = await response.json();
    if (!response.ok) { setLibraryNote(data.error || "Review failed."); return; }
    setSelected({ ...selected, reviewed: reviewed ? 1 : 0 });
    await refresh();
  }

  async function openPage(documentId, page) {
    const response = await fetch(`/api/sourcebooks?id=${encodeURIComponent(documentId)}&page=${page}`);
    const data = await response.json();
    if (!response.ok) { setLibraryNote(data.error || "Page not indexed."); return; }
    setSelected(data.passage);
  }

  function submit() {
    if (!form.title.trim() || !form.focus.trim()) return;
    onAdd({
      title: form.title.trim(),
      author: form.author.trim(),
      focus: form.focus.trim(),
      tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
    });
    setForm({ title: "", author: "", focus: "", tags: "" });
    setUploadNote("");
    setAdding(false);
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <BookOpen size={14} style={{ color: "var(--sig)" }} />
          <p className="text-[10px] tracking-[0.2em]" style={{ color: "var(--sig)" }}>REFERENCE LIBRARY — LIVE IN GM CONTEXT</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".txt,.md,.pdf" className="hidden" onChange={uploadFile} />
          <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className="text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5" style={{ border: "1px solid rgba(255,255,255,.12)", color: "#a9adb8" }}><Upload size={13} /> {busy ? "INDEXING…" : "IMPORT BOOK"}</button>
          <button type="button" onClick={() => setAdding((value) => !value)} className="gc-btn px-3.5 py-2 text-xs flex items-center gap-1.5"><Plus size={13} /> {adding ? "CANCEL" : "ADD MANUALLY"}</button>
        </div>
      </div>
      <p className="text-xs text-[#8b93a3] mb-4">Private indexed books stay on this PC. The GM receives only relevant page-labeled excerpts per turn. OCR pages need human review before being used as exact rules.</p>
      <div className="flex gap-2 flex-wrap mb-4">
        <select aria-label="Imported book authority" value={authority} onChange={(event) => setAuthority(event.target.value)} className="gc-input px-3 py-2 text-xs">
          <option value="setting">Setting / flavor only</option><option value="saga_core">Saga Edition Core</option><option value="saga_errata">Official Saga errata</option><option value="saga_supplement">Saga supplement</option>
        </select>
        <input value={query} onChange={(event) => { setQuery(event.target.value); queryRef.current = event.target.value; }} onKeyDown={(event) => { if (event.key === "Enter") refresh(query).catch((error) => setLibraryNote(error.message)); }} placeholder="Search indexed pages (e.g. Force, Black Sun, Coruscant)" className="gc-input px-3 py-2 text-xs min-w-[300px] flex-1" />
        <button type="button" onClick={() => refresh(query).catch((error) => setLibraryNote(error.message))} className="gc-btn px-4 py-2 text-xs">SEARCH</button>
      </div>
      {libraryNote && <p role="status" className="text-xs mb-4 text-[#d6a77b]">{libraryNote}</p>}
      <div className="grid gap-2 mb-6">
        {documents.map((document) => <GlassCard key={document.id} className="p-3 flex items-center justify-between gap-3">
          <div><strong className="text-sm text-[#f2f0ea]">{document.title}</strong><p className="text-xs text-[#8b93a3]">{document.indexedPages}/{document.pages} pages indexed · {document.ocrPages} OCR · {document.authority.replaceAll("_", " ")}</p></div>
          <a href={`/api/sourcebooks/file/${document.id}`} target="_blank" rel="noreferrer" className="text-xs text-[var(--sig)]">OPEN PDF</a>
        </GlassCard>)}
        {!documents.length && <p className="text-xs text-[#8b93a3]">No full-text sources imported yet. Catalog notes below are not full books.</p>}
      </div>
      {query && <div className="mb-6"><p className="text-[10px] tracking-[0.2em] text-[var(--sig)] mb-2">PAGE RESULTS</p><div className="grid gap-2">{hits.map((hit) => <button type="button" key={`${hit.documentId}-${hit.page}`} onClick={() => openPage(hit.documentId, hit.page)} className="text-left gc-card p-3 rounded-xl"><strong className="text-xs text-[#f2f0ea]">{hit.title} · PDF page {hit.page}</strong><span className="ml-2 text-[10px] text-[#8b93a3]">{hit.extraction} · {hit.reviewed ? "reviewed" : "unreviewed"}</span><p className="text-xs text-[#a9adb8] mt-1">{hit.excerpt}</p></button>)}{!hits.length && <p className="text-xs text-[#8b93a3]">No indexed page matches. Try a different term.</p>}</div></div>}
      {selected && <GlassCard className="p-4 mb-6"><div className="flex justify-between gap-4"><div><strong className="text-sm text-[#f2f0ea]">{selected.title} · PDF page {selected.page}</strong><p className="text-xs text-[#8b93a3]">{selected.extraction} · {selected.reviewed ? "GM-reviewed" : "unreviewed"} · {selected.authority.replaceAll("_", " ")}</p></div><button type="button" onClick={() => setSelected(null)} className="text-xs text-[#a9adb8]">CLOSE</button></div><p className="text-xs text-[#a9adb8] whitespace-pre-wrap max-h-64 overflow-auto my-3">{selected.body}</p><div className="flex gap-3 text-xs"><a href={`/api/sourcebooks/file/${selected.documentId}#page=${selected.page}`} target="_blank" rel="noreferrer" className="text-[var(--sig)]">COMPARE ORIGINAL PAGE</a><button type="button" onClick={() => reviewPage(!selected.reviewed)} className="text-[var(--sig)]">{selected.reviewed ? "REVOKE REVIEW" : "MARK VERIFIED AFTER COMPARISON"}</button></div></GlassCard>}
      <p className="text-[10px] tracking-[0.2em] text-[var(--sig)] mb-2">CAMPAIGN NOTES & CATALOG SUMMARIES</p>

      {adding && (
        <GlassCard className="p-4 mb-5 max-w-2xl space-y-3">
          {uploadNote && <p className="text-xs" style={{ color: "var(--force-light)" }}>{uploadNote}</p>}
          <input placeholder="Title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="gc-input w-full px-3 py-2 text-sm" />
          <input placeholder="Author / source (optional)" value={form.author} onChange={(event) => setForm({ ...form, author: event.target.value })} className="gc-input w-full px-3 py-2 text-sm" />
          <textarea placeholder="Focus — what the GM should draw from this (tone, factions, locations, mechanics)..." value={form.focus} onChange={(event) => setForm({ ...form, focus: event.target.value })} rows={5} className="gc-input w-full px-3 py-2 text-sm" />
          <input placeholder="Tags, comma separated" value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} className="gc-input w-full px-3 py-2 text-sm" />
          <button type="button" onClick={submit} className="gc-btn px-4 py-2 text-xs">SAVE TO LIBRARY</button>
        </GlassCard>
      )}

      <div className="grid gap-3 max-w-3xl">
        {sourcebooks.map((book) => (
          <GlassCard key={book.id} className="gc-card p-4 relative" style={{ borderTop: "2px solid var(--sig)" }}>
            <button type="button" onClick={() => onDelete(book.id)} className="absolute top-3 right-3 p-1.5 rounded-lg text-[#8b93a3] hover:text-[var(--force-dark)] transition-colors" title="Delete sourcebook" aria-label={`Delete ${book.title}`}><Trash2 size={14} /></button>
            <h3 className="text-[#f2f0ea] font-medium pr-8">{book.title}</h3>
            {book.author && <p className="text-xs text-[#8b93a3] mb-2">{book.author}</p>}
            <p className="text-sm text-[#a9adb8] mb-3 whitespace-pre-wrap">{book.focus.length > 260 ? `${book.focus.slice(0, 260)}…` : book.focus}</p>
            <div className="flex gap-2 flex-wrap">{(book.tags || []).map((tag) => <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full" style={{ border: "1px solid rgba(255,255,255,.12)", color: "#a9adb8" }}>{tag}</span>)}</div>
          </GlassCard>
        ))}
        {sourcebooks.length === 0 && <p className="text-sm text-[#8b93a3]">No sourcebooks loaded — the GM will improvise from the core directive alone.</p>}
      </div>
    </div>
  );
}
