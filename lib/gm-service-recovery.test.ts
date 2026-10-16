import { describe, expect, it } from "vitest";
import { assertCampaignResponseStructure, assertNarratedLocation, normalizeCampaignSections } from "./gm";
import { isRoutineServiceInquiry } from "./scene-commerce";

const saved = "Bonadan — Nuvorren Design House, front counter";
const scene = "D'mir stands at the front counter beside a display of fine garments, with the clerk consulting the private commission book while an assistant works beyond the open doorway.";
const reply = `## LOCATION
Bonadan — Nuvorren Design House, rear workroom

## SCENE
${scene}

## GM ADJUDICATION
An ordinary appointment question requires no Saga skill check.

## GAMEPLAY RESULT
The clerk explains that a bespoke request and preferred day go to the commission director, who must confirm an available appointment before anything is booked.

## SAGA CHECK
No check required.

## STATE UPDATE
No persistent change.

## PLAYER OPTIONS
A. Ask the clerk to forward the details.
B. Request the commission director's hours.
You may declare another action.`;

describe("routine service-dialogue recovery", () => {
  it("treats the Nuvorren commission question as ordinary dialogue, not a purchase or skill challenge", () => {
    expect(isRoutineServiceInquiry("How do I set an appointment for commission?")).toBe(true);
    expect(isRoutineServiceInquiry("When can I return for a fitting?")).toBe(true);
    expect(isRoutineServiceInquiry("Who manages bespoke commissions here?")).toBe(true);
    expect(isRoutineServiceInquiry("I pay the tailor and book my commission now")).toBe(false);
    expect(isRoutineServiceInquiry("I intimidate the clerk into giving me the appointment")).toBe(false);
  });

  it("repairs an incorrect LOCATION heading on stationary dialogue", () => {
    const normalized = normalizeCampaignSections(reply, {}, saved, true);
    expect(normalized).toContain(`## LOCATION\n${saved}`);
    expect(normalized).not.toContain("rear workroom");
    expect(() => assertCampaignResponseStructure(normalized)).not.toThrow();
    expect(() => assertNarratedLocation(normalized, {}, saved)).not.toThrow();
  });

  it("deduplicates LOCATION headings while preserving the actual answer and options", () => {
    const duplicate = reply.replace("## SCENE", "## LOCATION\nElsewhere in the building\n\n## SCENE");
    const normalized = normalizeCampaignSections(duplicate, {}, saved, true);
    expect(normalized.match(/^## LOCATION$/gm)).toHaveLength(1);
    expect(normalized).toContain("The clerk explains that a bespoke request");
    expect(normalized).toContain("B. Request the commission director's hours.");
    expect(() => assertCampaignResponseStructure(normalized)).not.toThrow();
    expect(() => assertNarratedLocation(normalized, {}, saved)).not.toThrow();
    // Repeated game-outcome sections are not harmless presentation noise.
    const bad = reply.replace("## SAGA CHECK", "## GAMEPLAY RESULT\nA second contradictory result.\n\n## SAGA CHECK");
    expect(() => assertCampaignResponseStructure(normalizeCampaignSections(bad, {}, saved, true))).toThrow();
  });

  it("does not rewrite a real travel destination or a state change as mere formatting", () => {
    const destination = "Bonadan — City Spaceport";
    const rendered = normalizeCampaignSections(reply, { location: destination }, saved);
    expect(rendered).toContain("rear workroom");
    expect(() => assertNarratedLocation(rendered, { location: destination }, saved)).toThrow();
  });
});
