// This means the first persistent playtest loop is available, not that every
// Saga subsystem or production deployment milestone is complete.
export const GAMEPLAY_IMPLEMENTED = true;
export const LIVE_AI_ENABLED = Boolean(process.env.NVIDIA_API_KEY);
export function gameplayReadiness() {
  return { ready: GAMEPLAY_IMPLEMENTED, playtestReady: GAMEPLAY_IMPLEMENTED && LIVE_AI_ENABLED, productionReady: false,
    liveAi: LIVE_AI_ENABLED, abilityMethod: "point_buy",
    blockers: ["Complete encounter/condition-track automation", "Deployment secrets and Neon-hosted end-to-end verification"] };
}
