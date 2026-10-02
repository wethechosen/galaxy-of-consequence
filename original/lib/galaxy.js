export function alignmentBand(value) {
  const alignment = Number(value);
  if (alignment >= 70) return "Light";
  if (alignment <= 30) return "Dark";
  return "Gray";
}
