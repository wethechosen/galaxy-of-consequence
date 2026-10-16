import {describe,it,expect} from "vitest";
import {ALL_NPC_TEST_ROSTER} from "./npc-test-roster";
import {NPC_HISTORICAL_TIERS,reconstructHumanNpc} from "./npc-historical-baselines";
import {progressionStatus} from "@/original/lib/sagaAdvancement";
import {accountStore} from "./accounts";
import {readDatapad} from "./datapad-save";
// This regression intentionally uses the isolated seeded NPC database;
// do not look for test character accounts in production or a developer default DB.
describe.skipIf(!String(process.env.CAMPAIGN_DB_PATH||"").endsWith("npc-autoplay-150.sqlite"))("150 ABY experienced PC origin builds",()=>{
  for(const [id,profile] of Object.entries(NPC_HISTORICAL_TIERS)){
    it(id+" carries a legal Saga heroic starting career without overwriting played turns",()=>{
      const npc=ALL_NPC_TEST_ROSTER.find(n=>n.id===id)!;
      const db=accountStore();
      const account=db.prepare("SELECT id,username,displayName,role FROM accounts WHERE username=?")
        .get("npc-autoplay-"+id) as any;
      if(!account)throw Error("Missing existing character save: "+id);
      const current=readDatapad(account,null,db);
      if(!current.snapshot)throw Error("No original save");
      const changed=reconstructHumanNpc(current.snapshot,npc);
      const after=progressionStatus(changed.character||{});
      expect(after.level).toBe(profile.level);
      expect(after.pendingLevels).toBe(0);
      expect(after.buildConsistent).toBe(true);
      expect(changed.character?.npcHistoricalReason).toBe(profile.reason);
      expect(changed.gameState.turnEvents).toEqual(current.snapshot.gameState.turnEvents);
      expect(changed.messages).toEqual(current.snapshot.messages);
      expect(changed.character?.npcStartingXp).toBeGreaterThan(0);
      if(id==="darth-korvalis"){
        expect(changed.character?.forceSensitive).toBe("Yes");
        expect(String(changed.character?.forcePowers)).toMatch(/Force Grip|Force Lightning/);
        expect(changed.character?.level).toBe(12);
      }
    });
  }
});