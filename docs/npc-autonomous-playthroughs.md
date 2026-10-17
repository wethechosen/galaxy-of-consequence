# Galaxy of Consequence — Isolated NPC simulation and GM continuity tests

## Authority and timelines
- 34 isolated **NPC scenario fixtures**, each using a temporary test-only player-account-shaped adapter because the current `runGmTurn` API requires an account. They are NOT playable NPCs in the actual game, nor are they a second player system. Kelvek is excluded from their concurrent campaign queue because he has a separate 147 ABY historical flashback.
- 13 D'mir-centered **NPCs** have story containers with identity, goals, private knowledge, status, encounter gating and event-sourced memory. Maera Holloràn and Daren Holloràn are newly supplied names for the canonically deceased parents. Their deaths, Kelvek's death and D'mir's established age and history cannot be undone by the simulator.
- Historical NPCs may appear alive only in appropriately dated flashbacks or authentic records. D'mir's primary live save is not used as a test harness.
- The 25 supplemental character profiles were adapted from a source 200 ABY proposal to 150 ABY; future titles are not assigned as current authority.
- A character goal is complete only when its exact authoritative `objectives[].status` is `completed`. **0 HP does not mean death.** Death requires an explicit authoritative `lifeStatus: dead` or `deceased: true` marker, which the engine currently may not emit. Otherwise an incapacitated PC is a blocker, not a completed ending.

## Actual game loop
1. Create and persist an isolated synthetic scenario fixture and Saga level-one foundation if supported by the existing race/class builder. The fixture's account adapter must never be exposed as a playable NPC.
2. NVIDIA NPC decision model sees only the character's verified location, objective, inventory, health and last messages; outputs exactly one first-person attempt.
3. The *existing* `runGmTurn` adjudicates this attempt, makes all dice/ledger decisions, validates state, and commits the turn with an immutable unique turn ID.
4. The runner rereads the saved revision and the turn ID. A failed turn does **not** award inventory, XP, advancement, skills or contact rights.
5. NPCs advance in round-robin; each PC receives no more than one turn per round. Multiple PCs are in flight concurrently but all model calls share the NVIDIA rate budget.
6. An exhausted provider or broken game rule is written to the append-only `data/npc-autoplay.jsonl` and blocks only that PC. Stop treating the simulated tests as real turns.
7. End only with confirmed objective fulfillment or documented death. A session reaching its turn cap remains active; it is never declared won.

## Local live test invocation
Run on the authorized Windows computer in `C:\Users\Passi\goc-npc-playthroughs`, **not** on the production database. Set the key securely in an ignored `.env.local`; do not commit or print it.

