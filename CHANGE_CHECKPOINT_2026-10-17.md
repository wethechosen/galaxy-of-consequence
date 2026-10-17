# Galaxy of Consequence — change checkpoint

Recorded 2026-10-17. This checkpoint distinguishes deployed changes from local work; it is not a claim that every system is repaired.

## Already deployed

- Main release commit: `138df0962f8c08a69430bdeae0a1fae3a998c65c` (PR #20).
- Successful checks cannot be narrated explicitly as failed; completed local movement must agree with its saved endpoint. Recovery receipts use the same checks.
- Revision-only synchronization reduces repeated full-save downloads.
- Atlas, travel, and archives work and territory-specific news instructions were included in prior releases.
- Signed-in read/synchronization endpoints were verified. This does not prove every live model-generated turn succeeds.
- Neon remains the authoritative hosted database. No Supabase fallback is intended.

## Local, not yet committed or deployed

- Validated NPC core-build registry with explicit provenance and pending-validation status for unsupported builds.
- GM NPC stat presentation and committed-scene NPC mechanics context.
- Verified core species catalog: Human, Bothan, Duros, Rodian, Sullustan, Twi'lek, and Zabrak. Foundation logic includes applicable languages, passive defenses, and conditional skill-focus traits without granting human-only bonuses to aliens.
- Optional species skill-reroll resolver with second-result and once-only checks. It is not yet connected to live controller action routing.
- Alien story traits remain distinct from mechanical authority. No automatic Force gifts, invented equipment, or player rewards.
- Hosted public roster uses bounded public-field projection instead of transferring other players' full saves.
- Existing unrelated `next-env.d.ts` modification is preserved.

## Verification at this checkpoint

- Latest focused run: 5 test files passed, 38 tests passed (species, NPC mechanics, advancement, public roster, GM NPC API).
- Earlier deployed release: 552 tests passed, 27 skipped; typecheck and production build passed.
- The latest local changes still require a fresh complete suite, typecheck, build, and deployment verification.
- Existing scripted NPC playthrough tests are offline-provider tests, not proof of live NVIDIA availability.

## Critical remaining checks

- Verify live draft timeout/rate-limit recovery and preserve the original pending action without duplicate outcomes or charges.
- Validate narration, structured location, objectives, and NPC presence together. A previously observed Bonadan front-counter/rear-workroom discrepancy has not been rewritten in the live save during this work.
- Wire eligible species rerolls into durable server-side turn handling before advertising them as playable.
- Connect validated NPC mechanics to combat resolution; equipment and attack kits remain unestablished unless supported by saved evidence.
- Confirm current live campaign revision before any narrowly scoped reconciliation. Do not replay old gameplay or patch an outdated revision.
- Verify final signed-in UI/controller behavior and territory news before calling the release complete.

## Campaign and operating constraints

- Preserve the existing story and earned consequences; do not force success, create rewards, or submit D'mir's actions during testing.
- Homebrew continuity is 150 ABY, combining canon, Legends, and EU where chronology and established campaign facts permit.
- Keep the existing black/crimson/teal visual identity.
- Free-plan constraints apply. Previously measured database storage was about 26 MB; the reported approximately 5 GB issue was transfer usage, not database size.
- Never include API secrets in this record. A key exposed in conversation should be rotated securely.
