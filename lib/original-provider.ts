import { assertAuthenticatedRequest } from "./local-http";
import { runtimeSourceGrounding } from "./runtime-source-grounding";
import { NvidiaProviderError, nvidiaRetryHeaders } from "./nvidia-errors";
import { nvidiaModel, nvidiaApiKey, type NvidiaPurpose } from "./nvidia-models";
import { reserveNvidiaSlot, checkNvidiaCooldown, recordNvidiaCooldown, parseRetryAfter, retryAfterIsEstimated } from "./nvidia-rate-budget";
import { markNvidiaRequest, recordNvidiaUsage } from "./nvidia-usage-telemetry";
import { setTimeout as wait } from "node:timers/promises";
export { NvidiaProviderError } from "./nvidia-errors";
export const TEST_AI_MODEL = "nvidia/nemotron-3-super-120b-a12b";
export function testAiStatus() {
  return { provider: "nvidia", model: nvidiaModel("gm"),
    models: { gm: nvidiaModel("gm"), npc: nvidiaModel("npc"), interpretation: nvidiaModel("interpretation"), ledger: nvidiaModel("ledger") },
    configured: Boolean(nvidiaApiKey("gm")), mode: "live-playtest" };
}

export type NvidiaMessage = { role: "user" | "assistant" | "system"; content: string };
export type NvidiaRequest = {
  purpose?: NvidiaPurpose;
  messages: NvidiaMessage[];
  system?: string;
  sourceQuery?: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  timeout_ms?: number;
};
type NvidiaResponse = {
  choices?: Array<{ finish_reason?: string; message?: { content?: string } }>;
  usage?: { prompt_tokens?: unknown; completion_tokens?: unknown; total_tokens?: unknown };
};
export async function invokeNvidia(body: NvidiaRequest) {
  if (!Array.isArray(body.messages) || !body.messages.length || body.messages.length > 100) throw new NvidiaProviderError("Conversation required.", 400);
  const purpose = body.purpose ?? "gm";
  const key = nvidiaApiKey(purpose);
  if (!key) throw new NvidiaProviderError("NVIDIA is not configured on the server. Add NVIDIA_API_KEY and restart the app.", 503);
  const messages = body.messages.map((message) => {
    if (!(["user", "assistant", "system"] as string[]).includes(message.role) || typeof message.content !== "string") throw new NvidiaProviderError("Invalid message.", 400);
    return { role: message.role, content: message.content };
  });
  const query = typeof body.sourceQuery === "string" ? body.sourceQuery.slice(0, 1000) : "";
  const grounding = query ? await runtimeSourceGrounding(query) : "";
  const system = [typeof body.system === "string" ? body.system : "", grounding].filter(Boolean).join("\n\n");
  const timeoutMs = Math.max(1000, Math.min(Number(body.timeout_ms) || 45_000, 60_000));
  const signal = AbortSignal.timeout(timeoutMs);
  const model = nvidiaModel(purpose);

  // The provider may omit usage and limit headers. Missing means unknown, not zero.
  // This block is strictly observational: telemetry failure must never interrupt play.
  const start = Date.now();
  let upstream: Response | undefined;
  let result: NvidiaResponse | undefined;
  let recordedFault: unknown;
  let trace: ReturnType<typeof markNvidiaRequest> = null;
  try {
    try {
      const delay = await reserveNvidiaSlot();
      if (delay) await wait(delay, undefined, { signal });
      await checkNvidiaCooldown();
      trace = markNvidiaRequest();
      upstream = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          max_tokens: Math.max(128, Math.min(Number(body.max_tokens) || 1536, 4096)),
          messages: system ? [{ role: "system", content: system }, ...messages] : messages,
          stream: false,
          temperature: Math.max(0, Math.min(Number(body.temperature ?? 0.7), 1.5)),
          top_p: Math.max(0.01, Math.min(Number(body.top_p ?? 0.95), 1)),
          chat_template_kwargs: { enable_thinking: false },
        }),
        signal,
      });
      if (upstream.ok) result = await upstream.json() as NvidiaResponse;
    } catch (error) {
      if (error instanceof NvidiaProviderError) throw error;
      const timeout = signal.aborted || error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name);
      throw new NvidiaProviderError(timeout ? "NVIDIA took too long to respond. No outcome was applied; retry the turn." : "NVIDIA is unavailable. No outcome was applied; retry the turn.", timeout ? 504 : 502);
    }
    if (!upstream.ok) {
      if (upstream.status === 429) {
        const suppliedRetryAfter = upstream.headers.get("retry-after");
        const seconds = parseRetryAfter(suppliedRetryAfter);
        await recordNvidiaCooldown(seconds);
        throw new NvidiaProviderError("NVIDIA rate limit reached. No gameplay outcome was applied.", 429, seconds, 429, retryAfterIsEstimated(suppliedRetryAfter));
      }
      const error = upstream.status === 401 || upstream.status === 403 ? "The server's NVIDIA key was rejected."
        : upstream.status === 404 || upstream.status === 410 ? "The configured NVIDIA model is unavailable or retired. Update NVIDIA_MODEL and restart the server."
        : `NVIDIA returned HTTP ${upstream.status}. Retry when the service is available.`;
      throw new NvidiaProviderError(error, 502);
    }
    const choice = result!.choices?.[0];
    if (choice?.finish_reason === "length") throw new NvidiaProviderError("The GM response was cut off. No outcome was applied; retry the turn.");
    const content = choice?.message?.content?.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    if (!content) throw new NvidiaProviderError("NVIDIA returned no response. No outcome was applied; retry the turn.");
    return { content, provider: "nvidia", model, finishReason: choice!.finish_reason };
  } catch (error) {
    recordedFault = error;
    throw error;
  } finally {
    try {
      const fault = recordedFault instanceof NvidiaProviderError ? recordedFault : null;
      recordNvidiaUsage({
        purpose, model,
        origin: upstream ? "provider" : trace ? "transport" : "local-pacer",
        status: upstream?.status ?? fault?.status ?? null,
        elapsedMs: Date.now() - start,
        usage: result?.usage,
        headers: upstream?.headers,
        trace,
        retryAfterSeconds: fault?.retryAfterSeconds ?? null,
        retryAfterEstimated: fault?.status === 429 ? fault.retryAfterEstimated : null,
      });
    } catch {
      // Metrics are never a gameplay dependency.
    }
  }
}

// The user's temporary test configuration routes all active AI through NVIDIA.
export async function originalProvider(request: Request, _provider: "local" | "nvidia" | "anthropic") {
  try {
    assertAuthenticatedRequest(request);
    const raw = await request.text();
    if (raw.length > 500000) throw new Error("Request too large");
    const body = JSON.parse(raw);
    const result = await invokeNvidia(body as NvidiaRequest);
    return Response.json({choices:[{message:{role:"assistant",content:result.content},finish_reason:result.finishReason}],provider:result.provider,model:result.model});
  } catch(error) {
    return Response.json({error:error instanceof Error ? error.message : "Provider unavailable.", retryAfterSeconds:error instanceof NvidiaProviderError ? error.retryAfterSeconds : undefined, retryAfterEstimated:error instanceof NvidiaProviderError ? error.retryAfterEstimated : undefined},{status:error instanceof NvidiaProviderError ? error.status : 400, headers:nvidiaRetryHeaders(error)});
  }
}
