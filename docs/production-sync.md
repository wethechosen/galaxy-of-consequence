# Galaxy of Consequence — Production Sync Contract

## Source of truth

1. **Codex local project is the code master**: `C:\Users\Passi\OneDrive\Desktop\GalaxyOfConsequence`.
2. **GitHub is the versioned code record**: `wethechosen/galaxy-of-consequence`.
3. **Vercel is the production execution environment** for the GitHub-approved Codex master.
4. **Supabase is the persistent gameplay source of truth** for campaign saves/loads and GPT-facing state.
5. **The Galaxy of Consequence Custom GPT is the gameplay controller.** Player decisions made in the GPT must travel through the production API, commit exactly once to Supabase, become visible in the web app, and be returned to the GPT on the next state read.

Do not deploy the older September SQLite prototype over the current Codex build.

## Important architecture correction

GitHub does **not** send gameplay responses back to the GPT. GitHub only versions and delivers code. The runtime loop is GPT <-> Vercel API <-> Supabase. The code-delivery loop is Codex -> GitHub -> Vercel.

```text
CODE DELIVERY
Codex local master
   -> GitHub
      -> Vercel deployment

GAMEPLAY RUNTIME
Player
   -> GOC Custom GPT controller
      -> Vercel /api/gpt/state and /api/gpt/turn
         -> authoritative GM/Saga resolution
         -> Supabase persistence
      <- committed response
   <- narration/HUD

Web app
   <-> Vercel API
   <-> same Supabase revision
```

## Current deployment wiring

The currently observed Vercel production deployments were created without Git commit metadata and behave like CLI/local deployments. Therefore, **do not assume Vercel is already tracking this GitHub repository**. The safe cutover order is:

1. Verify the local Codex checkout `origin` is exactly `wethechosen/galaxy-of-consequence`.
2. Push the complete current Codex working tree to `codex-master-sync` without secrets or build artifacts.
3. Validate typecheck, tests, build, controller routes, and persistence on that exact commit.
4. Promote that exact commit to `main`.
5. Only then connect/configure Vercel Git deployment against `wethechosen/galaxy-of-consequence` and `main`.
6. Confirm a Git commit produces the expected Vercel deployment before retiring CLI deployment as the normal path.

The repository includes `scripts/verify-local-master.ps1` for step 1 and `scripts/controller-smoke.mjs` for the controller round-trip acceptance test.

## Required live flow

```text
PLAYER
  -> Galaxy of Consequence Custom GPT (controller)
      -> GET /api/gpt/state
          -> read confirmed Supabase revision
      -> player declares exactly one action
      -> POST /api/gpt/turn { revision, action, turnId }
          -> authoritative GM / Saga resolution
          -> persist exactly once to Supabase
          -> return committed revision + narration + HUD/state
      -> GET /api/gpt/state
          -> verify the committed revision
          -> continue gameplay from confirmed state

SUPABASE
  <-> Vercel production APIs
  <-> Web app
  <-> GPT controller

CODE DELIVERY
Codex local master
   -> GitHub codex-master-sync
      -> reviewed/fast-forwarded to main
         -> Vercel production
```

The browser is a presentation/client surface, not a competing gameplay authority. It must load the same confirmed revision from Supabase and show controller-made changes after refresh/poll. The GPT controller must likewise see browser-made authoritative changes on its next `/api/gpt/state` read.

## Controller invariants

- The GPT must **read state before every action**.
- `revision` is the optimistic-concurrency token. A stale revision must return `409`; it must never overwrite newer state.
- `turnId` is the idempotency token. Replaying the same `turnId` must not apply damage, XP, credits, inventory, movement, or narrative consequences twice.
- `/api/gpt/turn` owns deterministic rules resolution and persistence. The GPT may declare intent and narrate from the committed result, but it must not directly edit database state.
- A successful turn is not complete until the server has committed the new snapshot/revision.
- The controller must re-read `/api/gpt/state` after a successful turn and reconcile against the returned revision.
- The web app must read from the same persistence layer; no Vercel-local SQLite/file save may diverge from Supabase.
- No service-role, bridge, or GPT action secret may be sent to client JavaScript or committed to GitHub.

## Persistence contract recovered from the current app

- `/api/datapad?accountId=...`
  - `GET`: load the latest confirmed snapshot and revision.
  - `PUT`: save `{ accountId, revision, snapshot }` with revision locking.
- Client autosave is revisioned and should never silently overwrite a newer save.
- Client polls for a newer server revision and replaces local state only with a newer confirmed record.
- `/api/gm` commits a GM turn using the current account revision and returns the updated snapshot/revision.
- `/api/gpt/state` exposes the latest confirmed state to the Custom GPT.
- `/api/gpt/turn` submits exactly one player action and must persist the resulting authoritative GM state.

## Known production failure mode

Historical Vercel runtime logs show `/api/gpt/turn` attempting to open SQLite in hosted execution (`:memory:` or a database file) and failing or losing persistence. This confirms the production turn path must hydrate from and commit to Supabase rather than using Vercel-local SQLite/filesystem storage. A `409` stale-revision response is expected and healthy when the controller submits an old revision; a SQLite open error is not.

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

## Controller test-game checkpoint

The controller/test UI screenshot is a **test loop checkpoint**, not a database migration source. Visible values are useful for regression comparison, but the complete persisted snapshot is authoritative.

The screenshot currently shows D'mir Holloran at:

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

Do not manually rebuild a Supabase snapshot from those visible fields. Hidden combat state, initiative, transcript, flags, GM context, relationships, rolls, and other data must travel through the normal controller/server persistence path.

## Production blockers to remove

The current Vercel deployment serves the UI but returns `403 {"error":"Local access only"}` from `/api/auth` and `/api/datapad`. Production server routes must use the shared Supabase-backed persistence/auth path instead of local-only filesystem/SQLite assumptions.

The Supabase project already contains the private datapad-save table and bridge RPC/Edge Function. Keep service credentials server-side only. No bridge or service-role secret may be exposed in client JavaScript or committed to GitHub.

## Deployment rule

Do not promote a deployment unless all of the following pass:

- local Codex `origin` is verified as `wethechosen/galaxy-of-consequence`;
- the complete current Codex source exists in GitHub on the exact commit being deployed;
- production login/auth works without the local-only gate;
- D'mir's latest Codex save loads on Vercel;
- a save made from one client is visible after reload on another client;
- stale revision writes return a conflict rather than overwriting newer state;
- GPT state reads the same revision shown by the web UI;
- one GPT turn persists once and is visible in Vercel after reload;
- repeating the same GPT `turnId` does not duplicate consequences;
- GPT re-read after the turn returns the same committed revision;
- one browser gameplay turn persists once and is visible to GPT state;
- no secret appears in browser bundles or repository history;
- rollback to the previous Vercel deployment remains available.
