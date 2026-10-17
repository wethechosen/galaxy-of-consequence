import {describe,it,expect} from "vitest";
import {interpretRpgActionContract,assertRpgOutcomeFocus} from "./rpg-action-contract";
const merchandise="## GAMEPLAY RESULT\nYou examine the merchandise where it is offered. You read visible condition, seal, label, and expiration markings. It remains with its current owner.";
const research="## GAMEPLAY RESULT\nThe public certification database lists a recalled serial number, though the physical prosthesis has not yet been inspected.";
describe("type-safe player action interpretation before GM narration",()=>{
 it("classifies database investigation, not a datapad purchase",()=>{
  const contract=interpretRpgActionContract("I check the public certification database on my datapad for prosthesis recalls.");
  expect(contract.kind).toBe("research");
  expect(contract.movementDeclared).toBe(false);
  expect(contract.outcomeAuthority).toBe("server-gm-only");
  expect(()=>assertRpgOutcomeFocus(contract,merchandise)).toThrow(/Unrelated merchandise/);
  expect(()=>assertRpgOutcomeFocus(contract,research)).not.toThrow();
 });
 it("classifies field crop diagnostics separately from merchandise",()=>{
  const contract=interpretRpgActionContract("I check the test plots at dawn for germination, seed condition and soil moisture.");
  expect(contract.kind).toBe("technical");
  expect(()=>assertRpgOutcomeFocus(contract,merchandise)).toThrow(/Unrelated merchandise/);
 });
 it("allows actual visible-goods inspections without ownership",()=>{
  const contract=interpretRpgActionContract("I inspect the medpac seal and expiration date.");
  expect(contract.kind).toBe("merchandise_inspection");
  expect(()=>assertRpgOutcomeFocus(contract,merchandise)).not.toThrow();
  expect(()=>assertRpgOutcomeFocus(contract,"## GAMEPLAY RESULT\nYou pay 50 credits and purchase the medpac.")).toThrow(/inspection/);
 });
 it("preserves combat, travel and dialogue as different kinds of declared intent",()=>{
  expect(interpretRpgActionContract("I shoot the attacker with my blaster.").kind).toBe("combat");
  const travel=interpretRpgActionContract("I leave the shop and travel to the landing pad.");
  expect(travel.kind).toBe("travel");
  expect(travel.movementDeclared).toBe(true);
  expect(interpretRpgActionContract("I ask the clerk when the office opens.").kind).toBe("dialogue");
 });
 it("does not read a negative player declaration as an attack",()=>{
  const result=interpretRpgActionContract("I do not shoot the guard. I ask for directions.");
  expect(result.kind).not.toBe("combat");
 });
});
