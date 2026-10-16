/**
 * Isolated autonomous NPC test-only repair: administrative origin/arc setup
 * advanced save revisions while an earlier no-outcome action was pending.
 * Preserve turnId, declared action and saved roll; never rebase over a
 * different gameplay turn or a completed attempt.
 */
import type {DatabaseSync} from "node:sqlite";
export function rebaseIsolatedNpcPendingAttempt(
  db:DatabaseSync,
  args:{accountId:string;turnId:string;currentRevision:number;
    existingGameTurnCount:number;expectedGameTurnCount:number;
    verifiedAdministrativeChange:boolean}
) {
  const existing=db.prepare("SELECT base_revision,status,action,roll FROM gm_turn_attempts WHERE account_id=? AND turn_id=?")
    .get(args.accountId,args.turnId) as {
      base_revision:number;status:string;action:string;roll:string|null
    }|undefined;
  if(!existing||Number(existing.base_revision)===args.currentRevision)
    return {rebased:false,action:existing?.action||null,rollPreserved:true};
  const eligible=existing.status==="pending"&&args.verifiedAdministrativeChange &&
    args.existingGameTurnCount===args.expectedGameTurnCount &&
    Number(existing.base_revision)<args.currentRevision &&
    Boolean(existing.action?.trim());
  if(!eligible)throw Error("Pending turn cannot be rebased: save contains unverified changes.");
  const result=db.prepare("UPDATE gm_turn_attempts SET base_revision=? WHERE account_id=? AND turn_id=? AND status='pending' AND base_revision=?")
    .run(args.currentRevision,args.accountId,args.turnId,existing.base_revision);
  if(result.changes!==1)throw Error("Pending turn revision changed concurrently; no modification committed.");
  const verified=db.prepare("SELECT base_revision,action,roll,status FROM gm_turn_attempts WHERE account_id=? AND turn_id=?")
    .get(args.accountId,args.turnId) as typeof existing;
  if(!verified || Number(verified.base_revision)!==args.currentRevision ||
    verified.action!==existing.action || verified.roll!==existing.roll ||
    verified.status!=="pending")
    throw Error("Pending turn action or roll integrity check failed.");
  return {rebased:true,action:verified.action,rollPreserved:true,
    previousRevision:existing.base_revision,revision:args.currentRevision};
}
