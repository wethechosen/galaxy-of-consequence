# UI reconciliation QA

Validated after moving the improved local Next app into this folder.

- Canonical runtime: `http://127.0.0.1:3100/` via `npm run play`.
- The previous Vite implementation is preserved at the sibling folder
  `galaxy-local-vite-backup-20260922`; it is not part of the active runtime.
- Desktop comparison checked the source reference against the Hangar Bay screen:
  compact header, grouped left datapad navigation, cyan glass panels, orange
  action buttons, and the same empty-panel rhythm are present.
- Responsive check at 390px: navigation opens from the datapad button, all
  content stays within the viewport, and the Hangar Bay request form remains
  usable.
- Functional checks: first-owner setup gate, authenticated session, Marketplace
  request persistence, Hangar Bay request persistence, Bank review request,
  profile persistence, HUD dialog, morality accent preview, and GM review queue.
- Automated verification: 27 tests passed across 13 files; TypeScript check and
  production build passed.

This is still a local solo archive. Review requests do not grant credits, items,
ships, stats, or NPC outcomes, and live AI remains disabled until the campaign
rules and adjudication layer are implemented.
