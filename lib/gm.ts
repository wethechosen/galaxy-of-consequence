import { appendRoll, appendScene, getCampaign } from "@/lib/campaign-store";
import { LORE_POLICY } from "@/lib/lore";
import { inferProvisionalCheck, rollD20 } from "@/lib/rules";
import type { GmTurnResponse } from "@/lib/types";

function localNarration(action: string, roll?: ReturnType<typeof rollD20>) {
  const resolution = roll
    ? roll.outcome === "success"
      ? ` The attempt holds: your ${roll.total} clears the immediate difficulty.`
      : ` The attempt falls short at ${roll.total}; the situation changes, but does not end your options.`
    : " No roll is required yet; the situation remains open.";
  return `You move on your intention: “${action}.” On Docking Ring Seven, the shuttered customs office hums with emergency power while CSA officers question travelers beneath the rain-smeared lights.${resolution} A protocol droid notices your movement and turns its photoreceptors toward you.`;
}

async function nemotronNarration(action: string, state: ReturnType<typeof getCampaign>, roll?: ReturnType<typeof rollD20>) {
  const key = process.env.NVIDIA_API_KEY;
  if (!key) return null;
  const system = [
    "You are a restrained Star Wars Saga Edition GM for a 200 ABY, Legends-first Legacy campaign.",
    "Never claim a campaign adaptation is published lore. Never expose hidden NPC statistics, target numbers, or reasoning.",
    "The server alone resolves dice and state. Narrate only immediate, player-perceivable results in 2 short paragraphs.",
    ...LORE_POLICY,
  ].join(" ");
  const user = JSON.stringify({
    playerAction: action,
    location: state.currentLocation,
    scene: state.currentScene,
    visibleCharacter: state.character,
    resolvedRoll: roll ? { total: roll.total, outcome: roll.outcome, reason: roll.reason } : null,
  });
  const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.NVIDIA_MODEL ?? "nvidia/nemotron-3-super-120b-a12b",
      temperature: 1,
      top_p: 0.95,
      max_tokens: 500,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      extra_body: { chat_template_kwargs: { enable_thinking: false } },
    }),
    cache: "no-store",
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return body.choices?.[0]?.message?.content?.trim() || null;
}

export async function runGmTurn(action: string): Promise<GmTurnResponse> {
  const initial = getCampaign();
  if (initial.rulesStatus !== "verified") {
    throw new Error("RULES_NOT_VERIFIED");
  }
  const check = inferProvisionalCheck(action);
  const roll = check ? rollD20(check) : undefined;
  const afterRoll = roll ? appendRoll(initial.id, roll) : initial;
  const generated = await nemotronNarration(action, afterRoll, roll);
  const narration = generated ?? localNarration(action, roll);
  const campaign = appendScene(initial.id, narration);
  return { narration, campaign, roll, source: generated ? "nemotron" : "local-safe-fallback" };
}
