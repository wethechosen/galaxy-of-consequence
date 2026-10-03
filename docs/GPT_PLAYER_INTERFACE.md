# Galaxy of Consequence — GPT Player Interface

This document defines the authoritative interaction pattern for the Custom GPT action interface.

## Core Principle

**The server is authoritative.** All gameplay facts (location, inventory, credits, XP, level, Force abilities, NPC outcomes, combat results, and campaign history) are determined and persisted server-side only. The GPT interface is a stateless client that reads state, accepts a single player action per turn, and receives authoritative game events in response.

## Turn Flow

### 1. Get Current State

```http
GET /api/gpt/state
Authorization: Bearer {GOC_GPT_ACTION_KEY}
```

**Response:**
```json
{
  "account": { "id": "...", "username": "...", "displayName": "..." },
  "revision": 42,
  "character": { "name": "D'mir Holloran", "level": 3, "experience": 1200, ... },
  "hud": {
    "level": 3,
    "experience": 1200,
    "forcePoints": 5,
    "destinyPoints": 2,
    "darkSideScore": 15,
    "notoriety": 30,
    "carried": 8
  },
  "world": {
    "location": "Coruscant — Level 1313",
    "health": 45,
    "conditionTrack": ["strained"],
    "credits": 500,
    "creditsCriminal": 200,
    "inventory": [{"name": "Datapad", "qty": 1}, ...],
    "objectives": [{"title": "Escape detention", "status": "active"}, ...],
    "discoveries": [...],
    "milestones": [...],
    "relationships": {...},
    "factionRep": {...},
    "combat": null
  },
  "lastNarration": "..."
}
```

**Store the revision. It is required for the next turn.**

### 2. Accept One Player Action

Prompt the player for a single declared action in natural language.

**Examples of valid actions:**
- "I search the maintenance terminal for access codes."
- "D'mir descends deeper along the service corridor."
- "I attempt to pick the lock on the detention cell door."
- "I remain in place and listen for footsteps in the passage."
- "I ask the droid why it is guarding this sector."

**Examples of invalid actions (do not submit):**
- Multiple independent turns: "I pick the lock. Then I search the room. Then I run down the corridor."
- Meta-game commands: "Load checkpoint" (use the control intent routes instead)
- Invented outcomes: "I use the Force to sense that the guard is asleep." (only declare intention; the server resolves)
- Unconfirmed character facts: "I retrieve my hidden lightsaber." (only the server confirms if you have it)

### 3. Submit Turn

```http
POST /api/gpt/turn
Authorization: Bearer {GOC_GPT_ACTION_KEY}
Content-Type: application/json

{
  "action": "{exact player declaration}",
  "turnId": "{8–100 character alphanumeric unique ID, e.g., turn-a1b2c3d4}",
  "revision": 42
}
```

**Response on success (200):**
```json
{
  "revision": 43,
  "turnId": "turn-a1b2c3d4",
  "narration": "## SCENE\n**Location:** Coruscant — Level 1313\n\n[GM narration describing the outcome of your declared action]\n\nGM RESOLUTION\n[How the server resolved your action: success, failure, complication, etc.]\n\nRESULT: SUCCESS\n\nSTATE UPDATE\n[Any changes to inventory, credits, conditions, location, objectives, etc.]\n\nPLAYER OPTIONS\nA. [Option 1]\nB. [Option 2]\nC. [Option 3]\nD. [Option 4]\nYou may declare another action.",
  "roll": {
    "label": "Perception",
    "formula": "1d20+2",
    "raw": 14,
    "modifier": 2,
    "total": 16,
    "target": 15,
    "targetLabel": "DC",
    "outcome": "success"
  },
  "provider": "nvidia",
  "fallbackReason": null,
  "hud": { ... },
  "state": { ... }
}
```

### 4. Present Results

