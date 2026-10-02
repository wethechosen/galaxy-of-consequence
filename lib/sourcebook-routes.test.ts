import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { indexSourceFile } from "./source-library.mjs";

it("limits private source search, page reading, and review to the GM", async () => {
  const dir = mkdtempSync(join(tmpdir(), "goc-source-routes-"));
  const old = process.env.CAMPAIGN_DB_PATH;
  process.env.CAMPAIGN_DB_PATH = join(dir, "test.sqlite");
  try {
    const auth = await import("../app/api/auth/route");
    const admin = await import("../app/api/admin/route");
    const sources = await import("../app/api/sourcebooks/route");
    const request = (path: string, cookie = "", method = "GET", body?: object) => new Request(`http://localhost:3101/api/${path}`, { method, headers: { cookie, origin: "http://localhost:3101", "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const ownerResponse = await auth.POST(request("auth", "", "POST", { action: "setup", username: "source-owner", password: "test-only-password-123", displayName: "Source Owner" }));
    const ownerCookie = ownerResponse.headers.get("set-cookie")!.split(";")[0];
    await admin.POST(request("admin", ownerCookie, "POST", { action: "create_player", username: "source-player", password: "test-only-password-123", displayName: "Source Player" }));
    const playerResponse = await auth.POST(request("auth", "", "POST", { action: "login", username: "source-player", password: "test-only-password-123" }));
    const playerCookie = playerResponse.headers.get("set-cookie")!.split(";")[0];
    const path = join(dir, "lore.txt");
    writeFileSync(path, "Coruscant archivists study Black Sun finance and prison syndicates.");
    const book = await indexSourceFile(path, { title: "Private campaign lore" });
    expect((await sources.GET(request("sourcebooks?q=Coruscant"))).status).toBe(403);
    expect((await sources.GET(request("sourcebooks?q=Coruscant", playerCookie))).status).toBe(403);
    const result = await sources.GET(request("sourcebooks?q=Coruscant", ownerCookie));
    expect(result.status).toBe(200);
    expect((await result.json()).hits[0].title).toBe("Private campaign lore");
    expect((await sources.GET(request(`sourcebooks?id=${book.id}&page=1`, ownerCookie))).status).toBe(200);
    expect((await sources.PATCH(request("sourcebooks", playerCookie, "PATCH", { id: book.id, page: 1, reviewed: true }))).status).toBe(403);
    expect((await sources.PATCH(request("sourcebooks", ownerCookie, "PATCH", { id: book.id, page: 1, reviewed: true }))).status).toBe(200);
  } finally {
    if (old === undefined) delete process.env.CAMPAIGN_DB_PATH;
    else process.env.CAMPAIGN_DB_PATH = old;
    // Account storage retains its SQLite handle for the test process on Windows.
  }
});
