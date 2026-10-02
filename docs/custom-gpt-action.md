# Custom GPT Action bridge

The bridge is intentionally separate from the browser-only `/api/gm` route. It uses the same `runGmTurn` authority, SQLite save, Saga dice, combat resolver, XP rules, inventory/economy rules, and idempotent turn ledger.

Configure these server-side secrets; never put them in GPT instructions or client JavaScript:

```text
GOC_GPT_ACTION_KEY=<random bearer secret, at least 32 characters>
GOC_GPT_ACCOUNT_USERNAME=dmir@galaxy.local
```

After deploying over HTTPS, import `https://galaxy-local.vercel.app/api/gpt/openapi` into the Custom GPT Actions editor and configure Bearer authentication with the same key. The GPT should call `GET /api/gpt/state` before a turn, then `POST /api/gpt/turn` with the returned `revision` and one `action`. On a revision conflict it must re-read state and submit a new turn ID.

The action is not a bulk transcript importer. Each submitted turn is resolved and persisted individually so dice, state, XP, credits, inventory, and campaign memory remain interactive and auditable.
