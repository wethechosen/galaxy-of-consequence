# Galaxy of Consequence

Galaxy of Consequence is a persistent Star Wars Saga Edition RPG platform with a Custom GPT gameplay controller, a web client, server-side GM/rules resolution, and Supabase-backed saves.

## Production architecture

```text
CODE DELIVERY
Local Codex project
  -> GitHub: wethechosen/galaxy-of-consequence
  -> Vercel: galaxy-local

GAMEPLAY
Player
  -> Galaxy of Consequence Custom GPT (controller)
  -> Vercel /api/gpt/state + /api/gpt/turn
  -> authoritative GM / Saga resolution
  -> Supabase persistent save
  -> response back to GPT
  -> same committed revision displayed by the Vercel web app
```

GitHub is the code record. It is **not** in the live turn-response path. Supabase is the persistent gameplay source of truth. The browser is a client surface, not a competing gameplay authority.

## Important migration status

The complete current application is still maintained in the local Codex working tree at:

`C:\Users\Passi\OneDrive\Desktop\GalaxyOfConsequence`

The repository `main` branch still represents an older prototype. Do **not** deploy `main` over the current Vercel application until the complete local Codex working tree has been uploaded and validated.

Migration work is staged on `codex-master-sync` and tracked in Draft PR #2.

Before uploading the local project, run:

```powershell
./scripts/verify-local-master.ps1
```

That check must confirm that the local `origin` is this repository:

`wethechosen/galaxy-of-consequence`

Then use the guarded sync helper:

```powershell
./scripts/sync-codex-to-github.ps1
```

The helper refuses to push if the remote is wrong, runtime/secret files are tracked, obvious secret values are staged, or validation fails.

## Required controller behavior

For every gameplay action:

1. GPT reads `/api/gpt/state` and receives revision `N`.
2. GPT submits exactly one action to `/api/gpt/turn` with revision `N` and a unique `turnId`.
3. The server performs deterministic rules/world-state resolution.
4. The server commits exactly once to Supabase as revision `N+1`.
5. GPT receives narration/state for `N+1`.
6. GPT re-reads `/api/gpt/state` and verifies `N+1`.
7. The Vercel web client displays that same committed revision.

A stale revision must return `409`; replaying a `turnId` must not duplicate damage, XP, credits, inventory, movement, or narrative consequences.

## Hosted persistence

Hosted Vercel routes must not use SQLite or local filesystem saves. Server-side integration variables are documented in `.env.example`. Never expose service-role, bridge, NVIDIA, OpenAI, or GPT action secrets through `NEXT_PUBLIC_*` variables or commit real secret values.

The Supabase bridge/save layer is revisioned. The current migration contract is documented in [`docs/production-sync.md`](docs/production-sync.md).

## Validation

Run locally before pushing the authoritative Codex source:

```bash
npm install
npm run typecheck
npm test
npm run build
```

After deployment, run the controller smoke test with server-side test credentials configured:

```bash
node scripts/controller-smoke.mjs
```

A production cutover is complete only when GPT -> Vercel -> Supabase -> GPT/web round-trip persistence succeeds and the same source commit is recorded in GitHub and deployed by Vercel.
