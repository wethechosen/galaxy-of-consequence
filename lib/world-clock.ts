export interface ScheduledWorldEvent {
  id: string;
  dueAtMs: number;
  summary: string;
  kind: "routine" | "personal_danger" | "irreversible_loss";
  dependsOn: string[];
  status: "scheduled" | "awaiting_player" | "completed";
  playerFacing?: boolean;
}

export interface WorldClock {
  campaignElapsedMs: number;
  lastRealAtMs: number;
  rate: 7;
  events: ScheduledWorldEvent[];
}

export function newWorldClock(now: number): WorldClock {
  return { campaignElapsedMs: 0, lastRealAtMs: now, rate: 7, events: [] };
}

// Pure scheduling only: economic and rules effects must be resolved separately.
export function advanceWorldClock(input: WorldClock, now: number, enabled: boolean) {
  if (!Number.isSafeInteger(now) || now < 0) throw new Error("Invalid clock timestamp");
  const clock = structuredClone(input);
  const elapsedRealMs = Math.max(0, now - clock.lastRealAtMs);
  clock.lastRealAtMs = Math.max(now, clock.lastRealAtMs);
  const advancedMs = enabled ? elapsedRealMs * 7 : 0;
  if (!Number.isSafeInteger(clock.campaignElapsedMs + advancedMs)) throw new Error("Clock overflow");
  clock.campaignElapsedMs += advancedMs;
  const newlyDue: ScheduledWorldEvent[] = [];
  if (enabled) {
    // Every due operation requires adjudication. No credits, damage or losses
    // are invented by this scheduler; dependent events stay blocked.
    for (const event of [...clock.events].sort((a, b) => a.dueAtMs - b.dueAtMs || a.id.localeCompare(b.id))) {
      if (event.status !== "scheduled" || event.dueAtMs > clock.campaignElapsedMs) continue;
      if (!event.dependsOn.every(id => clock.events.some(parent => parent.id === id && parent.status === "completed"))) continue;
      event.status = "awaiting_player";
      newlyDue.push(event);
    }
  }
  return { clock, advancedMs, newlyDue };
}
