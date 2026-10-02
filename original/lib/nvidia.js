// This label mirrors the server-side default and is shown in the GM console.
// The server remains authoritative and never accepts an arbitrary client model.
export const NVIDIA_MODEL = "nvidia/nemotron-3-super-120b-a12b";

export async function invokeNvidiaAssistant({
  messages,
  model = NVIDIA_MODEL,
  temperature = 0.6,
  top_p = 0.7,
  max_tokens = 4096,
  sourceQuery = "",
  purpose = "flavor",
}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 70000);
  let response;
  try {
    response = await fetch("/api/nvidia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, model, temperature, top_p, max_tokens, sourceQuery, purpose }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === "AbortError") throw new Error("NVIDIA request timed out.");
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
  const responseText = await response.text();
  let data;
  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {
    throw new Error("NVIDIA returned invalid JSON.");
  }
  if (!response.ok) throw new Error(data.error || `NVIDIA API error ${response.status}`);
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("NVIDIA returned an empty response.");
  return text;
}
