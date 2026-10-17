import {expect,it} from "vitest";
import {ALL_NPC_TEST_ROSTER} from "./npc-test-roster";
import {NPC_HISTORICAL_TIERS} from "./npc-historical-baselines";
import {npcMechanics,recordNpcMechanics} from "./npc-mechanics";
it("validates all 17 supported Human prior careers without treating rehearsal levels as actual stats",()=>{
  for(const [id,tier] of Object.entries(NPC_HISTORICAL_TIERS)) {
    const npc=ALL_NPC_TEST_ROSTER.find(n=>n.id===id)!;
    const mechanics=npcMechanics(npc.name);
    expect(mechanics.status, npc.name+": "+mechanics.reason).toBe("validated-core-build");
    expect(mechanics.character?.level).toBe(tier.level);
    expect(Number(mechanics.character?.maxHitPoints)).toBeGreaterThan(0);
    expect(mechanics.skillModifiers?.Perception).toBeTypeOf("number");
  }
});
it("does not convert alien proposals or unknown identities into Human builds",()=>{
  expect(npcMechanics("Rena Salvek").status).toBe("pending-validation");
  expect(npcMechanics("Jax").character).toBeUndefined();
  expect(npcMechanics("Kelvek").character).toBeUndefined();
});
it("records only present supported identities and preserves their saved injuries and progression",()=>{
  const original={credits:50,npcMechanics:{"orlan-vale":{health:2,conditionTrack:3}}};
  const next=recordNpcMechanics(original,[{name:"Orlan Vale"},{name:"Jax"}]);
  expect(next).toBe(original);
  const seeded=recordNpcMechanics({credits:50},[{name:"Orlan Vale"}]);
  expect((seeded.npcMechanics as any)["orlan-vale"].character.level).toBe(6);
  expect(seeded.credits).toBe(50);
  const returned=npcMechanics("Orlan Vale"); returned.character!.level=1;
  expect(npcMechanics("Orlan Vale").character!.level).toBe(6);
});
