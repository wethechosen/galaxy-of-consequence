# Galaxy of Consequence — Provider / GPT Action / CI Debug (2026-10-17)

## Evidence and scope
No production character, account, or saved campaign was read or modified. Live-model calls used an existing authorized local testing credential. Its value was never printed, logged, copied, or committed.

### NVIDIA availability
- A single low-token health probe completed with upstream **HTTP 200** against the configured model.
- In a subsequent isolated test using the real GM engine, the first larger interpret-action request received upstream **HTTP 429**. No real-model campaign turn completed.
- Three later fixture cases did not make additional upstream calls: the local NVIDIA cooldown correctly blocked them.
- This establishes that **a successful short probe is not proof of sufficient capacity for a real game turn**. The exact provider quota dimension (requests, tokens, account quota, model capacity) remains unverified. Avoid claims that changing API keys or increasing request throughput is a valid bypass.
- The test fixture runner is isolated from production campaign saves. Do not run it against a real actor or copy its local persistence to production.

### Retry accuracy and behavior
- Previously, a missing upstream `Retry-After` became an unlabeled 60-second default, shown as though it were a provider-confirmed reset. This is a false precision issue.
- Corrected error receipts carry `retryAfterEstimated`. A locally calculated cooldown is explicitly estimated, even when the server includes an HTTP `Retry-After` advisory.
- Browser gameplay retains the exact action and turnId, counts down, and retries without inventing a GM response.
- GPT Actions cannot initiate a new tool call after the current ChatGPT action invocation ends. The API now returns a structured, safe future retry plan with the original turn ID, base revision, retry time, and whether that time is estimated. This preserves the information needed for a later call; it is **not** a background scheduler and does **not** claim unattended GPT completion.

### GitHub Actions failure
- Repository: `wethechosen/galaxy-of-consequence`
- Workflow: Validate Codex Master Sync; run `39070629476`; attempt 2; job `117507544915`.
- Metadata: started 2026-10-17 21:23:06 UTC, completed 21:23:09 UTC, conclusion failure, `runner_name` blank, `steps: []`, check-run output null; job log returns 404 BlobNotFound.
- No checkout, npm install, test or build step started. This cannot be attributed to an application test failure. GitHub-runner allocation/account policy/provisioning are possibilities, not confirmed causes.
- Investigate repo Settings → Actions → General, account-level Actions policy, and the run-page annotations. If unavailable, ask GitHub Support to examine runner-side telemetry using the run/job IDs. Do not hide or disable the CI workflow just to obtain a green badge.
- Separate local TypeScript, Vitest and Next build verification is needed while GitHub-hosted execution is unavailable.

## Release guardrails
- Never expose credentials or upstream response bodies.
- Never fabricate GM narration, rolls, or authoritative state updates when rate-limited.
- Never retry a 409 revision conflict automatically; reconcile against authoritative saved state.
- Do not call a short health probe a live-GM certification.
- Keep GPT/production save read-only during diagnosis. Do not use a real campaign for acceptance tests.
