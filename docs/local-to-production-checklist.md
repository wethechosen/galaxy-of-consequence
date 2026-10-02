# Local Codex -> GitHub -> Vercel cutover checklist

Use this only after opening the authoritative local Codex project:

`C:\Users\Passi\OneDrive\Desktop\GalaxyOfConsequence`

## 1. Verify the repository

```powershell
./scripts/verify-local-master.ps1
```

Expected repository:

`wethechosen/galaxy-of-consequence`

If `origin` points anywhere else, stop. Do not push.

## 2. Sync the complete Codex working tree

```powershell
./scripts/sync-codex-to-github.ps1
```

This stages the complete working tree subject to `.gitignore`, rejects obvious secrets/runtime files, runs typecheck/tests/build when available, commits, and pushes to `codex-master-sync`.

## 3. Confirm GitHub contains the current app

The branch must contain the same routes and UI currently running locally, including the hosted controller surface (`/api/gpt/state`, `/api/gpt/turn`) and current player/datapad/auth code. Do not promote an older SQLite-only tree.

## 4. Preview deployment

Build a Vercel preview from the exact `codex-master-sync` commit. Confirm the Vercel deployment records the Git commit SHA.

Required environment variables are server-only and documented in `.env.example`; populate them in Vercel's secret/environment manager, never in Git.

## 5. Acceptance test

- GPT `GET /api/gpt/state` succeeds.
- GPT `POST /api/gpt/turn` succeeds with `revision` + unique `turnId`.
- Supabase revision advances exactly once.
- GPT re-read returns the committed revision.
- Web player shows the same revision after reload.
- Replaying the same `turnId` does not duplicate consequences.
- A stale revision returns `409` instead of overwriting state.
- `/api/auth` and `/api/datapad` no longer return `Local access only` in hosted execution.
- Hosted GM/GPT routes do not open SQLite or use Vercel-local files.

## 6. Production promotion

After the exact preview commit passes, merge/promote it to `main` and configure Vercel production to deploy from `wethechosen/galaxy-of-consequence` `main`.

The final production deployment must identify the same Git SHA that exists on GitHub.

## Runtime architecture

```text
Code:     Local Codex -> GitHub -> Vercel
Gameplay: GPT <-> Vercel API <-> Supabase <-> Web app
```

GitHub never carries live gameplay responses; it carries code only.
