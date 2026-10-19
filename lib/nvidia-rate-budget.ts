import { neonConfigured, neonQuery, withNeonTransaction, hostedRuntimeRequired } from "./neon-db";
import { NvidiaProviderError } from "./nvidia-errors";
const SCOPE = "goc-nvidia";
const SPACING_MS = 2000; // 30 RPM, with headroom below the user's 40 RPM.
export const FALLBACK_NVIDIA_COOLDOWN_SECONDS = 65 * 60; // Conservative safety interval, NOT NVIDIA's measured reset window.
let localNext = 0, localCooldown = 0;
export function retryAfterIsEstimated(value: string | null, now = Date.now()) {
  if (!value?.trim()) return true;
  const seconds = Number(value);
  const duration = Number.isFinite(seconds) ? seconds : (Date.parse(value) - now) / 1000;
  return !Number.isFinite(duration) || duration <= 0;
}
export function parseRetryAfter(value: string | null, now = Date.now()) {
  if (retryAfterIsEstimated(value, now)) return FALLBACK_NVIDIA_COOLDOWN_SECONDS;
  const seconds = Number(value);
  const duration = Number.isFinite(seconds) ? seconds : (Date.parse(value!) - now) / 1000;
  return Math.max(1, Math.min(86400, Math.ceil(duration)));
}
export function planNvidiaSlot(now: number, next: number, cooldown: number) {
  const delay = Math.max(0, next - now, cooldown - now);
  return cooldown > now || delay > 3000 ? {waitMs:0, retryAfterSeconds:Math.max(1,Math.ceil(delay/1000))}
    : {waitMs:delay,nextSlot:now+delay+SPACING_MS};
}
function limited(seconds: number): never {
  throw new NvidiaProviderError("NVIDIA request budget is cooling down. Your action has not advanced; retry the same turn after the indicated delay.",429,seconds,429,true);
}
export async function reserveNvidiaSlot() {
  if (!neonConfigured()) {
    if (hostedRuntimeRequired()) throw new NvidiaProviderError("Shared NVIDIA pacing is not configured.",503);
    const plan = planNvidiaSlot(Date.now(),localNext,localCooldown);
    if (plan.retryAfterSeconds) limited(plan.retryAfterSeconds);
    localNext = plan.nextSlot!;
    return plan.waitMs;
  }
  const plan = await withNeonTransaction(async client => {
    await client.query("INSERT INTO private.goc_provider_budget(scope) VALUES ($1) ON CONFLICT DO NOTHING",[SCOPE]);
    const {rows} = await client.query("SELECT next_slot_ms,cooldown_ms,extract(epoch from clock_timestamp())*1000 AS now_ms FROM private.goc_provider_budget WHERE scope=$1 FOR UPDATE",[SCOPE]);
    const row=rows[0], plan=planNvidiaSlot(Number(row.now_ms),Number(row.next_slot_ms),Number(row.cooldown_ms));
    if (plan.nextSlot) await client.query("UPDATE private.goc_provider_budget SET next_slot_ms=$2 WHERE scope=$1",[SCOPE,Math.ceil(plan.nextSlot)]);
    return plan;
  });
  if (plan.retryAfterSeconds) limited(plan.retryAfterSeconds);
  return plan.waitMs;
}
export async function checkNvidiaCooldown() {
  if (!neonConfigured()) { if (localCooldown>Date.now()) limited(Math.ceil((localCooldown-Date.now())/1000)); return; }
  const [row] = await neonQuery<{remaining:string}>("SELECT greatest(0,ceil((cooldown_ms-extract(epoch from clock_timestamp())*1000)/1000)) AS remaining FROM private.goc_provider_budget WHERE scope=$1",[SCOPE]);
  if (Number(row?.remaining)>0) limited(Number(row.remaining));
}
export async function recordNvidiaCooldown(seconds: number) {
  if (!neonConfigured()) {localCooldown=Math.max(localCooldown,Date.now()+seconds*1000);return;}
  await neonQuery("INSERT INTO private.goc_provider_budget(scope,cooldown_ms) VALUES ($1,ceil(extract(epoch from clock_timestamp())*1000)::bigint+$2::bigint) ON CONFLICT(scope) DO UPDATE SET cooldown_ms=greatest(private.goc_provider_budget.cooldown_ms,excluded.cooldown_ms)",[SCOPE,seconds*1000]);
}
