import { describe, expect, it } from "vitest";
import { MAPS, findMap, mapPoint } from "./maps";
import { GET } from "../app/api/maps/route";

describe("private reference atlas", () => {
  it("keeps all thirteen charts distinct, including both galaxy projections", () => {
    expect(MAPS).toHaveLength(13);
    expect(new Set(MAPS.map(map => map.id)).size).toBe(13);
    expect(new Set(MAPS.map(map => map.file)).size).toBe(13);
    expect(MAPS.every(map => map.width > 0 && map.height > 0)).toBe(true);
    expect(findMap("population")?.note).toContain("25 ABY");
    expect(findMap("sith-space")?.note).toContain("Does not establish");
  });
  it("normalizes references independently of zoom and rejects invalid dimensions", () => {
    expect(mapPoint(50, 25, 100, 100)).toEqual(mapPoint(200, 100, 400, 400));
    expect(mapPoint(-1, 200, 100, 100)).toEqual({ x: 0, y: 1 });
    expect(() => mapPoint(0, 0, 0, 100)).toThrow();
    expect(() => mapPoint(NaN, 0, 100, 100)).toThrow();
  });
  it("refuses remote callers and path traversal without accessing files", async () => {
    expect((await GET(new Request("http://evil.example/api/maps"))).status).toBe(403);
    expect((await GET(new Request("http://localhost/api/maps", { headers: { origin: "https://evil.example" } }))).status).toBe(403);
    // Authentication now precedes map lookup, including unknown IDs.
    expect((await GET(new Request("http://localhost/api/maps?id=../../.env"))).status).toBe(403);
    expect(findMap("../../.env")).toBeUndefined();
  });
});
