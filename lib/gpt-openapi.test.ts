import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "../app/api/gpt/openapi/route";

afterEach(() => vi.unstubAllEnvs());

describe("Custom GPT deployment routing", () => {
  it("keeps an imported preview schema on the stable production controller", async () => {
    vi.stubEnv("GOC_GPT_PUBLIC_BASE_URL", "");
    const response = await GET(new Request("https://old-immutable-preview.vercel.app/api/gpt/openapi"));
    const schema = await response.json();
    expect(schema.servers).toEqual([{ url: "https://galaxy-local.vercel.app" }]);
    expect(schema.paths["/api/gpt/turn"].post.operationId).toBe("submitPlayerAction");
    expect(schema.security).toEqual([{ bearerAuth: [] }]);
  });

  it("allows an explicitly configured stable controller address", async () => {
    vi.stubEnv("GOC_GPT_PUBLIC_BASE_URL", "https://game.example.com");
    const response = await GET(new Request("https://preview.vercel.app/api/gpt/openapi"));
    expect((await response.json()).servers).toEqual([{ url: "https://game.example.com" }]);
  });
});
