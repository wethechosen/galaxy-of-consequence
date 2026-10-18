# Galaxy of Consequence — targeted visual upgrades

## Preservation requirement

**Keep the current Galaxy of Consequence design.** Preserve the screenshot-led datapad, colors, fonts, nav grouping, existing routes, Saga mechanics, controller, saves and gameplay. Do not replace it with a new dashboard, duplicate GM, or unrelated UI theme. This is an incremental upgrade only.

## Track A — Custom GPT: complete player-facing datapad

Expose all supported player-visible modules in ChatGPT:

1. Narrated scene + freeform declarations and optional scene actions
2. Character portrait + read-only HUD: health/vitality, condition, level/XP, Force, defenses
3. Character dossier and known biography
4. Abilities and verified Force progression
5. Inventory, equipment, and inspected item stat blocks
6. Banking, investments, legal ownership, accessible vs inaccessible inheritance assets
7. Galactic navigation and known location information
8. NPC/faction relationships, observed rivalries, evidence and uncertainty
9. Objectives, mission journal and milestone history
10. Living chronology, committed dice rolls, receipts, and event provenance

The Custom GPT reads `/api/gpt/state` or `/api/gpt/hud`; both now expose `interface` presentation metadata. Use actual saved values, not archived example numbers. No client slider or locally editable stats. The existing headshot slot remains empty until the player provides or approves artwork; do not add unsolicited generated portraits.

### Single GM and authoritative state

The player declares actions, including dialogue, choices, intentions, movement, purchases, attacks or Force attempts. The existing controller/GM decides and commits outcome, rolls and consequences; the client renders the returned snapshot after the commit.

GM-controlled: HP, vitality, conditions, levels, XP, credits, accounts, inventory, equipment ownership, Force/Destiny points, dark-side status, combat and world state. Do not create a player-adjustable HUD field even in demos. Any purely visual preference (expand panel, pan map, select tab, hide a balance) must remain presentation-only.

All views must honor player-knowledge boundaries. Undiscovered Sith plots or private NPC plans are never shown in the player's intelligence network merely because internal simulation data exists.

Display current revision, authority source, stale/unsynced status, and no invented transactions. Preserve `turnId` on a failed/retryable turn. No new gameplay action is implied by opening a panel.

## Track B — Website: improve five existing systems only

Keep all current navigation, marketplace, character, scene and social interfaces unchanged. Do not remove functionality that already exists. Constrain **new web visualization efforts** to the five selected systems:

| ID | Existing surface | Targeted enhancement |
|---|---|---|
| 2 | Atlas / Galaxy map | Better known-system exploration, route and location context; navigation effects still GM-authoritative |
| 3 | Contacts / Syndicates | Source-linked, player-known faction/NPC connections and changed relationships, avoiding omniscient spoilers |
| 4 | Bank / financial assets | Separate spendable, bank, physical and legally held assets when confirmed by saved ledger |
| 5 | Inventory / equipment | Headshot + expandable equipment inspection, read-only stat blocks, clear ownership and pending commission status |
| 6 | Archive / chronology | Revisions, receipts, actions, developments, XP and other committed consequences in sequence |

These are incremental improvements to the existing screens, not five new replacement pages. The same NPC state and economy ledger feed both clients.

## Shared interaction rules

- **Presentation controls:** open/close, tab, filter, zoom, pan, select, expand, hide balances.
- **Player actions:** freeform declarations go through the existing controller; never pre-commit consequences.
- **GM actions:** validated engine-authorized writes only, with revision control and game-event receipts.
- **Sensitive world knowledge:** GM-only until learned in-universe.
- **Asset read-only:** the portrait is an illustration. It does not authorize or force appearance changes for any other character.

## Testing

- Preserve all previous snapshots and game saves.
- Verify state GET and HUD GET return consistent interface contracts.
- Verify `GM_ONLY_FIELDS` includes HP/vitality, conditions, XP, credits, and inventory.
- Confirm no player HP/XP sliders are introduced in ChatGPT or website.
- Verify no unapproved generated portrait appears in any interface.
- Ensure existing UI is functional at mobile widths and on desktop.
- Run tests and typecheck before merging any branch. If this cannot be completed, leave changes on a review branch.

## Implemented page-level interactive increment (2026-10-17)

No replacement dashboard was made, no generated image was approved or retained, and the existing portrait slots remain unchanged.

| Existing website page | Interaction now landed | Boundaries and follow-on |
|---|---|---|
| Atlas | Recorded current-position panel beside original zoom/pan, coordinate reference and journal note functionality | Clicking map does **not** travel; a verified graph-backed route planner can be added only when canonical system/route data exists |
| Contacts / Syndicates / Comms | Expand known contact cards; source-limited known intelligence search and known contacts; private goals/memories filtered out | Interactive relationship edges need explicit source-linked faction records, not invented associations |
| Bank / Economy | Read-only spendable funds and holdings summary, transaction search, inflow/outflow filter and explicit contract-decision count | Discrete deposit/physical chip layers require reading the authoritative GPT/hosted asset ledger; do not synthesize from local `CharacterState` |
| Assets / Inventory / Character dossier | Expand carried items and established equipment records within existing inventory panels | Rich item stat blocks and equipment slots require verified inventory/equipment data; no equipping-by-click without a validated GM transaction |
| Saves / Chronology | Timeline records now filtered by type, sorted by committed timestamp, and limited to player-visible events | Event-to-receipt links can be added when revision/turn IDs are available in the persisted event schema |

### Availability and limits

These changes are committed on a feature branch for review, not merged or deployed to production until validated. They are purely client projections of the existing saved data. No added page control changes character statistics, advances story time, makes purchases or exposes internal NPC state.

### GPT separate work track

The existing GPT controller response includes `interface` metadata and a complete read-only panel contract. The actual in-chat UI can render those panels only when ChatGPT is consuming live authenticated GPT state; this repository cannot unilaterally force arbitrary ChatGPT client UI rendering. Players always express game-changing intent through the GM controller; no raw client state writes or sliders.
