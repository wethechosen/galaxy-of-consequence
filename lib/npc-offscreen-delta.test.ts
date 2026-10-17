import {describe,it,expect} from "vitest";
import {parseEngineResponse,applyEngineDelta} from "@/original/lib/engineState";
const reply=(state:Record<string,unknown>)=>"## LOCATION\nBastion\n\n## GAMEPLAY RESULT\nCaptain Vell transmits a verified report.\n<!--STATE:"+JSON.stringify(state)+"-->";
describe("NPC intelligence commands follow the authoritative GM delta whitelist",()=>{
 it("keeps structured and bounded link, report and plan-resolve requests",()=>{
  const parsed=parseEngineResponse(reply({
   npcIntelLinkAdd:[{sender:"Captain Vell",recipient:"Agent Nira",channel:"comlink",sourceTurnId:"known-turn"}],
   npcIntelReportAdd:[{sender:"Captain Vell",recipient:"Agent Nira",linkId:"known-link",sourceTurnId:"witnessed-turn",transitMinutes:45}],
   npcOffscreenPlanResolve:[{planId:"due-plan",outcome:"adjudicated"}],
  }),{requireState:true});
  expect(parsed.delta).toMatchObject({
   npcIntelLinkAdd:[{channel:"comlink",sourceTurnId:"known-turn"}],
   npcIntelReportAdd:[{transitMinutes:45}],
   npcOffscreenPlanResolve:[{planId:"due-plan",outcome:"adjudicated"}],
  });
  const result=applyEngineDelta({location:"Bastion"},parsed.delta);
  expect(result).not.toHaveProperty("npcOffscreenPlanResolve");
  expect(result).not.toHaveProperty("npcIntelReportAdd");
 });
 it.each([
  {npcIntelLinkAdd:[{sender:"A",recipient:"B",channel:"telepathy",sourceTurnId:"t"}]},
  {npcIntelReportAdd:[{sender:"A",recipient:"B",linkId:"l",sourceTurnId:"t",transitMinutes:-5}]},
  {npcIntelReportAdd:[{sender:"A",recipient:"B",linkId:"l",sourceTurnId:"t",transitMinutes:10081}]},
  {npcOffscreenPlanResolve:[{planId:"p",outcome:"automatic-success"}]},
 ])("rejects unsupported offscreen effects before they can change game state",bad=>{
  expect(()=>parseEngineResponse(reply(bad),{requireState:true})).toThrow();
 });
});
