const OOC_COMMAND = "[[ Game master follow rules and directives ]]";

function formatConversation(messages) {
  return messages
    .map((message) => `${message.role === "user" ? "PLAYER" : "GAME MASTER"}: ${message.content}`)
    .join("\n\n");
}

function instructionForMode(mode) {
  if (mode === "ooc") {
    return "The player has stepped out of the scene to ask you, the Game Master, a direct out-of-character question. Answer helpfully and concisely as a GM guide — explain mechanics, clarify the scene, or list options. Do NOT advance the story, do NOT write in-character fiction, and do NOT output a STATE block. Keep it short and useful.";
  }
  return "Continue the scene as the Game Master. Reply with your next in-character response, ending with the hidden STATE block exactly as instructed in the directive.";
}

export async function invokeGameMaster({ apiKey, model, system, messages, mode = "play", provider = "lmstudio", sourceQuery = "" }) {
  if (!system || !Array.isArray(messages) || messages.length === 0) {
    throw new Error("The Game Master request needs system instructions and at least one message.");
  }

  const prompt = [
    system,
    "---",
    "CONVERSATION SO FAR:",
    formatConversation(messages),
    "---",
    instructionForMode(mode),
  ].join("\n\n");

  const isLocal = provider === "lmstudio";
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), isLocal ? 15000 : 30000);
  let response;
  try {
    response = await fetch(isLocal ? "/api/local-gm" : (apiKey ? "https://api.anthropic.com/v1/messages" : "/api/anthropic"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey && !isLocal ? {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        } : {}),
      },
      body: JSON.stringify({
        model,
        max_tokens: mode === "ooc" ? 768 : 1024,
        ...(isLocal || !apiKey ? { system } : {}),
        ...(isLocal ? { provider: "lmstudio" } : {}),
        sourceQuery,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`${isLocal ? "LM Studio" : "Game Master"} request timed out.`);
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`API error ${response.status}: ${errorText.slice(0, 200)}`);
  }

  const responseText = await response.text();
  let data;
  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {
    throw new Error(`The ${isLocal ? "LM Studio" : "Game Master"} provider returned invalid JSON.`);
  }
  const textBlock = (data.content || []).find((block) => block.type === "text");
  const text = textBlock?.text || data.choices?.[0]?.message?.content;
  if (!text) throw new Error("The Game Master returned an empty response.");
  return text;
}

export function getGameMasterMode(userText) {
  return /^\[\[[\s\S]*\]\]$/.test(userText?.trim() || "") ? "ooc" : "play";
}

export { OOC_COMMAND };
