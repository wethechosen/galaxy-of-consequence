import { NvidiaProviderError } from "./nvidia-errors";

export type GmDraftFailureKind = "provider" | "format" | "semantic";

/** Diagnostic classification; never treats an unsafe ledger as valid. */
export function classifyGmDraftFailure(error: unknown): GmDraftFailureKind {
  if (error instanceof NvidiaProviderError) return "provider";
  const reason = error instanceof Error ? error.message : String(error);
  if (/(?:world-state (?:ledger|JSON|block)|state ledger repair was malformed|missing state ledger|invalid JSON syntax)/i.test(reason)) {
    return "format";
  }
  return "semantic";
}
