/** Limits simultaneous provider requests and classifies recoverable NPC autoplay failures. */
export function npcAutoplayConcurrency(value: number): number {
  return Math.min(2,Math.max(1,Number.isFinite(value)?value:2));
}
export function shouldDeferNpcAutoplayFailure(err: unknown): boolean {
  const error=err as {status?:number;message?:string}|null;
  const code=Number(error?.status);
  const message=String(error?.message||err||"");
  return [429,502,503,504].includes(code)||
    /rate limit|request budget|cooling down|temporarily unavailable|quota/i.test(message);
}
