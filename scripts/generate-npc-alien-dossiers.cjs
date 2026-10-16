const fs=require("node:fs"),path=require("node:path"),Module=require("node:module"),ts=require("typescript");
const input=path.resolve(__dirname,"../lib/npc-alien-story-ratings.ts");
const output=path.resolve(__dirname,"../docs/npc-alien-stories-150ABY.md");
const code=ts.transpileModule(fs.readFileSync(input,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod=new Module(input,module);mod.filename=input;mod.paths=module.paths;mod._compile(code,input);
const data=mod.exports.GOC_ALIEN_STORY_RATINGS;
const lines=[
"# Galaxy of Consequence | Alien NPC story dossiers","",
"## 150 ABY campaign (Kelvek's flashback takes place in 147 ABY)","",
"These stories adapt the original user-supplied GOC supplements to the confirmed 150 ABY campaign. The source documents' potential 200 ABY titles, powers and careers are not automatically transferred to 150 ABY.","",
"**Rules status:** Levels, abilities, skills, talents and Force powers are proposed GM character ratings, NOT fully committed mechanical builds. The actual save and validated advancement engine control all outcomes. No Human racial bonus applies. Mirialan and Kiffar web rules are fan-created and are not enabled as mechanics.","",
"## Character rating overview","",
"| Name | Species | Year | Proposed level | Class | Force | STR | DEX | CON | INT | WIS | CHA | Rules |",
"|---|---|---:|---:|---|---|---:|---:|---:|---:|---:|---:|---|"
];
for(const n of data){
 lines.push("| "+[n.name,n.species,n.eraABY,n.level,n.heroicClass,n.force,n.strength,n.dexterity,n.constitution,n.intelligence,n.wisdom,n.charisma,n.speciesRules].join(" | ")+" |");
}
lines.push("","## The 17 individual story campaigns","");
for(const n of data){
 lines.push(
 "### "+n.name+" — "+n.role+" (proposed level "+n.level+" "+n.heroicClass+")","",
 "**Allegiance:** "+n.allegiance+". **Species:** "+n.species+". **Era:** "+n.eraABY+" ABY. **Force:** "+n.force+".","",
 "**Origin:** "+n.origin,"",
 "**First chapter:** "+n.firstAct,"",
 "**Second chapter:** "+n.secondAct,"",
 "**Long-term campaign:** "+n.longArc,"",
 "**Flaw:** "+n.flaw,"",
 "**Ability ratings:** STR "+n.strength+", DEX "+n.dexterity+", CON "+n.constitution+", INT "+n.intelligence+", WIS "+n.wisdom+", CHA "+n.charisma+".",
 "**Skill focus:** "+n.skills.join(", ")+". **Talent direction:** "+n.talentDirection+".",
 "**Force powers (candidate only):** "+(n.forcePowerDirection.join(", ")||"None")+".",
 "**Species bonuses proposed for later rules validation:** "+(Object.entries(n.speciesModifiers).map(([k,v])=>k+" "+(v>=0?"+":"")+v).join(", ")||"None")+". **Biology:** "+n.specialTraits.join("; ")+".",""
 );
}
lines.push("## Campaign safety rules","","- Proposed ratings never auto-grant levels, XP, feats, skills, powers, equipment or rank.","- Each species needs verified racial traits and a full Saga foundation before these levels become mechanical.","- Kelvek exists here only as a 147 ABY flashback; his later established death is untouched.","- The 34 real NPC save campaigns remain separate from D'mir's primary continuity.","");
fs.writeFileSync(output,lines.join("\n"),"utf8");
console.log("Created "+output+" from "+data.length+" NPCs");
