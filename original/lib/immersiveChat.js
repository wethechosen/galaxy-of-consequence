// Engine context is for the GM pipeline only. It must never appear in the player's datapad.
const INTERNAL_CONTEXT = /\[(?:PRIOR NARRATION|PRIOR PLAYER DECLARATION|CURRENT AUTHORITATIVE CAMPAIGN STATE|SERVER VALIDATION REJECTED)[^\]]*\]\s*/gim;

export function cleanPlayerMessage(content = "") {
  return String(content)
    .replace(INTERNAL_CONTEXT, "")
    .replace(/<!--\s*STATE\s*:[\s\S]*?-->/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function numberLabel(value, positive, negative) {
  const amount = Number(value || 0);
  if (!amount) return null;
  return amount > 0 ? `${positive} +${amount.toLocaleString()}` : `${negative} ${amount.toLocaleString()}`;
}

function listLabels(value, verb) {
  if (!Array.isArray(value)) return [];
  return value.filter(Boolean).map((entry) => `${verb}: ${typeof entry === "string" ? entry : entry.name || entry.title || "record updated"}`);
}

function conditionLabel(value) {
  const amount = Number(value || 0);
  if (!amount) return null;
  return amount < 0 ? `Condition improved ${Math.abs(amount)} step${Math.abs(amount) === 1 ? "" : "s"}` : `Condition worsened ${amount} step${amount === 1 ? "" : "s"}`;
}

export function summarizeStateUpdate(value = "") {
  let state = value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      state = JSON.parse(trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, ""));
    } catch {
      if (/[{}]|<!--|\b(?:provider|http|api|validation|ledger)\b/i.test(trimmed)) return ["Datapad synchronized with the confirmed outcome."];
      return trimmed.split(/\r?\n+/).map((line) => line.replace(/^[-*]\s*/, "").trim()).filter(Boolean).slice(0, 4);
    }
  }
  if (!state || typeof state !== "object") return [];

  return [
    numberLabel(state.health, "Vitality", "Vitality"),
    conditionLabel(state.conditionTrack),
    numberLabel(state.credits, "Credits", "Credits"),
    numberLabel(state.creditsCriminal, "Underworld credits", "Underworld credits"),
    numberLabel(state.experienceAward, "Experience", "Experience"),
    numberLabel(state.forcePoints, "Force Points", "Force Points"),
    numberLabel(state.destinyPoints, "Destiny Points", "Destiny Points"),
    numberLabel(state.darkSideScore, "Dark Side Score", "Dark Side Score"),
    state.location ? `Location: ${state.location}` : null,
    ...listLabels(state.inventoryAdd, "Acquired"),
    ...listLabels(state.inventoryRemove, "Removed"),
    ...listLabels(state.conditionAdd, "Condition"),
    ...listLabels(state.conditionRemove, "Condition cleared"),
    ...listLabels(state.objectiveAdd, "Objective"),
    ...listLabels(state.objectiveComplete, "Objective completed"),
    ...listLabels(state.discoveryAdd, "Discovery"),
    ...listLabels(state.milestoneAdd, "Milestone"),
  ].filter(Boolean);
}

const SECTION = /^(?:#{1,4}\s*)?(SCENE|GM RESOLUTION|RESOLUTION|OUTCOME|STATE UPDATE|CONSEQUENCES|PLAYER OPTIONS|POSSIBLE APPROACHES)\s*:?[ \t]*$/i;

export function parseImmersiveMessage(content = "") {
  const cleaned = cleanPlayerMessage(content);
  const lines = cleaned.split(/\r?\n/);
  const buckets = { scene: [], resolution: [], state: [], options: [] };
  let section = null;
  let structured = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const match = line.match(SECTION);
    if (match) {
      structured = true;
      const heading = match[1].toUpperCase();
      section = heading === "SCENE" ? "scene" : heading === "GM RESOLUTION" || heading === "RESOLUTION" || heading === "OUTCOME" ? "resolution" : heading === "STATE UPDATE" || heading === "CONSEQUENCES" ? "state" : "options";
      continue;
    }
    if (section) buckets[section].push(rawLine);
  }

  if (!structured) return { structured: false, text: cleaned, scene: "", resolution: "", consequences: [], options: [] };

  const optionLines = buckets.options.map((line) => line.trim()).filter(Boolean);
  const options = optionLines.slice(0, 4).map((line, index) => {
    const match = line.match(/^(?:[-*]\s*)?(?:\*\*)?([A-D])(?:[.)]|\*\*\s*[-:])?\s*(.+)$/i);
    return { label: match ? match[1].toUpperCase() : String.fromCharCode(65 + index), text: cleanPlayerMessage(match ? match[2] : line.replace(/^[-*]\s*/, "")) };
  }).filter((option) => option.text && !/^(?:or declare|you may declare)/i.test(option.text));

  return {
    structured: true,
    text: cleaned,
    scene: cleanPlayerMessage(buckets.scene.join("\n")),
    resolution: cleanPlayerMessage(buckets.resolution.join("\n")),
    consequences: summarizeStateUpdate(buckets.state.join("\n")),
    options,
  };
}

export function immersiveTurnError(error = "") {
  const value = String(error).toLowerCase();
  if (/campaign|revision|newer.*record/.test(value)) return "Your datapad detected a newer campaign record. Reload before continuing; no outcome was lost.";
  if (/dice|interrupt|turn identifier|already used/.test(value)) return "The last transmission ended before the outcome was confirmed. Retry the transmission; no duplicate outcome will be recorded.";
  if (/ledger|validat|state update|four alphabetical|response did not/.test(value)) return "The scene reached a rules checkpoint before it could be safely resolved. Your action was not completed and nothing changed. Retry the same declaration when the comlink clears.";
  if (/nvidia|openai|http|fetch|provider|model|api|network|database/.test(value)) return "Static cuts across the comlink before the scene can answer. Your action was not completed and nothing was added or lost. Retry when the signal returns.";
  return "The comlink cuts out before the scene is resolved. Your action was not completed and the campaign remains unchanged. Retry when ready.";
}
