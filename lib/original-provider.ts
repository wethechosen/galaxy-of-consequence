import { assertAuthenticatedRequest } from "./local-http";
import { runtimeSourceGrounding } from "./runtime-source-grounding";
export const TEST_AI_MODEL = "nvidia/nemotron-3-super-120b-a12b";
export function testAiStatus() {
  return { provider: "nvidia", model: process.env.NVIDIA_MODEL || TEST_AI_MODEL,
    configured: Boolean(process.env.NVIDIA_API_KEY), mode: "live-playtest" };
}

export type NvidiaMessage = { role: "user" | "assistant" | "system"; content: string };
export type NvidiaRequest = {
  messages: NvidiaMessage[];
  system?: string;
  sourceQuery?: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  timeout_ms?: number;
};

export class NvidiaProviderError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}

export async function invokeNvidia(body: NvidiaRequest) {
  if (!Array.isArray(body.messages) || !body.messages.length || body.messages.length > 100) throw new NvidiaProviderError("Conversation required.", 400);
  const key = process.env.NVIDIA_API_KEY;
  if (!key) throw new NvidiaProviderError("NVIDIA is not configured on the server. Add NVIDIA_API_KEY and restart the app.", 503);
  const messages = body.messages.map((message) => {
    if (!(["user", "assistant", "system"] as string[]).includes(message.role) || typeof message.content !== "string") throw new NvidiaProviderError("Invalid message.", 400);
    return { role: message.role, content: message.content };
  });
  const query = typeof body.sourceQuery === "string" ? body.sourceQuery.slice(0, 1000) : "";
  const grounding = query ? await runtimeSourceGrounding(query) : "";
  const system = [typeof body.system === "string" ? body.system : "", grounding].filter(Boolean).join("\n\n");
  let upstream: Response;
  const timeoutMs = Math.max(1000, Math.min(Number(body.timeout_ms) || 45_000, 60_000));
  const signal = AbortSignal.timeout(timeoutMs);
  let result: { choices?: Array<{ finish_reason?: string; message?: { content?: string } }> };
  try {
    upstream = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: testAiStatus().model,
        max_tokens: Math.max(128, Math.min(Number(body.max_tokens) || 1536, 4096)),
        messages: system ? [{ role: "system", content: system }, ...messages] : messages,
        stream: false,
        temperature: Math.max(0, Math.min(Number(body.temperature ?? 0.7), 1.5)),
        top_p: Math.max(0.01, Math.min(Number(body.top_p ?? 0.95), 1)),
        chat_template_kwargs: { enable_thinking: false },
      }),
      signal,
    });
    if (upstream.ok) result = await upstream.json();
  } catch (error) {
    const timeout = signal.aborted || error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name);
    throw new NvidiaProviderError(timeout ? "NVIDIA took too long to respond. No outcome was applied; retry the turn." : "NVIDIA is unavailable. No outcome was applied; retry the turn.", timeout ? 504 : 502);
  }
  if (!upstream.ok) {
    const error = upstream.status === 401 || upstream.status === 403 ? "The server's NVIDIA key was rejected."
      : upstream.status === 404 || upstream.status === 410 ? "The configured NVIDIA model is unavailable or retired. Update NVIDIA_MODEL and restart the server."
      : upstream.status === 429 ? "NVIDIA has reached its current quota or rate limit. Wait and retry the turn."
      : `NVIDIA returned HTTP ${upstream.status}. Retry when the service is available.`;
    throw new NvidiaProviderError(error, 502);
  }
  const choice = result!.choices?.[0];
  if (choice?.finish_reason === "length") throw new NvidiaProviderError("The GM response was cut off. No outcome was applied; retry the turn.");
  const content = choice?.message?.content?.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  if (!content) throw new NvidiaProviderError("NVIDIA returned no response. No outcome was applied; retry the turn.");
  return { content, provider: "nvidia", model: testAiStatus().model, finishReason: choice!.finish_reason };
}

// The user's temporary test configuration routes all active AI through NVIDIA.
export async function originalProvider(request: Request, _provider: "local" | "nvidia" | "anthropic") {
  try {
    assertAuthenticatedRequest(request);
    const raw = await request.text();
    if (raw.length > 500000) throw new Error("Request too large.");
    const body = JSON.parse(raw);
    const result = await invokeNvidia(body as NvidiaRequest);
    return Response.json({choices:[{message:{role:"assistant",content:result.content},finish_reason:result.finishReason}],provider:result.provider,model:result.model});
  } catch(error) {
    return Response.json({error:error instanceof Error ? error.message : "Provider unavailable."},{status:error instanceof NvidiaProviderError ? error.status : 400});
  }
}
