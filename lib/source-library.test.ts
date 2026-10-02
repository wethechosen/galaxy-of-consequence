import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { indexSourceFile, searchSources, reviewSourcePage, sourcePage, sourceGrounding } from "./source-library.mjs";

describe("private sourcebook index", () => {
  it("indexes a local text reference, retrieves its page, and records review", async () => {
    const dir = mkdtempSync(join(tmpdir(), "goc-sources-"));
    const previous = process.env.CAMPAIGN_DB_PATH;
    process.env.CAMPAIGN_DB_PATH = join(dir, "test.sqlite");
    try {
      const path = join(dir, "reference.txt");
      writeFileSync(path, "Coruscant lower levels have shadow markets and hidden Black Sun cells.");
      const result = await indexSourceFile(path, { title: "Local reference", authority: "setting" });
      expect(result.indexedPages).toBe(1);
      expect(searchSources("Black Sun")[0]?.title).toBe("Local reference");
      expect(sourceGrounding("Coruscant")).toContain("PDF page 1");
      expect(sourcePage(result.id, 1)?.reviewed).toBe(0);
      expect(reviewSourcePage(result.id, 1, true)).toBe(true);
      expect(sourcePage(result.id, 1)?.reviewed).toBe(1);
      await indexSourceFile(path, { title: "Local reference", authority: "setting" });
      expect(searchSources("Black Sun")).toHaveLength(1);
    } finally {
      if (previous === undefined) delete process.env.CAMPAIGN_DB_PATH;
      else process.env.CAMPAIGN_DB_PATH = previous;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
