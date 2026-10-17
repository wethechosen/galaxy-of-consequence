/** Saved-scene NPC visibility, with no GM dossier or private player data. */
import type {DatapadSnapshot} from "./datapad-save";
import {DMIR_STORY_NPCS} from "./dmir-story-npcs";
import {NPC_TEST_ROSTER} from "./npc-test-roster";
import {CAMPAIGN_NPCS_150_ABY} from "./npc-canon-roster";
type Row=Record<string,unknown>;
const record=(v:unknown):v is Row=>!!v&&typeof v==="object"&&!Array.isArray(v);
const text=(v:unknown,n=220)=>typeof v==="string"?v.trim().slice(0,n):"";
const slug=(v:string)=>v.toLocaleLowerCase().replace(/[^a-z0-9]/g,"");
const canonical=[
  ...DMIR_STORY_NPCS.map(n=>({id:n.id,name:n.name,species:n.species,role:n.role,homeworld:"",appearance:""})),
  ...NPC_TEST_ROSTER.map(n=>({id:n.id,name:n.name,species:n.species,role:n.role,homeworld:n.homeworld,appearance:n.appearance})),
  ...CAMPAIGN_NPCS_150_ABY.map(n=>({id:n.id,name:n.name,species:n.species,role:n.role150,homeworld:n.birthworld,appearance:""})),
];
const absent=new Set(["The","His","Her","They","Your","You","Now","When","With","Before","After","This","That","There","Current","Star","Wars","Sith","Jedi"]);
function displayNpc(v:Row){
  const name=text(v.name,80);
  if(!name||DMIR_STORY_NPCS.some(n=>slug(n.name)===slug(name)&&n.status==="dead"))return null;
  const known=canonical.find(c=>slug(c.name)===slug(name));
  return {id:text(v.id,90)||"scene-"+slug(name),kind:"npc",
    name,species:text(v.species,75)||known?.species||"Unknown",
    role:text(v.role,110)||known?.role||"Character",
    homeworld:text(v.homeworld,110)||known?.homeworld||"",
    appearance:text(v.appearance,320)||known?.appearance||"",
    background:text(v.publicBio,500),imageHeadshot:text(v.imageHeadshot,2000),
    imageFullBody:text(v.imageFullBody,2000)};
}
export function sceneNpcRoster(state:Row){
  const location=text(state.location,300);
  const scene=record(state.scene)?state.scene:{};
  const entries=[
    ...(Array.isArray(state.sceneNpcs)?state.sceneNpcs:[]),
    ...(Array.isArray(scene.npcs)?scene.npcs:[]),
  ];
  const found=new Map<string,ReturnType<typeof displayNpc>>();
  for(const raw of entries){
    if(!record(raw))continue;
    const where=text(raw.location,300);
    if(where&&where!==location)continue;
    const p=displayNpc(raw);
    if(p)found.set(slug(p.name),p);
  }
  return [...found.values()].filter((item):item is NonNullable<typeof item>=>item!==null);
}
function presentText(narration:string){
  const scene=/##\s*SCENE\s*\n([\s\S]*?)(?=\n##\s|$)/i.exec(narration)?.[1]||"";
  const result=/##\s*GAMEPLAY RESULT\s*\n([\s\S]*?)(?=\n##\s|$)/i.exec(narration)?.[1]||"";
  return (scene+"\n"+result).slice(0,13000);
}
/** Add only visibly named participants from a validated GM scene; no free contacts. */
export function recordVisibleSceneNpcs(state:Row,narration:string,turnId:string){
  const result=presentText(narration);
  if(!result.trim())return state;
  const location=text(state.location,300);
  const participants=new Map<string,Row>();
  const add=(candidate:Row)=>{
    const display=displayNpc(candidate);
    if(display)participants.set(slug(display.name),{...display,location,turnId});
  };
  const roleMatcher=/(?:a|the)?\s*(clerk|attendant|captain|officer|pilot|merchant|vendor|registrar|tailor|engineer|technician|warden|receptionist|librarian|inspector|sergeant)\s+(?:named\s+)?([A-Z][a-z][A-Za-z'-]{1,24})(?=\s|[,.!:;?]|$)/gi;
  const contacts=Array.isArray(state.contacts)?state.contacts.filter(record):[];
  const already=sceneNpcRoster(state).filter(record);
  const candidates=[...canonical,...contacts,...already];
  for(const match of result.matchAll(roleMatcher)){
    const following=result.slice((match.index||0)+match[0].length).trimStart();
    if(!/^(?:stands|sits|waits|responds|replies|speaks|says|asks|nods|gestures|points|looks|walks|approaches|greets|puts|hands|offers|directs|is|turns)\b/i.test(following))continue;
    const role=match[1].toLowerCase();
    const surname=match[2];
    if(absent.has(surname))continue;
    const withTitle=role.slice(0,1).toUpperCase()+role.slice(1)+" "+surname;
    const known=candidates.find(c=>slug(String(c.name||""))===slug(withTitle))
      ||candidates.find(c=>slug(String(c.name||""))===slug(surname));
    const isTitle=role==="captain"||role==="sergeant";
    add({name:known?.name|| (isTitle?withTitle:surname),role:match[1]});
  }
  for(const raw of candidates){
    const name=text(raw.name,80);
    if(!name)continue;
    const escaped=name.replace(/[.*+?^$()|[\]{}\\]/g,"\\$&");
    const speaking=new RegExp("(?:^|[\\n.!?]\\s*|\\b(?:you|clerk|captain|pilot|officer|agent|attendant|the)\\s+)"+escaped+"(?:\\s+(?:says|replies|responds|asks|nods|gestures|stands|looks|turns|points|speaks|steps|approaches)|[,.:])","im");
    if(speaking.test(result))add(raw);
  }
  return {...state,sceneNpcs:[...participants.values()].slice(0,18)};
}
/** Never project private inventory, credits, secret objectives or hidden GM flags. */
export function publicPcSheet(character:Row,accountId:string,isSelf:boolean){
  return {id:"pc-"+accountId,accountId,kind:"player",
    name:text(character.name,85)||"Unnamed Player",species:text(character.species,70)||"Unknown",
    role:text(character.heroicClass||character.classId||character.className,80)||"Player Character",
    homeworld:text(character.homeworld,140),appearance:text(character.appearance,420),
    background:text(character.publicBio,540)||(isSelf?text(character.background,540):""),
    level:Number.isSafeInteger(Number(character.level))?Number(character.level):1,
    talents:text(character.talents,500),feats:text(character.feats,500),
    imageHeadshot:text(character.imageHeadshot,2_000_000),
    imageFullBody:text(character.imageFullBody,2_000_000)};
}
export function sceneNpcSheets(snapshot:DatapadSnapshot){
  const current=sceneNpcRoster(snapshot.gameState);
  if(current.length)return current;
  // Older saves predate the per-scene roster. Infer only from the latest
  // committed GM scene, and only when its LOCATION matches the saved room.
  const messages=Array.isArray(snapshot.messages)?snapshot.messages:[];
  const last=[...messages].reverse().find(message=>
    record(message)&&message.role==="assistant"&&typeof message.content==="string"&&
    /##\s*SCENE\b/i.test(message.content));
  if(!last || !record(last))return [];
  const narrative=String(last.content);
  const heading=/##\s*LOCATION\s*\n([^\n]+)/i.exec(narrative)?.[1]?.trim()||"";
  const saved=text(snapshot.gameState.location,300);
  const normalize=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]/g,"");
  if(!heading||normalize(heading)!==normalize(saved))return [];
  return sceneNpcRoster(recordVisibleSceneNpcs(snapshot.gameState,narrative,String(last.turnId||"legacy")));
}
