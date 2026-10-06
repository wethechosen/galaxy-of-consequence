import { afterEach, describe, expect, it, vi } from "vitest";
import { scryptSync } from "node:crypto";
import { authenticateHosted, hostedAuthEnabled, hostedSessionAccount, hostedStartSession } from "./hosted-auth";

const previous = {
  VERCEL: process.env.VERCEL,
  URL: process.env.SUPABASE_GOC_BRIDGE_URL,
  KEY: process.env.SUPABASE_GOC_BRIDGE_KEY,
};

afterEach(() => {
  process.env.VERCEL = previous.VERCEL;
  process.env.SUPABASE_GOC_BRIDGE_URL = previous.URL;
  process.env.SUPABASE_GOC_BRIDGE_KEY = previous.KEY;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function enableHosted() {
  process.env.VERCEL = "1";
  process.env.SUPABASE_GOC_BRIDGE_URL = "https://example.invalid/bridge";
  process.env.SUPABASE_GOC_BRIDGE_KEY = "k".repeat(64);
}

describe("hosted web authentication", () => {
  it("bounds account lookup and body stalls without exposing credentials", async () => {
    enableHosted();
    const abort = new AbortController();
    const timer = vi.spyOn(AbortSignal, "timeout").mockReturnValue(abort.signal);
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      expect(init.signal).toBe(abort.signal);
      return { ok: true, json: async () => { abort.abort(); throw new DOMException('Deadline elapsed', 'TimeoutError'); } };
    }));
    await expect(authenticateHosted('dmir@galaxy.local', 'not-displayed')).rejects.toMatchObject({ status: 504, message: 'Account lookup timed out. Please try signing in again.' });
    expect(timer).toHaveBeenCalledWith(15_000);
  });
  it("issues and verifies stateless signed sessions", () => {
    enableHosted();
    expect(hostedAuthEnabled()).toBe(true);
    const account = { id: "bc822f06-3f84-48dd-9468-3151cf3485f9", username: "dmir@galaxy.local", displayName: "D'mir Holloran", role: "player" as const };
    const token = hostedStartSession(account, 1000);
    expect(hostedSessionAccount(token, 2000)).toMatchObject(account);
    expect(hostedSessionAccount(`${token}x`, 2000)).toBeNull();
  });
  it("verifies a password against the server-only bridge verifier", async () => {
    enableHosted();
    const salt = "a".repeat(64);
    const password = "test-password-123";
    const hash = scryptSync(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString("hex");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      auth: {
        id: "bc822f06-3f84-48dd-9468-3151cf3485f9",
        username: "dmir@galaxy.local",
        displayName: "D'mir Holloran",
        role: "player",
        salt,
        hash,
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } })));

    await expect(authenticateHosted("dmir@galaxy.local", password)).resolves.toMatchObject({ role: "player" });
    await expect(authenticateHosted("dmir@galaxy.local", "wrong-password")).rejects.toThrow(/incorrect/i);
  });
});
