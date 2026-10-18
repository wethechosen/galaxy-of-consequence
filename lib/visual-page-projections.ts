import type { CampaignEvent, LoreFact } from "./types";
import type { Contact } from "./world";

// Player projections only. Private NPC plans and unpublished lore never reach presentation components.
export function playerKnownContacts(contacts: Contact[]) {
  return contacts.filter(contact => contact.playerKnown).map(contact => ({
    id: contact.id, name: contact.name, description: contact.description,
    observedAttitude: contact.observedAttitude, companion: contact.companion,
    knownObligations: [...contact.knownObligations],
  }));
}

export function playerVisibleIntel(facts: LoreFact[], pattern: RegExp, search = "") {
  return facts.filter(fact => fact.playerVisible &&
    pattern.test(`${fact.label} ${fact.detail}`) &&
    `${fact.label} ${fact.detail}`.toLowerCase().includes(search.toLowerCase()));
}

export function playerVisibleChronology(events: CampaignEvent[]) {
  return events.filter(event => event.playerVisible).slice().sort((a,b) =>
    b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}
