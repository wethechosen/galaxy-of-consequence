const baseUrl = (process.env.GOC_BASE_URL || "https://galaxy-local.vercel.app").replace(/\/$/, "");
const token = process.env.GOC_GPT_ACTION_KEY;
if (!token) {
  console.error("GOC_GPT_ACTION_KEY is required.");
  process.exit(2);
}

const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) }, cache: "no-store" });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { response, body };
}

async function readState() {
  const { response, body } = await request("/api/gpt/state", { method: "GET" });
  if (!response.ok) throw new Error(`GET /api/gpt/state failed ${response.status}: ${JSON.stringify(body)}`);
  if (!Number.isInteger(body?.revision)) throw new Error("State response did not contain an integer revision.");
  return body;
}

const before = await readState();
const turnId = `smoke-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const action = process.env.GOC_SMOKE_ACTION || "Without moving or changing inventory, carefully observe the immediate surroundings for exits and immediate threats.";

const first = await request("/api/gpt/turn", {
  method: "POST",
  body: JSON.stringify({ revision: before.revision, action, turnId }),
});

if (!first.response.ok) {
  throw new Error(`POST /api/gpt/turn failed ${first.response.status}: ${JSON.stringify(first.body)}`);
}

const committedRevision = first.body?.revision;
if (!Number.isInteger(committedRevision) || committedRevision <= before.revision) {
  throw new Error(`Turn did not advance revision: before=${before.revision}, returned=${committedRevision}`);
}

const after = await readState();
if (after.revision !== committedRevision) {
  throw new Error(`Post-turn state mismatch: turn=${committedRevision}, reread=${after.revision}`);
}

// Idempotency probe: the same turnId must never advance state a second time.
const replay = await request("/api/gpt/turn", {
  method: "POST",
  body: JSON.stringify({ revision: before.revision, action, turnId }),
});
if (![200, 409].includes(replay.response.status)) {
  throw new Error(`Unexpected replay status ${replay.response.status}: ${JSON.stringify(replay.body)}`);
}

const finalState = await readState();
if (finalState.revision !== committedRevision) {
  throw new Error(`Idempotency failure: replay advanced revision from ${committedRevision} to ${finalState.revision}`);
}

console.log(JSON.stringify({
  ok: true,
  baseUrl,
  turnId,
  beforeRevision: before.revision,
  committedRevision,
  replayStatus: replay.response.status,
  finalRevision: finalState.revision,
}, null, 2));
