/** A service request is not automatically an appointment or purchase. */
export function isAtelierAppointmentRequest(action: string, location: unknown) {
  const text = String(action || "").trim();
  const here = String(location || "");
  return /bonadan/i.test(here) && /nuvorren|design house/i.test(here)
    && /appointment|booking|commission|bespoke|fitting|tailor|consultation/i.test(text)
    && /gm|how|who|where|when|ask|request|inquire|schedule|book|arrange|set|get|meet|see|speak|contact|find|consult|director|intake|access/i.test(text)
    && !/attack|shoot|rob|steal|threaten|intimidate|blackmail|bribe|break in|hack|forge/i.test(text);
}
function section(text: string, title: string) {
  const mark = text.indexOf("## " + title);
  if (mark < 0) return "";
  const start = mark + title.length + 4;
  const rest = text.slice(start);
  const next = rest.search(/\n## (?:LOCATION|SCENE|GM ADJUDICATION|GAMEPLAY RESULT|SAGA CHECK|STATE UPDATE|PLAYER OPTIONS)/);
  return (next < 0 ? rest : rest.slice(0, next)).trim();
}
export function hasAtelierBookingPath(result: string) {
  const text = result.replace(/\s+/g, " ");
  return /(?:can|may|will|offers?|agrees?|suggests?|directs?|points?|refers?|sends?|hands?|provides?|explains?).{0,115}(?:submit|forward|file|register|relay|route|schedule|book|introduce|contact|request|visit|meet|speak|present|leave a message|take your details).{0,115}(?:commission|appointment|director|scheduling|concierge|intake|reception|office|secretary|client|master tailor)/i.test(text)
    || /(?:bespoke|commission|appointment|scheduling|client)[ -]?(?:intake|desk|office|concierge|secretary|liaison|director|request|registrar).{0,110}(?:accepts?|handles?|receives?|takes?|routes?|records?|books?|registers?|forwards?)/i.test(text);
}
export function assertAtelierAppointmentProgress(narration: string, action: string, location: unknown) {
  if (!isAtelierAppointmentRequest(action, location)) return;
  if (hasAtelierBookingPath(section(narration, "GAMEPLAY RESULT"))) return;
  throw Error("The atelier inquiry has no actionable appointment route. The worker may decline direct bookings but must identify an intake, concierge, client liaison, director contact, referral, or a concrete new obstacle. Do not force an appointment, invent a price or repeat a failed referral.");
}
export function atelierAppointmentGmInstruction() {
  return "BESPOKE APPOINTMENT ACCESS — BONADAN: D'mir has substantial spendable funds; Nuvorren is a functioning commercial atelier, not a story-locked site. Answer the current scheduling request with a new NPC interaction and a concrete usable in-world path: a client-intake concierge, formal commission brief forwarded to the director, senior liaison, or legitimate intermediary. Being unable to book at the rear workroom is not a shop-wide refusal. Offer a process without guaranteeing a particular artisan, schedule, materials or terms. Respect established clerk refusals: do not send the player back to repeat a failed approach. If a new route is confirmed in dialogue record the discovery, but do not charge credits, grant goods, grant XP, or report a confirmed appointment.";
}
/** A last-resort NPC reply after failed drafts: one real lead, no booked appointment. */
export function atelierAppointmentRecovery(location: string) {
  const lead = "Nuvorren Design House, Bonadan: bespoke commission requests can go through the showroom client-intake concierge to the commission director for consideration. An appointment or price requires the director's later confirmation.";
  const lines = [
    "## LOCATION", location,
    "## SCENE",
    "A cutting instrument falls silent in the Nuvorren rear workroom. The worker looks from D'mir toward the broad doorway back to the public showroom, where staff receive clients during business hours.",
    "The worker keeps the unfinished garment on its table. \"This bench is not where appointments are made,\" the worker says. \"Our client-intake concierge takes the brief and forwards private commissions to the director. They will need the design requirements, a contact route, and a preferred day. I cannot promise the director's decision.\" The worker gestures toward the showroom-side intake.",
    "## GM ADJUDICATION",
    "This is an ordinary service enquiry. Explaining the process needs no Saga check and does not constitute acceptance.",
    "## GAMEPLAY RESULT",
    "The worker directs D'mir to the showroom client-intake concierge, which accepts written bespoke-commission requests and forwards them to the commission director. The director still must confirm any consultation, price and available materials.",
    "## SAGA CHECK", "No check required.",
    "## STATE UPDATE", "A new actionable client-intake lead is recorded. No appointment, payment, property, item, location or XP change is granted.",
    "## PLAYER OPTIONS",
    "A. Approach the showroom client-intake concierge with the bespoke cortosis-weave brief.",
    "B. Ask the worker whether an introduction to the commission director can be forwarded from the workroom.",
    "C. Request the senior client liaison's name and contact method.",
    "You may declare another action.",
    "<!--STATE:" + JSON.stringify({ discoveryAdd: [{title:"Nuvorren bespoke commission intake",detail:lead,source:"Nuvorren rear-workroom attendant"}] }) + "-->",
  ];
  return { content: lines.join("\n\n"), lead };
}
