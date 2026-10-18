# Galaxy of Consequence — 150 ABY canonical NPC reconciliation

## Source priority and period

The player and GM operate in **150 ABY**. Older sourcebooks with a **200 ABY** label
are *design-source material for this same campaign*, not evidence that their
characters already reached later promotions, won battles or acquired estates.
Original GOC characters are distinct from published Star Wars Legends characters.

Published Legends history is binding through the post-Second Imperial Civil War
settlement in **138 ABY**, including the restored Fel dynasty and the creation
of the Galactic Federation Triumvirate. The **Imperial Knights** are an established
Force order loyal to the Fel sovereign but must intervene against dark-side
corruption of the sovereign. The Knights are neither generic Jedi nor Sith.
Marasiah Fel's accession after Roan Fel is historical. Subsequent succession,
including any accession of the homebrew **Aliyah Fel**, requires explicit
committed GOC historical events; do not automatically grant her the crown.

From 138 to 150 ABY, prefer committed GOC world-state records over editorial
future speculation. No presumed death, promotion, Sith prestige level, marriage,
bank transfer, apprenticeship, or secret discovery may be fabricated to make
the legacy sourcebooks' projected history happen.

## Single identity registry

- Source: [`lib/npc-canonical-index.ts`](../lib/npc-canonical-index.ts).
- **54 unique named records**: 25 adapted core cast, 13 additional personal-story
  identities (with Korvalis merged into the core, not duplicated), 9 independent
  NPC simulation identities, 2 previously documented Hapan parents, and 5
  sourcebook-only proposals.
- `GOC_NPC_INDEX_BY_ID` is the canonical identity key; an alias in a story or
  testing module never creates another living body.
- `sourceClass` states why a character belongs to the registry.
  `worldState` distinguishes active candidates, historical-only records and
  unintroduced sourcebook proposals.
- NPC identities, biographies, private motives, memory and secrets are GM-only;
  *an index entry is not a verified meeting, location, inventory gain or player
  knowledge*.
- A historical NPC may appear in a flashback, authenticated recording, or
  witnessed evidence. A deceased character must never be spawned in present day.

## Core factions and existing exemplars

| Faction | Existing named participants | Simulation boundary |
| --- | --- | --- |
| **Fel dynasty / Imperial Knights / Imperial Navy** | Aliyah Fel, Jaed Sultar, Rena Salvek, Calen Vardex, Loresh Kallun | Fel succession, Emperor/Empress, Moff Council, Knight duties, Navy and economy persist independently of D'mir. |
| New Jedi Order | Akkan Vuu, Tarvyn Dree, Kala Morrin, Shado Liang | Jedi affiliations do not automatically confer identical techniques or attitudes. |
| House Murkhana | Nir Varek, Darth Xeran, Vesla Kreel | Sith claims, finance and relic hunts must be causally supported. |
| **Independent Sith Traditionalists** | Darth Korvalis, Alar Mar'Isk | Korvalis rejects the XIII and numerous self-styled claimants; he is not a XIII member or central scripted villain. Alar's confidence and obligations may diverge. |
| **XIII / IGFED** | Merek Tan, other covert agents by justified discovery | The XIII's secretly influential position is a GM-only setting fact, not general public or NPC knowledge. |
| Corporate Sector Authority | Tavia Kuat-Ardos, Keelo Greel, Ardis Nefar, Drell One | CSA corporate government, security and transport act for their own ends. |
| **Hapes Consortium** | Airi Djo, Sia'thra Velle, Seralyth Vhaelor, Lady Tazielle Vhaelor, Lord-Commander Rethan Vhaelor, Selis Vara | Hapan political influence and the Dathomiri/Jedi heritage of the royal line coexist; unrelated characters need not be blood relatives. |
| Mandalorian clans | Kor Vess | Clan politics independent of other plots. |
| Criminal and frontier networks | Ko'ra Veil, Vask Mora, Nerin Voss, Kara Murson, Ch'hal Vidar and other free traders | Trade, criminal activity, law, displacement and exploration can evolve without a PC. |

Other named civilian, academic and technical characters remain independently
situated in the registry rather than classified as quest-givers.

### Fel historical anchors

- **Jagged Fel** founded the Fel dynastic Empire.
- **Roan Fel** died before the 150 ABY starting world state.
- **Marasiah Fel** succeeded Roan following the 138 ABY conflict.
- **Aliyah Fel** is a GOC original, Force-trained dynast. Her current
  succession and title cannot be assumed from a 200 ABY editorial profile.
- **Jaed Sultar** is an established veteran Imperial Knight commander, not
  automatically an already appointed Supreme Commander.
- **Rena Salvek** is an Imperial Knight trainee whose powers require a
  legal Force-capable Saga build.

## D'mir, Kelvek, Hapes and Korvalis: confirmed private history

D'mir was ten when he killed three Black Sun operatives and was imprisoned.
His Hapan mother is **Maera Holloràn**, a member of important Hapan royalty
who went into exile for leaving with the Haruun Kal smuggler **Daren Holloràn**.
Both were accomplished smugglers; both are dead. Private court relatives and
precise succession implications require discoverable evidence.

