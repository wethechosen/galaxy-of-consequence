# Galaxy of Consequence: canonical gameplay contract v1

This document is the definitive interface contract for **both** the native browser game and the Custom GPT. The interface may change, but a committed turn's narrative, mechanics and authoritative state must not.

## Source of truth and equivalent output

- **One campaign**: the existing revisioned Neon Postgres save. Both transports invoke `runGmTurn`. Neither client grants itself dice, credits, XP, items, movement, NPC loyalty, or events.
- **One output**: `goc-gameplay-v1` is projected by `publicCommittedTurn` for *both* `POST /api/gm` and `POST /api/gpt/turn`. It contains the same `revision`, `turnId`, `narration`, `roll`, `receipt`, `character`, player-visible `snapshot`, `state`, `hud`, and `gameplayAdvanced`. The saved narration is anchored to the committed world location by the same shared function before saving; no GPT-only rewrite is permitted.
- **Visibility**: the server preserves all NPC private plans/mechanics in the authoritative save but excludes `rivalIntelligence`, `npcOffscreen`, and `npcMechanics` from both player-facing outputs. The GM still owns those fields.
- **Presentation**: the browser displays the response in its gameplay HUD. Custom GPT presents the returned narration *without adding unconfirmed dialogue, locations, rolls or outcomes*. Player choices remain wholly player-controlled.
- **Replay**: a committed `turnId` + matching original declaration replays the saved result without charging twice, rolling twice or advancing the revision. A reused `turnId` paired with another action is a **409 conflict**, never a fresh gameplay declaration. Replay transport metadata (such as `replayed` and `provider: hosted-replay`) can differ from the first execution; the narration, roll, holdings, state and outcomes must not.

## Transport differences — not rules differences

| Concern | Browser | Custom GPT |
| --- | --- | --- |
| Authentication | Website session/cookie | Existing bearer action key |
| New action | `POST /api/gm`, with revision/action/turnId | `submitPlayerAction`: `POST /api/gpt/turn`, with revision/action/turnId |
| Committed response | `goc-gameplay-v1` public envelope | The **same** `goc-gameplay-v1` public envelope |
| Cooldown | Visible, updating browser timer; browser reissues the identical declaration when permitted | Controller provides an **encrypted retry ticket**; GPT can check remaining cooldown and re-submit the ticket in a subsequent tool call |
| Refresh / reconnect | Browser retains pending action locally and checks authoritative revision | GPT retains an authenticated encrypted ticket, so it need not reconstruct the declaration from conversation history |
| Read pending | Browser countdown state | `checkPendingPlayerAction`: `POST /api/gpt/pending`, with `retryTicket` only |
| Resume | Browser uses same action/revision/turnId | `submitPlayerAction`: `POST /api/gpt/turn`, with `retryTicket` **alone** |
| Provider outage | No fabricated narrative; keep previous confirmed save | No fabricated narrative; preserve ticket and next permitted retry |
| A background retry after client disconnect | Not guaranteed without an active browser page | **Not supported**. Custom GPT cannot schedule new tool invocations when its turn ends. Server-side autonomous worker would require a separately provisioned queue/scheduler |

## Strict turn lifecycle

1. **NEW** — call `getCampaignState`. Pass the current `revision`, original player-authored `action` and a unique `turnId` to the canonical GM. No suggested choice is mandatory.
2. **COMMITTED** — require `receipt.status=committed` or a confirmed successful canonical result; render `narration`, `roll`, `character`, `state`, `hud` verbatim from the response. Do not turn another technical read into story progression.
3. **RATE LIMITED / TRANSIENT** — return HTTP 429 or marked retriable 502/503/504 with `retry.retryTicket`, `retry.retryAt`, `retry.estimated`, `retry.baseRevision`, `retry.turnId` and `gameplayAdvanced=false`. There is **no** GM narration or player-visible consequence.
4. **COOLDOWN** — call `checkPendingPlayerAction` with the *same* ticket. This action is read-only. `status=cooldown` includes `secondsRemaining`. If `estimated=true`, describe the delay as an estimate, not a guarantee from NVIDIA.
5. **READY** — status `ready` only means the stated retry interval has elapsed. Submit `retryTicket` **alone** to `submitPlayerAction`. The server decrypts the exact saved action/revision/turnId; do not invent or alter any of them. Another 429 issues a replacement ticket and countdown.
6. **ALREADY COMMITTED** — on pending check or repeated action, the controller returns the exact authoritative saved result. Display it as the committed outcome; do **not** submit the action again.
7. **409 CONFLICT** — read `getCampaignState`, inspect whether the original action already committed, and do not silently re-run or change it. If another action advanced the revision, user intervention may be required; never synthesize a new decision to force progress.
8. **INVALID / EXPIRED TICKET** — return HTTP 400; read the current authoritative state before planning any new turn. The encrypted ticket expires after seven days and is bound to the authenticated GPT account.
9. **NON-RETRIABLE GAMEPLAY PAUSE** — advancement gates, genuine invalid declarations, authorization errors, or Saga story outcomes are not model rate limits. Follow their respective contracts; do not retry in a loop.

## Prohibitions

- Never generate GM dialogue, equipment, credits, XP, relationships, dice outcomes, travel or state changes from a failed/429 response.
- Never replace an active declaration with a different or shortened one during recovery.
- Never use `reconcile`, `loadCheckpoint`, or `saveCheckpoint` to hide an interrupted gameplay action.
- Never claim a server retry is running in the background solely because a ticket exists.
- Never present a locally estimated cooldown as an exact NVIDIA-reset countdown.
- Never disclose or log GPT bearer credentials or ticket encryption keys.

## Guarantees and limits

The encryption uses authenticated AES-256-GCM with a key derived from the configured GPT action secret. The ticket carries an account binding, a copy of the exact player declaration, the original revision/turn ID, the next permitted retry and an expiration. Server-side turn/revision checks still gate execution; a ticket cannot bypass Saga mechanics or campaign authorization. Checking status never advances the game.

A strict *gameplay data parity* invariant is exercised by tests for both first-commit and replay paths, plus safe NPC-private-state projection. Live NVIDIA success remains a separate certification gate; requests can still be throttled by NVIDIA. The Custom GPT cannot initiate a new tool invocation after its host turn ends, so uninterrupted autonomous recovery requires an independent, separately supported server-side worker.
