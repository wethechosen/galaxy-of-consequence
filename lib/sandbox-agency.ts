/**
 * Cross-sandbox GM agency rules. A character can lose a check or be refused,
 * but an ordinary scene must not become an artificial game-over or menu lock.
 * This validator NEVER grants a purchased service, bypass, success or reward.
 */
const ORDINARY = /\b(?:ask|inquire|request|speak|talk|approach|contact|appointment|consult|commission|buy|purchase|shop|hire|rent|travel|passage|visit|look|search|investigat\w*|explor\w*|find|seek|offer|meet|apply|book|arrange|schedule|register|submit|deliver|repair|quest|job|work)\b/i;
const DANGEROUS = /\b(?:attack|assassinat\w*|fight|kill|threaten|intimidat\w*|steal|rob|hack|slice|infiltrat|sneak|break into|force choke|force grip|disable security|plant bomb|combat|shoot|escape custody)\b/i;
const HARD_STOP = /\b(?:no (?:further |other |available )?(?:way|options?|leads?|routes?|appointments?|alternatives?)|nothing (?:more|else)|no one (?:will|can)|not possible|cannot|can't|refuses?|won't|not allowed|unable to|options? (?:are|is) limited|only options? (?:are|is)|must leave|leave .* and pursue|no commission terms|no introduction)\b/i;
const PATH = /\b(?:contact|speak to|meet with|approach|request (?:a|an|the)|submit|register|forward|refer|arrange|visit|find|apply|reach|investigate|look for|search for|deliver|leave a message|public registry|intake|concierge|liaison|director|office|guild|bureau|directory|petition|contract|side quest|intermediary)\b/i;
const CONTEXT = /\b(?:desk|counter|office|showroom|concierge|intake|registrar|liaison|director|guild|bureau|station|public records|service|registry|directory|commissioner|broker|transport authority|manager|permit|authority|business|depot|workshop|bank|archive|contact|intermediary|request|lead|contract)\b/i;
function block(text:string,title:string) {
  const marker="## "+title;
  const start=text.indexOf(marker);if(start<0)return "";
  const tail=text.slice(start+marker.length).trimStart();
  const end=tail.search(/\n## (?:LOCATION|SCENE|GM ADJUDICATION|GAMEPLAY RESULT|SAGA CHECK|STATE UPDATE|PLAYER OPTIONS)/);
  return (end<0?tail:tail.slice(0,end)).trim();
}
export function isOrdinarySandboxAttempt(action:string) {
  return ORDINARY.test(action) && !DANGEROUS.test(action);
}
export function isArtificialHardStop(narration:string,action:string) {
  if(!isOrdinarySandboxAttempt(action))return false;
  const result=block(narration,"GAMEPLAY RESULT");
  if(!HARD_STOP.test(result))return false;
  // An actionable source-specific lead or real obstruction is different from
  // simply telling a player to repeat the same failed question indefinitely.
  if(PATH.test(result) && CONTEXT.test(result)
     && !/\b(?:return to the (?:same|front) (?:counter|clerk)|ask the same (?:clerk|worker)|already attempted|already tried|try again|keep asking|repeat (?:the|your) request)\b/i.test(result))return false;
  return /\b(?:limited|only|nothing|no (?:way|options?|leads?)|cannot|can't|refuses?|won't|unable|must leave|no introduction)\b/i.test(result);
}
export function assertSandboxAgency(narration:string,action:string,roll:Record<string,unknown>|null,delta:Record<string,unknown>|null) {
  // Failed dice rolls still have consequences, but cannot be overwritten by this.
  if(roll?.outcome==="failure")return;
  const progress=Boolean(delta && Object.keys(delta).some(k=>["discoveryAdd","contactAdd","relationshipUpdate","objectiveAdd","objectiveComplete","travelAccessAdd","location","tradeOfferAdd","timeAdvanceMinutes"].includes(k) && Boolean(delta[k]) && !(Array.isArray(delta[k])&&!delta[k].length)));
  if(!progress && isArtificialHardStop(narration,action))
    throw Error("Sandbox dead end: routine player agency was replaced by a generic refusal and no new usable route. Respond with a concrete person, process, changed NPC reaction, obstacle, or optional investigation. Do not repeat an exhausted choice, grant a purchased service, or force success.");
}
export const SANDBOX_GM_AGENCY = `SANDBOX AGENCY — GENERAL POLICY:
Star Wars SAGA Edition determines contested dice mechanics; it does not turn ordinary civilian life into permission gates. The game is an open sandbox: the PLAYER can attempt ANY rules-legal action, beyond listed options, and the AI GM controls NPC motives and consequences. Treat PLAYER OPTIONS as suggestions, NEVER the complete set of permitted actions.
For ordinary service, booking, introductions, legal commerce, charters, inquiries, exploration, side quests, repairs, lodging, banking and public records: respond as living people in a functioning world. Give ordinary procedures without rolling when no meaningful opposition exists. A helpful staffer can refer a client; a failed interaction with one person does not imply every other person or service is inaccessible. Wealth matters as an incentive and social context, not supernatural compliance; high-end ateliers and luxury providers should realistically offer intake, a consultation route, a broker, or supported grounds for declining.
On a failed check, uphold the dice and deny the attempted stake, but narrate a concrete consequence or fresh opening. On an NPC refusal, respect their agency while offering an independently plausible way to pursue the larger goal, evidence to obtain, a price/requirement to learn, an optional complication or side quest. Never demand repeated identical inquiries or create an endless procedural ladder.
The player may walk away, choose a different provider, bribe or negotiate when legal, research contacts, request a manager, apply through normal channels, wait, visit other cities, or invent an approach you did not list. Do not decree no alternatives unless the world supplies a genuine enforceable barrier. A "side quest" is a story opportunity, NOT a mandatory scripted key. Never auto-grant appointments, wins, owned items, contacts, permits, XP or access: reserve persistent changes for confirmed GM events and authoritative ledgers.`;
/**
 * Last resort ONLY for ordinary action at an established civilian location,
 * after malformed AI drafts. A fresh informational avenue, not an automatic
 * merchant agreement, admission, quest completion or successful skill check.
 */
export function mayUseCivilianAgencyRecovery(action:string,location:unknown) {
  const here=String(location||"");
  const civilian=/\b(?:city|market|shop|store|cantina|concourse|lobby|office|court|station|spaceport|dock|counter|design house|business|hotel|bank|commercial|reception|workshop|port|guild|street)\b/i.test(here);
  return isOrdinarySandboxAttempt(action)&&civilian;
}
export function civilianAgencyRecovery(action:string,location:string) {
  const travel=/\b(?:travel|ship|passage|charter|flight|transport|captain|pilot|taxi)\b/i.test(action);
  const service=/\b(?:appointment|book|hire|service|buy|shop|repair|room|rent|work|job|commission)\b/i.test(action);
  const information=/\b(?:investigat|explor|search|find|records|evidence|mystery|witness)\b/i.test(action);
  const type=travel?"transport":service?"service":information?"investigation":"conversation";
  const routes={
    transport:"the staffed public transport registry or licensed broker directory",
    service:"the local commercial intake office or licensed service directory",
    investigation:"the public archive, registry or independent witness network",
    conversation:"the relevant public liaison desk or another independent contact",
  };
  const channel=routes[type];
  const lead=`At ${location}, ${channel} is an ordinary public route for pursuing the current goal; the actual availability, answer or cooperation remains unknown.`;
  const content=[
    "## LOCATION",location,
    "## SCENE",
    "The current exchange winds down without an agreement. The nearby public area remains active: staff and travelers continue their ordinary business, and the surroundings do not turn into an invisible wall.",
    "The last interlocutor makes no promise of assistance, but points out that one refusal is not a ban on attempting another lawful route. The alternative has not been tried and no outcome is guaranteed.",
    "## GM ADJUDICATION",
    "This is a civilian inquiry, not a forced social victory. The action has reached the limit of this particular exchange, but another independent avenue remains possible. No Saga check or unearned success is asserted.",
    "## GAMEPLAY RESULT",
    `A distinct next line of inquiry is available through ${channel}. The player may seek its personnel or records, choose a different person or method, or abandon the lead. No booking, clearance, payment or discovery of restricted secrets is asserted.`,
    "## SAGA CHECK","No check required.",
    "## STATE UPDATE","The newly described public avenue is recorded as a lead only. No character resources, appointment, access, items or location changed.",
    "## PLAYER OPTIONS",
    `A. Approach ${channel} and ask about the practical procedure.`,
    "B. Seek an independent intermediary or another local establishment.",
    "C. Return to the original goal with a substantially different approach or new evidence.",
    "You may declare another action.",
    "<!--STATE:"+JSON.stringify({discoveryAdd:[{title:"Alternative public route ("+type+")",detail:lead,source:"Ordinary public information at "+location}]})+"-->",
  ].join("\n\n");
  return {content,lead};
}
