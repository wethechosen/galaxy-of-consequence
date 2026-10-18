import {NextResponse} from "next/server";
import {requireAccount} from "@/lib/accounts";
import {assertLocalRequest} from "@/lib/local-http";
import {GOC_FACTIONS_150_ABY,GOC_FACTION_MEMBERS,GOC_HIDDEN_FACTION_LINKS} from "@/lib/faction-canon-150aby";
import {GOC_NPC_INDEX_BY_ID} from "@/lib/npc-canonical-index";
export const runtime="nodejs";
export const dynamic="force-dynamic";
/** Private GM reference information, never public, no player-known implications. */
export async function GET(request:Request){
 try {
   assertLocalRequest(request);
   requireAccount(request,true);
   return NextResponse.json({eraABY:150,visibility:"gm-only",
     factions:GOC_FACTIONS_150_ABY,
     members:GOC_FACTION_MEMBERS.map(m=>({...m,name:GOC_NPC_INDEX_BY_ID.get(m.personId)?.name||m.personId})),
     hiddenLinks:GOC_HIDDEN_FACTION_LINKS,
     warnings:["A private GM dossier is not player knowledge.","Strategic plans do not grant or remove game resources.",
       "No official office, Force power, relationship, siege or war follows from faction importance alone."]},
     {headers:{"Cache-Control":"private, no-store"}});
 } catch {
   return NextResponse.json({error:"GM authorization required."},
    {status:403,headers:{"Cache-Control":"no-store"}});
 }
}
