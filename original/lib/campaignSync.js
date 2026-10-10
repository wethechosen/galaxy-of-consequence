// A conflict is not a failed fictional action. Read authority before retrying;
// never merge an old transcript or old possessions over a newer campaign.
export function recoverCampaignTurn(saved, pending) {
  if (!saved?.snapshot || !Number.isFinite(Number(saved.revision))) throw new Error("The saved campaign could not be reloaded. Your action is preserved.");
  const committed = Boolean(pending?.turnId && saved.snapshot.messages?.some(message => message.role === "assistant" && message.turnId === pending.turnId));
  return { snapshot: saved.snapshot, revision: saved.revision, committed,
    pending: committed ? null : { ...pending, history: saved.snapshot.messages, stateOverride: undefined, characterOverride: saved.snapshot.character },
    message: committed ? "" : "The latest saved campaign is loaded. Your pending action has not been confirmed. Review the scene before retrying it." };
}
