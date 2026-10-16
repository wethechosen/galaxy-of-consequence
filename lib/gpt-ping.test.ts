import { describe, expect, it, vi } from "vitest";
import { GET } from "../app/api/gpt/ping/route";
import { neonQuery } from "./neon-db";

vi.mock("./neon-db", () => ({ neonQuery: vi.fn() }));

describe("Custom GPT controller health check", () => {
  it("is public, read-only, and contains no campaign data", async () => {
    vi.mocked(neonQuery).mockResolvedValue([{ "?column?": 1 }]);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      ok: true,
      service: "Galaxy of Consequence Custom GPT Controller",
      version: "2.2.0",
    });
  });
  it("reports an outage instead of falsely claiming the campaign store is online", async () => {
    vi.mocked(neonQuery).mockRejectedValueOnce(new Error("offline"));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ ok: false });
  });
});
