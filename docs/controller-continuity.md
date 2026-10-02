# GOC controller continuity

## Runtime truth

Codex is a development environment, not a runtime dependency. A Codex quota/outage must not stop gameplay or persistence.

Runtime path:

1. Custom GPT calls the `goc-gpt-controller` Supabase Edge gateway.
2. The gateway proxies true gameplay turns to the existing Vercel `/api/gpt/turn` engine.
3. Gameplay results persist to Supabase.
4. The web app and GPT read the same Supabase-backed state.
5. Save/load/HUD/reconciliation use dedicated non-gameplay controller operations and never pass through the Saga turn resolver.

## Data vs code

- **Gameplay data**: Supabase only. Never store live campaign state in GitHub.
- **Code**: GitHub is the durable source-control fallback when the local Codex working tree is unavailable.
- **Deployment**: Vercel remains the web/gameplay runtime. GitHub changes should be preview-tested before production promotion once the full local application has been reconciled.

## Codex unavailable

When local Codex usage is unavailable:

- continue gameplay through the Custom GPT controller;
- persist every successful gameplay turn to Supabase;
- make emergency controller/code changes directly on `codex-master-sync` in GitHub;
- keep Supabase migrations and Edge Function source in the repository;
- do not overwrite the full Vercel production app from the older GitHub prototype.

## Codex returns

Before new local development:

1. fetch `wethechosen/galaxy-of-consequence`;
2. compare the local authoritative working tree with `codex-master-sync`;
3. preserve the current local UI/game engine while bringing in the controller, auth, datapad, migrations, and Edge Function changes;
4. run typecheck, tests, and build;
5. preview deploy;
6. test GPT -> controller -> Vercel -> Supabase -> web round trip;
7. promote only the validated commit.

## Control-operation invariant

The following are never gameplay turns:

- save/checkpoint;
- load/restore checkpoint;
- HUD/state read;
- OOC reconciliation/state correction.

They must not roll dice, generate initiative, narrate events, award XP, alter inventory beyond an explicit patch, advance combat, or infer consequences.
