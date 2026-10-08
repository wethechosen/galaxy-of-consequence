import { describe, expect, it } from "vitest";
import { applyBankTransfer, type BankTransfer } from "./bank-transfer";
import type { DatapadSnapshot } from "./datapad-save";

function snapshot(): DatapadSnapshot {
  return { character: { name: "Player", level: 1, experience: 500 }, gameState: {
    location: "Coruscant — lower-city market", credits: 1000, bankCredits: 250, underworldCredits: 90,
    inventory: [{ id: "comlink", name: "Comlink", qty: 1 }], time: 10,
  }, messages: [], comms: [], settings: {} };
}

describe("bank balance transfers", () => {
  it("moves existing credits both ways, preserving total wealth, scene and progression", () => {
    const before = snapshot();
    const deposited = applyBankTransfer(before, { action: "deposit", amount: 400 });
    expect(deposited.gameState).toEqual({ ...before.gameState, credits: 600, bankCredits: 650 });
    expect(deposited.character).toEqual(before.character);
    expect(applyBankTransfer(deposited, { action: "withdraw", amount: 400 })).toEqual(before);
    expect(before.gameState.credits).toBe(1000);
  });

  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "100", null])("rejects invalid amount %s without changing funds", amount => {
    const before = snapshot();
    expect(() => applyBankTransfer(before, { action: "deposit", amount } as BankTransfer)).toThrow("whole-credit");
    expect(before.gameState.credits).toBe(1000);
  });

  it("cannot withdraw more than deposited, deposit more than available, or overflow", () => {
    expect(() => applyBankTransfer(snapshot(), { action: "withdraw", amount: 251 })).toThrow("Deposited credits");
    expect(() => applyBankTransfer(snapshot(), { action: "deposit", amount: 1001 })).toThrow("Spendable credits");
    const before = snapshot(); before.gameState.bankCredits = Number.MAX_SAFE_INTEGER;
    expect(() => applyBankTransfer(before, { action: "deposit", amount: 1 })).toThrow("supported account balance");
  });

  it("initializes an absent deposit balance to zero, never the campaign's existing wealth", () => {
    const before = snapshot(); delete before.gameState.bankCredits;
    const next = applyBankTransfer(before, { action: "deposit", amount: 100 });
    expect(next.gameState).toMatchObject({ credits: 900, bankCredits: 100, underworldCredits: 90 });
    expect(() => applyBankTransfer(before, { action: "withdraw", amount: 1 })).toThrow("Deposited credits");
  });

  it("fails closed for corrupt or negative balances and unknown transfer types", () => {
    for (const credits of [-1, "1000", 1.5, null]) {
      const before = snapshot(); before.gameState.credits = credits;
      expect(() => applyBankTransfer(before, { action: "deposit", amount: 1 })).toThrow("verified");
    }
    expect(() => applyBankTransfer(snapshot(), { action: "mint", amount: 1 } as unknown as BankTransfer)).toThrow();
  });
});
