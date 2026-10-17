import React from "react";

/** A deliberately stylized, provisional visual-reference sketch, NOT a generated face portrait. */
const norm = value => String(value || "").toLowerCase();
const hash = id => [...String(id)].reduce((v,c)=>(v*31+c.charCodeAt(0))>>>0,17);
const palette = (species,id) => {
  const s=norm(species); const seed=hash(id);
  const skin = s.includes("chiss") ? "#276aaf" : s.includes("zeltron") ? "#bc5289" :
    s.includes("twi'lek") ? "#6351ad" : s.includes("rodian") ? "#6b9b55" :
    s.includes("falleen") ? "#367b69" : s.includes("mirialan") ? "#839761" :
    s.includes("duros") ? "#4c9aa2" : s.includes("zabrak") ? "#af7b4f" :
    s.includes("ithorian") ? "#7a947b" : s.includes("sullustan") ? "#b0826a" :
    s.includes("aqualish") ? "#896f67" : s.includes("bothan") ? "#a67a53" :
    s.includes("muun") ? "#b6b7a4" : s.includes("togruta") ? "#bf7954" :
    ["#986443","#b97752","#c39a74","#917464","#694a38"][seed % 5];
  const cloth = ["#313849","#505b4b","#463e50","#343838","#52473b"][seed%5];
  const backdrop = ["#151b28","#253039","#292b3c","#243238","#352924"][seed%5];
  return {skin,cloth,backdrop,trim:["#ca9f55","#86afb1","#cb8866"][seed%3]};
};
export default function NpcVisualCard({id,name,species,role,wide=false}) {
  const s=norm(species),c=palette(species,id),h=hash(id);
  const narrow=s.includes("muun"), wideHead=s.includes("ithorian");
  const isDuro=s.includes("duros"),isRodian=s.includes("rodian");
  const isTwi=s.includes("twi'lek"),isTogruta=s.includes("togruta");
  const isZabrak=s.includes("zabrak"),isAqualish=s.includes("aqualish");
  const isBothan=s.includes("bothan"),isSull=s.includes("sullustan");
  const blueEyes=s.includes("chiss"),hasHair=s.includes("human")||s.includes("kiffar")||s.includes("mirialan")||s.includes("zeltron");
  const eid="npc-art-"+String(id).replace(/[^a-z0-9-]/gi,"");
  const noFace=s.includes("unconfirmed");
  return <svg role="img" aria-label={`Provisional visual reference for ${name}, ${species}, ${role}; not a confirmed in-game portrait`} viewBox="0 0 300 330"
    className={wide?"w-full max-w-sm rounded-xl":"w-full h-auto rounded-lg"} xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id={eid+"-bg"} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor={c.backdrop}/><stop offset="1" stopColor="#101217"/>
    </linearGradient><linearGradient id={eid+"-coat"} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor={c.cloth}/><stop offset="1" stopColor="#171820"/>
    </linearGradient></defs>
    <rect width="300" height="330" fill={`url(#${eid}-bg)`}/>
    {Array.from({length:9},(_,i)=><g key={i} opacity=".14" stroke={c.trim} strokeWidth=".7">
      <path d={`M${-20+i*44} 0 V330 M0 ${12+i*42} H300`}/></g>)}
    <circle cx="150" cy="120" r="88" fill={c.trim} opacity=".10"/>
    <path d="M40 330 Q35 228 94 210 Q119 196 125 174 H175 Q182 196 206 210 Q265 226 260 330 Z"
      fill={`url(#${eid}-coat)`} stroke={c.trim} strokeOpacity=".55" strokeWidth="2"/>
    <path d="M127 176 L150 226 L172 176" fill="#18181c" stroke={c.trim} strokeOpacity=".65" strokeWidth="2"/>
    <path d="M87 230 L118 330 M213 230 L182 330" stroke={c.trim} strokeWidth="1.5" strokeOpacity=".35"/>
    {!noFace&&<>
      {isTwi&&<><path d="M117 86 Q61 119 78 216 Q98 220 107 196 L132 109" fill={c.skin}/>
        <path d="M183 86 Q232 139 211 217 Q195 216 190 182 L170 106" fill={c.skin}/></>}
      {isTogruta&&<><path d="M117 77 Q100 21 118 14 L141 76 M183 77 Q203 22 181 13 L159 76"
        fill="#dddacb" stroke="#6c7891" strokeWidth="6"/><path d="M105 85 Q57 135 97 218 M195 85 Q238 143 205 220"
        fill="none" stroke="#e5dac2" strokeWidth="20"/><path d="M97 95 L102 119 M200 99 L198 119"
        stroke="#384e69" strokeWidth="10"/></>}
      {isZabrak&&Array.from({length:5},(_,i)=><path key={i} d={`M${112+i*19} 73 L${108+i*19} ${42+(i%2)*13} L${123+i*18} 70`} fill="#926a54" stroke="#462f2d" strokeWidth="2"/>)}
      {wideHead&&<><rect x="42" y="82" width="215" height="62" rx="30" fill={c.skin}/>
        <circle cx="53" cy="99" r="12" fill={c.skin}/><circle cx="245" cy="99" r="12" fill={c.skin}/></>}
      <ellipse cx="150" cy="113" rx={wideHead?53:narrow?37:isDuro?56:isRodian?44:47}
        ry={narrow?78:isDuro?63:64} fill={c.skin} stroke="#080a0a" strokeOpacity=".25"/>
      {hasHair&&<path d="M102 95 Q94 40 146 47 Q204 44 199 95 Q178 63 156 75 Q120 69 102 95" fill={h%2?"#181920":"#29211d"}/>}
      {isRodian&&<><path d="M124 81 L115 43 M175 81 L187 44" stroke={c.skin} strokeWidth="9" strokeLinecap="round"/>
        <ellipse cx="150" cy="140" rx="18" ry="31" fill={c.skin} stroke="#2c4438" strokeWidth="2"/></>}
      {isBothan&&<path d="M106 72 L90 102 L108 138 M195 73 L210 101 L191 139" fill="none" stroke={c.skin} strokeWidth="17"/>}
      {isAqualish&&<><circle cx="116" cy="126" r="7" fill="#43383e"/><circle cx="184" cy="126" r="7" fill="#43383e"/>
        <path d="M125 153 Q138 178 150 163 Q164 177 176 153" fill="#4e4649" stroke="#dac3ab" strokeWidth="5"/></>}
      {isSull&&<><ellipse cx="111" cy="151" rx="19" ry="14" fill={c.skin}/><ellipse cx="190" cy="151" rx="19" ry="14" fill={c.skin}/></>}
      <ellipse cx="129" cy="116" rx={isDuro?15:blueEyes?10:8} ry={isDuro?17:9} fill={blueEyes?"#db676a":isDuro?"#b75852":"#161c1f"}/>
      <ellipse cx="170" cy="116" rx={isDuro?15:blueEyes?10:8} ry={isDuro?17:9} fill={blueEyes?"#db676a":isDuro?"#b75852":"#161c1f"}/>
      {!isRodian&&<path d="M146 126 L142 145 L155 146 M136 163 Q150 169 165 162" fill="none" stroke="#4a3432" strokeWidth="3" strokeLinecap="round"/>}
      {(s.includes("kiffar")||s.includes("mirialan"))&&<path d="M115 97 L124 89 L130 99" fill="none" stroke="#dfc356" strokeWidth="4"/>}
    </>}
    {noFace&&<><ellipse cx="150" cy="120" rx="49" ry="63" fill="#161b20" stroke={c.trim} strokeWidth="2" strokeDasharray="4 5"/>
      <text x="150" y="117" textAnchor="middle" fill={c.trim} fontSize="30">?</text></>}
    <rect x="0" y="280" width="300" height="50" fill="#080b10" opacity=".91"/>
    <path d="M16 285 H284" stroke={c.trim} strokeWidth="2"/>
    <text x="18" y="306" fill="#f4f2ec" fontSize="13" fontWeight="600" letterSpacing=".8">{String(name||"").slice(0,26)}</text>
    <text x="18" y="320" fill={c.trim} fontSize="8" letterSpacing="1">VISUAL STUDY · PROVISIONAL · {species}</text>
  </svg>;
}
