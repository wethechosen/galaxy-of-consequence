/**
 * NVIDIA text-inference routing. All credentials must be stored as server-side
 * environment variables, never committed or exposed to browser clients.
 *
 * NVIDIA ACE avatar / speech / animation services have different APIs; they
 * cannot be used as chat-completion IDs without a separate adapter.
 */
export type NvidiaPurpose = "interpretation" | "gm" | "dmir" | "ledger" | "npc";

export const NVIDIA_MODEL_CANDIDATES = {
  interpretation: {
    model:"nvidia/nemotron-3-super-120b-a12b",
    reason:"Public NIM chat endpoint. Validate structured interpretation before choosing a faster model.",
  },
  gm: {
    model:"nvidia/nemotron-3-super-120b-a12b",
    reason:"Stable NVIDIA NIM chat-completions model for world-state-constrained GM narration.",
  },
  npc: {
    model:"nvidia/nemotron-3-super-120b-a12b",
    reason:"NVIDIA NIM chat model for AI-GM-controlled NPC dialogue; no separate playable NPC mode.",
  },
  ledger: {
    model:"nvidia/nemotron-3-super-120b-a12b",
    reason:"Use constrained ledger validation; a model cannot grant an unsupported change.",
  },
} as const;

const configured = (value: string | undefined) => value?.trim() || "";

export function nvidiaModel(purpose: NvidiaPurpose = "gm"): string {
  const general = configured(process.env.NVIDIA_MODEL);
  const gm = configured(process.env.NVIDIA_MODEL_GM);
  switch (purpose) {
    case "dmir": return configured(process.env.NVIDIA_MODEL_DMIR) || gm || general || NVIDIA_MODEL_CANDIDATES.gm.model;
    case "gm": return gm || general || NVIDIA_MODEL_CANDIDATES.gm.model;
    case "npc": return configured(process.env.NVIDIA_MODEL_NPC) || gm || general || NVIDIA_MODEL_CANDIDATES.npc.model;
    case "ledger": return configured(process.env.NVIDIA_MODEL_LEDGER) || general || NVIDIA_MODEL_CANDIDATES.ledger.model;
    case "interpretation": return configured(process.env.NVIDIA_MODEL_INTERPRETATION) || general || NVIDIA_MODEL_CANDIDATES.interpretation.model;
  }
}

/** Dedicated D'mir key is only selected for verified D'mir primary turns.
 * A missing role secret gracefully falls back to the configured shared key.
 * Different API keys do NOT imply separate NVIDIA quota pools.
 */
export function nvidiaApiKey(purpose: NvidiaPurpose = "gm"): string {
  const general = configured(process.env.NVIDIA_API_KEY);
  const gm = configured(process.env.NVIDIA_API_KEY_GM);
  switch (purpose) {
    case "dmir": return configured(process.env.NVIDIA_API_KEY_DMIR) || gm || general;
    case "gm": return gm || general;
    case "npc": return configured(process.env.NVIDIA_API_KEY_NPC) || gm || general;
    case "ledger": return configured(process.env.NVIDIA_API_KEY_LEDGER) || general;
    case "interpretation": return configured(process.env.NVIDIA_API_KEY_INTERPRETATION) || general;
  }
}
