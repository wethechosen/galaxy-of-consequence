import {expect,it} from "vitest";
import {recoverCampaignTurn} from "../original/lib/campaignSync";
it("loads the newer record without overwriting it with a failed turn's old holdings",()=>{
 const snapshot={character:{level:2},gameState:{credits:40,properties:[{id:"home"}]},messages:[{role:"assistant",content:"New scene"}]};
 const recovered=recoverCampaignTurn({revision:8,snapshot},{turnId:"pending-a",userText:"pay",history:[],stateOverride:{credits:100},characterOverride:{level:1}});
 expect(recovered.snapshot).toBe(snapshot);expect(recovered.pending.history).toBe(snapshot.messages);expect(recovered.pending.stateOverride).toBeUndefined();expect(recovered.pending.characterOverride.level).toBe(2);expect(recovered.pending.userText).toBe("pay");expect(recovered.committed).toBe(false);
});
it("recognizes a committed response after a lost network reply without resubmitting",()=>{
 const result=recoverCampaignTurn({revision:8,snapshot:{messages:[{role:"assistant",turnId:"turn-a"}]}},{turnId:"turn-a",userText:"pay"});expect(result.committed).toBe(true);expect(result.pending).toBeNull();
});
