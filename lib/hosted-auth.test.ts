import { afterEach, describe, expect, it, vi } from "vitest";
import { scryptSync } from "node:crypto";
import { authenticateHosted, hostedAuthEnabled, hostedSessionAccount, hostedStartSession } from "./hosted-auth";
import { neonQuery } from "./neon-db";

vi.mock("./neon-db", () => ({ hostedRuntimeRequired: () => Boolean(process.env.VERCEL), neonQuery: vi.fn() }));

const previous = {
  VERCEL: process.env.VERCEL,
  SECRET: process.env.GOC_SESSION_SECRET,
};

afterEach(() => {
  process.env.VERCEL = previous.VERCEL;
  process.env.GOC_SESSION_SECRET = previous.SECRET;
  vi.mocked(neonQuery).mockReset();
});

function enableHosted() {
  process.env.VERCEL = "1";
  process.env.GOC_SESSION_SECRET = "k".repeat(64);
}

describe("Neon hosted web authentication", () => {
  it("looks up a normalized username with a parameterized query", async () => {
    enableHosted();
    const salt = "a".repeat(64);
    const password = "test-password-123";
    const hash = scryptSync(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString("hex");
    vi.mocked(neonQuery).mockResolvedValue([{
      id: "bc822f06-3f84-48dd-9468-3151cf3485f9",
      username: "dmir@galaxy.local",
      displayName: "D'mir Holloran",
      role: "player",
      salt,
      hash,
    }]);

    await expect(authenticateHosted(" DMIR@GALAXY.LOCAL ", password)).resolves.toMatchObject({ role: "player" });
    expect(neonQuery).toHaveBeenCalledWith(expect.stringContaining("private.goc_web_accounts"), ["dmir@galaxy.local"]);
    await expect(authenticateHosted("dmir@galaxy.local", "wrong-password")).rejects.toThrow(/incorrect/i);
  });

  it("fails closed when the account store is unavailable", async () => {
    enableHosted();
    vi.mocked(neonQuery).mockRejectedValue(new Error("connection failed"));
    await expect(authenticateHosted("dmir@galaxy.local", "not-displayed")).rejects.toMatchObject({
      status: 503,
      message: "Account service is unavailable. Please try signing in again.",
    });
  });

  it("issues and verifies stateless signed sessions", () => {
    enableHosted();
    expect(hostedAuthEnabled()).toBe(true);
    const account = { id: "bc822f06-3f84-48dd-9468-3151cf3485f9", username: "dmir@galaxy.local", displayName: "D'mir Holloran", role: "player" as const };
    const token = hostedStartSession(account, 1000);
    expect(hostedSessionAccount(token, 2000)).toMatchObject(account);
    expect(hostedSessionAccount(`${token}x`, 2000)).toBeNull();
  });
});
