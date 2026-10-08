import { describe, expect, it } from "vitest";
import { quotedCreditAmounts } from "./quoted-credits";
import { assertQuotedOfferConsistency } from "./gm";
describe("spoken quotes must have persistent terms", () => {
  it("recognizes normal written prices without changing amounts", () => {
    expect(quotedCreditAmounts("Fifteen hundred credits for thirty days; two hundred credits for breakfast.")).toEqual([1500, 200]);
    expect(quotedCreditAmounts("One hundred and twenty-six thousand credits; 18,000 credits refundable deposit.")).toEqual([18000, 126000]);
    expect(quotedCreditAmounts("No credits change hands.")).toEqual([]);
  });
  it("rejects an omitted written-out room quote instead of finalizing unsaved terms", () => {
    const narration = 'GAMEPLAY RESULT\nThe proprietor replies, “Fifteen hundred credits for thirty days in a private room.”\nSAGA CHECK\nNo check required.';
    expect(() => assertQuotedOfferConsistency(narration, {})).toThrow("omitted a quoted offer");
    expect(() => assertQuotedOfferConsistency(narration, { tradeOfferAdd: [{ totalCredits: 1500 }] })).not.toThrow();
  });
});
