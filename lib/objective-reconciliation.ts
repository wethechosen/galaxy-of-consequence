type Ledger = Record<string, unknown>;

const record = (value: unknown): value is Ledger => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const key = (value: unknown) => String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
const tokens = (value: unknown) => new Set(key(value).replace(/[^\p{L}\p{N}]+/gu, " ").split(" ").filter((word) =>
  word.length > 3 && !["acquire", "obtain", "purchase", "secure", "proper", "complete", "legitimate", "from", "with", "that", "this", "outfit"].includes(word)));

function receiptNames(state: Ledger) {
  const names: string[] = [];
  for (const receipt of Array.isArray(state.tradeReceipts) ? state.tradeReceipts : []) {
    if (!record(receipt)) continue;
    for (const item of Array.isArray(receipt.items) ? receipt.items : []) {
      if (record(item) && typeof item.name === "string") names.push(item.name);
    }
  }
  return names;
}

function objectiveHasReceiptedSubject(objective: Ledger, state: Ledger) {
  const subject = tokens(`${objective.title || ""} ${objective.detail || ""}`);
  if (!subject.size) return false;
  return receiptNames(state).some((name) => {
    const owned = tokens(name);
    return [...subject].some((word) => owned.has(word));
  });
}

function housingIsEstablished(objective: Ledger, state: Ledger) {
  if (!/\b(?:housing|home|apartment|lease|tenancy)\b/i.test(`${objective.title || ""} ${objective.detail || ""}`)) return false;
  const properties = Array.isArray(state.properties) ? state.properties.filter(record) : [];
  if (properties.some((property) => key(property.status || "active") === "active"
    && ["leased", "owned"].includes(key(property.tenure || property.type)))) return true;
  return receiptNames(state).some((name) => /\b(?:lease|apartment|residence|housing)\b/i.test(name));
}

function departureIsEstablished(objective: Ledger, state: Ledger) {
  const match = /^leave\s+(.+)$/i.exec(String(objective.title || "").trim());
  if (!match) return false;
  const origin = key(match[1]);
  const location = key(state.location);
  return Boolean(origin && location && !location.includes(origin));
}

export function objectiveIsAuthoritativelyFulfilled(objective: Ledger, state: Ledger) {
  if (key(objective.status) === "completed") return true;
  const title = String(objective.title || "");
  if (/^(?:acquire|obtain|purchase|buy)\b/i.test(title) && objectiveHasReceiptedSubject(objective, state)) return true;
  return housingIsEstablished(objective, state) || departureIsEstablished(objective, state);
}

/**
 * Derive completion only from receipts, active property records, or the saved
 * location. It never fabricates a purchase and can safely run on every retry.
 */
export function reconcileFulfilledObjectives(state: Ledger, now = Date.now()) {
  const objectives = Array.isArray(state.objectives) ? state.objectives.filter(record) : [];
  let changed = false;
  const reconciled = objectives.map((objective) => {
    if (!objectiveIsAuthoritativelyFulfilled(objective, state) || key(objective.status) === "completed") return objective;
    changed = true;
    return { ...objective, status: "completed", completedAt: objective.completedAt || now, updatedAt: now, completionSource: "authoritative-ledger" };
  });
  return changed ? { ...state, objectives: reconciled } : state;
}
