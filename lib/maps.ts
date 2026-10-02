import catalog from "./map-catalog.json";

export type AtlasMap = typeof catalog[number];
export type MapEntry = AtlasMap & { available: boolean };
export const MAPS: readonly AtlasMap[] = catalog;
export function findMap(id: string) { return MAPS.find(map => map.id === id); }

// Reference coordinates only: no distance, travel, or campaign fact is implied.
export function mapPoint(x: number, y: number, width: number, height: number) {
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) throw new Error("Invalid map dimensions");
  return { x: Math.max(0, Math.min(1, x / width)), y: Math.max(0, Math.min(1, y / height)) };
}
