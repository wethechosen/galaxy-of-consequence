# Confirmed asset ledger — Phase 1 (read-only)

## Intent

Give the live `/character` dossier and the Custom GPT state reader a shared, non-mutating view of existing campaign financial records. This borrows Torn's durable progression/ownership presentation **only**, not its mechanics.

## Runtime ownership and compatibility

- `original/lib/assetLedger.js` reads the **existing datapad `gameState`** fields. It does not set them, start a timer, request AI, or save a campaign.
- `original/components/AssetLedgerPanel.jsx` renders the dossier panel in `original/pages/CharacterPage.jsx`. It does not affect the older 150 ABY archive.
- `app/api/gpt/state/route.ts` adds `assetLedger` derived from the same saved Supabase/local authenticated snapshot. Existing `world`, `character`, `hud` and revision response shapes remain unchanged.
- Legacy/suspected inheritance stays in the existing dossier claims panel. It is excluded from the new GPT `assetLedger` projection, and never included in liquid funds.
- Existing saves require **no migration**. Missing fields are handled as empty collections or unknown figures. No new account, gameplay route, write path or third-party service is introduced.

## Accounting boundaries

| Source field | Presentation | Never infer |
|---|---|---|
| `credits` | Spendable galactic credits | New income, rewards or conversion |
| `bankCredits` | Deposited galactic credits | Interest; separate wealth in addition to deposit |
| `creditsCriminal` | Underworld credits separately | Fungibility with galactic accounts |
| `properties` | Recorded holdings or **leasehold access** | Legal title for tenants |
| `ships` | Recorded vessels | Market resale valuation |
| `investments` | Saved positions and historical committed amount | Real-time gains, distributions |
| `tradeReceipts` | Recent committed merchant receipts | Purchase from an *open offer* |
| `bankTransactions` | Recent committed transfers | Credits created by deposit/withdrawal |
| `legacyAssets` | Existing legacy claim section | Accessible capital or inherited ownership |

A `baseValue` or `amount` (when positive and valid) is labeled **recorded basis**, not market value. Zero, malformed or absent basis is unknown. Neither property appreciation nor a total net worth is computed. Landlord-held security deposits remain separate from bank funds.

## Safety requirements

1. The Saga Edition rules and GM resolver remain authoritative for all acquisitions and progression.
2. An outstanding quote is not a receipt; an offered residence is not a lease; a lease is not a deed.
3. For merchant replay, server `turnId` and revision locking remain unchanged.
4. No offline income, auto-investing, dynamic valuations or new relationship state has been added.
5. Do not test by making purchases or altering D'mir's live character.
6. Any later write features require separate server-side validation, idempotency tests and review.

## Verification

- Unit tests: `original/lib/assetLedger.test.js` cover balances, leases, missing valuations, unconfirmed claims, receipts and malformed data.
- API test: `lib/gpt-state.test.ts` verifies the optional projection contains no legacy claims and does not mutate the input snapshot.
- Before merge: `npm ci && npm run typecheck && npm test && npm run build` on the reviewed PR commit.
- Before any deployment: respect `docs/repair-priorities-20261008.md` promotion gates. This PR does **not** deploy or mutate the production campaign.
