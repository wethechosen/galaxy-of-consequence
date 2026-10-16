import { expect, it } from "vitest";
import { GET } from "@/app/api/npcs/route";

it("publishes 35 separate NPC dossiers without falsely claiming completed gameplay or leaking GM secrets", async () => {
  const response = await GET();
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result.roster).toHaveLength(35);
  expect(result.endingCountVerified).toBe(0);
  expect(new Set(result.roster.map((entry: { id: string }) => entry.id)).size).toBe(35);
  for (const entry of result.roster) {
    expect(entry.playthroughStatus).toBe("unverified");
    expect(entry).not.toHaveProperty("confidential");
    expect(entry).not.toHaveProperty("secret");
    expect(entry).not.toHaveProperty("forcePowers");
    expect(entry).not.toHaveProperty("experience");
  }
  expect(result.roster.find((entry: { id: string }) => entry.id === "kelvek").era).toBe(147);
  expect(result.roster.find((entry: { id: string }) => entry.id === "aliyah-fel").designation).not.toMatch(/empress/i);
});
