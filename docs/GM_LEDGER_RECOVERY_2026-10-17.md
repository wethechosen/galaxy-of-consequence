# GM drafting and ledger recovery — October 17, 2026

## Scope and existing architecture
The authoritative Saga engine, one Nemotron GM, existing Neon campaign store, browser, and Custom GPT controller are unchanged. No change to credits, dice rules, player accounts, provider credentials, or Custom GPT action parameters.

1. First attempt strict parsing. If a single existing hidden STATE comment has only safe, unambiguous JSON syntax errors, normalize and reparse locally. Missing or semantically inconsistent consequences still require the existing ledger role and validators.
2. On 429/502/503/504 provider failures, return a retriable technical response instead of spending two more immediate requests. Preserve the same action/turnId/revision.
3. Checkpoint the original raw GM narration BEFORE ledger validation/repair; a retry can reuse it without another narration call. Raw drafts are never committed or presented as confirmed gameplay. After full validation, promote the checkpoint to validated, then use the existing compare-and-swap campaign save and duplicate-turn replay.
4. Checkpoints are bound to account, turn ID, action digest and base revision. A mismatched reuse is HTTP 409. Reused validated drafts undergo server checks again; no duplicate roll or credit deduction.

## Hosted deployment prerequisite
Apply db/neon/003_gm_validated_drafts.sql to the intended Neon database using an authorized migration workflow BEFORE relying on hosted checkpoint recovery. It creates an independent private schema table; it does not touch existing campaign saves or revisions. If the table is absent during staged deployment, the application continues without this optimization instead of failing a valid turn.

No Vercel production secrets are changed by these source modifications. Do not copy local .env.local values into GitHub or logs.

## GPT contract
docs/custom-gpt-controller-instructions.md now explicitly describes raw-versus-validated checkpoints and existing same-turn retry semantics. The already published /api/gpt/turn, /api/gpt/pending, and OpenAPI request/response shapes are unchanged. Therefore docs/gpt-actions.openapi.json and the generated OpenAPI route do not require a schema update.

The published instructions in the Custom GPT builder must still be synchronized with the updated repository document if that GPT has a separately configured copy.

## Acceptance gates
- Typecheck, full scripted Vitest suite, and Next production build must pass after final edits.
- Targeted tests must cover locally repaired JSON, unrecoverable ledger semantics, provider-error classification, protected draft identity, and a real-engine scripted simulation of ledger HTTP 429 followed by same-turn recovery.
- The isolated real-NVIDIA certification is a separate gate, not demonstrated by scripted tests. Check its completion marker and provider cooldown before one bounded live scenario; never run against D'mir's saved campaign.
- GitHub-hosted CI runner provisioning is separate from application test pass/fail; investigate failures without suppressing the workflow.
