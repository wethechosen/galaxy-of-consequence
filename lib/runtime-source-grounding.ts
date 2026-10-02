import { bridgeSearchRag } from "./datapad-bridge";
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

function formatCloudGrounding(hits: RagHit[]) {
  const passages = hits.map((hit) => {
    const title = hit.title || "Indexed source";
    const page = Number.isFinite(Number(hit.page)) ? `page ${hit.page}` : "page unknown";
    const authority = hit.authority || "reference";
    const review = hit.reviewed ? "GM reviewed" : "unreviewed";
    const extraction = hit.extraction || "text";
    const content = String(hit.content || "").replace(/\s+/g, " ").trim().slice(0, 3500);
    return `[${title}, ${page}; ${authority}; ${extraction}; ${review}]\n${content}`;
  });
  return `CLOUD SOURCEBOOK PASSAGES — retrieved from the owner's private Supabase RAG library. Saga Core has rules precedence. Only reviewed rules passages should support an exact mechanic; unreviewed or non-Saga material is context, tone, or a lead. Paraphrase and do not quote long passages.\n\n${passages.join("\n\n")}`;
}

export async function runtimeSourceGrounding(query: string) {
  const normalized = String(query || "").trim();
  if (!normalized) return "";

  const cloudPreferred = Boolean(process.env.VERCEL || process.env.GOC_USE_CLOUD_RAG === "1");
  if (cloudPreferred) {
    try {
      const result = await bridgeSearchRag(normalized, 5);
      const hits = Array.isArray(result?.hits) ? result.hits as RagHit[] : [];
      if (hits.length) return formatCloudGrounding(hits);
    } catch (error) {
      console.warn("[source-grounding] cloud RAG unavailable; using local/fallback grounding", {
        message: error instanceof Error ? error.message : "unknown RAG error",
      });
    }
  }

  return sourceGrounding(normalized);
}
