import {NextResponse} from "next/server";
import {requireAccount} from "@/lib/accounts";
import {assertLocalRequest} from "@/lib/local-http";
import {NPC_TEST_ROSTER} from "@/lib/npc-test-roster";
import {CAMPAIGN_NPCS_150_ABY} from "@/lib/npc-canon-roster";
import {DMIR_STORY_NPCS} from "@/lib/dmir-story-npcs";
import {SERALYTH_ID,SERALYTH_SAGA_SHEET,SERALYTH_GM_DOSSIER,SERALYTH_HAPES_OPENING} from "@/lib/seralyth-vhaelor";
import {npcVisualReference} from "@/lib/npc-visual-reference";
import {npcVerifiedLocalEnding,NPC_VERIFIED_LOCAL_ENDINGS} from "@/lib/npc-audited-ending-ledger";
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
        designation:n.role,era:n.yearABY,category:n.id==="kelvek"?"story":"test",description:n.background,
        objective:n.objective,appearance:n.appearance,
        visualReference:npcVisualReference(n.id,n.appearance,n.role,n.species),
        visualReferenceType:"provisional-vector-study",
        playthroughStatus:npcVerifiedLocalEnding(n.id)?"goal_complete":"unverified",
        auditedEnding:npcVerifiedLocalEnding(n.id),gmOnly:true,
      })),
      ...CAMPAIGN_NPCS_150_ABY.map(n=>({
        id:n.id,name:n.name,species:n.species,homeworld:n.birthworld,
        designation:n.role150,era:150,category:n.id==="calen-vardex"?"test":"cast",description:n.biography,
        objective:n.objective,secret:n.confidential,eraCorrection:n.revision,
        visualReference:npcVisualReference(n.id,n.biography,n.role150,n.species),
        visualReferenceType:"provisional-vector-study",
        playthroughStatus:"unverified",gmOnly:true,
      })),
      ...DMIR_STORY_NPCS.map(n=>({
        id:"story-"+n.id,name:n.name,species:n.species,
        homeworld:"GM location: "+n.locationHint,designation:n.role,era:150,
        category:"story",description:n.background,objective:n.objective,
        secret:n.privateKnowledge,plot:n.arc,encounterRules:n.allowedEncounter,
        status:n.status,playthroughStatus:"unverified",gmOnly:true,
        visualReference:npcVisualReference(n.id,n.persona,n.role,n.species),
        visualReferenceType:"provisional-vector-study",
        sagaSheet:n.id===SERALYTH_ID?SERALYTH_SAGA_SHEET:null,
        gmDossier:n.id===SERALYTH_ID?SERALYTH_GM_DOSSIER:null,
        initialScene:n.id===SERALYTH_ID?SERALYTH_HAPES_OPENING:null,
      })),
    ];
    return NextResponse.json({roster,
      endingCountVerified:Object.keys(NPC_VERIFIED_LOCAL_ENDINGS).length,
      endingEvidenceScope:"audited-isolated-live-playthroughs-not-hosted-saves",visibility:"gm-only"},
      {headers:{"Cache-Control":"private, no-store"}});
  }catch{
    return NextResponse.json({error:"GM authorization required."},{status:403,
      headers:{"Cache-Control":"no-store"}});
  }
}
