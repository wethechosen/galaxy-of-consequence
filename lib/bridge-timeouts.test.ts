import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hostedGet, hostedPut } from "./hosted-bridge";
import { bridgeGet, bridgeSave, bridgeSearchRag } from "./datapad-bridge";

beforeEach(() => {
  vi.stubEnv("SUPABASE_GOC_BRIDGE_URL", "https://bridge.example.test");
  vi.stubEnv("SUPABASE_GOC_BRIDGE_KEY", "test-only-secret");
  vi.stubEnv("GOC_SUPABASE_BRIDGE_URL", "");
  vi.stubEnv("GOC_SUPABASE_BRIDGE_KEY", "");
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("bounded cloud campaign requests", () => {
  it("attaches 15-second abort signals to hosted reads and writes", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const snapshot = { character: {}, gameState: {}, messages: [], comms: [], settings: {} };
    const cloud = { account_username: "dmir", account_id: "dmir", revision: 8, snapshot, updated_at: "2026-10-06" };
    const fetcher = vi.fn().mockImplementation(async () => Response.json(cloud));
    vi.stubGlobal("fetch", fetcher);
    expect(await hostedGet("dmir")).toEqual(cloud);
    expect(await hostedPut("dmir", "dmir", 7, snapshot)).toEqual(cloud);
    expect(timeout.mock.calls).toEqual([[15_000], [15_000]]);
    for (const [, init] of fetcher.mock.calls) expect(init).toMatchObject({ cache: "no-store", signal: expect.any(AbortSignal) });
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toMatchObject({ expectedRevision: 7, snapshot });
  });

  it("gives optional cloud RAG a shorter deadline than authoritative saves", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const fetcher = vi.fn().mockImplementation(async () => Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetcher);
    await bridgeSearchRag("Saga equipment", 50);
    await bridgeGet("dmir");
    await bridgeSave("dmir", 7, {});
    expect(timeout.mock.calls).toEqual([[5_000], [15_000], [15_000]]);
    expect(String(fetcher.mock.calls[0][0])).toContain("limit=12");
  });

  it.each(["hosted-read", "hosted-write", "datapad-read", "datapad-write", "rag"])("stops stalled %s without asserting a write rollback", async (kind) => {
    const abort = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(abort.signal);
    vi.stubGlobal("fetch", vi.fn((_target, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal!.addEventListener("abort", () => reject(new DOMException("Deadline elapsed", "TimeoutError")), { once: true });
    })));
    const snapshot = { character: {}, gameState: {}, messages: [], comms: [], settings: {} };
    const request = kind === "hosted-read" ? hostedGet("dmir")
      : kind === "hosted-write" ? hostedPut("dmir", "dmir", 7, snapshot)
      : kind === "datapad-read" ? bridgeGet("dmir")
      : kind === "datapad-write" ? bridgeSave("dmir", 7, snapshot)
      : bridgeSearchRag("Equipment");
    const rejection = expect(request).rejects.toMatchObject({ status: 504, message: expect.stringContaining("Reload state before retrying") });
    abort.abort();
    await rejection;
  });

  it("does not turn a response-body timeout into an empty successful result", async () => {
    const abort = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(abort.signal);
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => {
      abort.abort();
      throw new DOMException("Deadline elapsed", "AbortError");
    } })));
    await expect(bridgeGet("dmir")).rejects.toMatchObject({ status: 504 });
  });

  it("retains revision-conflict status rather than confusing it with a timeout", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "revision_conflict", revision: 9 }, { status: 409 })));
    await expect(hostedGet("dmir")).rejects.toMatchObject({ status: 409, message: "revision_conflict" });
    await expect(bridgeSave("dmir", 7, {})).rejects.toMatchObject({ status: 409, currentRevision: 9 });
  });
});
