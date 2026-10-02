import { randomUUID } from "node:crypto";

export interface CharacterDraft {
  name: string; species: string; background: string; biography: string;
  startingLocation: string; aspirations: string; review: "pending_source_review";
}
export interface Lead {
  id: string; title: string; detail: string; kind: "rumor" | "opportunity" | "goal" | "note";
  status: "discovered" | "pursuing" | "dismissed" | "archived"; discoveredAt: number;
}
export interface Contact {
  id: string; name: string; description: string; observedAttitude: string; knownObligations: string[];
  companion: boolean; playerKnown: boolean;
  privateGoal: string; knowledge: string[]; memories: string[];
}
export interface Asset { id: string; name: string; kind: "ship" | "business" | "property" | "equipment"; description: string; }
export interface Cashflow {
  id: string; label: string; credits: number; intervalMs: number; nextDueMs: number;
  remainingOccurrences: number | null; status: "active" | "paused" | "finished";
  authorityEventId: string;
  dependsOnDecisionIds?: string[];
}
export interface LedgerEntry { id: string; flowId: string; campaignAtMs: number; credits: number; balance: number; }
export interface Contract {
  id: string; title: string; deadlineMs: number; status: "offered" | "accepted" | "fulfilled" | "awaiting_decision" | "declined";
  terms: string; authorityEventId: string;
}
export interface Decision {
  id: string; kind: "funds" | "deadline" | "danger" | "loss"; title: string; detail: string;
  relatedId: string; campaignAtMs: number; status: "pending" | "submitted" | "resolved";
  response?: string;
}
export interface WorldState {
  draft: CharacterDraft | null; journal: Lead[]; contacts: Contact[]; assets: Asset[];
  cashflows: Cashflow[]; ledger: LedgerEntry[]; contracts: Contract[]; decisions: Decision[];
}
export function emptyWorld(): WorldState {
  return { draft: null, journal: [], contacts: [], assets: [], cashflows: [], ledger: [], contracts: [], decisions: [] };
}
export function requireInteger(value: number, label: string, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum) throw new Error(`Invalid ${label}`);
}

// Rates are explicit campaign contracts, never invented Saga economic rules.
// Unaffordable payments pause that obligation; they cannot destroy an asset or
// create unapproved debt. Remaining routine obligations proceed independently.
export function settleEconomy(input: WorldState, balance: number, untilMs: number, authorityIds: Set<string>) {
  const world = structuredClone(input);
  requireInteger(balance, "balance"); requireInteger(untilMs, "time");
  const logs: string[] = [];
  let processed = 0;
  let pending = false;
  for (const flow of world.cashflows) {
    requireInteger(flow.intervalMs, "interval", 1); requireInteger(flow.nextDueMs, "due time");
    if (!Number.isSafeInteger(flow.credits) || !authorityIds.has(flow.authorityEventId)) throw new Error("Unapproved cashflow");
    if (flow.remainingOccurrences !== null) requireInteger(flow.remainingOccurrences, "occurrences");
  }
  while (true) {
    const flow = world.cashflows.filter(f => f.status === "active" && f.remainingOccurrences !== 0 && f.nextDueMs <= untilMs && (f.dependsOnDecisionIds ?? []).every(id => world.decisions.some(d => d.id === id && d.status === "resolved")))
      .sort((a, b) => a.nextDueMs - b.nextDueMs || a.id.localeCompare(b.id))[0];
    if (!flow) break;
    if (++processed > 10000) { pending = true; break; }
    const newBalance = balance + flow.credits;
    if (!Number.isSafeInteger(newBalance)) throw new Error("Balance overflow");
    if (newBalance < 0) {
      flow.status = "paused";
      world.decisions.push({ id: randomUUID(), kind: "funds", relatedId: flow.id, title: `Payment needs attention: ${flow.label}`, detail: "Insufficient available credits. No debt, loss or repossession has been applied.", campaignAtMs: flow.nextDueMs, status: "pending" });
      logs.push(`Paused ${flow.label}: insufficient credits.`);
      continue;
    }
    balance = newBalance;
    world.ledger.push({ id: randomUUID(), flowId: flow.id, campaignAtMs: flow.nextDueMs, credits: flow.credits, balance });
    logs.push(`${flow.label}: ${flow.credits >= 0 ? "+" : ""}${flow.credits} credits; balance ${balance}.`);
    requireInteger(flow.nextDueMs + flow.intervalMs, "next payment time");
    flow.nextDueMs += flow.intervalMs;
    if (flow.remainingOccurrences !== null && --flow.remainingOccurrences === 0) flow.status = "finished";
  }
  for (const contract of pending ? [] : world.contracts) {
    requireInteger(contract.deadlineMs, "contract deadline");
    if (contract.status !== "accepted" || contract.deadlineMs > untilMs) continue;
    if (!authorityIds.has(contract.authorityEventId)) throw new Error("Unapproved contract");
    contract.status = "awaiting_decision";
    world.decisions.push({ id: randomUUID(), kind: "deadline", relatedId: contract.id, title: `Deadline: ${contract.title}`, detail: contract.terms, campaignAtMs: contract.deadlineMs, status: "pending" });
    logs.push(`Contract deadline reached: ${contract.title}. Consequences await adjudication.`);
  }
  return { world, balance, logs, pending };
}
