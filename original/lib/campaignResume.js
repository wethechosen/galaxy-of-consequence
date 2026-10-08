import { cleanPlayerMessage, parseImmersiveMessage } from "./immersiveChat";

const entries = (value) => Array.isArray(value) ? value.filter(Boolean) : [];
const text = (value) => cleanPlayerMessage(typeof value === "string" ? value : "");
const key = (value) => text(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const diagnostic = /\b(?:local-safe-fallback|server validation|authoritative campaign state|provider failure|no outcome was saved|no consequences were recorded|administratively|reconciliat|test fixture)\b/i;
const genericScene = /(?:your action meets the immediate world|you commit to the declared attempt|you carry the declared action into the immediate scene|nearby equipment, distance, and access|the environment answers with a concrete change)/i;
const unavailable = new Set(["hidden", "secret", "private", "draft", "unconfirmed", "retracted"]);
const playerKnown = (entry) => !unavailable.has(entry?.visibility) && !unavailable.has(entry?.status);

export function sameCampaignLocation(left, right) {
  return Boolean(key(left) && key(right) && key(left) === key(right));
}

export function isInterruptedMessage(message) {
  if (!message || message.error || message.role === "system") return true;
  if (message.role !== "assistant") return false;
  const content = text(message.content);
  // A server-resolved receipt is a real saved consequence even if prose generation failed.
  if (message.model === "resolved-saga-receipt" && content) return false;
  return message.provider === "local-safe-fallback" || Boolean(message.fallbackReason)
    || !content || diagnostic.test(content) || genericScene.test(content)
    || /^(?:transmission (?:lost|interrupted|disrupted)|comlink static)\b/i.test(content);
}

/** A display-only projection. Never removes or rewrites the saved transcript. */
export function campaignTranscript(messages = []) {
  const source = entries(messages).map((message, index) => ({ ...message, sourceIndex: index }));
  const groups = [];
  for (const message of source) {
    if (message.role === "user" || !groups.length || groups.at(-1).some((item) => item.role === "assistant") && message.role !== "assistant") groups.push([]);
    groups.at(-1).push(message);
  }
  const confirmed = [], archived = [], pending = [];
  for (const [groupIndex, group] of groups.entries()) {
    const valid = group.filter((message) => message.role === "assistant" && !isInterruptedMessage(message));
    if (valid.length) {
      confirmed.push(...group.filter((message) => ["user", "roll", "assistant"].includes(message.role) && !isInterruptedMessage(message)));
      archived.push(...group.filter(isInterruptedMessage));
    } else if (group.some((message) => message.role === "assistant" || isInterruptedMessage(message))) archived.push(...group);
    else if (groupIndex === groups.length - 1) pending.push(...group.filter((message) => message.role === "user" || message.role === "roll"));
    else archived.push(...group);
  }
  const seen = new Set();
  const unique = confirmed.filter((message) => {
    // Retried responses with the same turn id are one saved turn, not another scene.
    if (!message.turnId) return true;
    const id = `${message.role}:${message.turnId}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  const latest = unique.findLast((message) => message.role === "assistant") || null;
  const latestStart = latest ? unique.findLastIndex((message) => message.role === "user" && message.sourceIndex < latest.sourceIndex) : unique.length;
  return { confirmed: unique, archived, pending, latest, latestExchange: unique.slice(Math.max(0, latestStart)) };
}

function changeSummary(event) {
  const change = event.changes || {};
  const fragments = [];
  if (change.location) fragments.push(`Reached ${text(change.location)}.`);
  for (const entry of entries(change.objectiveComplete)) fragments.push(`Completed: ${text(typeof entry === "string" ? entry : entry.title || entry.name)}.`);
  for (const entry of entries(change.milestoneAdd)) fragments.push(text(typeof entry === "string" ? entry : entry.detail || entry.title));
  for (const entry of entries(change.discoveryAdd)) fragments.push(text(typeof entry === "string" ? entry : entry.detail || entry.title));
  const acquired = entries(change.inventoryAdd).map((item) => text(typeof item === "string" ? item : item.name)).filter(Boolean);
  if (acquired.length) fragments.push(`Acquired ${acquired.join(", ")}.`);
  if (Number(change.credits) < 0) fragments.push(`Spent ${Math.abs(Number(change.credits)).toLocaleString("en-US")} credits.`);
  if (Number(event.experienceAward) > 0) fragments.push(`Earned ${Number(event.experienceAward)} XP.`);
  return fragments.filter((item) => item && !diagnostic.test(item)).join(" ");
}

/** Return recaps are a read of the save, not a new GM turn or off-screen simulation.
 * @param {{messages?: any[], gameState?: Record<string, any>, character?: Record<string, any> | null}} [snapshot]
 */
export function buildCampaignRecap({ messages = [], gameState = {}, character = {} } = {}) {
  const transcript = campaignTranscript(messages);
  const invalidTurns = new Set(transcript.archived.filter((message) => message.role === "assistant").map((message) => message.turnId).filter(Boolean));
  const validByTurn = new Map(transcript.confirmed.filter((message) => message.role === "assistant" && message.turnId).map((message) => [message.turnId, message]));
  const seenTurns = new Set();
  const timeline = entries(gameState.turnEvents).map((event, index) => ({ ...event, index })).filter((event) => {
    if (!event.turnId || invalidTurns.has(event.turnId) && !validByTurn.has(event.turnId) || seenTurns.has(event.turnId)) return false;
    seenTurns.add(event.turnId);
    return true;
  }).sort((a, b) => {
    const left = Date.parse(a.resolvedAt), right = Date.parse(b.resolvedAt);
    return Number.isFinite(left) && Number.isFinite(right) ? left - right || a.index - b.index : a.index - b.index;
  }).map((event) => ({ id: event.turnId, at: event.resolvedAt, summary: changeSummary(event) })).filter((event) => event.summary).slice(-8);
  const milestones = entries(gameState.milestones).filter(playerKnown)
    .map((entry) => text(typeof entry === "string" ? entry : entry.detail || entry.title)).filter((item) => item && !diagnostic.test(item));
  const location = text(gameState.location) || "Location not recorded";
  const savedScene = text(gameState.scene?.summary);
  const sceneMessage = transcript.confirmed.findLast((message) => message.role === "assistant"
    && sameCampaignLocation(parseImmersiveMessage(message.content).location, location));
  const latest = sceneMessage ? parseImmersiveMessage(sceneMessage.content) : null;
  const lastRawAssistant = entries(messages).findLast((message) => message.role === "assistant");
  // A failed turn may have written a plausible-looking frame at an old place.
  // Only use the stored frame if both its location and the latest reply are sound.
  const reliableFrame = sameCampaignLocation(gameState.scene?.location, location)
    && (!lastRawAssistant || !isInterruptedMessage(lastRawAssistant));
  // Once an interrupted turn follows an exchange, its older present-tense
  // prose is historical context, not proof of the character's current position.
  const sceneIsCurrent = Boolean(sceneMessage && sceneMessage.sourceIndex === messages.indexOf(lastRawAssistant) || reliableFrame);
  const scene = sceneIsCurrent ? latest?.scene || (savedScene && !genericScene.test(savedScene) && !diagnostic.test(savedScene) ? savedScene : "") : "";
  const news = entries(gameState.publicNews).filter(playerKnown)
    .slice(-3).map((entry) => ({ title: text(entry.headline || entry.title), detail: text(entry.summary || entry.body || entry.detail || entry.facts), source: text(entry.source || entry.network) })).filter((entry) => entry.title || entry.detail);
  return {
    name: text(character?.name) || "Your character", location, scene,
    lastAction: transcript.confirmed.findLast((message) => message.role === "user")?.content || "",
    lastOutcome: latest?.gameplay || "", sceneIsCurrent,
    lastRecordedScene: sceneIsCurrent ? "" : latest?.scene || "",
    timeline, milestones: [...new Set(milestones)].slice(-5), news,
    objectives: entries(gameState.objectives).filter((entry) => entry.status === "active").map((entry) => text(entry.title)).filter(Boolean).slice(-4),
    lastSavedTurn: transcript.latest?.turnId || "", interruptedCount: transcript.archived.filter((entry) => entry.role === "assistant").length,
  };
}

export function shouldShowReturnRecap(lastVisit, now = Date.now()) {
  const previous = Number(lastVisit);
  return !Number.isFinite(previous) || previous <= 0 || now - previous >= 30 * 60 * 1000;
}
