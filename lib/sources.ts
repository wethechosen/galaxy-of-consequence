import { listSourceDocuments, searchSources } from "./source-library.mjs";

// The archive and GM console share one private library in CAMPAIGN_DB_PATH.
export function sourceStatus() {
  return listSourceDocuments().map((source) => ({
    id: source.id,
    title: source.title,
    authority: source.authority,
    pages: source.pages,
    reviewedPages: source.reviewedPages,
    status: source.indexedPages < source.pages
      ? `Indexing ${source.indexedPages}/${source.pages}`
      : source.reviewedPages === source.pages ? "Reviewed" : "Needs page review",
  }));
}

export function retrieveApprovedSources(query: string, rulesOnly = false) {
  return searchSources(query, 20)
    .filter((hit) => hit.reviewed && (!rulesOnly || ["saga_core", "saga_supplement"].includes(hit.authority)))
    .slice(0, 6)
    .map((hit) => ({
      source: hit.documentId,
      pdfPage: hit.page,
      printedPage: null,
      excerpt: hit.excerpt,
      authority: hit.authority,
    }));
}
