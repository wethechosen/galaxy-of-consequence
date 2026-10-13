import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock, neonMock, bridgeMock } = vi.hoisted(() => {
  const queryMock = vi.fn();
  return { queryMock, neonMock: vi.fn(() => ({ query: queryMock })), bridgeMock: vi.fn() };
});

vi.mock("@neondatabase/serverless", () => ({ neon: neonMock }));
vi.mock("./datapad-bridge", () => ({ bridgeSearchRag: bridgeMock }));
vi.mock("./source-library.mjs", () => ({ sourceGrounding: () => "LOCAL FALLBACK" }));

import { neonSourceSearchTerms, searchNeonRag } from "./neon-rag";
import { runtimeSourceGrounding, formatSourceGrounding } from "./runtime-source-grounding";

const saved = {
  neonEnabled: process.env.GOC_NEON_RAG_ENABLED,
  url: process.env.GOC_NEON_RAG_DATABASE_URL,
  vercel: process.env.VERCEL,
  cloud: process.env.GOC_USE_CLOUD_RAG,
};

function restore(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
beforeEach(() => {
  vi.clearAllMocks();
  process.env.GOC_NEON_RAG_DATABASE_URL = "postgresql://sample:sample@example.neon.tech/test";
  process.env.GOC_NEON_RAG_ENABLED = "1";
  process.env.GOC_USE_CLOUD_RAG = "1";
});
afterEach(() => {
  restore("GOC_NEON_RAG_ENABLED", saved.neonEnabled);
  restore("GOC_NEON_RAG_DATABASE_URL", saved.url);
  restore("VERCEL", saved.vercel);
  restore("GOC_USE_CLOUD_RAG", saved.cloud);
});

describe("opt-in Neon RAG retrieval", () => {
  it("constructs a bounded lexical query without SQL input interpolation", () => {
    expect(neonSourceSearchTerms("What Force powers can the character use?")).toBe("force | powers | can | the | use");
    expect(neonSourceSearchTerms("  and the  ")).toBe("the");
  });
  it("returns searchable source hits with correct PDF page provenance", async () => {
    queryMock.mockResolvedValue([{
      documentId: "goc-upload-test", title: "Galaxy of Intrigue", authority: "mechanics",
      namespace: "saga_edition", page: 82, extraction: "pdf_text",
      reviewed: false, content: "Social encounters can resolve through skill challenges.",
    }]);
    const hits = await searchNeonRag("skill challenges", 100);
    expect(hits).toHaveLength(1);
    expect(hits[0].page).toBe(82);
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("private.goc_rag_chunks"), ["skill | challenges", 8]);
    const grounding = await runtimeSourceGrounding("skill challenges");
    expect(grounding).toContain("Galaxy of Intrigue, PDF page 82");
    expect(grounding).toContain("unreviewed");
    expect(grounding).toContain("deterministic Saga Edition rules engine");
    expect(bridgeMock).not.toHaveBeenCalled();
  });
  it("falls back to Supabase on Neon error", async () => {
    queryMock.mockRejectedValue(new Error("test Neon unreachable"));
    bridgeMock.mockResolvedValue({ hits: [{ title: "Saga Core", page: 12, content: "Grounded source", reviewed: true }] });
    expect(await runtimeSourceGrounding("grounded source")).toContain("private Supabase RAG library");
    expect(bridgeMock).toHaveBeenCalledTimes(1);
  });
  it("does not query Neon when the opt-in flag is disabled", async () => {
    process.env.GOC_NEON_RAG_ENABLED = "0";
    bridgeMock.mockResolvedValue({ hits: [{ title: "Old index", page: 1, content: "safe fallback" }] });
    expect(await runtimeSourceGrounding("safe fallback")).toContain("Old index");
    expect(neonMock).not.toHaveBeenCalled();
  });
  it("never promotes unreviewed material into mechanical authority", () => {
    const text = formatSourceGrounding([{ title: "WEG Source", page: 37, reviewed: false, content: "Example" }], "Neon");
    expect(text).toContain("Unreviewed passages cannot authorize an exact rule");
    expect(text).toContain("PDF page 37");
  });
});
