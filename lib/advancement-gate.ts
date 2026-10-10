import { advancementGate } from "@/original/lib/sagaAdvancement";

export class AdvancementRequiredError extends Error {
  status = 409;
  code = "advancement_required";
  constructor(public advancement: ReturnType<typeof advancementGate>) { super(advancement.message); }
}

export function assertAdvancementReady(character: Record<string, unknown> | null | undefined) {
  const gate = advancementGate(character || {});
  if (gate.blocked) throw new AdvancementRequiredError(gate);
}

export function advancementErrorBody(error: AdvancementRequiredError) {
  return { error: error.message, code: error.code, advancement: error.advancement, gameplayAdvanced: false };
}
