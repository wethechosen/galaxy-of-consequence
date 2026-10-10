import { describe, expect, it } from "vitest";
import { GET } from "../app/api/gpt/ping/route";

describe("Custom GPT controller health check", () => {
  it("is public, read-only, and contains no campaign data", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      ok: true,
      service: "Galaxy of Consequence Custom GPT Controller",
      version: "2.1.0",
    });
  });
});
