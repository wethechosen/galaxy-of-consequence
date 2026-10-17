# Autonomous NPC Intelligence — GOC Offscreen World Simulation

## Integration

The implementation extends the existing authoritative GM, SAGA Edition, NPC rivalry-memory, and quest-world event subsystems. There is **one AI GM**; there is no additional playable-NPC controller or replacement architecture.

**Relevant code**

- `lib/npc-rival-intelligence.ts`: firsthand witness memory and player style tendencies
- `lib/npc-offscreen-intelligence.ts`: independent agendas, intelligence transmission, delayed preparations, and GM adjudication queue
- `lib/gm.ts`: one authoritative commit and a private GM context; existing SAGA rolls and action validation remain authoritative
- `original/lib/engineState.js`: strict whitelist for the three NPC intelligence commands
- `lib/npc-private-state.ts`: player-facing projection strips hidden NPC intelligence and offscreen plans; ordinary autosaves retain the original server-authoritative information
- `lib/quest-world-events.ts`: existing turn-sourced world ledger

## Deterministic rules

1. **Only established characters** can participate. There must be a source-linked scene relationship, contact, or committed witness event.
2. **No omniscience.** One NPC knows only directly witnessed tactics and reports actually delivered to them along an established directional communication link. Rumor remains identified as potentially mistaken.
3. **Transit time matters.** Comlink, courier, and in-person messages have minimum fictional delivery times; messages cannot instantly teleport between NPCs.
4. **Motivation is not a stat modifier.** Two observed tactics can cause an NPC to consider a preparation, but not gain free armor, bonuses, troops, immunity, or Force powers.
5. **Independent agendas.** Established contacts with a committed, named objective can prepare their own actions whether or not the player is in the scene. Private GM plans are marked *preparing* and only become *awaiting_gm* after campaign time elapses.
6. **GM adjudication is required.** A matured plan can become *adjudicated* only with an actor-linked, validated world consequence. Offscreen outcomes may not directly change player health, credits, inventory, XP, or conditions.
7. **Idempotence.** Duplicate turn IDs never duplicate a plan, report, or delivery. Failed checks are not successes; a turn cap is never a quest ending.
8. **Information privacy.** Player-visible datapad, GM action, recovery, advancement, market, and bank API responses cannot reveal these private NPC memory records, while the complete authoritative save remains intact.

## GM-supplied structured directives

These are legal **only inside a validated committed turn**; an action declaration or model assertion alone is not a world event.

```json
{
  "npcIntelLinkAdd": [
    {"sender": "Captain Vell", "recipient": "Agent Nira", "channel": "comlink", "sourceTurnId": "prior-channel-proof-turn"}
  ],
  "npcIntelReportAdd": [
    {"sender": "Captain Vell", "recipient": "Agent Nira", "sourceTurnId": "prior-witnessed-turn", "linkId": "verified-channel-id", "transitMinutes": 30}
  ],
  "npcOffscreenPlanResolve": [
    {"planId": "matured-plan-id", "outcome": "adjudicated"}
  ],
  "relationshipUpdate": [
    {"name": "Captain Vell", "note": "The captain completes a verified reassignment using known resources."}
  ]
}
```

The GM must not attempt to author raw `npcOffscreen` state directly. The server constructs and verifies it after the turn is committed and before the authoritative save transaction.

## Dedicated isolated testing

The dedicated test `lib/npc-offscreen-marathon.manual.test.ts` opens the 34-NPC source campaign database in **read-only** mode, creates synthetic NPC scenarios **in memory**, and executes **6,800 simulated world ticks** without calling NVIDIA or modifying the original saves. It checks message paths, plan maturity, replay idempotence, no duplicate reports, no unearned outcomes, and no XP awards. It is explicitly **not** evidence that a live NPC playthrough has completed.

To run deliberately and independently from the NVIDIA runner:

```powershell
$env:GOC_OFFSCREEN_MARATHON='1'
$env:GOC_OFFSCREEN_SOURCE_DB='C:\Users\Passi\goc-npc-playthroughs\data\npc-autoplay-150.sqlite'
node .\node_modules\vitest\vitest.mjs run lib/npc-offscreen-marathon.manual.test.ts --maxWorkers=1
```

Completed first stress check (2026-10-17): 34 characters, 6,800 synthetic rounds, 34 delivered reports, 68 synthetic plans, 34 explicitly adjudicated plans, 0 fabricated victories, 0 unearned XP, 0 attempted writes to the real database. The existing 34-character NVIDIA campaign stress runner was neither restarted nor modified.

## Known boundaries / next work

- This is a turn-driven world simulation: plans and message delivery advance with **authoritative campaign time**, not unsupervised real-world timers. No hidden event can modify a saved character while their campaign is idle.
- The GM can narrate and resolve mature, valid background plans in the normal gameplay pipeline; an independent server scheduler for offline time will require a deliberately authorized job and the same transactional validation.
- Broad NPC behavior is still constrained by established NPC sourcebooks, private knowledge, roles, locations, and resources. NPC species rules and the other 33 unfinished live campaigns are separate outstanding validation tasks.
- The first dedicated stress test is deterministic. Future live NVIDIA trials should use a distinct isolated save and respect the existing provider rate-limit budget.
