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

The Custom GPT reads `/api/gpt/state` or `/api/gpt/hud`; both now expose `interface` presentation metadata. Use actual saved values, not archived example numbers. No client slider or locally editable stats. The hero portrait is a presentation-only illustration at `/images/dmir-headshot.svg` for D'mir. It does not rewrite existing character canon or provide new abilities.

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
- Verify the website portrait only appears for D'mir; other characters keep existing appearance.
- Ensure existing UI is functional at mobile widths and on desktop.
- Run tests and typecheck before merging any branch. If this cannot be completed, leave changes on a review branch.
