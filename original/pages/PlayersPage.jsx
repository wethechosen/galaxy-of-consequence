import {useEffect,useRef,useState} from "react";
import {Link} from "react-router-dom";
import {MessageCircle,Upload,UserRound,Users,ShieldCheck} from "lucide-react";
import {useAuth} from "@/original/lib/AuthContext";
import {useGame} from "@/original/lib/GameContext";
import {Shell,TopBar,GlassCard} from "@/original/components/GalaxyUI";

function Portrait({entry,large=false}){
  const src=entry.imageHeadshot||entry.headshot||"";
  const cls=large?"w-28 h-28 rounded-2xl":"w-16 h-16 rounded-xl";
  return src?<img src={src} alt={entry.name+" headshot"} className={cls+" shrink-0 object-cover bg-white/5"}/>:
    <div className={cls+" shrink-0 bg-white/5 flex items-center justify-center"}>
      <UserRound size={large?35:24} className="text-[#5c6370]"/>
    </div>;
}
function Detail({entry,onClose,channel}){
  const npc=entry.kind==="npc";
  const image=entry.imageFullBody||entry.fullBody;
  return <GlassCard className="p-5 mb-6" >
    <div className="flex gap-5 items-start flex-wrap md:flex-nowrap">
      <Portrait entry={entry} large/>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] tracking-[.22em] text-[#ff9b50]">{npc?"ENCOUNTERED CHARACTER":"PUBLIC CHARACTER DOSSIER"}</p>
        <h2 className="gc-display text-xl text-[#f2f0ea] mt-1">{entry.name}</h2>
        <p className="text-xs text-[#a9adb8] mt-2">{entry.species||"Unknown"} · {entry.role||"Character"}{entry.homeworld?" · "+entry.homeworld:""}</p>
        {entry.level&&<p className="text-xs mt-2 text-[#e0dcd5]">LEVEL {entry.level}</p>}
        {entry.appearance&&<p className="mt-4 text-sm text-[#a9adb8]">{entry.appearance}</p>}
        {entry.background&&<p className="mt-3 text-sm text-[#c6c8d0]">{entry.background}</p>}
        {!npc&&entry.feats&&<p className="text-xs text-[#c6c8d0] mt-3"><span className="text-[#ff9b50]">FEATS </span>{entry.feats}</p>}
        {!npc&&entry.talents&&<p className="text-xs text-[#c6c8d0] mt-2"><span className="text-[#ff9b50]">TALENTS </span>{entry.talents}</p>}
        {npc&&<p className="text-xs text-[#8b93a3] mt-3">Present in the current saved scene. Private GM facts and undiscovered abilities are concealed.</p>}
        <div className="flex flex-wrap gap-3 mt-4">
          {channel&&<Link to={"/comms?channel="+encodeURIComponent(channel)} className="gc-btn px-4 py-2 text-xs flex items-center gap-2"><MessageCircle size={14}/> OPEN COMMS</Link>}
          <button onClick={onClose} className="gc-btn px-4 py-2 text-xs">CLOSE SHEET</button>
        </div>
      </div>
      {image&&<img src={image} alt={entry.name+" full body"} className="max-h-80 max-w-48 object-contain rounded-xl"/>}
    </div>
  </GlassCard>;
}
export default function PlayersPage(){
  const {user}=useAuth();
  const {character,gameState,updateCharacterField}=useGame();
  const fileRef=useRef(null);
  const [directory,setDirectory]=useState({players:[],npcPlayers:[],sceneLocation:""});
  const [selected,setSelected]=useState(null);
  const [issue,setIssue]=useState("");
  const revision=Array.isArray(gameState?.turnEvents)?gameState.turnEvents.length:0;
  useEffect(()=>{
    const abort=new AbortController();
    fetch("/api/player/roster",{cache:"no-store",signal:abort.signal})
      .then(r=>{if(!r.ok)throw Error("Unable to retrieve the saved roster");return r.json();})
      .then(data=>{setDirectory({players:data.players||[],npcPlayers:data.npcPlayers||[],sceneLocation:data.sceneLocation||""});setIssue("");})
      .catch(error=>{if(!abort.signal.aborted)setIssue(error.message||"Roster unavailable");});
    return ()=>abort.abort();
  },[user?.email,gameState?.location,revision]);
  function uploadHeadshot(event){
    const file=event.target.files?.[0];
    if(!file||!file.type.startsWith("image/"))return;
    const reader=new FileReader();
    reader.onload=()=>updateCharacterField("imageHeadshot",reader.result);
    reader.readAsDataURL(file);
  }
  const contacts=Array.isArray(gameState?.contacts)?gameState.contacts:[];
  const getChannel=(entry)=>{
    const contact=contacts.find(c=>(c.name===entry.name || c.playerAccountId===entry.accountId) &&
      typeof c.channel==="string" && /^(npc|player):/.test(c.channel));
    return contact?.channel||null;
  };
  const all=[...directory.players,...directory.npcPlayers];
  const visibleSelected=all.find(n=>n.id===selected);
  return <Shell>
    <TopBar character={character} gameState={gameState}/>
    <main className="flex-1 min-h-0 overflow-y-auto m-3 gc-glass rounded-2xl p-6">
      <p className="text-[10px] tracking-[.2em] text-[#ff7a1a] mb-2">PLAYERS & PRESENT CHARACTERS</p>
      <h1 className="gc-display text-3xl font-bold text-[#f2f0ea]">CHARACTER ROSTER</h1>
      <p className="text-sm text-[#8b93a3] mt-2 mb-5">Public character sheets for registered players, plus NPCs established in your current room. GM-only dossiers stay private.</p>
      {issue&&<p className="text-xs text-[#ff9b50] mb-3">{issue}</p>}
      {visibleSelected&&<Detail entry={visibleSelected} onClose={()=>setSelected(null)} channel={getChannel(visibleSelected)}/>}
      <div className="flex items-center gap-2 mb-4">
        <Users size={16} className="text-[#ff9b50]"/>
        <h2 className="text-lg text-[#eeeae3] font-semibold">PLAYER CHARACTERS</h2>
        <span className="text-xs text-[#858995]">{directory.players.length}</span>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 mb-9">
        {directory.players.map(entry=><GlassCard key={entry.id} className="p-5">
          <div className="flex items-start gap-3">
            <Portrait entry={entry}/>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-[#f2f0ea]">{entry.name}</p>
              <p className="text-xs text-[#9ca1ac]">{entry.species} · {entry.role} · Level {entry.level||1}</p>
              <p className="text-[10px] text-[#777d89] mt-2">PLAYER CHARACTER</p>
            </div>
          </div>
          {entry.appearance&&<p className="mt-4 text-xs text-[#afb1b9] line-clamp-2">{entry.appearance}</p>}
          <div className="flex flex-wrap gap-2 mt-4">
            <button onClick={()=>setSelected(entry.id)} className="gc-btn px-3 py-2 text-xs">VIEW CHARACTER SHEET</button>
            {getChannel(entry)&&<Link to={"/comms?channel="+encodeURIComponent(getChannel(entry))} className="gc-btn px-3 py-2 text-xs">COMLINK</Link>}
            {entry.accountId===user?.id&&<button onClick={()=>fileRef.current?.click()} className="gc-btn px-3 py-2 text-xs flex gap-1.5 items-center"><Upload size={12}/> PORTRAIT</button>}
          </div>
        </GlassCard>)}
      </div>
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck size={16} className="text-[#ff9b50]"/>
        <h2 className="text-lg text-[#eeeae3] font-semibold">IN YOUR SCENE</h2>
        <span className="text-xs text-[#858995]">{directory.npcPlayers.length}</span>
      </div>
      {directory.sceneLocation&&<p className="text-xs text-[#858995] mb-4">Location: {directory.sceneLocation}</p>}
      {directory.npcPlayers.length===0&&<p className="text-sm text-[#8b93a3]">No named NPCs have been confirmed as present in your saved scene.</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {directory.npcPlayers.map(entry=><GlassCard key={entry.id} className="p-5">
          <div className="flex items-start gap-3">
            <Portrait entry={entry}/>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-[#f2f0ea]">{entry.name}</p>
              <p className="text-xs text-[#9ca1ac]">{entry.species} · {entry.role}</p>
              <p className="text-[10px] text-[#ff9b50] mt-2">NPC · PRESENT</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap mt-4">
            <button onClick={()=>setSelected(entry.id)} className="gc-btn px-3 py-2 text-xs">VIEW CHARACTER SHEET</button>
            {getChannel(entry)&&<Link to={"/comms?channel="+encodeURIComponent(getChannel(entry))} className="gc-btn px-3 py-2 text-xs">COMLINK</Link>}
          </div>
        </GlassCard>)}
      </div>
      <input ref={fileRef} type="file" accept="image/*" onChange={uploadHeadshot} className="hidden"/>
    </main>
  </Shell>;
}
