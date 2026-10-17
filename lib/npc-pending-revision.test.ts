import {it,expect} from "vitest";
import {DatabaseSync} from "node:sqlite";
import {rebaseIsolatedNpcPendingAttempt} from "./npc-pending-revision";
function setup(){
  const db=new DatabaseSync(":memory:");
  db.exec("CREATE TABLE gm_turn_attempts(account_id TEXT,turn_id TEXT,base_revision INTEGER,action TEXT,roll TEXT,status TEXT)");
  db.prepare("INSERT INTO gm_turn_attempts VALUES(?,?,?,?,?,?)")
    .run("npc","npc-real-ardis-nefar-t002",2,"I review the freight logs.",'{"roll":14}',"pending");
  return db;
}
it("preserves the original pending NPC action, roll and immutable turn ID when only setup advanced",()=>{
  const db=setup();
  const before=db.prepare("SELECT * FROM gm_turn_attempts").get() as any;
  const outcome=rebaseIsolatedNpcPendingAttempt(db,{
    accountId:"npc",turnId:"npc-real-ardis-nefar-t002",currentRevision:4,
    existingGameTurnCount:1,expectedGameTurnCount:1,verifiedAdministrativeChange:true
  });
  const after=db.prepare("SELECT * FROM gm_turn_attempts").get() as any;
  expect(outcome.rebased).toBe(true);
  expect(after.base_revision).toBe(4);
  expect(after.turn_id).toBe(before.turn_id);
  expect(after.action).toBe(before.action);
  expect(after.roll).toBe(before.roll);
  expect(after.status).toBe("pending");
  expect(rebaseIsolatedNpcPendingAttempt(db,{
    accountId:"npc",turnId:"npc-real-ardis-nefar-t002",currentRevision:4,
    existingGameTurnCount:1,expectedGameTurnCount:1,verifiedAdministrativeChange:true,
  }).rebased).toBe(false);
  db.close();
});
it("refuses to rebase when gameplay advanced or no validated origin/setup marker exists",()=>{
  const db=setup();
  const options={accountId:"npc",turnId:"npc-real-ardis-nefar-t002",currentRevision:4,
    existingGameTurnCount:2,expectedGameTurnCount:1,verifiedAdministrativeChange:true};
  expect(()=>rebaseIsolatedNpcPendingAttempt(db,options)).toThrow("unverified");
  expect(()=>rebaseIsolatedNpcPendingAttempt(db,{...options,
    existingGameTurnCount:1,verifiedAdministrativeChange:false})).toThrow("unverified");
  expect((db.prepare("SELECT base_revision FROM gm_turn_attempts").get() as any).base_revision).toBe(2);
  db.close();
});
it("refuses to rebase a completed turn rather than duplicating XP or material effects",()=>{
  const db=setup();
  db.prepare("UPDATE gm_turn_attempts SET status='complete'").run();
  expect(()=>rebaseIsolatedNpcPendingAttempt(db,{
    accountId:"npc",turnId:"npc-real-ardis-nefar-t002",currentRevision:3,
    existingGameTurnCount:1,expectedGameTurnCount:1,verifiedAdministrativeChange:true
  })).toThrow("unverified");
  db.close();
});
it("recovers the preserved first Kor-Vess turn after a setup-only revision 1 to 3",()=>{
  const db=new DatabaseSync(":memory:");
  db.exec("CREATE TABLE gm_turn_attempts(account_id TEXT,turn_id TEXT,base_revision INTEGER,action TEXT,roll TEXT,status TEXT)");
  const action="I step forward into the negotiation ring and address the clan leaders.";
  db.prepare("INSERT INTO gm_turn_attempts VALUES(?,?,?,?,?,?)")
    .run("kor","npc-real-kor-vess-t001",1,action,null,"pending");
  const result=rebaseIsolatedNpcPendingAttempt(db,{
    accountId:"kor",turnId:"npc-real-kor-vess-t001",currentRevision:3,
    existingGameTurnCount:0,expectedGameTurnCount:0,verifiedAdministrativeChange:true,
  });
  const after=db.prepare("SELECT * FROM gm_turn_attempts").get() as any;
  expect(result.rebased).toBe(true);
  expect(after.base_revision).toBe(3);
  expect(after.action).toBe(action);
  expect(after.roll).toBeNull();
  expect(after.turn_id).toBe("npc-real-kor-vess-t001");
  db.close();
});
