import { neon } from "@neondatabase/serverless";

/**
 * Optional, read-only retrieval from GOC's private Neon source index.
 * The GM decides no rules: it receives short, page-cited passages only.
 * Campaign state continues to use its existing authoritative store.
 */
export type NeonRagHit = {
  documentId: string;
  title: string;
  authority: string;
  namespace: string;
  page: number;
  extraction: string;
  reviewed: boolean;
  content: string;
};

const QUERY_STOPWORDS = new Set(
  "about after again also and are been before being could does each from have into just more most only over said says some than that their them then there these this those through very were what when where which while with would your game player character please move continue".split(" "),
);

export function neonSourceSearchTerms(query: string): string {
  const words = [...new Set(String(query || "").toLowerCase().match(/[a-z][a-z0-9]{2,}/g) || [])]
    .filter((word) => !QUERY_STOPWORDS.has(word))
    .slice(0, 10);
  // to_tsquery is SQL-parameterized; this deliberately creates an OR query so
  // a natural-language scene request does not need to match every word.
  return words.join(" | ");
}

export async function searchNeonRag(query: string, limit = 5): Promise<NeonRagHit[]> {
  const terms = neonSourceSearchTerms(query.slice(0, 500));
  if (!terms) return [];

  const databaseUrl = process.env.GOC_NEON_RAG_DATABASE_URL || process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("Neon RAG database URL is missing.");

  const sql = neon(databaseUrl, { fetchOptions: { cache: "no-store" } });
  const maxHits = Math.max(1, Math.min(Math.floor(limit) || 5, 8));
  const result = await sql.query(
    `WITH candidates AS (
      SELECT c.document_id, d.title, d.authority, d.namespace,
        c.page, c.extraction, c.reviewed,
        LEFT(c.content, 1400) AS content,
        ts_rank_cd(c.search_vector, to_tsquery('english', $1)) AS relevance,
        row_number() OVER (
          PARTITION BY c.document_id
          ORDER BY ts_rank_cd(c.search_vector, to_tsquery('english', $1)) DESC, c.page ASC
        ) AS source_rank
      FROM private.goc_rag_chunks c
      JOIN private.goc_rag_documents d ON d.document_id = c.document_id
      WHERE c.search_vector @@ to_tsquery('english', $1)
        AND length(c.content) > 0
    )
    SELECT document_id AS "documentId", title, authority, namespace,
           page, extraction, reviewed, content
    FROM candidates
    WHERE source_rank <= 2
    ORDER BY relevance DESC, document_id, page
    LIMIT $2`,
    [terms, maxHits],
  );
  return result.map((row) => ({
    documentId: String(row.documentId),
    title: String(row.title),
    authority: String(row.authority),
    namespace: String(row.namespace),
    page: Number(row.page),
    extraction: String(row.extraction),
    reviewed: row.reviewed === true,
    content: String(row.content),
  }));
}
