# Galaxy of Consequence — Debug Report (2026-10-02)

> Current live repair details are also recorded in `docs/cloud-repair-2026-10-02.md`.

## Authoritative campaign state

The production Supabase datapad save for `dmir@galaxy.local` is currently revision **47** after a structural state-shape repair. The repair did not alter established gameplay values.

Confirmed current checkpoint:

- D'mir Holloran
- Level 1 / 200 XP
- 26 HP
- 1,199,999,770 credits
- 1 carried item (identity unresolved rather than invented)
- Coruscant — Black Sun-controlled apartment bloc, Unit 4-B sublevel (concealed bunker access)
- Combat Round 1
- player side active
- Guard Blocking The Corridor 12/12 HP · CT 0
- Standard 1 · Move 1 · Swift 1

Exact checkpoints exist immediately before and after the normalization.

## Runtime turn failure and repair

The current Vercel production artifact logged repeated failures on `/api/gpt/turn`:

`TypeError: Cannot read properties of undefined (reading 'push')`

The persisted save was therefore revision-locked, backed up, and normalized so runtime arrays/objects used by turn resolution exist. This includes the main game-state arrays plus combat `events`, `log`, `turnOrder`, `initiative`, `pendingActions`, `effects`, `combatants`, and per-combatant `conditions`/`effects`.

Running the normalizer again on revision 47 returns `changed=false`.

The Supabase `goc-gpt-controller` gateway is live at **version 2**. It now:

1. rejects stale revisions before forwarding a turn;
2. rejects save/load/HUD/OOC text from the gameplay action;
3. checks and self-heals missing runtime containers before gameplay;
4. never executes the player's action if the repair advanced revision;
5. guarantees a stable turnId if one was omitted;
6. re-reads authoritative state after every upstream turn attempt;
7. reports whether an upstream failure changed state;
8. accepts a turn as successful only after the committed revision is verified.

A fresh authenticated gameplay turn is still required to prove whether state normalization eliminated the compiled Vercel `.push()` crash.

## Hosted auth/datapad replacement staged on `codex-master-sync`

The old production deployment still contains its historical `Local access only` branches, but replacement hosted routes are committed to GitHub:

- `app/api/auth/route.ts`
  - Supabase password authentication;
  - HTTP-only secure access/refresh cookies;
  - session refresh and logout;
  - anonymous GET returns `{ user: null }` with HTTP 200.
- `app/api/datapad/route.ts`
  - authenticated sessions;
  - own-account enforcement except GM/admin;
  - Supabase bridge persistence instead of local SQLite/files;
  - optimistic revision conflicts;
  - GM configuration persistence.
- `lib/supabase-auth.ts`
- `lib/datapad-bridge.ts`

## Secret-management repair staged

The currently deployed `goc-datapad-bridge` v4 still contains the legacy bridge credential in function source. Do not copy or expose it.

A replacement source is now committed at `supabase/functions/goc-datapad-bridge/index.ts` that reads `GOC_SUPABASE_BRIDGE_KEY` from protected environment storage and supports `GOC_SUPABASE_BRIDGE_KEY_PREVIOUS` only during a coordinated dual-key rotation.

Do **not** deploy that replacement until the protected secret is configured and every caller is updated, or the current app will disconnect.

## Vercel production source

Current production deployment:

- project: `galaxy-local`
- deployment: `dpl_77PegBy2ARxUj6gbFofeMkfX1NES`
- source: **CLI**
- target: production

Therefore the live delivery path remains local/CLI -> Vercel, not GitHub -> Vercel.

## Remaining deployment boundary

Do not merge PR #2 or replace production from GitHub yet. The current local Codex/Vercel application contains newer production source—especially the live `app/api/gpt/state` and `app/api/gpt/turn` implementation—that is still not completely represented in GitHub.

The final cutover remains:

```text
C:\Users\Passi\OneDrive\Desktop\GalaxyOfConsequence
  -> reconcile with codex-master-sync
  -> build/test
  -> Vercel preview
  -> controller + web round-trip tests
  -> merge to main
  -> Vercel production tracks GitHub main
```

GitHub versions code. Supabase owns persistent gameplay state. Codex is a development environment and must not be a runtime dependency.
