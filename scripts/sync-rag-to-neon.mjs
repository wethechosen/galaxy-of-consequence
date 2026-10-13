import { DatabaseSync } from "node:sqlite";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const dryRun = args.includes("--dry-run");
const only = String(option("--only") || "").trim().toLowerCase();
const batchSize = Math.max(1, Math.min(Number(option("--batch-size")) || 40, 100));
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
const localEnv = explicitEnv ? loadEnvFile(resolve(explicitEnv)) : loadEnvFile(resolve(".env.local"));
const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL ||
  localEnv.DATABASE_URL_UNPOOLED || localEnv.DATABASE_URL;
if (!dryRun && !connectionString) throw new Error("A server-only Neon DATABASE_URL is required.");

const namespaceFor = (authority) => ["saga_core", "saga_supplement", "saga_errata"].includes(authority)
  ? "saga_rules" : "star_wars_legends";
const local = new DatabaseSync(dbPath, { readOnly: true });
const pool = dryRun ? null : new pg.Pool({ connectionString, max: 1 });
let documentCount = 0;
let chunkCount = 0;

try {
  const documents = local.prepare(`SELECT id, title, filename, authority, pages,
    indexed_pages AS indexedPages, ocr_pages AS ocrPages FROM source_documents ORDER BY title`).all()
    .filter((doc) => !only || String(doc.title).toLowerCase().includes(only) || String(doc.filename).toLowerCase().includes(only));
  if (!documents.length) throw new Error("No indexed source documents matched the requested filter.");

  for (const doc of documents) {
    const pages = local.prepare(`SELECT page, body AS content, extraction, reviewed
      FROM source_pages WHERE document_id = ? ORDER BY page`).all(doc.id);
    const client = pool && await pool.connect();
    try {
      if (client) {
        await client.query("BEGIN");
        await client.query(`INSERT INTO private.goc_rag_documents
          (document_id, title, authority, namespace, source_hash, pages, indexed_pages, ocr_pages, metadata)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
          ON CONFLICT (document_id) DO UPDATE SET title=excluded.title, authority=excluded.authority,
          namespace=excluded.namespace, source_hash=excluded.source_hash, pages=excluded.pages,
          indexed_pages=excluded.indexed_pages, ocr_pages=excluded.ocr_pages,
          metadata=excluded.metadata, updated_at=now()`, [
          doc.id, doc.title, doc.authority, namespaceFor(doc.authority), doc.id,
          Number(doc.pages), Number(doc.indexedPages), Number(doc.ocrPages),
          JSON.stringify({ filename: doc.filename, source: "local-private-source-index" }),
        ]);
      }
      for (let offset = 0; offset < pages.length; offset += batchSize) {
        const batch = pages.slice(offset, offset + batchSize).map((page) => ({
          page: Number(page.page), chunk_index: 0, content: String(page.content || "").slice(0, 25000),
          extraction: String(page.extraction || "text"), reviewed: Boolean(page.reviewed),
          token_count: Math.max(1, Math.ceil(String(page.content || "").length / 4)),
          metadata: { source: "local-private-source-index" },
        }));
        if (client) await client.query(`INSERT INTO private.goc_rag_chunks
          (document_id, page, chunk_index, content, extraction, reviewed, token_count, metadata)
          SELECT $1, x.page, x.chunk_index, x.content, x.extraction, x.reviewed, x.token_count, x.metadata
          FROM jsonb_to_recordset($2::jsonb) AS x(page integer, chunk_index integer, content text,
            extraction text, reviewed boolean, token_count integer, metadata jsonb)
          ON CONFLICT (document_id, page, chunk_index) DO UPDATE SET content=excluded.content,
            extraction=excluded.extraction, reviewed=excluded.reviewed, token_count=excluded.token_count,
            metadata=excluded.metadata, updated_at=now()`, [doc.id, JSON.stringify(batch)]);
        chunkCount += batch.length;
      }
      if (client) await client.query("COMMIT");
      documentCount++;
      console.log(`${doc.title}: ${pages.length} chunks ${dryRun ? "planned" : "synced"}`);
    } catch (error) {
      if (client) await client.query("ROLLBACK");
      throw error;
    } finally {
      client?.release();
    }
  }
} finally {
  local.close();
  await pool?.end();
}
console.log(JSON.stringify({ ok: true, dryRun, documents: documentCount, chunks: chunkCount }));
