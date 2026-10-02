import { DatabaseSync } from "node:sqlite";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const dryRun = args.includes("--dry-run");
const only = String(option("--only") || "").trim().toLowerCase();
const batchSize = Math.max(1, Math.min(Number(option("--batch-size")) || 40, 50));
const dbPath = resolve(option("--db") || "data/campaign.sqlite");
if (!existsSync(dbPath)) throw new Error(`Campaign database not found: ${dbPath}`);

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(readFileSync(path, "utf8").split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "")];
    }));
}
const explicitEnv = option("--env");
const localEnv = explicitEnv ? loadEnvFile(resolve(explicitEnv)) : { ...loadEnvFile(resolve(".env.hosted.local")), ...loadEnvFile(resolve(".env.local")) };
const bridgeUrl = (process.env.GOC_SUPABASE_BRIDGE_URL || process.env.SUPABASE_GOC_BRIDGE_URL || localEnv.GOC_SUPABASE_BRIDGE_URL || localEnv.SUPABASE_GOC_BRIDGE_URL || "").replace(/\/$/, "");
const bridgeKey = process.env.GOC_SUPABASE_BRIDGE_KEY || process.env.SUPABASE_GOC_BRIDGE_KEY || localEnv.GOC_SUPABASE_BRIDGE_KEY || localEnv.SUPABASE_GOC_BRIDGE_KEY || "";
if (!dryRun && (!bridgeUrl || !bridgeKey)) throw new Error("Supabase bridge URL/key are not configured.");

const namespaceFor = (authority) => ["saga_core", "saga_supplement", "saga_errata"].includes(authority) ? "saga_rules" : "star_wars_legends";
const request = async (body) => {
  const response = await fetch(bridgeUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${bridgeKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `Bridge request failed (${response.status})`);
  return data;
};

const db = new DatabaseSync(dbPath, { readOnly: true });
const documents = db.prepare(`SELECT id, title, filename, authority, pages,
  indexed_pages AS indexedPages, ocr_pages AS ocrPages FROM source_documents ORDER BY title`).all()
  .filter((doc) => !only || String(doc.title).toLowerCase().includes(only) || String(doc.filename).toLowerCase().includes(only));
if (!documents.length) throw new Error("No indexed source documents matched the requested filter.");
let totalChunks = 0;
try {
  for (const doc of documents) {
    const metadata = {
      filename: doc.filename,
      source: "local-private-source-index",
      syncedAt: new Date().toISOString(),
    };
    if (!dryRun) await request({ action: "rag_document", document: {
      documentId: doc.id, title: doc.title, authority: doc.authority,
      namespace: namespaceFor(doc.authority), sourceHash: doc.id,
      pages: Number(doc.pages), indexedPages: Number(doc.indexedPages),
      ocrPages: Number(doc.ocrPages), metadata,
    }});

    const pages = db.prepare(`SELECT page, body AS content, extraction, reviewed
      FROM source_pages WHERE document_id = ? ORDER BY page`).all(doc.id);
    for (let offset = 0; offset < pages.length; offset += batchSize) {
      const chunks = pages.slice(offset, offset + batchSize).map((page) => ({
        page: Number(page.page), chunk_index: 0, content: String(page.content || ""),
        extraction: String(page.extraction || "text"), reviewed: Boolean(page.reviewed),
        token_count: Math.max(1, Math.ceil(String(page.content || "").length / 4)),
        metadata: { source: "local-private-source-index" },
      }));
      if (!dryRun) await request({ action: "rag_chunks", documentId: doc.id, chunks });
      totalChunks += chunks.length;
      console.log(`${doc.title}: ${Math.min(offset + chunks.length, pages.length)}/${pages.length} chunks ${dryRun ? "planned" : "synced"}`);
    }
  }
} finally {
  db.close();
}
console.log(JSON.stringify({ ok: true, dryRun, documents: documents.length, chunks: totalChunks }));
