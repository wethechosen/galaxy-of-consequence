import type { DatapadSnapshot } from "./datapad-save";
export class BankTransferError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export type BankTransfer = { action: "deposit" | "withdraw"; amount: number };

/** Move existing galactic credits between spendable and deposited balances. No minting, conversion, or interest. */
export function applyBankTransfer(snapshot: DatapadSnapshot, input: BankTransfer): DatapadSnapshot {
  if (!snapshot.character) throw new BankTransferError("No character account is available.");
  if (!["deposit", "withdraw"].includes(input.action) || !Number.isSafeInteger(input.amount) || input.amount <= 0) throw new BankTransferError("Enter a positive whole-credit amount.");
  const credits = snapshot.gameState.credits;
  const bankCredits = snapshot.gameState.bankCredits ?? 0;
  if (typeof credits !== "number" || typeof bankCredits !== "number" || !Number.isSafeInteger(credits) || !Number.isSafeInteger(bankCredits) || credits < 0 || bankCredits < 0) throw new BankTransferError("The account balances could not be verified.");
  const source = input.action === "deposit" ? credits : bankCredits;
  const destination = input.action === "deposit" ? bankCredits : credits;
  if (input.amount > source) throw new BankTransferError(input.action === "deposit" ? "Spendable credits do not cover this deposit." : "Deposited credits do not cover this withdrawal.");
  if (!Number.isSafeInteger(destination + input.amount)) throw new BankTransferError("This transfer exceeds the supported account balance.");
  return { ...snapshot, gameState: { ...snapshot.gameState,
    credits: input.action === "deposit" ? credits - input.amount : credits + input.amount,
    bankCredits: input.action === "deposit" ? bankCredits + input.amount : bankCredits - input.amount } };
}
