import { describe, expect, it } from "vitest";
import { isAtelierAppointmentRequest, hasAtelierBookingPath, assertAtelierAppointmentProgress, atelierAppointmentRecovery } from "./atelier-appointments";
import { assertCampaignResponseStructure, assertNoProgressLoop, assertNarrativeLedgerConsistency } from "./gm";
import { parseEngineResponse } from "@/original/lib/engineState";

const location = "Bonadan — Nuvorren Design House, rear workroom";
const declaration = "gm how do i get an appointment here?";
const blocked = `## GAMEPLAY RESULT
The worker's position is firm: they do not take direct clients and cannot set appointments for you. No commission terms, contact name, or introduction are offered.
If you want to pursue this further, your options are limited to what you have established so far: return to the front counter and try speaking with the clerk (already attempted; she yielded nothing); show a cred chit; or leave Nuvorren Design House. No state change.
## PLAYER OPTIONS
A. Return to the front clerk.
B. Leave.
You may declare another action.`;

describe("Bonadan commission access must stay playable", () => {
  it("recognizes the exact screenshot declaration and legitimate commission inquiries", () => {
    expect(isAtelierAppointmentRequest(declaration, location)).toBe(true);
    expect(isAtelierAppointmentRequest("How do I set an appointment for commission?", location)).toBe(true);
    expect(isAtelierAppointmentRequest("I threaten the tailor into booking the appointment", location)).toBe(false);
    expect(isAtelierAppointmentRequest(declaration, "Taris — cantina")).toBe(false);
  });
  it("rejects the on-screen circular refusal and accepts a usable access route", () => {
    expect(hasAtelierBookingPath(blocked)).toBe(false);
    expect(() => assertAtelierAppointmentProgress(blocked, declaration, location)).toThrow(/no actionable appointment route/);
    const good = `## GAMEPLAY RESULT
The attendant directs D'mir to the showroom client-intake concierge. The concierge accepts written commission briefs and forwards them to the commission director, who must confirm an appointment.`;
    expect(() => assertAtelierAppointmentProgress(good, declaration, location)).not.toThrow();
  });
  it("recovers a concrete scheduling lead without spending or fabricating the booking", () => {
    const recovered = atelierAppointmentRecovery(location);
    expect(recovered.content).toContain("showroom client-intake concierge");
    expect(recovered.content).toContain("director still must confirm");
    expect(recovered.content).toContain("<!--STATE:");
    expect(recovered.content).not.toMatch(/appointment (?:is|has been) booked/i);
    const parsed = parseEngineResponse(recovered.content, {requireState:true});
    expect(() => assertCampaignResponseStructure(parsed.clean)).not.toThrow();
    expect(() => assertAtelierAppointmentProgress(parsed.clean, declaration, location)).not.toThrow();
    expect(() => assertNoProgressLoop(parsed.clean,declaration, parsed.delta as unknown as Record<string, unknown>, location, "There is no appointment here.")).not.toThrow();
    expect(() => assertNarrativeLedgerConsistency(parsed.clean, parsed.delta as unknown as Record<string, unknown>, declaration)).not.toThrow();
    expect(parsed.delta).toMatchObject({discoveryAdd:[expect.objectContaining({title:"Nuvorren bespoke commission intake",detail:expect.stringContaining("client-intake concierge")})]});
  });
});
