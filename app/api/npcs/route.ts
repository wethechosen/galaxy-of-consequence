import {NextResponse} from "next/server";
import {requireAccount} from "@/lib/accounts";
import {assertLocalRequest} from "@/lib/local-http";
import {NPC_TEST_ROSTER} from "@/lib/npc-test-roster";
import {CAMPAIGN_NPCS_150_ABY} from "@/lib/npc-canon-roster";
import {DMIR_STORY_NPCS} from "@/lib/dmir-story-npcs";
import {CHARACTER_VISUAL_DOSSIERS} from "@/lib/character-visual-dossiers";
import {CHARACTER_REFERENCE_SHEETS} from "@/lib/character-reference-sheets";
export const runtime="nodejs";
export const dynamic="force-dynamic";
/** GM PRIVATE: character containers, plots and confidential facts. */
export async function GET(request:Request){
  try{
    assertLocalRequest(request);
    requireAccount(request,true);
    const roster=[
      ...NPC_TEST_ROSTER.map(n=>({
        id:n.id,name:n.name,species:n.species,homeworld:n.homeworld,
        designation:n.role,era:n.yearABY,category:"test",description:n.background,
        objective:n.objective,visualDossier:CHARACTER_VISUAL_DOSSIERS[n.id]||null,
        playthroughStatus:"unverified",gmOnly:true,
      })),
      ...CAMPAIGN_NPCS_150_ABY.map(n=>({
        id:n.id,name:n.name,species:n.species,homeworld:n.birthworld,
        designation:n.role150,era:150,category:"cast",description:n.biography,
        objective:n.objective,secret:n.confidential,eraCorrection:n.revision,
        visualDossier:CHARACTER_VISUAL_DOSSIERS[n.id]||null,
        playthroughStatus:"unverified",gmOnly:true,
      })),
      ...DMIR_STORY_NPCS.map(n=>({
        id:"story-"+n.id,name:n.name,species:n.species,
        homeworld:"GM location: "+n.locationHint,designation:n.role,era:150,
        category:"story",description:n.background,objective:n.objective,
        secret:n.privateKnowledge,plot:n.arc,encounterRules:n.allowedEncounter,
        status:n.status,playthroughStatus:"unverified",gmOnly:true,
      })),
    ];
    return NextResponse.json({roster,referenceSheets:CHARACTER_REFERENCE_SHEETS,endingCountVerified:0,visibility:"gm-only"},
      {headers:{"Cache-Control":"private, no-store"}});
  }catch{
    return NextResponse.json({error:"GM authorization required."},{status:403,
      headers:{"Cache-Control":"no-store"}});
  }
}
