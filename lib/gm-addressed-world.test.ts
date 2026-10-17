import {describe,it,expect} from "vitest";
import {classifyTurnMode,isGmAddressedWorldAction} from "./gm";
describe("GM-addressed player statements are not automatically OOC",()=>{
  it.each([
    "gm how do i get an appointment here?",
    "GM, how do I request a bespoke commission at this shop?",
    "GM: I return to the front counter and ask the clerk.",
    "Game Master, can I buy a room here?",
    "GM where can I hire a pilot for my ship?",
  ])("allows an in-world declaration: %s",(action)=>{
    expect(isGmAddressedWorldAction(action)).toBe(true);
    expect(classifyTurnMode(action)).toBe("play");
  });
  it.each([
    "GM fix the engine error please",
    "GM how do I view my character sheet?",
    "GM why is the controller broken?",
    "GM what is my XP?",
    "GM, my game's save file crashed",
    "OOC: I want to correct my background",
  ])("keeps genuine game/meta questions out of the campaign: %s",(action)=>{
    expect(classifyTurnMode(action)).not.toBe("play");
  });
  it("does not assume ordinary unprefixed roleplay is metacommentary",()=>{
    expect(classifyTurnMode("How do I get an appointment here?")).toBe("play");
    expect(classifyTurnMode("I return to the front counter")).toBe("play");
  });
});
