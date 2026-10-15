export type TurnLifecycleStatus = "processing" | "committed" | "failed";

export type TurnLifecycleReceipt = {
  turnId: string;
  baseRevision: number;
  status: TurnLifecycleStatus;
  phase: string;
  draftAttempts: number;
  startedAt: string;
  completedAt?: string;
  committedRevision?: number;
  gameplayAdvanced: boolean;
  retriable: boolean;
  reason?: string;
  draftFailures?: Array<{ attempt: number; phase: "provider" | "validation"; reason: string }>;
};

// Receipts survive the response and can be retained by either client after the
// hosting platform's short log window expires. Never include the model draft,
// source context, request headers, connection strings, or provider credentials.
export function recordDraftFailure(receipt: TurnLifecycleReceipt, attempt: number, phase: "provider" | "validation", error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  const reason = raw.replace(/(?:https?:\/\/|postgres(?:ql)?:\/\/)[^\s]+/gi, "[redacted endpoint]")
    .replace(/\b(?:Bearer\s+\S+|(?:sk|nvapi)[-_][\w-]+)\b/gi, "[redacted credential]").slice(0, 500);
  receipt.draftFailures = [...(receipt.draftFailures || []), { attempt, phase, reason }].slice(-3);
}

export function beginTurnLifecycle(turnId: string, baseRevision: number, now = new Date().toISOString()): TurnLifecycleReceipt {
  return {
    turnId,
    baseRevision,
    status: "processing",
    phase: "load",
    draftAttempts: 0,
    startedAt: now,
    gameplayAdvanced: false,
    retriable: false,
  };
}

export function advanceTurnLifecycle(receipt: TurnLifecycleReceipt, phase: string, draftAttempts = receipt.draftAttempts) {
  receipt.phase = phase;
  receipt.draftAttempts = draftAttempts;
  return receipt;
}

export function commitTurnLifecycle(receipt: TurnLifecycleReceipt, committedRevision: number, now = new Date().toISOString()): TurnLifecycleReceipt {
  return {
    ...receipt,
    status: "committed",
    phase: "committed",
    completedAt: now,
    committedRevision,
    gameplayAdvanced: true,
    retriable: false,
  };
}

export function failTurnLifecycle(receipt: TurnLifecycleReceipt, phase: string, reason: string, status: number, now = new Date().toISOString()): TurnLifecycleReceipt {
  return {
    ...receipt,
    status: "failed",
    phase,
    completedAt: now,
    gameplayAdvanced: false,
    retriable: status >= 500,
    reason: reason.slice(0, 500),
  };
}

export function turnLifecycleFromError(error: unknown): TurnLifecycleReceipt | null {
  if (!error || typeof error !== "object" || !("turnLifecycle" in error)) return null;
  const receipt = (error as { turnLifecycle?: unknown }).turnLifecycle;
  return receipt && typeof receipt === "object" ? receipt as TurnLifecycleReceipt : null;
}
