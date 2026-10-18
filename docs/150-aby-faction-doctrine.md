# GALAXY OF CONSEQUENCE — 150 ABY faction powers and institutions

**GM-private design doctrine.** The galaxy is not a collection of quests about D'mir.
Organizations represent independent agents with persistent structures, internal
contradictions, interests, jurisdictions and resource limitations. Their players
are not the ordinary players of this campaign.

## Continuity

- Star Wars **Legends** establishes the Galactic Federation Triumvirate's
  138 ABY coalition of the Fel Empire, Galactic Alliance Remnant and New Jedi
  Order, associated with historical founders Marasiah Fel, Gar Stazi and
  K'Kruhk. **No 150 ABY officeholder is made sovereign by an obsolete
  sourcebook's projected 200 ABY biography.**
- Imperial Knights remain a **distinct Force order**, serving the Fel sovereign
  with a doctrinal duty against falling to the dark side. Jaed Sultar is a
  commander/instructor, not an automatically appointed Supreme Commander;
  Aliyah Fel is a Force-trained dynast, not an automatically reigning Empress.
- The Hapes Consortium's Queen Mother institutions, navy, and Djo/Dathomiri
  Force ancestry remain historically grounded. The current Queen Mother is
  unconfirmed; **Airi Djo is a negotiator, not automatically Queen Mother**.
  Maera's royal exile and the Vhaelor household's hidden patronage are GM
  confidential, not general player information.
- **XIII**, **IGFED** and their covert connection are GOC homebrew, not
  historical Disney-canon or published Legacy factual assertions. Korvalis
  rejects the XIII's legitimacy and their financial influence. He is not
  their member or the single designated main antagonist.
- Old **200 ABY** GOC design drafts are **150 ABY**, with rank and history
  reconciled against actual world events instead of assumed future promotions.

## Jedi restoration correction (Legends 138–139 ABY)

The New Jedi Order is **an independent founding power**, not a subordinate
Fel or Triumvirate department and not a handful of unrecognized fugitives.
Its Coruscant Temple was reclaimed in 138 ABY. K'Kruhk represented the Jedi
in the founding Triumvirate, but neither his 150 ABY office nor a current
Grand Master or High Council roster is presumed. The 139 ABY Mala crisis
did not establish that no Sith survived. T'ra Saa and Wolf Sazen died in
138 ABY and are historical-only; old 200 ABY Jedi leadership profiles are
not automatically present-day promotions. The Imperial Knights' light-side
loyalty reform was **announced** after Mala; its full administrative
implementation remains an open GOC chronological question.

See `docs/150-aby-jedi-restoration.md` and `lib/jedi-order-150aby.ts`
for source chronology, seven offices, four Jedi sites, six missions,
historical personnel, four existing GOC Jedi, and strict GM/player
information separation.

## Twenty-seven institutions

**Postwar settlement / Fel:** Galactic Federation Triumvirate; Galactic
Alliance civic tradition; Fel Empire; Imperial Knights; Imperial Navy; Moff
and sector administration; New Jedi Order.

**Trade / finance / law:** Corporate Sector Authority; Espo security; IGFED;
independent freetrader routes; neutral relief and public archives.

**Hapes / frontier:** Hapes Consortium; Hapan royal houses; Hapan Royal Navy;
Mandalorian clans; Chiss frontier.

**Force competitors:** XIII Sith Houses; House Murkhana; Korvalis's Sith
Traditionalists; independent Sith claimants.

**Criminal organizations:** Black Sun; Hutt kajidics; Tenloss; Bounty Hunters'
Guild; Red Key Raiders; Exchange legacy rackets.

## Authorized resources

Each faction's `strengths` fields are **ordinal bands (1–5)** for political,
economic, military, intelligence, and logistics planning capability. These
are NOT balances, owned corporations, fuel, personnel counts, Force modifiers,
or authorization to seize a player's property.

`relations` describe institutional stance, not enforceable treaties.
`presence` is influence or operational reach, not an atlas polygon of
exclusive jurisdiction. `member` means occupational/cultural association
unless the authoritative story ledger establishes employment, knighthood or
membership. Historical NPCs remain **historical**, sourcebook-only candidates
remain **unintroduced**. Hidden affiliations are never public news by default.

## GM autonomy on the authoritative clock

`lib/faction-strategy-150aby.ts` projects one strategically plausible
**unadjudicated** faction initiative per seven-day controlled galactic-time
window. More important factions have distinct alternate agendas across
windows. Nothing in this read-only system writes to a save, records a war,
awards XP, moves credits or skips time. Faction proposals only enter the
private GM drafting context when the player's topic/confirmed scene actually
calls for faction knowledge. The GM adjudicates material consequences through
the existing Saga and committed event machinery. A private plan never becomes
player knowledge merely because it appears on a GM screen.

This is a **strategic intent foundation**, not a second economy solver,
unbounded real-time model simulation, or evidence that fleet movement and
economic transfers are fully automated between player turns.

## Boundaries and interfaces

- `lib/faction-canon-150aby.ts`: 27 group profiles, exact parent/child
  structure, ordinary/public affiliations covering **54** known NPCs,
  relationship records and two additional **GM-only cross-links**.
- `lib/faction-strategy-150aby.ts`: deterministic agendas and topic-scoped
  GM context from committed game time; no new persistence channel.
- `app/api/factions/route.ts`: only public history and institutional
  information. **No hidden factions, secrets, private agendas or personnel**.
- `app/api/factions/private/route.ts`: account-verified **GM-only** directory.
- `original/pages/FactionsPage.jsx`: new /factions atlas, preserving the
  existing dark Galaxy datapad visual language and the separate /syndicates
  commerce/underworld page.
- `lib/gm.ts`: integrates faction context only for on-topic turns; all
  results still pass the existing authoritative Saga/gameplay ledger.

## Required regression boundaries

1. Every group and relation resolves to a real group; all 54 unique known
   NPC identities have an association or explicit independent status.
2. Public views cannot disclose XIII, Korvalis/Seralyth associations,
   Kelvek's fortune or confidential Hapan familial history.
3. The GM's ordinary tailor appointment scene does not trigger XIII or
   Black Sun plots.
4. Weekly agendas are reproducible and explicitly **unadjudicated**.
5. No current-saved NPC assets, credits, skills, relation, location, time,
   injuries, equipment, titles or faction control is migrated or changed.

Review future faction-level balance sheets, armies, intercompany loans and
offscreen material world-state mutations only after those systems have
verified owned assets, source-linked political authority, cost/budget ledgers,
route transit, intelligence delay and failure conditions.
