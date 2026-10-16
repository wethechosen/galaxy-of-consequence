import { NextResponse } from "next/server";
import { NPC_TEST_ROSTER } from "@/lib/npc-test-roster";
import { CAMPAIGN_NPCS_150_ABY } from "@/lib/npc-canon-roster";
export const dynamic = "force-dynamic";
export async function GET() {
  const roster = [
    ...NPC_TEST_ROSTER.map(npc => ({ id: npc.id, name: npc.name, species: npc.species, homeworld: npc.homeworld,
      designation: npc.role, era: npc.yearABY, category: "test", description: npc.background,
      playthroughStatus: "unverified" })),
    ...CAMPAIGN_NPCS_150_ABY.map(npc => ({ id: npc.id, name: npc.name, species: npc.species, homeworld: npc.birthworld,
      designation: npc.role150, era: 150, category: "cast", description: npc.biography,
      playthroughStatus: "unverified" })),
  ];
  return NextResponse.json({ roster, endingCountVerified: 0 }, {headers:{"Cache-Control":"no-store"}});
}
