# NVIDIA model roles

All roles share one server-side request budget; separate models or API keys do not multiply the provider quota. The application reserves at most 30 calls/minute across workers using Neon, with headroom below the account's reported 40 RPM. Other applications can still consume that account quota.

| Role | Configuration | Responsibility |
| --- | --- | --- |
| GM / NPC dialogue | NVIDIA_MODEL_GM | Grounded narration and character dialogue, subject to server validation |
| Action interpretation | NVIDIA_MODEL_INTERPRETATION | Classify player intent; never authorize transactions |
| Ledger repair | NVIDIA_MODEL_LEDGER | Serialize established facts; never invent payments or rewards |

Unset overrides use NVIDIA_MODEL, then the existing nvidia/nemotron-3-super-120b-a12b. Routing adds no extra calls. Rules, money, rolls and persistence remain code-owned.

The user-selected narration model is nvidia/nemotron-3.5-super-vl-120b-a12b, configured through NVIDIA_MODEL_GM. NPC dialogue inherits that override unless NVIDIA_MODEL_NPC is supplied. NVIDIA_API_KEY_GM optionally supplies a narration-only credential, preserving NVIDIA_API_KEY for interpretation and ledger repair. Both credentials share the same pacing budget.

Endpoint access and the Python streaming smoke test passed. The production controller continues bounded non-streaming output with thinking disabled so it can validate a complete turn before committing. The Python helper scripts/verify-super-vl.py is an optional standalone connectivity check, not a second game backend. Vision/image input, autonomous NPC planning and retrieval training are not enabled by changing this model.

Lightning 3.5 remains an evaluation candidate for interpretation, not an activated model. Never use model failover to evade a 429.

Before deploying shared pacing, apply db/neon/002_nvidia_rate_budget.sql to an isolated branch and then the production database. On upstream 429, save the provider's cooldown, return Retry-After, and preserve the existing pending turn ID for retry. Do not submit another gameplay action to test connectivity.
