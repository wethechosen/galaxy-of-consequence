import { describe, expect, it } from "vitest";
import { objectiveIsAuthoritativelyFulfilled, reconcileFulfilledObjectives } from "./objective-reconciliation";

const state = {
  location: "Taris — Shipyards, Level C",
  properties: [{ name: "Unit 3-G", type: "Residential lease", tenure: "leased", status: "active" }],
  tradeReceipts: [
    { turnId: "lease", items: [{ name: "Six-month lease: Unit 3-G", tag: "property", qty: 1 }] },
    { turnId: "coat", items: [{ name: "Black Longcoat Ensemble, Model VII-Spec", tag: "clothing", qty: 1 }] },
  ],
  objectives: [
    { title: "Secure proper housing on Coruscant", status: "active" },
    { title: "Acquire the black longcoat outfit", status: "active" },
    { title: "Leave Coruscant", status: "future" },
    { title: "Trace the dark-side pull beneath Coruscant", status: "deferred" },
  ],
};

describe("authoritative objective reconciliation", () => {
  it("closes receipted purchases, established housing, and completed departures", () => {
    const reconciled = reconcileFulfilledObjectives(state, 42);
    expect((reconciled.objectives as Array<Record<string, unknown>>).map((entry) => [entry.title, entry.status])).toEqual([
      ["Secure proper housing on Coruscant", "completed"],
      ["Acquire the black longcoat outfit", "completed"],
      ["Leave Coruscant", "completed"],
      ["Trace the dark-side pull beneath Coruscant", "deferred"],
    ]);
    expect((reconciled.objectives as Array<Record<string, unknown>>)[0]).toMatchObject({ completedAt: 42, completionSource: "authoritative-ledger" });
  });

  it("is idempotent and never treats an unreceipted inventory label as proof of purchase", () => {
    const unreconciled = { location: "Coruscant", inventory: [{ name: "Black Longcoat Ensemble", qty: 1 }], objectives: [{ title: "Acquire the black longcoat outfit", status: "active" }] };
    expect(objectiveIsAuthoritativelyFulfilled(unreconciled.objectives[0], unreconciled)).toBe(false);
    const once = reconcileFulfilledObjectives(state, 42);
    expect(reconcileFulfilledObjectives(once, 99)).toBe(once);
  });
});
