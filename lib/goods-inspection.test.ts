import { describe, expect, it } from "vitest";
import { constrainReadOnlyGoodsInspectionDelta, isReadOnlyGoodsInspection } from "./goods-inspection";

describe("read-only merchandise inspection", () => {
  it.each([
    "I inspect the medpac seal and expiration date.",
    "Look over the med-pack packaging and check its condition.",
    "The vendor hands it over temporarily; I examine the medpac label.",
  ])("recognizes inspection without transferring ownership: %s", (action) => {
    expect(isReadOnlyGoodsInspection(action)).toBe(true);
  });

  it.each([
    "I inspect and buy the medpac.",
    "I check the fit, then pay for the armor.",
    "I examine the coat and put it on.",
    "I use my medpac.",
    "I sell the old clothing after looking it over.",
  ])("does not erase an explicit material action: %s", (action) => {
    expect(isReadOnlyGoodsInspection(action)).toBe(false);
  });

  it.each([
    "I return to the test plots at dawn to check for germination, examining soil moisture and seed condition, then share my observations with the farmers.",
    "I access the Biomedical Compliance Unit's public database on my datapad, entering the prosthesis registry number to check for certification recalls.",
    "I examine the physical shipment manifests and their inspection logs to cross-check cargo references.",
    "I review the public registry status on my device.",
    "I inspect the ship's maintenance diagnostic readings before troubleshooting its pressure seal.",
  ])("does NOT misclassify NPC investigation or technical work as merchandise inspection: %s", action => {
    expect(isReadOnlyGoodsInspection(action)).toBe(false);
  });

  it("removes an invented purchase while retaining non-material scene state", () => {
    expect(constrainReadOnlyGoodsInspectionDelta({
      credits: -5400,
      inventoryAdd: [{ name: "Medpac", qty: 12 }],
      inventoryRemove: [{ name: "Old clothing", qty: 1 }],
      location: "Coruscant market",
      timeAdvanceMinutes: 2,
    }, "I inspect the medpac seal and expiration date.")).toEqual({
      credits: 0,
      creditsCriminal: 0,
      bankCredits: 0,
      inventoryAdd: [],
      inventoryRemove: [],
      propertyAdd: [],
      shipAdd: [],
      investmentAdd: [],
      location: "Coruscant market",
      timeAdvanceMinutes: 2,
    });
  });

  it("does not alter the exact ledger of a server-verified accepted trade", () => {
    const delta = { credits: -5400, inventoryAdd: [{ name: "Medpac", qty: 12 }] };
    expect(constrainReadOnlyGoodsInspectionDelta(delta, "I inspect and buy the medpacs.", true)).toBe(delta);
  });
});
