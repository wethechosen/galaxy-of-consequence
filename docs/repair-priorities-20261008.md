# Repair priorities and release gate

## Authority and user story

GitHub holds the code. Supabase holds the revisioned campaign. Vercel and the local app run that code; the browser and Custom GPT submit declared actions to the same GM resolver. Neither client may invent a successful payment, item, roll, reward, or scene transition.

Player prose → semantic action plan → Saga adjudication when needed → concrete world/NPC response → validated consequences → one revisioned save → narration/HUD. Ordinary competent actions and public commerce do not need arbitrary checks. Suggestions are optional, scene-specific directions, not the only accepted input.

## Broken: repair before extending

| Priority | Reproduced failure | Repair and evidence required |
| --- | --- | --- |
| P0 | An NPC quotes terms, but the next payment has no persisted offer. | Persist complete quotes, including written prices, bundled costs and optional extras. Recover omitted legacy terms only from the latest confirmed reply at the saved location. Test quote → natural-language acceptance → exact debit/access/receipt → replay. |
| P0 | Ordinary lease authorization requires an unrelated successful roll. | Accept an unambiguous saved offer without a roll; atomically record rent, landlord-held deposit, tenancy and credentials. Never grant property ownership. |
| P0 | Invalid AI drafts become canned successful turns and advance time. | Repair serialization of the same draft, or leave the campaign untouched. Retain genuinely server-resolved receipts; do not fabricate outcomes on a provider outage. |
| P0 | Payment retries or lost cloud responses can double charge. | Stable operation IDs, exact request fingerprints, cloud reload/replay and compare-and-swap revision checks. Test a committed write with a lost response. |
| P1 | Scenery stays a combatant after leaving; mundane actions become attacks/Force use. | Encounter lifecycle and semantic intent regression tests, including negation and concrete withdrawal. |
| P1 | Prose and HUD disagree about location, rewards or purchased items. | Validate the actual outcome against server mechanics and committed delta; no narration-only acquisition or movement. |
| P1 | Dead replies obscure the last real scene; scrolling fails on short screens. | Display-only transcript archive, latest confirmed exchange, return recap and independent page/transcript scroll. Preserve original history and campaign state. |

## Existing requests completed alongside repairs

- Bank deposit/withdrawal uses existing galactic credits only, saves both balances, and retains transaction receipts.
- Contextual marketplace separates retail from securities exchanges and varies by saved world/district, merchant, luxury/illicit context and access. Goods, homes and vehicles persist without automatically equipping, relocating or driving.
- Return recap reads confirmed events, known milestones, current location and established public news. It neither advances offline time nor invents galaxy events.
- The GPT state reader uses the same confirmed-history projection, not the latest failed reply, and includes saved merchant offers, assets and bank balances.
- Advancement supports a bounded core catalog and player-selected choices. Unsupported prestige/supplement options and metadata-dependent choices are explicitly unavailable, not silently implemented.

## Still to build, after repair gate

Expanded Saga powers, prestige classes and supplement talents; comprehensive specialized combat actions, vehicles and starships; richer persistent merchant/world generation; deep memory/RAG evaluation; autonomous NPCs and living-galaxy simulation. These are feature gaps, not reasons to block ordinary current gameplay.

## Verification baseline

2026-10-08: 387 automated tests passed before the additional two GPT-read regressions; final totals are recorded in the release verification section. All four isolated actual-NVIDIA sandbox tests passed: lodging dialogue/bundle purchase, established-route travel, full-month quote persistence, and legacy lease recovery with exact one-time payment. TypeScript passed. Tests never spend D'mir's live credits or mutate his campaign.

Live read-only baseline: revision 314, Level 512 transit spine, 26 HP, 1,050 XP, 1,199,996,506 credits; no saved trade offer or property. The historical failed lease remains unpaid. A repair release must preserve this save; do not use a live purchase as a smoke test.

Release gate: successful final build → stage production without assigning the stable domain → check controller/schema and access controls → promote that exact build → verify authenticated stable website and Supabase revision agreement → restart local app and verify loading. Report unverified boundaries explicitly; a ping is not proof of complete gameplay.

## Release verification — 2026-10-08

- Application commit: `4320e8f`, pushed to the working branch and fast-forwarded to GitHub `main`. Final production deployment: `dpl_GM4AQmxCKRVAvHhEBVjSGCp6WdRM`; staged, checked, then promoted to `https://galaxy-local.vercel.app`. Controller/schema version: `2.0.9`, eight operations. Older deployment-specific URLs remain immutable and should not be used to check current repairs.
- Final suite: **391 passed, 6 skipped**, 62 passing test files and two skipped files. The four actual-NVIDIA isolated sandbox tests passed separately. Final TypeScript and production build passed. No live purchase, checkpoint load, reconciliation or gameplay turn was used as a test.
- Authenticated stable and restarted local app both returned revision **314**, 26 HP, 1,050 XP, 1,199,996,506 credits, four inventory entries and the saved Level 512 transit-spine location. The lease is still unpaid. Existing authentication credentials and campaign data were preserved.
- Authenticated player UI rendered the last confirmed exchange, archive and return recap; old docking-bay prose is labeled recorded history rather than current positioning. Transcript PageDown changed scrollTop from 0 to 236.8 pixels on a 271-pixel-high pane. Browser error log was empty. Bank controls and contextual marketplace categories rendered without making a transfer or purchase.
- Actual private GOC GPT editor imported the stable version 2.0.9 schema. Its campaign-state and HUD action tests both succeeded at revision 314. Updated free-form play, exact-location, presentation and same-turn retry instructions were published; the editor confirmed **GPT Updated / Invite-only**, last edited October 8. No credentials or sharing scope changed. Browser control detached during a further post-publication state check, so that additional check was not completed; the published configuration and prior successful authenticated reads were visibly verified.
- Final-deployment HTTP 5xx log query returned no entries during the verification window. Node 22's experimental SQLite notice still appears on stderr and is labeled an error log by Vercel, even on HTTP 200 reads; it is a runtime warning, not a failed request. The earlier Node engine-range and tesseract install-script warnings were eliminated.

## Player configuration still required

D'mir's legacy dossier has no structured level-1 class/talent build. The player must establish those legal starting choices before selecting earned level-2 advancement. The interface exposes the required choices and available core talent trees; the engine must not pick them on the player's behalf. Existing XP, level and inventory are not reset by this repair.

No claim is made that every Saga supplement or arbitrary future AI response has been implemented or exhaustively verified. The repair gate covers the reproduced common-play failures above. Expanded rule catalogs, specialized vehicle/starship combat, deeper memory and autonomous-world systems remain deferred.
