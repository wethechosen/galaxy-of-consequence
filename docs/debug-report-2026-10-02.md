# Galaxy of Consequence — Debug Report (2026-10-02)

## Current state

- Supabase authoritative datapad save for `dmir@galaxy.local` has advanced through the live GPT controller and is now at revision **41**.
- The current persisted controller checkpoint remains aligned with the Unit 4-B combat continuity (4 HP, 1,199,999,770 credits, 250 XP, Unit 4-B concealed bunker access, combat round 3, player side active).
- Prior revisions were checkpointed before reconciliation work.

## Hosted auth/datapad fix staged on `codex-master-sync`

The old production deployment still contains its historical `Local access only` branches, but replacement hosted routes are now committed to GitHub:

- `app/api/auth/route.ts`
  - Supabase password authentication for login/register;
  - HTTP-only secure access/refresh cookies;
  - session refresh;
  - logout and cookie invalidation;
  - anonymous session checks return `{ user: null }` with HTTP 200 rather than a hosted 403;
  - admin role is derived only from trusted `app_metadata` or the established GM account identity, never writable user metadata.
- `app/api/datapad/route.ts`
  - requires an authenticated session;
  - players may access only their own `accountId`;
  - GM/admin may access another campaign account;
  - reads and writes the Supabase datapad bridge rather than local SQLite/files;
  - preserves optimistic revision locking and propagates 409 conflicts;
  - refreshes expired sessions;
  - supports GM configuration persistence.
- `lib/supabase-auth.ts`
  - thin server-only Supabase Auth REST client; no service-role credential is exposed to the browser.
- `lib/datapad-bridge.ts`
  - server-only bridge client using `GOC_SUPABASE_BRIDGE_URL` + `GOC_SUPABASE_BRIDGE_KEY`.

The Supabase side has also been upgraded:

- `goc-datapad-bridge` is active at version 3;
- it now accepts `accountId` while preserving the prior username contract used by GPT routes;
- a server-only account-id-to-username RPC was added;
- GM config storage + revision-locked config RPCs were added;
- existing GPT traffic remained compatible after the bridge upgrade: a later live GPT turn successfully persisted revision 41.

## Production observations

### Working

1. `GET /api/gpt/state` returns HTTP 200 when invoked with configured GPT action authentication.
2. `POST /api/gpt/turn` returns HTTP 200 on the current production deployment and persists to Supabase.
3. Supabase revision locking is active.
4. The turn route can fall back to deterministic resolution when an AI draft is rejected.

### Deployment still required

The current Vercel production artifact predates the replacement auth/datapad route commits, so its `/api/auth` still logs HTTP 403 until the authoritative local Codex source is reconciled with `codex-master-sync` and a new Vercel deployment is made.

Do **not** deploy the older GitHub tree as-is: the current production/local Codex build contains newer UI and GPT routes that are not yet fully represented on this branch. The correct action is to bring the current local working tree into `codex-master-sync`, retain the hosted auth/datapad replacements, build/test the merged tree, create a preview, and only then promote it.

## AI draft / validator mismatch

A successful `POST /api/gpt/turn` has logged AI-draft validation warnings such as invalid or malformed world-state output. The route recovers through deterministic fallback. This is non-fatal but should be normalized after the authoritative local GM source is synced.

## Source / deployment correction

```text
CODE DELIVERY
C:\Users\Passi\OneDrive\Desktop\GalaxyOfConsequence
    -> wethechosen/galaxy-of-consequence
    -> Vercel

GAMEPLAY RUNTIME
GOC Custom GPT <-> Vercel API <-> Supabase <-> Web app
```

GitHub versions code; it is not part of the live gameplay response path.
