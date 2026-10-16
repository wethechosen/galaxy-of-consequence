# Production synchronization

GitHub versions the code. Vercel runs the released application. Neon Postgres is the only hosted campaign persistence source; there is no legacy cloud bridge or hosted SQLite fallback.

## Shared authoritative loop

Browser or custom GPT -> Vercel API -> validated mechanics and transactions -> Neon commit -> confirmed receipt -> narration and refreshed interface.

Both clients read the same account, campaign revision, balances, inventory, holdings, objectives, advancement, and checkpoints. The GM receives confirmed state, not a competing chat-only ledger.

## Persistence and credentials

Apply `db/neon/001_goc_hosted_store.sql` before serving the application. Use server-only `DATABASE_URL`, `GOC_SESSION_SECRET`, and GPT action credentials. Keep pooled connections for the hosted runtime. Production and preview must use separate Neon branches.

The temporary SQLite cache supports the existing resolver; it is hydrated from Neon and never a durable hosted save. A missing Neon connection fails explicitly rather than creating a divergent campaign.

## Exactly-once changes

Writes check the expected revision and lock the campaign row. Replayed turn IDs return the existing receipt. Stale revisions return 409 and must refresh before resubmission. Money and acquired assets commit together; narrative claims are not independent transactions.

## Release verification

Check ping, authenticated state, HUD, checkpoint list, and browser datapad reads against the same saved revision. Test mutations on a cloned preview branch. Promote only a successful production build; changing code alone does not update the public alias.

The migration manifest preserves account hashes, campaign snapshots, backups, checkpoints, and indexed sourcebook chunks. Old cloud records are retained outside the running application for recovery, not as a fallback.
