import {NextResponse} from "next/server";
import {requireAccount,listAccounts} from "@/lib/accounts";
import {assertLocalRequest} from "@/lib/local-http";
import {readDatapad} from "@/lib/datapad-save";
import {hostedPersistenceEnabled,hostedGet} from "@/lib/hosted-bridge";
import {publicPcSheet,sceneNpcSheets} from "@/lib/player-scene-roster";
import {neonQuery} from "@/lib/neon-db";
export const runtime="nodejs";
export const dynamic="force-dynamic";

/** Public sheets for existing players and only the current scene's NPCs. */
export async function GET(request:Request){
  try{
    assertLocalRequest(request);
    const viewer=requireAccount(request);
    const hosted=hostedPersistenceEnabled();
    const accounts=hosted
      ? await neonQuery<{id:string;username:string;displayName:string;role:"player"}>(
          `SELECT id::text, username, display_name AS "displayName", role
           FROM private.goc_web_accounts WHERE role = $1 ORDER BY username LIMIT 100`,["player"])
      : listAccounts().filter(a=>a.role==="player");
    const players=[];
    let viewerSnapshot=null;
    for(const account of accounts){
      const snapshot=hosted?(await hostedGet(account.username))?.snapshot:
        readDatapad(account,null).snapshot;
      if(!snapshot?.character||!String(snapshot.character.name||"").trim())continue;
      const mine=account.id===viewer.id;
      if(mine)viewerSnapshot=snapshot;
      players.push(publicPcSheet(snapshot.character,account.id,mine));
    }
    const npcPlayers=viewerSnapshot?sceneNpcSheets(viewerSnapshot):[];
    return NextResponse.json({players,npcPlayers,
      sceneLocation:viewerSnapshot?.gameState.location||"",view:"player-visible"},
      {headers:{"Cache-Control":"private, no-store"}});
  }catch(error){
    const status=/sign in/i.test(String(error))?401:403;
    return NextResponse.json({error:"Unable to read your visible character roster."},{status,
      headers:{"Cache-Control":"no-store"}});
  }
}
