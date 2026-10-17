/** Decision context for real NPC PC turns.
 * A GM response can put GAMEPLAY RESULT thousands of characters after SCENE.
 * Never truncate the response before extracting its adjudicated result.
 */
export type NpcHistoryMessage={role?:unknown;content?:unknown};
const section=(text:string,title:string)=>{
  const escaped=title.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  const pattern=new RegExp("(?:^|\\n)##\\s*"+escaped+"\\s*\\n([\\s\\S]*?)(?=\\n##\\s+[A-Z ]+\\s*\\n|$)","i");
  return pattern.exec(text)?.[1]?.trim()||"";
};
export function npcGameplayResult(content:string):string {
  return section(String(content||""),"GAMEPLAY RESULT");
}
export function npcDecisionHistory(messages:readonly NpcHistoryMessage[],count=8):Array<{role:string;content:string}>{
  return messages.slice(-count).map(message=>{
    const role=String(message.role||"unknown");
    const raw=String(message.content||"");
    if(role!=="assistant")return {role,content:raw.slice(0,700)};
    const result=npcGameplayResult(raw);
    const check=section(raw,"SAGA CHECK");
    const update=section(raw,"STATE UPDATE");
    // Fail visibly if a legacy receipt has no structured result.
    return {role,content:result
      ? ["ACTUAL GM GAMEPLAY RESULT: "+result.slice(0,1300),
         check?"SAGA CHECK: "+check.slice(0,300):"",
         update?"STATE UPDATE: "+update.slice(0,400):""].filter(Boolean).join("\n")
      : "GM RECEIPT (unstructured): "+raw.slice(-1100)};
  });
}
export function npcAdministrativeLoopHint(recentActions:readonly string[],lastGm:string):string|null {
  const actions=recentActions.filter(Boolean).slice(-6);
  const inquiries=actions.filter(a=>/\b(?:ask|request|inquire|seek|confirm|verify|review)\b/i.test(a)
    && /\b(?:clerk|desk|office|form|approval|authorization|access|permit|registry|administrator|appointment|supervisor|officer)\b/i.test(a));
  if(inquiries.length<3)return null;
  const outcome=npcGameplayResult(lastGm)||lastGm;
  return [
    "LOOP WARNING: Three or more recent actions were administrative inquiries.",
    "Do NOT re-ask the same official or merely rephrase a request.",
    "Use only established leads and the actual last GM result to attempt a consequential next step:",
    "follow a documented lead, complete an available procedure, leave for another accessible source,",
    "or make one specific proposal and accept the GM's possible refusal.",
    "Do not assume authorization, bypass restricted access, invent contacts, or declare success.",
    "LAST RESOLVED RESULT: "+outcome.slice(0,900),
  ].join(" ");
}
