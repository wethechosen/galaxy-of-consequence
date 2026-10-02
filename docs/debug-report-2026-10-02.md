# Galaxy of Consequence — Debug Report (2026-10-02)

## Current state

- Supabase authoritative datapad save for `dmir@galaxy.local` is revision **40**.
- Confirmed persisted values at revision 40:
  - HP: **4**
  - credits: **1,199,999,770**
  - XP: **250**
  - location: **Coruscant — Black Sun-controlled apartment bloc, Unit 4-B sublevel (concealed bunker access)**
  - combat round: **3**
  - active side: **player**
  - Guard Blocking The Corridor: **6 HP**
- Prior revision 39 was backed up before reconciliation.

## Production observations

### Working

1. `GET /api/gpt/state` returns HTTP 200 when invoked with the configured GPT action authentication.
2. `POST /api/gpt/turn` has returned HTTP 200 on the current production deployment.
3. The turn route can fall back to deterministic resolution when the AI draft is rejected.
4. No new Vercel runtime errors were observed in the latest two-hour window.

### Broken / incomplete

1. `GET /api/auth` still returns **403** in hosted production because the current deployment retains the local-only gate.
2. `GET /api/datapad` still returns **403** in hosted production for the same reason.
3. Historical hosted builds attempted SQLite (`:memory:` or a local database path) and produced `ERR_SQLITE_ERROR: unable to open database file`. Hosted execution must never rely on Vercel-local SQLite/filesystem persistence.
4. Current Vercel deployments do not show Git commit metadata, so GitHub -> Vercel automatic deployment is not yet proven/configured.
5. The GitHub branch does not yet contain the complete current Codex source. In particular, `app/api/gpt` is absent from `codex-master-sync`; the working GPT routes exist only in the newer local/Vercel source until that tree is pushed.

## GitHub Actions status

The `Validate Codex Master Sync` workflow is syntactically normal, but the latest run failed before any workflow step executed. The failed job shows:

- `runner_id: 0`
- empty runner name
- zero steps
- roughly two seconds from job start to failure
- no downloadable job log

That means this failure is **not evidence that typecheck, tests, or build failed**; the GitHub-hosted runner never started. Treat this as a repository/Actions runner provisioning or account-level CI issue until a job actually receives a runner and executes steps. Local validation in `scripts/sync-codex-to-github.ps1` remains the required gate in the meantime.

## AI draft / validator mismatch

A successful `POST /api/gpt/turn` logged this warning:

`The GM returned an invalid world-state field (inventoryAdd). Retry this turn.`

The route recovered by using deterministic fallback, so the request still returned 200. This is not fatal, but it is a schema mismatch between the GM draft output and the server validator.

### Fix when the current local source is synced

Choose one canonical mutation schema and make both the model prompt and validator use it. Prefer an explicit change-set contract such as:

```ts
type WorldStatePatch = {
  healthDelta?: number;
  creditsDelta?: number;
  xpDelta?: number;
  location?: string;
  inventory?: {
    add?: Array<{ id?: string; name: string; quantity?: number }>;
    remove?: Array<{ id?: string; name?: string; quantity?: number }>;
  };
  combat?: CombatPatch;
};
```

Do not allow the model to invent top-level fields such as `inventoryAdd` unless that field is explicitly part of the validator schema. If backward compatibility is needed, normalize legacy `inventoryAdd` to `inventory.add` before validation, then validate the normalized object.

## Required route fixes after local Codex sync

### `/api/auth`

- Remove the hosted `Local access only` branch.
- Keep local development support, but hosted production must use Supabase Auth/session verification.
- Never expose service-role credentials to the browser.

### `/api/datapad`

- Remove the hosted `Local access only` branch.
- Read/write the same Supabase datapad record used by GPT controller routes.
- Preserve optimistic revision locking.
- A stale write must return 409 and must never overwrite a newer revision.

### `/api/gpt/state`

- Read the authoritative Supabase revision directly or through the server-side bridge.
- Do not open SQLite in hosted execution.
- Return the confirmed revision used for the next turn.

### `/api/gpt/turn`

Order must be:

1. authenticate GPT action;
2. load authoritative Supabase state and current revision;
3. reject stale `revision` with 409;
4. dedupe `turnId` before applying consequences;
5. resolve deterministic mechanics;
6. optionally generate AI narration/draft changes;
7. validate/normalize the draft;
8. commit exactly once to Supabase;
9. return committed revision + narration/HUD;
10. controller re-reads `/api/gpt/state` and verifies the same revision.

No hosted turn should depend on a Vercel-local SQLite database.

## Source / deployment correction

Correct code-delivery path:

```text
C:\Users\Passi\OneDrive\Desktop\GalaxyOfConsequence
    -> wethechosen/galaxy-of-consequence
    -> Vercel
```

Correct gameplay path:

```text
GOC Custom GPT <-> Vercel API <-> Supabase <-> Web app
```

GitHub is not part of the live turn-response loop; it versions and delivers code only.

## Cutover blocker

Do not merge the older GitHub `main` into production until the complete current Codex working tree is pushed to `codex-master-sync` and verified. The branch includes scripts that reject a wrong Git remote, tracked runtime files, obvious staged secrets, and failed typecheck/tests/build.
