import { bridgeSearchRag } from "./datapad-bridge";
import { searchNeonRag } from "./neon-rag";
import { sourceGrounding } from "./source-library.mjs";

type RagHit = {
  title?: string;
  authority?: string;
  namespace?: string;
  page?: number;
  extraction?: string;
  reviewed?: boolean;
  content?: string;
};

export function formatSourceGrounding(hits: RagHit[], backend: "Neon" | "Supabase") {
  const passages = hits.map((hit) => {
    const title = hit.title || "Indexed source";
    const page = Number.isFinite(Number(hit.page)) ? `PDF page ${hit.page}` : "PDF page unknown";
    const authority = hit.authority || "reference";
    const review = hit.reviewed ? "GM reviewed" : "unreviewed";
    const extraction = hit.extraction || "text";
    const content = String(hit.content || "").replace(/\s+/g, " ").trim().slice(0, 1400);
    return `[${title}, ${page}; ${authority}; ${extraction}; ${review}]\n${content}`;
  });
  return `PRIVATE SOURCEBOOK PASSAGES - retrieved from the owner's private ${backend} RAG library.
GAMEPLAY SAFETY: The deterministic Saga Edition rules engine has final authority for rolls, Force powers, action economy, inventory, credits, and campaign state. Unreviewed passages cannot authorize an exact rule or a state change. Only GM-reviewed Saga Edition rules passages may support an exact mechanic; West End Games, pre-Saga d20, fan supplements, and Force and Destiny have lore or comparative value only. Cite book titles and PDF pages when relevant. Paraphrase instead of quoting lengthy passages. Do not invent hidden locations, secrets, artifacts, or successful outcomes from retrieval alone.

${passages.join("\n\n")}`;
}

export async function runtimeSourceGrounding(query: string) {
  const normalized = String(query || "").trim();
  if (!normalized) return "";

  // Deliberately opt-in: the production GM still uses its original Supabase
  // bridge until the Neon-backed retrieval path has passed deployment tests.
  if (process.env.GOC_NEON_RAG_ENABLED === "1") {
    try {
      const hits = await searchNeonRag(normalized, 5);
      if (hits.length) return formatSourceGrounding(hits, "Neon");
    } catch (error) {
      console.warn("[source-grounding] Neon RAG unavailable; using existing source bridge", {
        message: error instanceof Error ? error.message : "unknown RAG error",
      });
    }
  }

  const cloudPreferred = Boolean(process.env.VERCEL || process.env.GOC_USE_CLOUD_RAG === "1");
  if (cloudPreferred) {
    try {
      const result = await bridgeSearchRag(normalized, 5);
      const hits = Array.isArray(result?.hits) ? result.hits as RagHit[] : [];
      if (hits.length) return formatSourceGrounding(hits, "Supabase");
    } catch (error) {
      console.warn("[source-grounding] Supabase RAG unavailable; using local/fallback grounding", {
        message: error instanceof Error ? error.message : "unknown RAG error",
      });
    }
  }

  return sourceGrounding(normalized);
}
