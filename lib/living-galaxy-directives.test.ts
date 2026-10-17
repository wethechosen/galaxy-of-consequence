import { describe, expect, it } from "vitest";
import { GM_SYSTEM } from "./gm";
import { LIVING_GALAXY_DIRECTIVES } from "./living-galaxy-directives";
import { LORE_POLICY } from "./lore";

/** Contract/regression tests, not synthetic NPC victories or a replacement rule engine. */
describe("selected RPG System Bible policies", () => {
  it("shares the same world guidance through the one authoritative GM prompt", () => {
    expect(GM_SYSTEM).toContain(LIVING_GALAXY_DIRECTIVES);
    expect(GM_SYSTEM).toContain("single director over four private specialist roles");
    expect(GM_SYSTEM).toContain("Star Wars Saga Edition");
    expect(GM_SYSTEM).toContain("authoritative server roll");
  });
  it("weights NPC significance and forbids universal faction omniscience", () => {
    expect(LIVING_GALAXY_DIRECTIVES).toContain("Ambient bystanders have scene-only detail");
    expect(LIVING_GALAXY_DIRECTIVES).toContain("Promote importance only after an earned relationship or material event");
    expect(LIVING_GALAXY_DIRECTIVES).toContain("demonstrated awareness, jurisdiction, objectives, capacity, and time");
    expect(LIVING_GALAXY_DIRECTIVES).toContain("never teleports knowledge");
  });
  it("keeps Force atmosphere and corporate intrigue subordinate to confirmed mechanics", () => {
    expect(LIVING_GALAXY_DIRECTIVES).toContain("uncertain until established");
    expect(LIVING_GALAXY_DIRECTIVES).toContain("Neither a vision nor atmosphere");
    expect(LIVING_GALAXY_DIRECTIVES).toContain("through existing verified ledgers");
    expect(LIVING_GALAXY_DIRECTIVES).toContain("not player choices, completed events, guaranteed rewards");
    expect(GM_SYSTEM).toContain("never silently replace Saga math");
    expect(GM_SYSTEM).toContain("Award XP only for a completed");
  });
  it("does not import the PDF's conflicting percentile mechanics or an obsolete save system", () => {
    expect(LORE_POLICY).toContain("Approved campaign adaptations must be labelled and must not rewrite history.");
    expect(LIVING_GALAXY_DIRECTIVES).not.toMatch(/91.100|percentile|Supabase|Canvas/);
    expect(GM_SYSTEM).not.toContain("Miraculous success");
  });
});
