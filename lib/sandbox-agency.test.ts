import {describe,expect,it} from "vitest";
import {isOrdinarySandboxAttempt,isArtificialHardStop,assertSandboxAgency,mayUseCivilianAgencyRecovery,civilianAgencyRecovery,SANDBOX_GM_AGENCY} from "./sandbox-agency";
import {parseEngineResponse} from "@/original/lib/engineState";
import {assertCampaignResponseStructure,assertNoProgressLoop,assertNarrativeLedgerConsistency} from "./gm";

const passage="## GAMEPLAY RESULT\nThe shipmaster refuses passenger passage. There is no other way to reach the destination, no options available. You must leave.\n\n## PLAYER OPTIONS\nA. Leave.\nYou may declare another action.";
const tailor="## GAMEPLAY RESULT\nThe worker cannot make appointments. You have no introduction. Your options are limited to asking the same front clerk who already refused or leaving the atelier.\n\n## PLAYER OPTIONS\nA. Ask the same clerk.\nB. Leave.\nYou may declare another action.";
const legitimate="## GAMEPLAY RESULT\nThe vendor can't accept the payment at this desk, but directs you to the licensed broker directory where a different agent can review the transaction. No payment is taken.\n\n## PLAYER OPTIONS\nA. Visit the broker directory.\nYou may declare another action.";
describe("systemwide sandbox agency",()=>{
  it("does not allow limited menus to trap open-world ordinary attempts",()=>{
    expect(isOrdinarySandboxAttempt("I ask for a charter captain")).toBe(true);
    expect(isOrdinarySandboxAttempt("I investigate the guild hall")).toBe(true);
    expect(isOrdinarySandboxAttempt("I explore the market")).toBe(true);
    expect(isOrdinarySandboxAttempt("I attack the guards")).toBe(false);
    expect(isOrdinarySandboxAttempt("I intimidate the clerk")).toBe(false);
    expect(SANDBOX_GM_AGENCY).toContain("ANY rules-legal action");
  });
  it("rejects dead ends across transit and social commerce",()=>{
    expect(isArtificialHardStop(passage,"I ask for passenger passage")).toBe(true);
    expect(isArtificialHardStop(tailor,"How do I request a commission?")).toBe(true);
    expect(()=>assertSandboxAgency(passage,"I ask for passenger passage",null,{})).toThrow(/Sandbox dead end/);
    expect(()=>assertSandboxAgency(tailor,"How do I request a commission?",null,{})).toThrow(/Sandbox dead end/);
  });
  it("respects a person's refusal when an independently actionable route exists",()=>{
    expect(isArtificialHardStop(legitimate,"I ask to pay the vendor")).toBe(false);
    expect(()=>assertSandboxAgency(legitimate,"I ask to pay the vendor",null,{})).not.toThrow();
    expect(()=>assertSandboxAgency(passage,"I ask for passenger passage",{outcome:"failure"},{})).not.toThrow();
    expect(()=>assertSandboxAgency(passage,"I ask for passenger passage",null,{discoveryAdd:[{title:"another route"}]})).not.toThrow();
  });
  it("never claims civilian fallbacks bypass security, grant access or guarantee services",()=>{
    expect(mayUseCivilianAgencyRecovery("I ask for a ship charter","Bonadan spaceport")).toBe(true);
    expect(mayUseCivilianAgencyRecovery("I look for a local job","Coruscant city")).toBe(true);
    expect(mayUseCivilianAgencyRecovery("I hack a secured banking terminal","Coruscant bank")).toBe(false);
    expect(mayUseCivilianAgencyRecovery("I ask for a charter","Uncharted jungle")).toBe(false);
    for(const [action,place] of [["I hire a pilot","Bonadan spaceport"],["I request a merchant meeting","Coruscant business district"],["I investigate the archive","Bastion city court"]]){
      const {content,lead}=civilianAgencyRecovery(action,place);
      const parsed=parseEngineResponse(content,{requireState:true});
      expect(()=>assertCampaignResponseStructure(parsed.clean)).not.toThrow();
      expect(()=>assertSandboxAgency(parsed.clean,action,null,parsed.delta as unknown as Record<string,unknown>)).not.toThrow();
      expect(()=>assertNoProgressLoop(parsed.clean,action,parsed.delta as unknown as Record<string,unknown>,place,"No other avenue is possible.")).not.toThrow();
      expect(()=>assertNarrativeLedgerConsistency(parsed.clean,parsed.delta as unknown as Record<string,unknown>,action)).not.toThrow();
      expect(lead).toContain(place);
      expect(parsed.delta).toMatchObject({discoveryAdd:[expect.objectContaining({detail:expect.stringContaining("ordinary public route")})]});
      expect(content).not.toMatch(/appointment (?:is|has been) booked|payment completed|access granted|mission complete/i);
    }
  });
});
