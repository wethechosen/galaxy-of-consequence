# Custom GPT Action bridge

The bridge is intentionally separate from the browser-only `/api/gm` route. Both call the same `runGmTurn` authority, Saga dice, combat resolver, XP rules, inventory/economy rules, and idempotent turn ledger. With the hosted bridge configured, both hydrate the current Supabase campaign into a transient local cache and commit the resulting snapshot back through the same revision-checked Supabase bridge. SQLite is not the durable save on Vercel.

Configure these server-side secrets; never put them in GPT instructions or client JavaScript:

```text
GOC_GPT_ACTION_KEY=<random bearer secret, at least 32 characters>
GOC_GPT_ACCOUNT_USERNAME=dmir@galaxy.local
```

After deploying over HTTPS, import `https://galaxy-local.vercel.app/api/gpt/openapi` into the Custom GPT Actions editor and configure Bearer authentication with the same key. The schema uses the stable production URL even if opened from an immutable deployment URL. Set `GOC_GPT_PUBLIC_BASE_URL` only when deliberately moving the controller to another stable HTTPS address.

The GPT must call `GET /api/gpt/state` before a turn, then `POST /api/gpt/turn` with the returned `revision`, one `action`, and a unique `turnId`. The actual gameplay body is `{ "revision": 201, "action": "I listen at the hatch.", "turnId": "turn_unique_id" }`; it does not require `expectedRevision` or client-authored mechanical intent. Reuse the same ID only when retrying the exact same action. On a revision conflict, re-read state before resubmitting. Present the committed seven-section narration and server-owned check without replacing them with an independently invented outcome.

The action is not a bulk transcript importer. Each submitted turn is resolved and persisted individually so dice, state, XP, credits, inventory, and campaign memory remain interactive and auditable.
