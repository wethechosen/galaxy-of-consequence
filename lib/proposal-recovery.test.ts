import { describe, expect, it } from "vitest";
import { resolvedProposalDiscussion } from "./gm";
import { reconcileCommittedArrival } from "./committed-arrival";
import type { DatapadSnapshot } from "./datapad-save";
const action = "Tell Jax I'm ready to discuss his original six-month employment proposal seriously.";
const snapshot = {character:{name:"D'mir"}, gameState:{location:"Taris — Market District (inside the cantina)",credits:628650006,scene:{id:"508",action:"I head back to the docks and seek Jax out"}}, messages:[{role:"assistant",content:"## GAMEPLAY RESULT\nYou successfully navigate the market district and arrive at Docking Bay 94’s Level B slip 14 without delay or incident. Jax stands near the airlock.\n## SAGA CHECK\nNo check required."}], comms:[],settings:{}} as unknown as DatapadSnapshot;
describe("revision 508 recovery", () => {
 it("reconciles only the last committed arrival without spending or advancing time", () => {
  const fixed = reconcileCommittedArrival(snapshot);
  expect(fixed.gameState.location).toBe("Taris — Docking Bay 94, Level B slip 14");
  expect(fixed.gameState.credits).toBe(snapshot.gameState.credits);
  expect(reconcileCommittedArrival(fixed)).toBe(fixed);
 });
 it("does not turn a failed arrival or player goal into a destination", () => {
  const failed = {...snapshot,messages:[{role:"assistant",content:"## GAMEPLAY RESULT\nYou do not arrive at Docking Bay 94."}]} as DatapadSnapshot;
  expect(reconcileCommittedArrival(failed)).toBe(failed);
 });
 it("engages the existing proposal without accepting or pricing a contract", () => {
  const receipt = resolvedProposalDiscussion(reconcileCommittedArrival(snapshot), action, "dialogue", null);
  expect(receipt?.content).toContain("What duties and destinations");
  expect(receipt?.content).not.toMatch(/credits":|inventoryAdd|tradeOfferAdd/);
  expect(resolvedProposalDiscussion(snapshot,"I accept and pay Jax for the contract","commerce",null)).toBeNull();
 });
});
