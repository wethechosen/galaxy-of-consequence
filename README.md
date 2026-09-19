# Galaxy of Consequence

A solo, lore-governed web GM for a 200 ABY, Legends-first Star Wars Saga Edition campaign.

> Current implementation update: Node.js 22.16+ is required for built-in SQLite.
> Campaigns and full checkpoint snapshots now persist in `data/campaign.sqlite`;
> restore is not implemented yet. `CAMPAIGN_DB_PATH` overrides the local path.
> Gameplay is blocked in both server and UI until rules are verified. Do not
> unlock the existing provisional keyword checks. The agreed target is 150 ABY
> with OpenAI as GM and Nemotron for flavor; the old sample scene is not migrated.
> Run on localhost only: `npm run dev -- --hostname 127.0.0.1`.
> The PostgreSQL production checklist below is historical, not the current local
> persistence plan. Source indexing, OpenAI integration and character creation
> remain unimplemented. Back up the data directory with the app stopped.

## Run locally

1. Install Node.js 22.16+.
2. Copy `.env.example` to `.env.local`.
3. Add `NVIDIA_API_KEY` only to `.env.local`; never use a `NEXT_PUBLIC_` prefix.
4. Run `npm install`, then `npm run dev`.

The application works without an NVIDIA key using a deliberately limited lore-safe fallback narrator. With a key, `/api/gm` calls NVIDIA from the server only. It never sends the key to the browser and it disables visible reasoning output.

## Rules and source safeguards

- `Saga Edition Core Rulebook.pdf` is the mechanical authority. It is currently a scanned PDF and must be OCR-indexed with page citations before rule-specific checks are marked verified.
- The app begins with a `provisional_until_saga_core_is_indexed` lock. This prevents the UI and GM route from claiming its temporary action checks are official Saga rules.
- Legends/EU controls the Legacy Era; Canon may fill compatible gaps. Campaign adaptations are labelled and may not overwrite historical lore.
- Do not upload or distribute sourcebook text through the public app. Keep any source index private to the rights holder's account.

## Production checklist

1. Provision a private PostgreSQL database and apply [`db/schema.sql`](db/schema.sql).
2. Add a real authentication provider and enforce the authenticated campaign owner in every route before public deployment.
3. For any future hosted version, migrate the local SQLite adapter to authenticated database access.
4. OCR the authorized Saga Core Rulebook locally, review each imported page, and create verified citations for mechanics before changing `rulesStatus` to `verified`.
5. Configure `NVIDIA_API_KEY` in the host's secret manager, not in repository files.

## Verification

Run `npm run typecheck`, `npm test`, and `npm run build`. The rules tests exercise server-side d20 ranges, arithmetic, intent detection, and the lore classification guard.
