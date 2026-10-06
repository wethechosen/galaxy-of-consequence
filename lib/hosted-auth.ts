import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";

export type HostedAccount = {
  id: string;
  username: string;
  displayName: string;
  role: "admin" | "player";
};

type HostedCredential = HostedAccount & { salt: string; hash: string };
type SessionPayload = { account: HostedAccount; exp: number };
const SESSION_MS = 8 * 60 * 60 * 1000;
const KNOWN_ACCOUNTS: HostedAccount[] = [
  { id: "bc822f06-3f84-48dd-9468-3151cf3485f9", username: "dmir@galaxy.local", displayName: "D'mir Holloran", role: "player" },
  { id: "61f21f45-383c-4890-869b-d18826079fb7", username: "gm@galaxy.local", displayName: "GM Operator", role: "admin" },
];

function bridgeKey() {
  const value = process.env.SUPABASE_GOC_BRIDGE_KEY?.trim() || "";
  if (value.length < 32) throw new Error("Hosted authentication is not configured.");
  return value;
}
function bridgeUrl() {
  const value = process.env.SUPABASE_GOC_BRIDGE_URL?.trim() || "";
  if (!value) throw new Error("Hosted authentication is not configured.");
  return value.replace(/\/$/, "");
}

export function hostedAuthEnabled() {
  return Boolean(process.env.SUPABASE_GOC_BRIDGE_URL && process.env.SUPABASE_GOC_BRIDGE_KEY && (process.env.VERCEL || process.env.GOC_ALLOW_HOSTED_WEB === "1"));
}
export function hostedListAccounts(): HostedAccount[] {
  return KNOWN_ACCOUNTS.map((account) => ({ ...account }));
}

export async function authenticateHosted(username: string, password: string): Promise<HostedAccount> {
  const name = username.trim().toLowerCase();
  const signal = AbortSignal.timeout(15_000);
  let response: Response;
  let body: { auth?: HostedCredential | null; error?: string };
  try {
    response = await fetch(`${bridgeUrl()}?username=${encodeURIComponent(name)}`, {
      headers: { Authorization: `Bearer ${bridgeKey()}`, "Content-Type": "application/json" },
      cache: "no-store", signal,
    });
    body = await response.json();
  } catch (error) {
    if (signal.aborted) throw Object.assign(new Error("Account lookup timed out. Please try signing in again."), { status: 504 });
    throw error;
  }
  if (!response.ok) throw new Error(body.error || "Hosted account lookup failed.");
  const row = body.auth;
  const salt = row?.salt || "unknown-hosted-account";
  const supplied = scryptSync(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const expected = row?.hash ? Buffer.from(row.hash, "hex") : Buffer.alloc(64);
  if (!row || expected.length !== supplied.length || !timingSafeEqual(supplied, expected)) {
    throw new Error("Username or password is incorrect.");
  }
  return { id: row.id, username: row.username, displayName: row.displayName, role: row.role };
}

function encode(value: string) { return Buffer.from(value, "utf8").toString("base64url"); }
function decode(value: string) { return Buffer.from(value, "base64url").toString("utf8"); }
function signature(payload: string) {
  return createHmac("sha256", bridgeKey()).update(payload).digest("base64url");
}
export function hostedStartSession(account: HostedAccount, now = Date.now()) {
  const payload = encode(JSON.stringify({ account, exp: now + SESSION_MS } satisfies SessionPayload));
  return `${payload}.${signature(payload)}`;
}

export function hostedSessionAccount(token: string, now = Date.now()): HostedAccount | null {
  const [payload, suppliedSignature, extra] = token.split(".");
  if (!payload || !suppliedSignature || extra) return null;
  const expectedSignature = signature(payload);
  const left = Buffer.from(suppliedSignature);
  const right = Buffer.from(expectedSignature);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const parsed = JSON.parse(decode(payload)) as SessionPayload;
    if (!parsed?.account || !Number.isFinite(parsed.exp) || parsed.exp <= now) return null;
    const current = KNOWN_ACCOUNTS.find((entry) => entry.id === parsed.account.id && entry.username === parsed.account.username);
    return current ? { ...current } : null;
  } catch {
    return null;
  }
}
