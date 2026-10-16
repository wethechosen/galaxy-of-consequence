import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "../app/api/gpt/openapi/route";

afterEach(() => vi.unstubAllEnvs());

describe("Custom GPT deployment routing", () => {
  it("exports a Neon-only contract within the GPT operation description limits", async () => {
    const schema = await (await GET(new Request("https://galaxy-local.vercel.app/api/gpt/openapi"))).json();
    expect(JSON.stringify(schema)).not.toMatch(/supabase/i);
    for (const path of Object.values(schema.paths) as Array<Record<string, { description?: string }>>) {
      for (const operation of Object.values(path)) expect((operation.description || "").length).toBeLessThanOrEqual(300);
    }
    expect(schema.paths["/api/gpt/turn"].post.responses["200"].content["application/json"].schema.properties.receipt.properties.status.enum).toContain("committed");
  });
  it("keeps an imported preview schema on the stable production controller", async () => {
    vi.stubEnv("GOC_GPT_PUBLIC_BASE_URL", "");
    const response = await GET(new Request("https://old-immutable-preview.vercel.app/api/gpt/openapi"));
    const schema = await response.json();
    expect(schema.openapi).toBe("3.1.0");
    expect(schema.servers).toEqual([{ url: "https://galaxy-local.vercel.app" }]);
    expect(schema.paths["/api/gpt/turn"].post.operationId).toBe("submitPlayerAction");
    expect(schema.paths["/api/gpt/ping"].get.operationId).toBe("pingCampaignService");
    expect(schema.paths["/api/gpt/ping"].get.security).toEqual([]);
    expect(schema.security).toBeUndefined();
    expect(schema.paths["/api/gpt/state"].get.security).toEqual([{ bearerAuth: [] }]);
    expect(schema.paths["/api/gpt/turn"].post.security).toEqual([{ bearerAuth: [] }]);
  });

  it("allows an explicitly configured stable controller address", async () => {
    vi.stubEnv("GOC_GPT_PUBLIC_BASE_URL", "https://game.example.com");
    const response = await GET(new Request("https://preview.vercel.app/api/gpt/openapi"));
    expect((await response.json()).servers).toEqual([{ url: "https://game.example.com" }]);
  });
});
