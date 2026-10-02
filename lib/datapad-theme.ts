// Presentation only. The ten-point color ramp is NOT a Saga alignment threshold.
// It neither adjudicates morality nor changes the authoritative character state.
export function datapadTheme(score: number | null, verified: boolean) {
  if (!verified || score === null || !Number.isSafeInteger(score) || score < 0) {
    return { accent: "255, 126, 35", label: "Unassigned · neutral display" };
  }
  const amount = Math.min(score / 10, 1);
  const start = [100, 220, 255], end = [255, 108, 124];
  const accent = start.map((value, index) => Math.round(value + (end[index] - value) * amount)).join(", ");
  return { accent, label: `Dark Side Score ${score} · cosmetic color response` };
}
