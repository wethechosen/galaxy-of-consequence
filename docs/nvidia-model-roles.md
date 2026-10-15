# NVIDIA model roles

All roles share one server-side request budget; separate models or API keys do not multiply the provider quota. The application reserves at most 30 calls/minute across workers using Neon, with headroom below the account's reported 40 RPM. Other applications can still consume that account quota.

| Role | Configuration | Responsibility |
| --- | --- | --- |
| GM / NPC dialogue | NVIDIA_MODEL_GM | Grounded narration and character dialogue, subject to server validation |
| Action interpretation | NVIDIA_MODEL_INTERPRETATION | Classify player intent; never authorize transactions |
| Ledger repair | NVIDIA_MODEL_LEDGER | Serialize established facts; never invent payments or rewards |

Unset overrides use NVIDIA_MODEL, then the existing nvidia/nemotron-3-super-120b-a12b. Routing adds no extra calls. Rules, money, rolls and persistence remain code-owned.

Evaluation candidates (not enabled by this change): NVIDIA's documented nvidia/nemotron-3.5-lightning-30b-a3b for interpretation; the requested Nemotron 3.5 Super VL 120B A12B for GM narration after hosted model ID, account access, latency and ledger correctness are verified. Vision support alone does not improve a text-only campaign. Do not silently switch production or use fallbacks to evade a 429.

Before deploying shared pacing, apply db/neon/002_nvidia_rate_budget.sql to an isolated branch and then the production database. On upstream 429, save the provider's cooldown, return Retry-After, and preserve the existing pending turn ID for retry. Do not submit another gameplay action to test connectivity.
