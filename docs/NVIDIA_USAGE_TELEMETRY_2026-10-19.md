# NVIDIA Usage and Rate-Limit Telemetry

This change extends the **existing** NVIDIA provider; it does not replace the GM or
touch real campaign saves. The four previously completed real-Nemotron test fixtures
remain completed; do not rerun them just to collect metrics.

## Output and privacy

For each provider invocation, the server emits one structured
`[goc/nvidia-usage]` JSON record via `console.info`. These fields alone are included:

- UTC timestamp, model identifier (validated), model **purpose** (`interpretation`,
  `gm`, `ledger`, `npc`), provider-vs-local-pacer-vs-transport origin, HTTP status,
  and elapsed milliseconds.
- `inputTokens`, `outputTokens`, `totalTokens` from NVIDIA's *reported* usage only.
  Missing or unparseable counts are `null`, not fabricated estimates.
- Provider `Retry-After` duration recorded as `retryAfterSeconds`; the Boolean
  `retryAfterEstimated` separates a provider-supplied cooldown from our fallback.
- An allowlist of numeric/duration/date `x-ratelimit-*` quota/reset header fields,
  only when actually returned and safely parsed. Unrecognized headers and arbitrary
  header values are discarded, including provider IDs or any credential-bearing values.
- A randomly generated `traceId` and monotonically increasing
  `turnRequestNumber` for GM-turn-scoped calls. It groups interpretation, narration,
  and optional ledger/repair requests belonging to **one in-process GM-turn attempt**.
  Standalone calls outside `runGmTurn` have null trace/request number.

No API keys, player identifiers, turn IDs, player actions, prompts, narration, response
bodies, account IDs, sourcebook content, payment data, or token strings are logged.
Provider error text is never included in the metrics record. Telemetry failure is
ignored and never blocks gameplay or changes the authoritative GM outcome.

## Limits and retention

These are server log records, **not** a new database table or endpoint. Retention,
cross-process aggregation and access control depend on the deployment's existing
log management. No Neon writes or migrations are required. The only real usage
evidence is what the endpoint actually returns; when headers/usage are absent,
their values remain unknown. Do not infer an hourly token reset from the historical
~64-minute *operator-imposed* test pacing.

The existing pacing mechanism remains 2,000 ms between calls. For HTTP 429, it
continues to honor NVIDIA's valid `Retry-After` (seconds or HTTP date). When
`Retry-After` is missing or invalid, the fallback is **3,900 seconds / 65 minutes**
as a conservative safety policy, not a statement about NVIDIA's actual reset window.
The original action and turn ID are preserved through existing gameplay retry logic.

## Reviewing logs

Filter for `[goc/nvidia-usage]` and aggregate by `traceId`. To estimate average
tokens per successful completed GM turn, sum reported `totalTokens` across its
requests, **excluding** turns with missing usage values; report the excluded count.
Compare rate-limited requests to provider `retryAfterEstimated` and reset headers.
Do not treat local-pacer rejections as new NVIDIA provider rate limits.

## Verification

`npm run typecheck`, `npx vitest run lib/nvidia-usage-telemetry.test.ts lib/original-provider.test.ts lib/nvidia-models.test.ts`,
and the normal deterministic suite use *simulated* provider responses. They do not
contact NVIDIA or certify quota policy. Do not run the `*.live.test.ts` fixtures
after the isolated completion marker says certification is complete.
