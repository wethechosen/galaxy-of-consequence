import {NextResponse} from "next/server";
import {requireAccount,listAccounts} from "@/lib/accounts";
import {assertLocalRequest} from "@/lib/local-http";
import {readDatapad} from "@/lib/datapad-save";
import {hostedPersistenceEnabled} from "@/lib/hosted-bridge";
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
    const players=[];
    let viewerSnapshot=null;
    if(hosted){
      // Only public character fields cross the database boundary. The viewer
      // alone receives their current scene and most recent GM message.
      const rows=await neonQuery<{id:string;character:Record<string,unknown>;gameState:Record<string,unknown>|null;messages:unknown[]|null}>(
        `SELECT a.id::text, jsonb_build_object(
          'name',s.snapshot->'character'->'name','species',s.snapshot->'character'->'species',
          'heroicClass',s.snapshot->'character'->'heroicClass','level',s.snapshot->'character'->'level',
          'homeworld',s.snapshot->'character'->'homeworld','appearance',s.snapshot->'character'->'appearance',
          'publicBio',s.snapshot->'character'->'publicBio',
          'background',CASE WHEN a.id::text=$1 THEN s.snapshot->'character'->'background' ELSE NULL END,
          'talents',s.snapshot->'character'->'talents','feats',s.snapshot->'character'->'feats',
          'imageHeadshot',s.snapshot->'character'->'imageHeadshot','imageFullBody',s.snapshot->'character'->'imageFullBody'
        ) AS character,
        CASE WHEN a.id::text=$1 THEN jsonb_build_object('location',s.snapshot->'gameState'->'location',
          'scene',s.snapshot->'gameState'->'scene','sceneNpcs',s.snapshot->'gameState'->'sceneNpcs') END AS "gameState",
        CASE WHEN a.id::text=$1 THEN (SELECT jsonb_agg(recent.value) FROM
          (SELECT value FROM jsonb_array_elements(COALESCE(s.snapshot->'messages','[]'::jsonb)) WITH ORDINALITY m(value,n)
           WHERE value->>'role'='assistant' ORDER BY n DESC LIMIT 1) recent) END AS messages
        FROM private.goc_web_accounts a JOIN private.goc_datapad_saves s ON s.account_id=a.id::text
        WHERE a.role='player' ORDER BY a.username LIMIT 100`,[viewer.id]);
      for(const row of rows){
        if(!String(row.character?.name||"").trim())continue;
        const mine=row.id===viewer.id;
        if(mine)viewerSnapshot={character:row.character,gameState:row.gameState||{},messages:row.messages||[],comms:[],settings:{}};
        players.push(publicPcSheet(row.character,row.id,mine));
      }
    }else{
      for(const account of listAccounts().filter(a=>a.role==="player")){
        const snapshot=readDatapad(account,null).snapshot;
        if(!snapshot?.character||!String(snapshot.character.name||"").trim())continue;
        const mine=account.id===viewer.id;
        if(mine)viewerSnapshot=snapshot;
        players.push(publicPcSheet(snapshot.character,account.id,mine));
      }
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
