import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { extname, basename, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

// Vercel's function filesystem is read-only. Hosted turns use the Supabase
// bridge for campaign state; sourcebook retrieval is optional there, so use an
// ephemeral in-memory index instead of trying to open the local SQLite file.
const databasePath = () => process.env.CAMPAIGN_DB_PATH || (process.env.VERCEL ? ":memory:" : resolve("data", "campaign.sqlite"));
const normal = (value) => String(value || "").replace(/\s+/g, " ").trim();

export function sourceStore(path = databasePath()) {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;");
  db.exec(`CREATE TABLE IF NOT EXISTS source_documents (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, filename TEXT NOT NULL,
    source_path TEXT NOT NULL, authority TEXT NOT NULL,
    pages INTEGER NOT NULL DEFAULT 0, indexed_pages INTEGER NOT NULL DEFAULT 0,
    ocr_pages INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS source_pages (
    document_id TEXT NOT NULL, page INTEGER NOT NULL, body TEXT NOT NULL,
    extraction TEXT NOT NULL, reviewed INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (document_id, page));
    CREATE VIRTUAL TABLE IF NOT EXISTS source_fts USING fts5(
      document_id UNINDEXED, page UNINDEXED, body, tokenize = 'porter unicode61');`);
  return db;
}

export function listSourceDocuments(db = sourceStore()) {
  try {
    return db.prepare("SELECT id, title, filename, authority, pages, indexed_pages AS indexedPages, ocr_pages AS ocrPages, created_at AS createdAt, (SELECT count(*) FROM source_pages p WHERE p.document_id = source_documents.id AND p.reviewed = 1) AS reviewedPages FROM source_documents ORDER BY title").all();
  } finally { db.close(); }
}

export function sourcePage(documentId, page, db = sourceStore()) {
  try {
    return db.prepare(`SELECT p.document_id AS documentId, d.title, d.authority,
      p.page, p.body, p.extraction, p.reviewed FROM source_pages p
      JOIN source_documents d ON d.id = p.document_id
      WHERE p.document_id = ? AND p.page = ?`).get(documentId, page) || null;
  } finally { db.close(); }
}

export function reviewSourcePage(documentId, page, reviewed, db = sourceStore()) {
  try {
    const change = db.prepare("UPDATE source_pages SET reviewed = ? WHERE document_id = ? AND page = ?").run(reviewed ? 1 : 0, documentId, page);
    return change.changes > 0;
  } finally { db.close(); }
}

export function sourceFile(documentId, db = sourceStore()) {
  try {
    return db.prepare("SELECT id, title, filename, source_path AS sourcePath FROM source_documents WHERE id = ?").get(documentId) || null;
  } finally { db.close(); }
}

const STOP = new Set("about after again also and are been before being could does each from have into just more most only over said says some than that their them then there these this those through very were what when where which while with would your dmir holloran game master player scene continue".split(" "));

const HOSTED_FLAVOR_GUIDE = `SOURCEBOOK FLAVOR GUIDE - paraphrased from the owner's indexed Saga Edition Core Rulebook, Legacy Era Campaign Guide, Force and Destiny Core Rulebook, and Corporate Era guide. Use this material for atmosphere, technology, social behavior, architecture, institutions, and plausible scene texture only. Never treat it as authority for an exact mechanic unless the server already resolved that mechanic.

- SAGA EDITION CORE: keep action physical and tactical. Star Wars technology feels used rather than magical: durasteel, access panels, comlinks, repulsors, blasters, service corridors, security systems, crowded transport, and practical consequences. Make locations readable in space and let cover, distance, noise, light, doors, crowds, and equipment matter as fiction.
- LEGACY ERA: the galaxy carries layers of old institutions, rival governments, war memory, local power, and inherited symbols. Authority is rarely singular. Uniforms, heraldry, old infrastructure, faction suspicion, veterans, refugees, and obsolete systems can show history without dumping lore.
- FORCE AND DESTINY: when the Force is relevant, favor subtle pressure, intuition, unease, coincidence, temptation, memory, and sensory disturbance over free powers or prophecy. Criminals, drifters, mentors, and frontier figures act from debts, fear, loyalties, need, and history.
- CORPORATE ERA: corporate power appears through permits, contracts, tariffs, branded infrastructure, private security, shipping schedules, maintenance systems, checkpoints, company law, and workers caught inside the machine.
- CORUSCANT LOWER LEVELS: emphasize verticality, aging utilities, sealed service access, recycled air, condensation, distant traffic and machinery, patched habitation, criminal intermediaries, and the sense of immense city mass overhead.

Paraphrase. Do not quote sourcebook prose. Do not invent a named person, faction, relic, password, treasure, or hidden passage merely for flavor.`;

function hostedFlavorGrounding(query) {
  const value = String(query || "").toLowerCase();
  const emphasis = [];
  if (/coruscant|1313|underlevel|sublevel|bunker|corridor/.test(value)) emphasis.push("Emphasize Coruscant lower-level verticality, old infrastructure, filtered air, service architecture, and close-quarters pressure.");
  if (/blaster|shoot|fire|attack|combat|guard/.test(value)) emphasis.push("For combat flavor, describe sightlines, cover, weapon report, heat, sparks, impacts, and movement without inventing extra attacks or damage.");
  if (/corporate|security|checkpoint|permit|contract|cargo|shipping/.test(value)) emphasis.push("For corporate flavor, foreground procedure, private security, access control, logistics, and institutional friction.");
  if (/force|dark side|sith|jedi|vision/.test(value)) emphasis.push("For Force flavor, keep perception subtle and ambiguous unless an earned mechanic establishes more.");
  return `${HOSTED_FLAVOR_GUIDE}${emphasis.length ? `\n\nSCENE EMPHASIS:\n${emphasis.join("\n")}` : ""}`;
}
export function searchSources(query, limit = 6, db = sourceStore()) {
  try {
    const words = [...new Set(String(query || "").toLowerCase().match(/[a-z][a-z0-9'-]{2,}/g) || [])]
      .filter((word) => !STOP.has(word)).slice(0, 12);
    if (!words.length) return [];
    const match = words.map((word) => `"${word.replace(/"/g, "")}"`).join(" OR ");
    const rows = db.prepare(`SELECT f.document_id AS documentId, d.title, d.authority,
      CAST(f.page AS INTEGER) AS page, f.body, p.extraction, p.reviewed,
      bm25(source_fts) AS rank FROM source_fts f
      JOIN source_documents d ON d.id = f.document_id
      JOIN source_pages p ON p.document_id = f.document_id AND p.page = f.page
      WHERE source_fts MATCH ? ORDER BY rank LIMIT ?`).all(match, Math.max(1, Math.min(Number(limit) || 6, 20)));
    return rows.map((row) => {
      const body = normal(row.body);
      const firstMatch = words.map((word) => body.toLowerCase().indexOf(word)).filter((index) => index >= 0).sort((a,b) => a-b)[0];
      const start = firstMatch === undefined ? 0 : Math.max(0, firstMatch - 180);
      const excerpt = body.slice(start, start + 900);
      return { documentId: row.documentId, title: row.title, authority: row.authority,
        page: row.page, excerpt, extraction: row.extraction, reviewed: Boolean(row.reviewed) };
    });
  } finally { db.close(); }
}

export function sourceGrounding(query, dbPath) {
  const hits = searchSources(query, 5, sourceStore(dbPath));
  if (!hits.length) return process.env.VERCEL ? hostedFlavorGrounding(query) : "";
  return `PRIVATE SOURCEBOOK PASSAGES ? extracted from the owner's local library. Only GM-reviewed pages can support exact mechanics; unreviewed OCR or extracted text is for ideas, tone, and leads. Saga Edition Core has rules precedence; WEG and FFG books are setting flavor only. Do not quote lengthy passages. If a rule is not reviewed, say that its exact wording is unverified.\n\n${hits.map((hit) =>
    `[${hit.title}, PDF page ${hit.page}; ${hit.authority}; ${hit.extraction}; ${hit.reviewed ? "GM reviewed" : "unreviewed"}]\n${hit.excerpt}`).join("\n\n")}\n\n${hostedFlavorGrounding(query)}`;
}

function persistPage(db, documentId, page, body, extraction) {
  db.prepare("INSERT OR REPLACE INTO source_pages (document_id, page, body, extraction, reviewed) VALUES (?, ?, ?, ?, COALESCE((SELECT reviewed FROM source_pages WHERE document_id = ? AND page = ?), 0))")
    .run(documentId, page, body, extraction, documentId, page);
  db.prepare("DELETE FROM source_fts WHERE document_id = ? AND page = ?").run(documentId, page);
  if (body.length > 20) db.prepare("INSERT INTO source_fts (document_id, page, body) VALUES (?, ?, ?)").run(documentId, page, body);
  db.prepare("UPDATE source_documents SET indexed_pages = indexed_pages + 1, ocr_pages = ocr_pages + ? WHERE id = ?")
    .run(extraction === "OCR" ? 1 : 0, documentId);
}

export async function indexSourceFile(filePath, { title, authority = "setting", onProgress, maxPages = Infinity } = {}) {
  const path = resolve(filePath);
  const extension = extname(path).toLowerCase();
  if (![".pdf", ".txt", ".md"].includes(extension)) throw new Error("Choose a PDF, TXT, or Markdown source.");
  if (statSync(path).size > 180_000_000) throw new Error("Source is larger than 180 MB.");
  const data = readFileSync(path);
  const id = createHash("sha256").update(data).digest("hex");
  const db = sourceStore();
  const label = normal(title || basename(path, extension)).slice(0, 160);
  let task, worker;
  try {
    let document, pages = 1;
    if (extension === ".pdf") {
      const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
      task = getDocument({ data: new Uint8Array(data), useSystemFonts: true });
      document = await task.promise;
      pages = document.numPages;
    }
    db.prepare("INSERT OR IGNORE INTO source_documents VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?)")
      .run(id, label, basename(path), path, authority, pages, new Date().toISOString());
    const already = new Set(db.prepare("SELECT page FROM source_pages WHERE document_id = ?").all(id).map((row) => row.page));
    if (extension !== ".pdf") {
      if (!already.has(1)) persistPage(db, id, 1, normal(data.toString("utf8")).slice(0, 500_000), "text");
      return { id, title: label, pages, indexedPages: 1, ocrPages: 0 };
    }
    let processed = 0;
    for (let number = 1; number <= pages && processed < maxPages; number++) {
      if (already.has(number)) continue;
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      let body = normal(content.items.map((item) => item.str || "").join(" "));
      let extraction = "text";
      if (body.length < 100) {
        if (!worker) {
          const { createWorker } = await import("tesseract.js");
          worker = await createWorker("eng", 1);
        }
        const { createCanvas } = await import("@napi-rs/canvas");
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        await page.render({ canvasContext: canvas.getContext("2d"), viewport, canvas }).promise;
        const result = await worker.recognize(canvas.toBuffer("image/png"));
        body = normal(result.data.text);
        extraction = "OCR";
      }
      persistPage(db, id, number, body.slice(0, 25_000), extraction);
      page.cleanup();
      processed++;
      onProgress?.({ title: label, page: number, pages, extraction, chars: body.length });
    }
    const status = db.prepare("SELECT indexed_pages AS indexedPages, ocr_pages AS ocrPages FROM source_documents WHERE id = ?").get(id);
    return { id, title: label, pages, ...status };
  } finally {
    if (worker) await worker.terminate();
    if (task) await task.destroy();
    db.close();
  }
}
