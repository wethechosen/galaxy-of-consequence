# NVIDIA ACE integration blueprint

## Goal

Use NVIDIA for NPC cognition, dialogue, memory retrieval, world texture, background simulation, speech, and animation without allowing a language model to bypass the game's rules or corrupt persistent state.

## Authority boundaries

1. **Rules and state authority — application server**
   - Saga Edition dice, defenses, skills, damage, condition track, Force/Destiny/Dark Side points.
   - Credits, inventory, purchases, sales, travel fares, access gates, levels, permissions, and authentication.
   - The campaign ledger and event log are the only canonical truth.
   - AI may propose typed commands; the server validates and commits them.
2. **Primary GM reasoning — provider-neutral GM service**
   - Frames scenes, chooses stakes, requests deterministic checks, reconciles consequences, and decides what information is visible.
   - The current test provider can be NVIDIA. A future OpenAI provider can occupy this role without changing game rules or saved data.
3. **NVIDIA world and NPC services**
   - NPC intent, voice, dialogue variants, rumors, sensory detail, news drafts, faction planning, and background world events.
   - RAG retrieves approved lore and campaign memories; it does not overwrite current truth.

## NVIDIA components to use

### Hosted Nemotron NIM — immediate test path

The existing Next.js server calls NVIDIA's OpenAI-compatible endpoint. Use it for the playable GM loop now. Keep the key server-side, pin the model through `NVIDIA_MODEL`, expose a health check, and preserve the deterministic state patch validator.

Current tested model: `nvidia/nemotron-3-super-120b-a12b`.

### Game Agent SDK v0.5 — local NPC sidecar

The downloaded SDK is a Windows-native C99/C++ library, not a browser package. Its minimum supported machine is Windows 10/11 with an Ampere-or-newer NVIDIA GPU, driver 570.65+, CUDA 12.8+, and enough VRAM (the bundled Qwen3.5 4B model uses about 3.8 GB).

Use it behind a local sidecar boundary:

- **Agent API:** stateful named NPC sessions, tool-call loops, rolling history, cancellation, serialized conversations, and one-shot/transient context.
- **Chat API:** stateless flavor variants, rumor phrasing, item descriptions, and disposable background dialogue.
- **RAG API:** small local NPC memories and approved lore collections using semantic, lexical, or hybrid retrieval.
- **Multi-agent:** multiple NPC identities can share one model, but inference on a shared model must be serialized because one model is not thread-safe for concurrent inference.

Do not link the native SDK into the Next.js client. Build a small local Windows service that exposes a narrow HTTP or named-pipe API and keeps the SDK DLLs/models outside the web bundle.

### NVIDIA RAG Blueprint — campaign knowledge service

Use for larger lore and campaign archives:

- separate collections for licensed rules references, public setting lore, GM-only canon, campaign events, NPC memories, locations, factions, and market/news history;
- hybrid retrieval plus reranking for names, rules terms, and natural-language questions;
- metadata filters for date, visibility, source, location, faction, NPC, spoiler level, and canon status;
- query rewriting for multi-turn play and agentic RAG only for complex research or planning turns;
- citations in GM/admin inspection views, never as in-character narration.

The full blueprint normally needs Docker/Compose or Kubernetes and is not currently deployable on this machine because Docker is not installed. The smaller Game Agent SDK RAG database is the practical local-first option.

### Optional immersion layer

- Nemotron ASR for player speech.
- TTS for NPC voices.
- Audio2Face-3D for lip sync and Audio2Emotion for expression when 3D characters are added.
- NeMo Guardrails or equivalent output validation for character boundaries, hidden knowledge, safety, and tool permissions.

## One playable turn

1. Player submits an action.
2. Server loads the canonical scene snapshot and relevant character sheet.
3. GM planner decides whether the action is automatic or uncertain.
4. If uncertain, the planner requests a typed Saga check. The deterministic dice service rolls and returns the public result plus private adjudication data.
5. RAG retrieves only collections and visibility levels allowed for this scene.
6. NVIDIA produces NPC intent, dialogue, and scene flavor from the validated facts and result.
7. GM synthesis proposes narration plus typed state commands.
8. Server validates every command against rules, permissions, balances, inventory, travel gates, and version numbers.
9. A single transaction commits the event and state changes; then public news/background simulation jobs may be queued.

If any AI call fails, no state mutation is committed. The player can retry the same turn idempotently.

## NPC tiers

- **Ambient:** stateless Chat call; no private memory; expires after the scene.
- **Recurring:** Agent session plus a compact per-NPC memory collection.
- **Major:** persistent Agent session, goals, relationships, schedule, faction tools, and GM-only memories.
- **Faction/world:** scheduled planners that emit proposed events; the deterministic simulation service validates them before publication.

Promote NPCs when the player forms a relationship or when the NPC gains campaign importance. Do not spend persistent-agent resources on every bystander.

## Data model additions

- `ai_agents`: provider, model, persona version, tier, status.
- `npc_memories`: npc id, event id, summary, visibility, salience, embedding reference.
- `world_events`: proposed/validated/published states, effective time, affected entities.
- `ai_jobs`: idempotency key, purpose, input state version, output, validation status, latency/error.
- `knowledge_sources`: rights/provenance, collection, visibility, checksum, indexed version.

## Deployment order

1. Fix and monitor hosted NVIDIA inference; finish the complete text gameplay loop.
2. Add typed AI tools and transactional command validation.
3. Add local knowledge ingestion and retrieval with source/visibility metadata.
4. Prototype one recurring NPC through the native Game Agent sidecar.
5. Add background faction simulation with a queue and approval/validation stage.
6. Add speech and facial animation only after text gameplay, saves, and recovery are reliable.

## Non-negotiable safeguards

- Never send API keys to the browser or commit them.
- Never let generated prose directly edit the database.
- Never expose GM-only or copyrighted source material in player responses.
- Index only material the project is allowed to process; store provenance and access level.
- Version prompts, models, knowledge indexes, and state schemas so saves remain reproducible.
- Log model/provider failures without logging secrets or full private source text.
