# GOC controller continuity

## Runtime truth

Codex is a development environment, not a runtime dependency. A Codex quota/outage must not stop gameplay or persistence.

Runtime path:

1. Custom GPT calls the Vercel `/api/gpt/*` controller directly.
2. True gameplay turns run through the Vercel `/api/gpt/turn` engine.
3. Gameplay results persist to Neon Postgres with revision checks.
4. The web app and GPT read the same Neon-backed state.
5. Save/load/HUD/reconciliation use dedicated non-gameplay controller operations and never pass through the Saga turn resolver.

## Data vs code

- **Gameplay data**: Neon Postgres only. Never store live campaign state in GitHub.
- **Code**: GitHub is the durable source-control fallback when the local Codex working tree is unavailable.
- **Deployment**: Vercel remains the web/gameplay runtime. GitHub changes should be preview-tested before production promotion once the full local application has been reconciled.

## Codex unavailable

When local Codex usage is unavailable:

- continue gameplay through the Custom GPT controller;
- persist every successful gameplay turn to Neon;
- make emergency controller/code changes directly on `codex-master-sync` in GitHub;
- keep Neon schema migrations in the repository;
- do not overwrite the Vercel production app from an older GitHub prototype.

## Codex returns

Before new local development:

1. fetch `wethechosen/galaxy-of-consequence`;
2. compare the local working tree with the production branch;
3. preserve the current UI/game engine while bringing in controller, auth, datapad, and Neon schema changes;
4. run typecheck, tests, and build;
5. preview deploy;
6. test GPT -> Vercel controller -> Neon -> web round trip;
7. promote only the validated commit.

## Control-operation invariant

The following are never gameplay turns:

- save/checkpoint;
- load/restore checkpoint;
- HUD/state read;
- OOC reconciliation/state correction.

They must not roll dice, generate initiative, narrate events, award XP, alter inventory beyond an explicit patch, advance combat, or infer consequences.
