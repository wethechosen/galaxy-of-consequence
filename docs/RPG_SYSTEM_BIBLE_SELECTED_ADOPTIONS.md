# RPG System Bible v3.2 — selective integration into Galaxy of Consequence

**Source:** user-supplied *RPG SYSTEM BIBLE: AI Game Master Edition v3.2 with NVIDIA ACE / Nemotron Integration*, 40-page parsed version (some repeated later sections). This is **creative direction and world-simulation guidance**, not a replacement rulebook or a new architecture. Applied to the canonical existing 150 ABY Saga Edition campaign and shared `goc-gameplay-v1` web/GPT result.

## Adopted, without duplicating existing subsystems

| Source section | Selected improvement | Implemented |
| --- | --- | --- |
| Core philosophy / modes | Maintain in-universe default while separating explicit GM discussion and technical troubleshooting. Never impersonate gameplay during a provider outage. | GPT instructions |
| NPC and faction simulation | Weight ambient, contact, recurring, and faction-leader responses by established importance. Treat rumors, awareness, goals, resources and jurisdiction as prerequisites for reactions. | Compact `LIVING_GALAXY_DIRECTIVES` in existing GM prompt |
| Force Resonance Engine | Atmosphere, mystery and visions can add tension, but they cannot serve as proof or award unearned Saga powers or alignment changes. | Same GM directive; GPT instruction |
| Dynamic difficulty/resistance | Factions can escalate in proportion to confirmed knowledge and available capacity; no arbitrary hostility or narrative dead ends. | Same GM directive |
| CSA economics | Use economic power, contract friction, currencies and enforcement as **possible** sources of stakes. Confirm actual prices, holdings, legal regime, and transfers through existing sources and ledger. | Same GM directive |
| Module interpreter | Acts, flags and objectives from uploaded books are non-binding *potential* leads until established in play. No forced quests or instant rewards. | Same GM directive |
| Datapad HUD / persistence | Retain the already-implemented authoritative HUD, save, named NPC memory, turn commitments and continuity. | No duplicate implementation |

## Existing implementations intentionally retained

- `lib/gm.ts`: single GM director, Saga adjudication, state ledger, continuity checker, NPC/world specialists, actor agency.
- `lib/npc-offscreen-intelligence.ts`, `lib/npc-rival-intelligence.ts`: witnessed style memories, evidence-gated reports, independent plans and GM adjudication.
- `docs/NVIDIA_ACE_ARCHITECTURE.md`: already defines ambient/recurring/major/faction-agent tiers; these are **behavioral guidance**, not a new required field on every existing NPC.
- `lib/saga-force.ts`: real Saga Force power prerequisites/checks; no new mechanic or D20-to-percentile conversion.
- `lib/gameplay-contract.ts`, `app/api/gm/route.ts`, `app/api/gpt/turn/route.ts`: one saved campaign and equivalent gameplay output. The new guidance is shared because the canonical GM prompt is shared.

## Rejected or deferred because of conflicts or lack of evidence

1. The PDF's **1–100** success/failure table: conflicts with the server's authoritative Saga Edition D20 checks. Do not use it even as a shadow roll.
2. The PDF's **Supabase Canvas** memory/save instruction: obsolete; Neon is authoritative. No save migration and no duplicated simulation engine.
3. The PDF's blend of **FFG and West End D6** mechanics: lore references only unless explicitly reviewed and converted; no automatic numerical conversion.
4. Its CSA financial descriptions (including voucher practices, particular exchanges and speculative Imperial/First Order claims) are **setting claims, not present-day 150 ABY proof**. Do not invent confirmed current market prices, legal rules, corporate rulers or exchange rates.
5. Automatic image rendering at *every* scene/planet and full AI voice/audio simulation: not within this selective GM/GPT logic change. Never pretend the model produced an image.
6. Universal permanent memory for spawned NPCs or continuous idle world simulation: existing memory and time-based scheduling are evidence-gated. No speculative offscreen results or extra compute obligations.
7. RPG Bible's possible "hide all rolls" in-character: overrides neither explicit player requests for Saga checks nor the game's current verified check/receipt display.

## Behavioral acceptance checks

- A routine shop conversation does not spontaneously trigger galaxy-wide bounty escalation, a Force event, or new NPC agents.
- A rival who **witnessed** a specific tactic may adapt through existing memory; an uninformed rival cannot.
- A high-heat character may face faction opposition only where credible information, access and resources allow it.
- A Force vision can be narrated without changing Force Points, Dark Side Score, learned powers or unlocking secret history.
- A CSA investment idea creates a plausible offer or investigation, not an owned security or automatic credit conversion.
- Module references can produce actionable leads without claiming they are completed or forcing the next player choice.
- A 429 leaves the exact action pending and does not invoke in-universe dialogue or a fictional state change.

## Change scope and verification

Only compact canonical-GM guidance, Custom GPT presentation/role instructions and tests/documentation change. NPC save schema, money/XP rules, inventory, provider credentials, living campaign state, stored histories and GPT Action schema are untouched. Use targeted prompt tests, full regression, TypeScript verification and production build before merge.
