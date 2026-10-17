import React from "react";

/** Provisional full-body costume studies. These are concept art, not earned equipment or canonical gear. */
const REFERENCES = {
  "jena-lorr": {skin:"#b77a5e",hair:"#241d22",coat:"#34353b",trim:"#c9a27e",style:"audit"},
  "orlan-vale": {skin:"#bb8e6b",hair:"#77777b",coat:"#555746",trim:"#9ca19c",style:"veteran"},
  "ari-vess": {skin:"#c2a081",hair:"#28282b",coat:"#526b4d",trim:"#d6aa66",style:"salvage"},
  "mirren-sol": {skin:"#ab805e",hair:"#2c2425",coat:"#77745a",trim:"#a8a28e",style:"survey"},
  "torin-kade": {skin:"#a9785c",hair:"#211e21",coat:"#2f526b",trim:"#a1aebb",style:"shipyard"},
  "lenna-fen": {skin:"#9f765c",hair:"#292426",coat:"#6a5849",trim:"#c9cacc",style:"medic"},
  "tesa-norr": {skin:"#b28368",hair:"#302a2d",coat:"#59626b",trim:"#b7a996",style:"quartermaster"},
  "bren-varo": {skin:"#936341",hair:"#392e2a",coat:"#a38a60",trim:"#d9c49f",style:"guide"},
  "sorin-pell": {skin:"#bb997c",hair:"#77747b",coat:"#292b32",trim:"#c1bcae",style:"archive"},
  "calen-vardex": {skin:"#b99379",hair:"#33363a",coat:"#252f46",trim:"#c4cbd5",style:"governor"},
};
export default function NpcFullBodyCard({id,name}) {
  const v=REFERENCES[id]||{skin:"#9d7764",hair:"#343038",coat:"#3a4853",trim:"#afaa9d",style:"general"};
  const ink="#171b24", key="body-"+String(id).replace(/[^a-z0-9-]/gi,"");
  const cloaked=["guide","archive"].includes(v.style);
  const isUniform=["veteran","quartermaster","governor"].includes(v.style);
  return <svg role="img" aria-label={`Provisional full-body clothing concept for ${name}; not confirmed gear`} viewBox="0 0 220 420" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto rounded-xl">
    <defs>
      <linearGradient id={key+"-bg"} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#252c38"/><stop offset="1" stopColor="#10141d"/></linearGradient>
      <linearGradient id={key+"-cloth"} x1="0" y1="0" x2="1" y2="1"><stop stopColor={v.coat}/><stop offset="1" stopColor={ink}/></linearGradient>
    </defs>
    <rect width="220" height="420" fill={`url(#${key}-bg)`}/>
    <path d="M22 32 H198 M22 387 H198" stroke={v.trim} strokeOpacity=".5"/>
    <circle cx="110" cy="133" r="89" fill={v.trim} opacity=".07"/>
    <path d="M79 246 L102 252 L102 364 L84 374 L72 364 Z M118 253 L143 247 L149 365 L135 375 L115 364 Z" fill="#303541" stroke={v.trim} strokeOpacity=".32"/>
    <path d="M67 363 L101 362 L105 388 L72 389 Q62 382 67 363 Z M115 362 L152 363 L156 387 L120 389 Q110 383 115 362 Z" fill="#181a22" stroke={v.trim} strokeWidth="1.3"/>
    {cloaked&&<path d="M78 142 Q48 163 40 324 L59 352 L91 225 M140 142 Q172 170 181 341 L156 355 L134 227" fill={v.coat} stroke={v.trim} strokeOpacity=".35"/>}
    <path d="M84 143 Q70 145 61 160 L66 261 Q87 276 112 267 Q138 276 155 257 L159 161 Q151 149 135 143 Z" fill={`url(#${key}-cloth)`} stroke={v.trim} strokeOpacity=".55"/>
    <path d="M72 156 Q56 165 49 189 L36 262 Q39 273 48 276 L58 272 L83 200 Z M147 157 Q163 168 171 196 L185 264 Q181 273 171 277 L162 273 L138 202 Z" fill={v.coat} stroke={v.trim} strokeOpacity=".4"/>
    <ellipse cx="45" cy="279" rx="10" ry="16" fill={v.skin}/><ellipse cx="175" cy="279" rx="10" ry="16" fill={v.skin}/>
    <path d="M83 148 L108 181 L137 147" fill="none" stroke={v.trim} strokeWidth="2" strokeOpacity=".75"/>
    <path d="M70 228 Q110 240 153 228 L151 241 Q113 251 69 241 Z" fill="#202431" stroke={v.trim} strokeWidth="2"/>
    <rect x="101" y="230" width="20" height="12" rx="2" fill={v.trim}/>
    {["salvage","shipyard","survey","guide"].includes(v.style)&&<><path d="M72 174 L90 177 L90 199 L72 196 M131 176 L149 175 L149 199 L132 199" fill="none" stroke={v.trim} strokeWidth="1.5"/><path d="M86 248 L77 268 M137 248 L144 272" stroke={v.trim} strokeWidth="3"/></>}
    {isUniform&&<><path d="M96 160 H131 M99 167 H124" stroke={v.trim} strokeWidth="2"/><rect x="134" y="183" width="15" height="8" rx="1" fill={v.trim} opacity=".55"/></>}
    {v.style==="medic"&&<><circle cx="141" cy="184" r="8" fill={v.trim}/><path d="M141 179 V189 M136 184 H146" stroke="#26292d" strokeWidth="2"/></>}
    {v.style==="audit"&&<path d="M82 154 L85 272 M142 152 L135 271" stroke={v.trim} strokeWidth="2" strokeOpacity=".5"/>}
    {v.style==="guide"&&<path d="M54 159 Q111 111 165 160 L173 199 L153 201 Q146 165 110 167 Q73 167 68 201 L48 197 Z" fill={v.coat} stroke={v.trim}/>}
    <path d="M93 125 L94 149 Q109 160 125 149 L126 125" fill={v.skin}/>
    <ellipse cx="110" cy="99" rx="36" ry="47" fill={v.skin} stroke="#1e2028" strokeWidth="1.6"/>
    <path d="M76 91 Q67 47 109 49 Q147 47 143 90 Q126 66 110 72 Q92 69 76 91 Z" fill={v.hair}/>
    {v.style==="medic"&&<path d="M77 85 Q106 60 143 83 L139 73 Q110 55 79 70 Z" fill="#918677" stroke={v.trim}/>}
    {v.style==="guide"&&<><path d="M75 88 H146 L148 100 H73 Z" fill="#474b4d"/><rect x="77" y="91" width="28" height="9" rx="3" fill="#827f67"/><rect x="113" y="91" width="28" height="9" rx="3" fill="#827f67"/></>}
    <path d="M88 103 H102 M118 103 H132" stroke="#24222a" strokeWidth="2.5" strokeLinecap="round"/>
    <path d="M111 105 L108 122 L116 122 M99 134 Q112 137 124 133" fill="none" stroke="#5d433d" strokeWidth="1.7"/>
    {v.style==="archive"&&<path d="M91 137 Q110 155 130 137" stroke={v.hair} strokeWidth="10" fill="none" opacity=".7"/>}
    {v.style==="veteran"&&<rect x="170" y="254" width="10" height="18" rx="2" fill="#a4a9a8"/>}
    <text x="110" y="404" textAnchor="middle" fill="#d4d1c8" fontSize="9" fontFamily="monospace" letterSpacing="2">COSTUME STUDY · UNVERIFIED</text>
  </svg>;
}