Use the local test process with:
- `CAMPAIGN_DB_PATH=...\data\npc-autoplay-150.sqlite`
- `GOC_AUTONOMOUS_NPCS=1`
- `GOC_NPC_MAX_TURNS=30` (maximum turns **per PC**, increase to continue without rewriting existing results)
- `GOC_NPC_CONCURRENCY=2` (avoid swamping NVIDIA's shared rate budget)
- `GOC_NPC_SUBJECTS=jena-lorr,orlan-vale` for a quick pilot; omit for all 34
- `npx vitest run lib/npc-autonomous-live.manual.test.ts`

The default test suite **skips** live GPU/API play unless `GOC_AUTONOMOUS_NPCS=1` is present. The simulated `npc-ten-playthroughs.integration.test.ts` is useful for deterministic regression but does not count as a genuine playthrough.

## ACE-style character containers without an architecture rewrite
NVIDIA ACE Agent NPC bot samples use unique per-character backstories, game-stage-specific context and server-side NPC response control. GOC retains its existing Next/Neon/NVIDIA stack: `dmir-story-npcs.ts` is the character identity/mission layer, `dmir-npc-memory.ts` is the event-sourced per-campaign memory, and `gm.ts` assembles context only for relevant named or scene-established NPCs. These are **logical containers**, not separately deployed NVIDIA ACE Docker microservices.

GM-only knowledge is not serialized to the browser. The GM uses it to make believable choices, while player-facing outcomes remain bound to authoritative game state. Only adjudicated event fields can modify `gameState.npcContinuity`, and replaying the same turn ID cannot add duplicate moments.

**Known blockers requiring real validation:** nonhuman species feats/racial modifiers are not yet certified by the current heroic builder; before these 150 ABY supplemental PCs are called rules-complete, finish their species foundation. No automatic multi-level advancement choices have been made; characters that earn sufficient XP must choose class, legal talents, feats and skills through the game's validated level-up system. Running thirty turns with no valid ending is not a completed playthrough.

References: NVIDIA ACE Agent gaming NPC bot and architecture docs, https://docs.nvidia.com/ace/ace-agent/4.1/sample-bots/gaming-npc-bot.html and https://docs.nvidia.com/ace/ace-agent/4.0/architecture/arch-intro.html.

## Player-visible encounter roster and private GM dossiers
- `/players` is the character directory. Actual player character sheets are fetched server-side from committed saves via `/api/player/roster`; other players see publicly safe appearance, class, level, feats and talents, not inventory, credits, undisclosed goals or hidden flags. The original browser-local roster cannot share another player's character across devices.
- Only NPCs explicitly present in the most recently committed room appear as NPC entries in Players. The game derives them from named characters in validated GM SCENE or GAMEPLAY RESULT sections and saves `gameState.sceneNpcs`, and removes them when the scene changes. A conservative legacy-save fallback reads only the latest saved scene when its LOCATION matches the authoritative location.
- The GM may be shown locally plausible story characters as encounter candidates; their inclusion in a prompt is not an actual meeting. GM private story memory is updated only by validated story/contact/relationship event fields.
- The `/npcs` route and `/api/npcs` are GM-restricted. Players cannot query unearned private plots, secrets or complete NPC dossiers.
- Comms only exposes saved established contacts. Merely seeing an NPC or another player's public sheet cannot create a comlink channel. Existing player-to-player messages remain browser-local until an authenticated cross-account transport is separately implemented; do not claim delivery across player devices.

## 150 ABY starting-tier audit (added 2026-10-16)
- Seventeen supported Human PC saves were advanced through the real Saga foundation/level-up validators and saved with an optimistic-concurrency revision check. The new character origin records separate prior 150 ABY career XP from XP actually earned in the test; no old turn events or GM history were rewritten.
- Human master builds include Darth Korvalis (Jedi heroic-class chassis for Sith mechanics) at 12th level, Nir Varek 11th, Jaed Sultar 9th, Aliyah Fel and Kor Vess 8th. No Jedi Order allegiance is implied by a heroic-class label; no unsupported Sith prestige class was invented.
- The remaining 17 non-Human characters are still mechanically level one due to the verifier's Human-only species foundation. Lore-tier target levels and species-validation flags are stored separately; they are NOT claimed as active Saga character-level attributes. Implement and independently validate each species' actual traits before promotion.
- Long-form goals are now separate from initial easy investigation objectives, using `gameState.npcUltimateGoal`, `npcArcVersion=150aby-longarc-v1`, and a status check of that full objective. A simple found clue does not terminate a life campaign. The 34-goal source is `lib/npc-ultimate-arcs.ts`.
- `lib/npc-autonomous-live.manual.test.ts` uses account-unique turn IDs, the existing GM authoritative adjudicator, round-robin concurrency, saved state verification, and recovery of the original unresolved declaration from the GM attempt ledger/log. It is opt-in and MUST remain on the isolated local SQLite file.
- `lib/npc-repetition-recovery.ts` can propose a new lawful attempt from specific pre-established leads when the autonomous PC loops, but cannot independently declare a GM outcome or add XP, credits, or items.
- The original four completed level-one scenes (Mirren, Bren, Rena, Kara) were ONLY first-chapter completions. Do not count them as completed life arcs. Death must be verified by authoritative state, not by zero HP alone.

## Pending test-turn revision reconciliation
A newly discovered failure arises when an original unresolved NPC action was declared at an earlier save revision and then GM-only historical-career or long-arc setup advanced the same character's revision. A pending attempt with a stored roll must not be silently rerolled or duplicated. The test-only `rebaseIsolatedNpcPendingAttempt` guards for an existing pending record, untouched real turn-event count, verified audited scenario metadata, and an older revision; it updates only that existing attempt's base revision and rereads action, original turn ID, status and roll to prove nothing else changed. It explicitly refuses completed actions and genuine gameplay conflicts. Production GM save-conflict protections remain unchanged.
