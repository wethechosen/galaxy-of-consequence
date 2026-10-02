import { describe, expect, it } from "vitest";
import { emptyWorld, settleEconomy } from "./world";

describe("authorized campaign economy", () => {
  it("resumes long catch-up without losing or duplicating transactions", () => {
    const world = emptyWorld();
    world.cashflows.push({ id: "income", label: "Approved income", credits: 1, intervalMs: 1, nextDueMs: 1, remainingOccurrences: 10001, status: "active", authorityEventId: "contract" });
    const first = settleEconomy(world, 0, 10001, new Set(["contract"]));
    expect(first.pending).toBe(true);
    expect(first.balance).toBe(10000);
    const second = settleEconomy(first.world, first.balance, 10001, new Set(["contract"]));
    expect(second.pending).toBe(false);
    expect(second.balance).toBe(10001);
    expect(second.world.ledger).toHaveLength(10001);
  });
  it("settles recurring payments chronologically and never repeats them", () => {
    const world = emptyWorld();
    world.cashflows = [
      { id: "income", label: "Work contract", credits: 100, intervalMs: 10, nextDueMs: 10, remainingOccurrences: 3, status: "active", authorityEventId: "contract" },
      { id: "rent", label: "Rent", credits: -50, intervalMs: 10, nextDueMs: 15, remainingOccurrences: null, status: "active", authorityEventId: "contract" },
    ];
    const result = settleEconomy(world, 0, 30, new Set(["contract"]));
    expect(result.balance).toBe(200);
    expect(result.world.ledger.map(row => row.campaignAtMs)).toEqual([10, 15, 20, 25, 30]);
    expect(result.world.cashflows[0].status).toBe("finished");
    expect(settleEconomy(result.world, result.balance, 30, new Set(["contract"])).world.ledger).toEqual(result.world.ledger);
    expect(world.ledger).toEqual([]);
  });
  it("pauses insufficient funds and deadline consequences without inventing debt", () => {
    const world = emptyWorld();
    world.cashflows.push({ id: "rent", label: "Rent", credits: -50, intervalMs: 10, nextDueMs: 0, remainingOccurrences: null, status: "active", authorityEventId: "contract" });
    world.contracts.push({ id: "job", title: "Delivery", deadlineMs: 10, status: "accepted", terms: "Deliver cargo", authorityEventId: "contract" });
    const result = settleEconomy(world, 5, 30, new Set(["contract"]));
    expect(result.balance).toBe(5);
    expect(result.world.decisions.map(d => d.kind)).toEqual(["funds", "deadline"]);
    expect(result.world.ledger).toEqual([]);
    expect(settleEconomy(result.world, 5, 30, new Set(["contract"])).world.decisions).toHaveLength(2);
  });
  it("rejects unapproved rates and invalid arithmetic", () => {
    const world = emptyWorld();
    world.cashflows.push({ id: "bad", label: "Forged income", credits: 999, intervalMs: 10, nextDueMs: 0, remainingOccurrences: null, status: "active", authorityEventId: "missing" });
    expect(() => settleEconomy(world, 0, 100, new Set())).toThrow("Unapproved");
    world.cashflows[0].intervalMs = 0;
    expect(() => settleEconomy(world, 0, 100, new Set(["missing"]))).toThrow("interval");
  });
});
