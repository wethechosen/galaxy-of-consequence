import {NextResponse} from "next/server";
import {publicFactionAtlas} from "@/lib/faction-canon-150aby";
import {publicJediInstitution150} from "@/lib/jedi-order-150aby";
export const runtime="nodejs";
export const dynamic="force-dynamic";
/** Only setting-level public history; never secret organizations, members or planned operations. */
export async function GET(){
 return NextResponse.json({eraABY:150,scope:"public-atlas-not-a-verified-live-intelligence-report",
  factions:publicFactionAtlas(),jediOrder:publicJediInstitution150()}, {headers:{"Cache-Control":"public, max-age=0, must-revalidate"}});
}