1. **Display the GM narration** exactly as returned, including the SCENE, GM RESOLUTION, RESULT, STATE UPDATE, and PLAYER OPTIONS sections.
2. **Report the roll** if present (label, total, target, outcome).
3. **Report the HUD** (level, experience, Force points, Destiny points, Dark Side score, notoriety, carried items).
4. **Store the new revision** for the next turn.
5. **Call GET /api/gpt/state** to refresh and confirm the persisted state before accepting the next action.

### 5. Revision Conflict

If the response is HTTP 409:
```json
{
  "error": "The campaign changed. Reload state and submit the action again."
}
```

1. Call `GET /api/gpt/state` to fetch the current state.
2. Notify the player that the campaign state changed (another player or the GM made a turn).
3. Prompt the player to declare a new action with the refreshed state.
4. Generate a new `turnId` and submit the new action.

## Critical Rules

### Do Not Invent Outcomes
- **Never** decide or narrate the result of your declared action.
- **Never** claim you discovered something, gained an item, or succeeded at a check without the server's narration confirming it.
- **Never** narrate what NPCs think, feel, or decide unless the server's narration establishes it.

### Do Not Bypass the Server
- **Never** edit or bulk-import campaign history, transcripts, or game state.
- **Never** modify inventory, credits, XP, level, or Force abilities directly.
- **Never** claim permanent changes to the world (e.g., "The door is now broken") without server confirmation.
- **Never** fast-forward time or skip turns.

### One Action Per Turn
- Each POST to `/api/gpt/turn` resolves exactly one declared action.
- If the player's narration contains multiple independent sub-actions, pick the primary one and submit it. Other sub-actions become the next turn's actions.

### Respect State Authority
- The `revision` number ensures consistency. Always use the latest revision returned.
- The `hud` and `state` in the response are the ground truth. Display them, don't override them.
- If you doubt a fact about the character or world, consult the returned `state` from the last turn.

## Authentication

Every request requires:
```http
Authorization: Bearer {GOC_GPT_ACTION_KEY}
```

This key must be configured server-side. If the server responds with HTTP 401 or 503, the key is missing or invalid; stop and report the error.

## Endpoints Reference

| Endpoint | Method | Purpose | Authentication |
|----------|--------|---------|-----------------|
| `/api/gpt/state` | GET | Fetch current campaign state and revision | Bearer token |
| `/api/gpt/turn` | POST | Submit one player action and receive outcome | Bearer token |
| `/api/gpt/save` | POST | Save or checkpoint the campaign | Bearer token |
| `/api/gpt/load` | POST | Load a checkpoint | Bearer token |
| `/api/gpt/reconcile` | POST | Sync out-of-character state conflicts | Bearer token |

## Example Session

```
[Call GET /api/gpt/state]
→ revision: 10, location: "Detention corridor", health: 45

[Player declares:]
"I search the desk for access codes."

[Call POST /api/gpt/turn with action, turnId, revision:10]
← revision: 11, narration: "You find a datapad...", roll: { label: "Perception", outcome: "success" }, state: { inventory: [..., {name: "Datapad", qty: 1}] }

[Display narration, roll, and updated HUD]

[Call GET /api/gpt/state]
→ revision: 11, inventory now includes the datapad, other state confirmed

[Player declares next action]
...
```

## Implementation Notes

- **Fail-fast on missing secrets:** If `NVIDIA_API_KEY` or `GOC_GPT_ACTION_KEY` is not configured, the server will reject requests with HTTP 503. Do not proceed; report the configuration error to the GM.
- **Idempotent turn IDs:** A turnId may be resubmitted if a network error occurs. The server will replay the prior response if the turnId already exists.
- **No fallback state mutation:** If the GM engine cannot resolve a turn (e.g., provider unavailable, insufficient Destiny points for a Force roll), no state is mutated. The response includes a `fallbackReason` and no movement or reward is granted.
- **Intent parsing is strict:** Declarations like "I sit and meditate," "I do not move," or "I search the room" will not trigger movement or combat. Movement or combat is only recognized from explicit, affirmative declarations like "I walk down the corridor" or "I attack the guard."

---

**Version:** 1.0  
**Last Updated:** 2026-10-03  
**Status:** Production
