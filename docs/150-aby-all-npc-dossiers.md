# GOC — Complete 150 ABY NPC Dossiers (GM-Only)

This register implements exactly **54 distinct named characters**, not merely 25 major actors or 47 legacy display rows. It keeps the legacy 200 ABY *editorial* sourcebook cast aligned to **GOC 150 ABY** and follows published Legends history through the Fel reconsolidation in 138 ABY. It does not replace the living galaxy's event ledger.

## Sources of truth

- `lib/npc-canonical-index.ts` — original identities, major factions, established biographies, confidential source provenance and historical status.
- `lib/npc-origin-records-150aby.ts` — **54 individually authored life profiles**, with birth year, world of origin, personal chronology to 150 ABY, physical appearance, temperament, liabilities, relationships and equipment plan.
- `lib/npc-definitive-dossiers-150aby.ts` — builds and independently verifies each character's **complete private Saga Edition prior-career sheet**, including feats, talents, skills, class levels, level/XPs, HP/defenses and native traits through existing `reconstructCoreNpc`, `applySagaFoundation`, `applySagaAdvancement` and `progressionStatus`. Historical/deceased and proposed/unintroduced people have **read-only GM reference builds**, never active saved NPC bodies.
- `lib/seralyth-vhaelor.ts` — authored Scoundrel 1/Jedi 7 sheet and GM-only Hapan Sith secrets; preserved intact rather than replaced by a generic build.
- `app/api/npcs/route.ts` — admin-only, no-store API; 54 `definitiveDossier` records are attached to canonical entries while legacy responses remain unchanged.
- `original/pages/NpcsPage.jsx` — display individual lives, personality, Force training, legal abilities, complete classes/XP/HP/defenses and GM reference equipment. Not a player-facing encyclopedia.

## Roster audit

| Provenance | Distinct identities |
|---|---:|
| Original adapted main cast, including Fel dynasty and Imperial Knights | 25 |
| D'mir story figures other than already-registered Korvalis | 13 |
| Isolated autonomous-simulation characters (not established game encounters) | 9 |
| Seralyth's named Hapan parents | 2 |
| Old sourcebook candidate figures (not already introduced in 150 ABY) | 5 |
| **Total** | **54** |

The protected canon relationships include Korvalis as a Sith Traditionalist opposed to the XIII and IGFED, Seralyth's secret apprenticeship, Maera's exiled Hapan status, Daren's Haruun Kal training, Kelvek's tens-of-billions estate and D'mir's 1.2-billion inherited credit balances across multiple accounts.

## Mechanical guarantees

1. Every record is individually keyed, has a full lifetime to 150 ABY, and has a Saga legal *prior-career* heroic sheet. The historical XP baseline **is not earned gameplay XP** and cannot be copied over a progressed NPC's existing experience.
2. Race, class, feats, talents, powers and languages are validated by the existing deterministic Saga machinery. GOC homebrew species exceptions are labeled as such; they are not presented as published rules. Force abilities are awarded only through valid character-builder choices or Seralyth's separate authored advancement accounting.
3. GM starting loadouts are **designed and documented**, but cannot be mistaken for already owned campaign items or placed in authoritative inventories merely by reading the registry. Likewise, projected combat modifiers do not simulate an attack or certify a weapon modification.
4. D'mir's dead parents and Kelvek are historical-only. Their completed sheets are available to the GM for flashbacks, document analysis or archival scene reconstruction, never ordinary 150 ABY encounters.
5. The sourcebook-only characters have full origin biographies and rule sheets; they remain **unintroduced world actors** until the GM's causal simulation justifies their presence. A dossier does not grant the player omniscient intelligence.
6. Fel dynasty succession after 138 ABY is not invented; the GOC Aliyah Fel is not automatically Empress. Imperial Knights remain a separate Force tradition with obligations to reject a dark-side sovereign.
7. Origin histories are newly authored **GM setting facts**, not claimed preexisting player-observed scenes. No current character state, saved encounter or NPC playthrough is retconned.

## Tests and release gate

- `lib/npc-definitive-dossiers-150aby.test.ts` verifies that all **54** identities have unique origin data and legal numerical Saga profiles, that each has skills, feats, talents, a specific baseline gear kit, and that archival/GM knowledge boundaries are preserved.
- `lib/npc-roster-api.test.ts` asserts that **all 54** dossiers are served only through GM authorization, that the old verified test-turn evidence remains unchanged, and that authorization failures reveal nothing.
- `lib/npc-mechanics.test.ts` retains the earlier 25-core-NPC species-validation safeguards.

**No production save migration, client library exposure or website deployment occurs from this reconciliation branch.** Merge/deploy are separate controlled operations after full build and test verification.
