import { describe, expect, it } from "vitest";
import { itemStatBlock, itemPreset } from "../original/lib/itemStats";
describe("verified item stat blocks", () => {
 it("shows source-backed blaster and armor without granting proficiency", () => {
  expect(itemStatBlock({name:"Blaster pistol"}).stats.Damage).toBe("3d6 energy");
  const armor=itemStatBlock({name:"Armored spacer’s flight suit"},{level:12});
  expect(armor.stats["Reflex armor bonus"]).toContain("+5");
  expect(armor.proficient).toBe(false);
 });
 it("does not reinterpret unknown equipment or auto-scale rewards", () => {
  expect(itemPreset({name:"Sith mask",statBlock:{damage:"100d6"}})).toBe(null);
  const mask=itemStatBlock({name:"Sith mask",tag:"force-relic",acquisition:"Earned in the tomb"},{level:1});
  expect(mask.earned).toContain("Earned"); expect(mask.stats["Mechanical bonus"]).toBe("None established");
 });
 it("separates leased housing and recorded facilities from free bacta", () => {
  const block=itemStatBlock({name:"Unit 3-G",type:"lease",lease:{months:6,rentCredits:108000,depositCredits:18000}});
  expect(block.stats.Tenure).toContain("Leased"); expect(block.stats.Recovery).toContain("once per 24");
  expect(block.stats.Facilities).not.toContain("bacta");
 });
 it("uses actual X-34 stats only for an identified model", () => {
  expect(itemStatBlock({name:"SoroSuub X-34 landspeeder"}).stats["Base HP"]).toBe(40);
  expect(itemStatBlock({name:"Luxury civilian landspeeder",ownership:"vehicle"}).stats.Identification).toContain("No verified");
 });
});