**Kelvek** was a *staff librarian*, not an inmate. He was worth tens of
billions of credits. D'mir inherited approximately 1.2 billion credits,
currently split across an approximately 628 million spendable balance,
571.1 million deposited balance, and physical/underworld chips, with the
actual saved campaign ledger having precedence over this summary.
Kelvek's datapad gives access to further financial infrastructure, not
automatic legal title to all of Kelvek's remaining assets.

**Darth Korvalis** targeted Kelvek for money, not personal friendship or
Sith collaboration. He secretly trained **Seralyth Vhaelor** since birth,
and his own ideology opposes the XIII's covert economic domination through
IGFED. He is *one autonomous participant*, not the designated final boss.
D'mir's future meeting, apprenticeship, hostility or trust is not guaranteed.

Seralyth is sixteen and has her own ambitions; her canonical documented
parents are **Lady Tazielle Vhaelor** and **Lord-Commander Rethan Vhaelor**.
She and D'mir have not met. Her separate [Saga character sheet](../lib/seralyth-vhaelor.ts)
must not be replaced by an improvised alternate build. The exact terms of any
Queen Mother/royal-court bargain with Korvalis remain GM-private and unsettled,
not player facts.

## Mechanical authority and XP handling

1. `npcMechanics()` produces a full numeric sheet only after
   `applySagaFoundation`, `applySagaAdvancement` and progression checks.
   This is the authoritative source for mechanical level, earned/professional
   XP accounting, legal feats and talents, equipment eligibility, maximum
   HP, defenses, skill modifiers and known Force powers.
2. `NPC_HISTORICAL_TIERS` and other explicit index levels are **historical
   starting-career design targets**, not adventuring XP awarded in D'mir's
   current or past gameplay. XP thresholds use `experienceForLevel()`.
   The game records origin XP separately from later earned XP.
3. The alien story-ratings catalogue and the new index give **editorial**
   ability-score and talent/Force directions. Proposed scores and powers
   are not mechanically valid merely because they are printed in a dossier.
   **Species not implemented or rules-validated must remain pending**.
4. The Saga species builder recognizes Human, Bothan, Duros, Rodian,
   Sullustan, Twi'lek and Zabrak alongside Core Aqualish/Ithorian and
   supplement-derived Chiss, Falleen, Nikto, Togruta, Weequay and Zeltron.
   Mirialan, Kiffar and Muun adaptations are **explicitly labeled GOC homebrew**;
   their abilities must never be misrepresented as verified official Saga traits.
   Native languages and eligible racial bonus feats/skills are now validated.
   Chiss-raised Kiffar means Kiffar ancestry, **not stacked Kiffar and Chiss** traits.
   Additional rare species remain gated until their exact source mechanics are entered.
5. **Seralyth** has an authored eighth-level Saga character sheet with an
   explicit class history, ability scores, attacks, defenses, Force powers
   and talents. It is separately labeled authored, not falsely certified by
   a re-constructed generic NPC career.
6. Present characters' accrued damage, relationships, inventory, earned XP,
   abilities and advancement choices are **never replaced** by defaults from
   this directory. `recordNpcMechanics` only seeds a valid absent profile.
7. Unborn, deceased, unknown-species or sourcebook-proposed people cannot
   receive invented combat powers to fill a table. The proper marker is
   `unresolved` until a specific legal build is approved and tested.
8. The registry records **biography, objective, faction, status, GM secrets,
   design level/XP, proposed attributes and Force direction** for the full
   population; only the subset with confirmed or authored Saga sheets has
   complete runtime talents, feats and defenses. This difference is explicit
   in the GM dossier and API.

## Verification

- Canonical population and duplicate identity tests:
  `lib/npc-canonical-index.test.ts`.
- Private GM API, scenes and original audit-record preservation:
  `lib/npc-roster-api.test.ts`.
- Existing Saga career validator and unsupported species protections:
  `lib/npc-mechanics.test.ts` and progression tests.
- Full project validation expected before merge:
  `npm test`, `npm run typecheck`, `npm run build`.
- Live NVIDIA NPC playthrough and deployed database checks are separate
  validations; source-code commits alone do not prove the simulation has
  advanced or updated hosted save-state records.

## Species foundation bottleneck (2026-10-17 resolution)

- Root cause: nonhuman automatic languages were missing from `SAGA_LANGUAGE_OPTIONS`;
  some generated bonus-language choices reused the character's native language.
- Registered and source-labeled the needed species and automatic languages;
  corrected Kiffar/Chiss cultural ancestry normalization, racial feat grants and
  extra trained skills. Unsupported/homebrew trait names do not grant unearned powers.
- **All 25 members of `CAMPAIGN_NPCS_150_ABY` now produce mechanically validated
  starting-career sheets in memory** through `npcMechanics()` and the actual
  Saga foundation/advancement validator. `lib/npc-mechanics.test.ts` requires
  complete build construction and explicit racial source provenance for each.
- This does **not** certify undocumented equipment inventories, advanced special
  racial actions not implemented as server-owned roll handlers, or live NPC save
  migrations. Existing lower-level NPC simulation test saves are not promoted
  by rendering the roster. Deceased Kelvek is blocked from living NPC spawning.
