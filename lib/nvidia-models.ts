export type NvidiaPurpose = "interpretation" | "gm" | "ledger";
// Evaluation presets, not automatic failover: a second model still consumes the account budget.
export const NVIDIA_MODEL_CANDIDATES = {
  interpretation: { model: "nvidia/nemotron-3.5-lightning-30b-a3b", reason: "Short, low-temperature intent classification; validate accuracy and latency before enabling." },
  gm: { model: "nvidia/nemotron-3-super-120b-a12b", reason: "Existing grounded GM and NPC narration baseline." },
  ledger: { model: "nvidia/nemotron-3-super-120b-a12b", reason: "Conservative structured serialization of confirmed outcomes; no authority to grant assets." },
} as const;
export function nvidiaModel(purpose: NvidiaPurpose = "gm") {
  const overrides = {interpretation:process.env.NVIDIA_MODEL_INTERPRETATION,gm:process.env.NVIDIA_MODEL_GM,ledger:process.env.NVIDIA_MODEL_LEDGER};
  return overrides[purpose]?.trim() || process.env.NVIDIA_MODEL?.trim() || "nvidia/nemotron-3-super-120b-a12b";
}
