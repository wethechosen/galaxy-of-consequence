# Sandbox gameplay repair — 6 October 2026

## Authority and runtime

GitHub is the code source of truth. Vercel runs the deployed commit. Supabase is the shared campaign-state source of truth. The local Next.js host mounts the same `original/` React player UI and uses the same authoritative GM resolver and Supabase bridge as production. Browser caches are not authority for credits, inventory, XP, combat, or advancement.

Use the stable production address `https://galaxy-local.vercel.app/player`. Old per-deployment preview URLs are immutable: updating production does not update those URLs. The Custom GPT schema should keep `https://galaxy-local.vercel.app` as its server. Its turn/state interfaces remain compatible with this release; changing its credentials is not required.

## Root causes and changes

- Previous scene prose was fed back to the GM as scene context, reinforcing copied paragraphs. GM context now carries structured scene facts and prior resolved outcomes rather than its own prior description as a writing template.
- Raw keyword matching confused speech, travel, negation, and technical actions. A bounded semantic intent interpreter uses the existing NVIDIA provider; rules and state remain server-owned. The model cannot supply dice, DCs, modifiers, outcomes, or mechanical rewards.
- Routine shopping and public lodging questions triggered unnecessary Persuasion checks. They now remain ordinary NPC dialogue. Discounts, deception, threats, and contested access still require adjudication.
- A quoted purchase could be narrated without its ledger. Priced merchant bundles now persist before acceptance; acceptance commits the exact debit, inventory, receipt, and turn together. Unpriced extras and conditional deals do not become free or automatic purchases.
- “You receive directions” was misread as a money award. Currency validation now distinguishes information from funds. Purchases are debits, not income.
- Invalid ledger repair could silently become an empty update. Invalid repairs now retry the same turn and never erase confirmed consequences. Empty presentation-only state summaries and option lettering are repaired without changing the outcome.
- Cloud timeouts, retry races, and stale revision checks could make committed operations look failed. Durable operation identifiers and request fingerprints cover market trades, advancement, and gameplay. Retries recover the committed result instead of repeating its effects.
- Selected operator campaigns were not consistently scoped across routes. Authorization is checked before reading the selected campaign; ordinary players cannot operate on another account.
- HP was clamped to 100 on every turn and displayed as a percentage. HP is now an absolute Saga resource; healing uses a confirmed maximum. An unrecorded maximum is not replaced with a fabricated 100 HP.
- Advancement foundation, legal class/feat/talent prerequisites, derived stats, earned-XP thresholds, and player-controlled selections were corrected. A missing starting build does not block ordinary gameplay or earned XP.
- Force sensitivity and trained skill use do not imply an earned named Force power. Specific power requirements remain enforced without turning an attempted action into an application error.

## D'mir bookkeeping repair

The user confirmed that 1,500 credits covered both the armored spacer's flight suit and plain tunic. A backed-up, compare-and-swap repair recorded that exact purchase once in D'mir's primary campaign. At repair revision 246: 1,199,997,006 credits, 500 XP, level 1, 26 HP, four carried items. The new garments are carried, not automatically equipped. No other player save was changed and no campaign was reset.

## Verification and boundaries

Automated regression tests cover quoted purchases, slang, negation, contested social actions, invalid ledgers, persistent retries after lost responses, advancement prerequisites, authorization, and HP. Opt-in live-model tests isolate all campaign writes in an in-memory fixture; they do not play D'mir's campaign. Browser/GPT verification uses shared-state reads and campaign navigation.

This is not a claim that every Saga supplement, active talent, Force power, or NPC tactic is implemented. Unsupported options remain explicitly unavailable instead of granting effects. No software can guarantee that an AI provider or network never fails; failed requests must preserve the save and permit safe retry.

## Next player-facing checks

1. Refresh the stable production site, sign in as D'mir, and verify the market location, credits, and four carried items.
2. Use the Dossier's starting-build panel to choose D'mir's existing legal class, starting feats/talent, trained skills, and languages. His six ability scores already exist; do not reroll them or reset the campaign.
3. Continue the merchant/lodging conversation in ordinary language. Suggested A–D approaches are optional; typed declarations remain the actual decision.
4. Compare the resulting turn and HUD on the website and Custom GPT. Read latest state before switching clients or submitting another action.
5. Extend executable combat/talent/Force-power effects with source-backed Saga rules and isolated regression tests.

## Design grounding

The repair follows state-driven RPG play, not phrase-unlock menus: [GDC narrative systems](https://www.gdcvault.com/play/1020434/Narrative), [GDC character-design video](https://www.youtube.com/watch?v=4mgK2hL33Vw), [Torn trade documentation](https://wiki.torn.com/wiki/Trade), [Foundry system data models](https://foundryvtt.com/article/system-data-models/), and [SWTOR choice/consequence design](https://www.swtor.com/blog/introducing-alliance-system). [FFG's Star Wars GM guidance](https://www.fantasyflightgames.com/en/news/2013/7/5/focus-on-the-action/) informs narrative presentation only; its mechanics do not replace Saga Edition.
