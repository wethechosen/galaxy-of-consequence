import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";
import { hostedRuntimeRequired, neonQuery } from "./neon-db";

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

function sessionSecret() {
  const value = process.env.GOC_SESSION_SECRET?.trim() || "";
  if (value.length < 32) throw Object.assign(new Error("Hosted authentication is not configured."), { status: 503 });
  return value;
}

export function hostedAuthEnabled() {
  return hostedRuntimeRequired();
}
export function hostedListAccounts(): HostedAccount[] {
  return KNOWN_ACCOUNTS.map((account) => ({ ...account }));
}

export async function authenticateHosted(username: string, password: string): Promise<HostedAccount> {
  const name = username.trim().toLowerCase();
  let row: HostedCredential | undefined;
  try {
    [row] = await neonQuery<HostedCredential>(
      'SELECT id::text, username, display_name AS "displayName", role, salt, password_hash AS hash FROM private.goc_web_accounts WHERE username = $1 LIMIT 1',
      [name],
    );
  } catch {
    throw Object.assign(new Error("Account service is unavailable. Please try signing in again."), { status: 503 });
  }
  const salt = row?.salt || "unknown-hosted-account";
  const supplied = scryptSync(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const expected = row?.hash ? Buffer.from(row.hash, "hex") : Buffer.alloc(64);
  if (!row || !["admin", "player"].includes(row.role) || expected.length !== supplied.length || !timingSafeEqual(supplied, expected)) {
    throw new Error("Username or password is incorrect.");
  }
  return { id: row.id, username: row.username, displayName: row.displayName, role: row.role };
}

function encode(value: string) { return Buffer.from(value, "utf8").toString("base64url"); }
function decode(value: string) { return Buffer.from(value, "base64url").toString("utf8"); }
function signature(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
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
    if (current) return { ...current };
    // Newly registered PC accounts carry a server-signed session just like
    // D'mir. The historical KNOWN_ACCOUNTS bootstrap list must not prohibit
    // them from remaining signed in. Non-bootstrap users cannot self-elevate.
    const candidate = parsed.account;
    if (candidate.role !== "player" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate.id) ||
        !/^[a-z0-9_.@-]{3,80}$/i.test(candidate.username) ||
        !candidate.displayName || candidate.displayName.length > 80) return null;
    return {...candidate, role:"player"};
  } catch {
    return null;
  }
}
