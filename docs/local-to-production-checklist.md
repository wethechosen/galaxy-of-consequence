# Local-to-production critical checklist

- Typecheck, regression tests, and production build pass.
- Neon schema exists; migrated record counts and snapshot digests match.
- Production DATABASE_URL targets the production Neon branch.
- Preview uses an isolated Neon branch.
- GOC_SESSION_SECRET and existing GPT credentials are server-only.
- Ping checks actual database connectivity.
- GPT state, HUD, checkpoints, and browser datapad return the same campaign revision.
- A transaction commits once; stale revisions return 409 without losing confirmed outcomes.
- No legacy cloud credentials or bridge remain in the active deployment.
- Custom GPT imports the live /api/gpt/openapi schema and uses the stable Vercel API.
- Promote the verified build to galaxy-local.vercel.app.

Code delivery: Codex -> GitHub -> Vercel.
Gameplay: Browser/custom GPT -> Vercel -> Neon Postgres.
