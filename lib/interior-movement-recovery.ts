import {permitsLocationChange, positiveActionText} from "./action-intent";

/** Only known, public, intrabuilding routes. No locked rooms or invented transit. */
const venue=/^\s*(Bonadan\s*[—–-]\s*Nuvorren Design House)[,\s]+(rear workroom|front counter|showroom)\s*$/i;
const destinations=[
  {id:"front counter",label:"front counter",pattern:/\bfront\s+(?:counter|desk)\b/i},
  {id:"showroom",label:"showroom",pattern:/\bshowroom\b/i},
  {id:"rear workroom",label:"rear workroom",pattern:/\brear\s+workroom\b/i},
] as const;
export type InteriorMove={location:string;destination:string;from:string;discussesCommission:boolean};

/** Detects a player-owned, physically unopposed move within an established shop. */
export function planInteriorMovement(action:string,location:unknown):InteriorMove|null {
  const from=String(location||"").trim();
  const match=venue.exec(from);
  if(!match) return null;
  if(!permitsLocationChange(action))return null;
  const text=positiveActionText(action);
  const dest=destinations.find(d=>d.pattern.test(text));
  if(!dest || dest.id.toLowerCase()===match[2].toLowerCase())return null;
  // Never bypass a locked/guarded/restricted transition by calling it public.
  if(/\b(?:locked|sealed|restricted|force|break|sneak|without permission|trespass|staff[- ]only|guarded)\b/i.test(text))return null;
  return {location:match[1]+", "+dest.label,destination:dest.id,from:match[2],discussesCommission:/\b(?:commissions?|bespoke|tailors?|appointments?|fittings?)\b/i.test(text)};
}

/** Runs only when 3 GM drafts fail location validation: same declared action,
 * conservative public interior movement, no appointment or NPC compulsion.
 */
export function recoverInteriorMovement(plan:InteriorMove){
  const next=plan.destination;
  const intake="Nuvorren Design House: bespoke commissions can be submitted through the showroom's private client-intake process for later director review; no appointment is yet confirmed.";
  const atFront=next==="front counter"||next==="showroom";
  const result=plan.discussesCommission && atFront
    ? "D'mir returns to the "+next+" and addresses the clerk about commissions. She explains that the front desk cannot guarantee a consultation, but the showroom client-intake process accepts written bespoke briefs for the commission director's later review. No appointment is scheduled."
    : "D'mir leaves the "+plan.from+" and reaches the "+next+" within Nuvorren Design House. The accessible interior movement is complete; no commission, sale or private admission is granted.";
  const delta:Record<string,unknown>={location:plan.location};
  if(plan.discussesCommission && atFront)delta.discoveryAdd=[{title:"Nuvorren commission intake",detail:intake,source:"Nuvorren front-desk procedure"}];
  const sections=[
    "## LOCATION",plan.location,
    "## SCENE",
    "D'mir passes out of the "+plan.from+" into the public area of Nuvorren Design House. The footfalls and cutting sounds of the workroom recede; the polished display space and its public counter come back into view.",
    "He reaches the "+next+". The room is open to customers. No guard, transaction or locked threshold interrupts this short walk.",
    "## GM ADJUDICATION",
    "The player's stated movement between accessible public areas of the same establishment requires no SAGA check. This does not grant a private audience or force anyone to accept a commission.",
    "## GAMEPLAY RESULT",result,
    "## SAGA CHECK","No check required.",
    "## STATE UPDATE","Location updated to "+plan.location+". No payment, appointment, purchase, inventory change or XP award."+(delta.discoveryAdd?" A commission-intake procedure is recorded.":""),
    "## PLAYER OPTIONS",
    "A. Ask for the formal private-commission intake process.",
    "B. Request a senior client liaison or commission director's contact details.",
    "C. Review the displays and decide whether to submit a written design brief.",
    "You may declare another action.",
    "<!--STATE:"+JSON.stringify(delta)+"-->",
  ];
  return {content:sections.join("\n\n"),delta};
}
