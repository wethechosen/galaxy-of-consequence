# Galaxy of Consequence — Production Sync Contract

## Source of truth

1. **Codex local project is the code master**: `C:\Users\Passi\OneDrive\Desktop\GalaxyOfConsequence`.
2. **GitHub is the versioned code record**: `wethechosen/galaxy-of-consequence`.
3. **Vercel is the production mirror** of the GitHub-approved Codex master.
4. **Supabase is the persistent gameplay source of truth** for campaign saves/loads and GPT-facing state.

Do not deploy the older September SQLite prototype over the current Codex build.

## Required live flow

```text
Codex local master
   -> GitHub codex-master-sync
      -> reviewed/fast-forwarded to main
         -> Vercel production
            -> Supabase persistent state

GPT gameplay
   -> /api/gpt/state (read confirmed revision)
   -> /api/gpt/turn (submit one action)
   -> authoritative GM/Saga resolution
   -> Supabase commit
   -> Vercel UI polls/loads the same revision
```

## Persistence contract recovered from the current app

- `/api/datapad?accountId=...`
  - `GET`: load the latest confirmed snapshot and revision.
  - `PUT`: save `{ accountId, revision, snapshot }` with revision locking.
- Client autosave is revisioned and should never silently overwrite a newer save.
- Client polls for a newer server revision and replaces local state only with a newer confirmed record.
- `/api/gm` commits a GM turn using the current account revision and returns the updated snapshot/revision.
- `/api/gpt/state` exposes the latest confirmed state to the Custom GPT.
- `/api/gpt/turn` submits exactly one player action and must persist the resulting authoritative GM state.

## Combat state surface

The live player UI expects an active combat object with, at minimum:

```ts
{
  status: "active",
  round: number,
  activeSide: "player" | string,
  combatants: [
    {
      side: "opposition" | string,
      name: string,
      hp: number,
      maxHp: number,
      conditionTrack: number
    }
  ],
  playerActions: {
    standard: number,
    move: number,
    swift: number
  }
}
```

Server-side combat resolution may require additional fields. Preserve the complete Codex snapshot; do not reconstruct a partial combat object when syncing production.

## Current master gameplay checkpoint

The current Codex master UI shows D'mir Holloran at:

- 4 HP
- 1,199,999,770 galactic credits
- 0 underworld credits
- Coruscant — Black Sun–controlled apartment bloc, Unit 4-B sublevel (concealed bunker access)
- Level 1 / 250 XP
- 1 carried item
- Combat round 3
- Player turn
- Guard Blocking The Corridor: 6/12 HP, CT 0
- Player actions: Standard 1, Move 1, Swift 1

The full local snapshot and transcript are authoritative. This checkpoint is for verification only and is **not** a substitute for uploading the complete local save/state.

## Production blockers to remove

The current Vercel deployment serves the UI but returns `403 {"error":"Local access only"}` from `/api/auth` and `/api/datapad`. Production server routes must use the shared Supabase-backed persistence/auth path instead of local-only filesystem/SQLite assumptions.

The Supabase project already contains the private datapad-save table and bridge RPC/Edge Function. Keep service credentials server-side only. No bridge or service-role secret may be exposed in client JavaScript or committed to GitHub.

## Deployment rule

Do not promote a deployment unless all of the following pass:

- production login/auth works without the local-only gate;
- D'mir's latest Codex save loads on Vercel;
- a save made from one client is visible after reload on another client;
- stale revision writes return a conflict rather than overwriting newer state;
- GPT state reads the same revision shown by the web UI;
- one GPT turn persists once and is visible in Vercel after reload;
- one browser gameplay turn persists once and is visible to GPT state;
- no secret appears in browser bundles or repository history;
- rollback to the previous Vercel deployment remains available.
