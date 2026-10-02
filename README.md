# Galaxy of Consequence

Local, solo React/Next.js application for a 150 ABY Star Wars Saga Edition
sandbox. Read [CAMPAIGN.md](CAMPAIGN.md) for the accepted campaign decisions.

## Run locally

Requires Node.js 22.16+ (built-in SQLite is experimental on Node 22).

Double-click **Start Galaxy.cmd**, or run:

```powershell
npm run play
```

Keep the launcher running while using the app. It builds when application files
change, then serves the same build on port 3100. It uses a fresh build directory
to avoid stale OneDrive cache errors, without deleting caches or campaign saves.
If a cached build becomes unreadable, run `npm run play -- --rebuild` after stopping
the previous server. On a fresh checkout, run `npm install` first.

Open http://127.0.0.1:3100. Keep this app on loopback; its accounts are for this
private local terminal, not public hosting. No cloud database or Base44 service is required. Live AI is
disabled by the user's choice. No keys are necessary for current functionality.

## Working features

- Screenshot-led orange/cyan glass datapad, responsive sidebar, locally bundled
  Orbitron and Space Grotesk fonts, HUD overlay and morality-responsive accents.
- First-run owner setup, local sign-in/out, hashed passwords, expiring HttpOnly
  sessions, editable account profile and server-enforced administrator role.
  The first account is the owner; the GM console can create player accounts.
  All local accounts share this solo campaign archive, not isolated multiplayer worlds.
- Marketplace category/search controls, holdings and financial entry requests,
  persistent intention queue and GM review responses. These are **review requests**,
  not completed purchases, stat grants, NPC replies or automated gameplay.

## First sign-in

Choose your own username, display name and a password of at least 12 characters
on the initialization screen. No default administrator password is installed.
Existing saves are retained. Profiles and sessions live in the same private
SQLite database. The owner can create local player accounts in **GM Console**.
Never expose this service on the public network. There is no email/password
recovery flow or production multiplayer account isolation.

## Campaign archive features

- 150 ABY setup, editable biography drafts and a source-verified organic
  point-buy calculator (Core printed p.18 / PDF p.19). It is not a complete
  character creator and does not assign active stats.
- Persistent SQLite campaign state, named snapshots, independent checkpoint
  branches, timeline selection and separate new campaigns.
- Journal notes with pursue/dismiss/archive controls; tracking is not accepting
  a contract. Contacts/assets and economic records have dedicated views.
- Seven-times world clock; atomic catch-up, approved recurring cashflows,
  unaffordable-payment pauses and contract deadline decision records.
  No sample income or obligations are silently assigned to the player.
- Decision-response form records intentions without prematurely resolving
  consequences. Rules adjudication still needs implementation.
- Player-visible state projection excludes hidden contacts, agendas, events,
  and secret roll targets. Local-origin checks protect mutation routes.
- Isolated deterministic provider preview with no paid requests or campaign writes.
- Private source index shared by the GM console and archive, page search, and
  local PDF OCR. Extracted pages are NOT automatically approved. Only reviewed
  passages may establish exact rules; unreviewed passages supply flavor and leads.

## Source processing

Use **GM Console → Sourcebooks** to upload a PDF, TXT, or Markdown source,
search extracted pages, open the original PDF, and review a page after checking
its text. Bulk import uses the explicit sourcebook allowlist in the Node script,
not every PDF in Downloads.

```powershell
npm run index:sources
npm run index:sources -- --only "Saga Edition Core" --max-pages 10
```

The canonical indexer is `scripts/index-sourcebooks.mjs`. It uses PDF.js and
Tesseract for local extraction and OCR, and resumes completed pages after an
interruption. `--max-pages` limits newly processed pages in a run. OCR can take
time for scanned books; review the original page before approving rules because
tables and headings can be misread. Printed and PDF page numbering are distinct.
The older Python source scripts are retained as historical utilities and are
not used by the app or its shared source library.

The private source library and campaign saves share `data/campaign.sqlite`.
Override both together with `CAMPAIGN_DB_PATH`. Bulk-imported PDFs stay in
Downloads; uploads are private files under `data/private-sources/`.
Stop the app before backing up the complete data directory. PDFs, extracted
text, databases and credentials must stay out of Git. Never put API keys in
`NEXT_PUBLIC_` variables.

## Still required before playable release

Verified species/class/feat/talent choices, full character creation, combat,
conditions, Force effects, XP/level progression, travel and inventory resolution;
source-reviewed lore and faction/NPC behavior; authoritative OpenAI tool
orchestration, constrained Nemotron voice, idempotent AI retries and spending
controls. The old keyword-based combat checks have been removed.

The first persistent playtest loop is enabled: the server loads the saved campaign, plans and rolls common Saga checks, retrieves local source material, calls NVIDIA for narration, validates the proposed ledger delta, and saves the completed turn. Full combat/condition-track automation and the production Supabase identity bridge remain later milestones.
Changing a campaign's database rules flag must not bypass these gates. Test
provider narration is explicitly labeled and cannot create campaign canon.
The PostgreSQL schema in `db/` is historical and unused.

## Verification

```powershell
npm run typecheck
npm test
npm run build
```

Tests cover persistence, timeline isolation, random dice arithmetic, source-based
point buy, offline replay protection, economy ordering, loss pauses, origin
checks, hidden-data projection, and rejection of model state patches.
# Private maps

The **Atlas** tab supports the 13 supplied charts, zoom/scroll, and personal journal references. Import them with `node scripts/import_maps.mjs "path/to/Galactic Maps"`. Originals remain private under ignored `data/maps/`; they are not uploaded or automatically approved as 150 ABY lore. See [MAPS.md](MAPS.md) for limitations and the planned reviewed navigation layer.
