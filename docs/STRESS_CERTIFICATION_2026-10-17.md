# Galaxy of Consequence — Isolated Stability Stress Report (2026-10-17)

**Certification status: PARTIAL — DO NOT LABEL THE COMPLETE GAME CERTIFIED.**

This report accompanies a repeatable, adversarial 100-turn test of the **existing**
`runGmTurn` engine and authoritative SQLite persistence, not a new game engine.

## Reproducible execution

```powershell
npx vitest run lib/campaign-100-turn.stress.test.ts --maxWorkers=1 --testTimeout=300000
npm test -- --maxWorkers=2 --testTimeout=300000
npm run build
```

The test creates and destroys a new temporary SQLite file. Its actor has a synthetic
account ID, a fictional starting balance, and no connection to D'mir's actual save.
NVIDIA is replaced **only in the test process** with a scripted response provider.
No live API keys, credentials, characters, campaign revisions, or production database
records are read or mutated.

## Verified long-run scenario

- 100 legally permissible public-service inquiries, committed as 100 authoritative turns;
  final expected revision 101.
- Ten identical-turn-ID replays, each required to return the previously committed result
  without additional state changes.
- Five close/reopen boundaries of the persistent SQLite database after every 20 turns.
- An explicitly injected provider exception at turn 37, with unchanged saved revision,
  followed by retry of the *same action and turn ID*.
- Persistent credit balance, XP, health, inventory, location, and final discovered procedure.
- A scene NPC must remain in the current room after repeated **witnessed** interactions,
  but must not appear in person because the character was merely mentioned in old mail.

## SAGA Edition and NPC coverage

The normal repository suite additionally covers initiative, action economy, condition
tracks, combat resolution, damage, Force prerequisites/use/recovery, Saga skill planning,
character foundation and advancement, NPC authority, NPC private context, and save
continuity. The existing isolated 35-NPC integration test exercises five scripted
turns per case (not 35 genuinely autonomous 100-turn campaigns). These tests do NOT
constitute a complete rules-book-by-rules-book certification.

## Important limits

1. **Real Nemotron/ACE not certified.** There is no rotated, verified development NVIDIA
   API key in this isolated worktree. A preexisting key file in another test worktree
   must not be assumed safe to reuse after the credentials were shared in chat.
   Actual model quality, rate limits, refusal behavior, and coherence over 100 turns
   still require secure key rotation and a real model-driven test run.
2. **The extended run is intentionally one lawful civilian scene.** Complex multi-planet
   travel, combat encounters, market transactions, dynamic quest state and NPC secrets
   are covered by shorter specialized tests but not yet together in one 100-turn story.
3. **No automatic NPC-arc completions.** The test simulates only server-adjudicated events;
   D'mir's future story, Seralyth's arc, or any character's ending is never awarded here.
4. **No claims about unrestricted concurrency.** All 100 turns use one isolated player,
   executed serially; concurrency and production latency are separate certification gates.

## Defect discovered through stress testing

The existing scene-NPC projection could drop a titled NPC appearing in dialogue
(e.g., Captain Vell) because role-name parsing did not handle title case consistently.
The repair preserves full titled identities, reuses known character names, and requires
a clearly visible action before discovering an unfamiliar character. A message referring
to an NPC does not make them physically present in the scene.

Do not remove Saga authority, GM-only character control, or save-ledger validations to
make future stress tests pass. Reproduce and repair any further failures at their source.
