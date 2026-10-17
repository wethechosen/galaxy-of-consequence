# GOC NPC Rivalry Intelligence — Initial Release

## Purpose

This is a **character-memory and adaptation layer**, not a new GM, combat rules engine, or guaranteed revenge encounter. Nemotron/Mistral may act and narrate as NPCs, but the game decides what an NPC knows.

## Execution path

1. Player declares an action. Existing intent/SAGA systems resolve it; no invented rolls or dice.
2. Existing GM validation and authoritative save commit the action as one `turnId`.
3. `recordCommittedRivalObservation` compares the pre-turn and finalized saves. If the turn is not committed, it does nothing.
4. Only eligible, previously established scene witnesses or surviving present combat opponents learn a visible tactic. A successful Stealth check does not reveal the player's method. Failure without a confirmed exposure also does not automatically identify the player.
5. Firsthand observations are persisted in `gameState.rivalIntelligence` with turn ID, location, source, outcome, and campaign minute. The same turn cannot write the same memory twice.
6. At a later scene, the GM receives **only the memories belonging to the NPCs actually present**. A potential counter appears only after at least two observations. Elapsed campaign time affects preparation plausibility.
7. Nemotron/Mistral chooses a believable NPC response based on standing, motive and resources. The ordinary GM state validator, SAGA combat and trade systems adjudicate any actual change. No new NPC, item, hostile status, immunity or XP is granted by the memory layer.

## Information boundaries

- A successful hidden action is not witnessed, and failed stealth only becomes known after a committed exposure.
- Deception does not become recognized as deception unless independent world evidence later exposes it.
- Player character sheets, finances, private objectives, inventory and hidden Force capabilities are not inferable from combat style alone.
- Off-scene NPCs cannot receive telepathic updates. Rumor propagation and faction intelligence networks require a separate, source-linked communication event; they are **not** silently simulated in v1.
- NPCs known to be deceased cannot become new witnesses. Defeated/incapacitated combatants do not receive an automatic retaliatory turn.
- Observations are bounded to 24 per character, and 50 NPC memory records per campaign save to prevent unbounded prompt growth.

## Adaptive design principles

- **Legible:** The GM may foreshadow an established rival's preparation when enough evidence and time exist.
- **Fair:** Learning a preference cannot directly modify SAGA defense, grant gear, spawn reinforcements, or remove counterplay.
- **Character-driven:** Friendship, caution, resentment, fear and material incentives matter more than an automatic hostility meter.
- **Persistent but not scripted:** No forced quest track or mandatory revenge fight. Rivalry grows only through actual encounters.

## Testing and next expansion

Unit regression covers missing witnesses, idempotent reload, failed rolls, secrecy, verified stealth exposure, multi-turn adaptation, offscreen isolation, earned mercy, and dead/disabled adversaries. Integration tests and TypeScript validation must pass before merging with `main`.

Future additions require explicit, auditable message-delivery records for informants, misunderstandings/rumors, faction intelligence and offline rival preparation. None should be simulated through hidden omniscience or model prose alone.

The separate 34-PC 150 ABY autonomous test stays on its own isolated SQLite save and is never restarted merely to install this code.
