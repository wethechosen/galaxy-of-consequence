// Saga hit points are an absolute resource, not a percentage out of 100.
// Old campaigns without a recorded maximum keep their actual current HP.
export function hitPointDisplay(character, gameState) {
  const current = Math.max(0, Number(gameState?.health) || 0);
  const rawMaximum = character?.maxHitPoints;
  const maximum = rawMaximum !== null && rawMaximum !== undefined && rawMaximum !== "" && Number.isFinite(Number(rawMaximum)) && Number(rawMaximum) > 0 ? Number(rawMaximum) : null;
  return {
    current, maximum,
    percent: maximum === null ? null : Math.max(0, Math.min(100, current / maximum * 100)),
    label: maximum === null ? `${current} HP` : `${current}/${maximum} HP`,
  };
}
