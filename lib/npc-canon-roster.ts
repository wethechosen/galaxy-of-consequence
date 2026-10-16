/**
 * Galaxy of Consequence -- GM-only campaign dossier, 150 ABY.
 * Source: GOC_NPC_Roster (14), GOC_main_npcs (11), Dark Lord of Ash (Korvalis).
 * Original supplied documents were set in 200 ABY. These revisions retime their
 * identities, capabilities and motivating conflicts without assuming future titles.
 * The names/institutions created for GOC are campaign canon, not established Legends canon.
 */
export type CanonNpc = {
  id: string; name: string; species: string; birthworld: string; originalRole: string;
  role150: string; affiliation: string; levelBand: "heroic" | "senior" | "legendary";
  force: "no" | "latent" | "trained" | "unknown"; location150: string;
  biography: string; objective: string; confidential: string; revision: string;
  affiliationScope: "GOC-original" | "Legends-compatible";
};
const n = (
  id: string, name: string, species: string, birthworld: string,
  originalRole: string, role150: string, affiliation: string, levelBand: CanonNpc["levelBand"],
  force: CanonNpc["force"], location150: string,
  biography: string, objective: string, confidential: string, revision: string,
  affiliationScope: CanonNpc["affiliationScope"] = "GOC-original",
): CanonNpc => ({ id, name, species, birthworld, originalRole, role150, affiliation, levelBand, force, location150, biography, objective, confidential, revision, affiliationScope });

export const CAMPAIGN_NPCS_150_ABY: readonly CanonNpc[] = [
  n("calen-vardex","Calen Vardex","Human","Coruscant","High Moff / sector governor","Imperial sector logistics governor; prospective Moff","Fel Empire","senior","no","Bastion — Imperial administrative offices",
    "A logistics officer who helped restore damaged Imperial transport lines after the Sith-Imperial conflict; pragmatic toward alien citizens yet proud of Imperial hierarchy.",
    "Reconcile Mercia corridor tariffs with Imperial security without ceding sovereignty.","His sister lives in Hapan space and receives encoded private correspondence.","His 200 ABY High Moff rank and 200 ABY subordinate relationships are not pre-earned in 150 ABY."),
  n("rena-salvek","Rena Salvek","Zeltron","Zeltros","Imperial Knight initiate / junior knight","Imperial Knight trainee","Imperial Knights","heroic","trained","Bastion — Imperial Knight training hall",
    "A gifted Zeltron in Fel-era Imperial Knight training whose species empathy can make authoritarian duty difficult.","Investigate a missing training crystal without accusing her peers.","Maintains a private exchange of study notes with a Jedi acquaintance, not proven traitorous.","In 150 ABY she remains a trainee; do not imply a 200 ABY commission already occurred."),
  n("loresh-kallun","Loresh Kallun","Duros","Duro","Captain, Star Destroyer Imperial Virtue","Imperial naval commander; frigate captain","Fel Empire","senior","no","Bastion — naval liaison pier",
    "A Duros fleet officer who survived late Sith-Imperial warfare and values crews more than honors.","Secure a safe lane for civilian convoys through contested outer reaches.","Once bent an evacuation order to rescue refugees.","His future Star Destroyer captaincy and command of Imperial Virtue remain possible, not already established."),
  n("ardis-nefar","Ardis Nefar","Zabrak","Iridonia","Espo Captain at Mercia Hub","Corporate Sector Authority Espo lieutenant","Corporate Sector Authority","senior","no","Bonadan — Espo permit office",
    "An Iridonian Espo officer accustomed to severe corporate discipline; considers due process an inconvenience.","Break an apparent cargo-fraud ring without losing the company's trade volume.","Has proposed an off-ledger detention transport; implementation not established.","Promoted later in the 200 ABY source; is not already a fleet captain here."),
  n("merek-tan","Merek Tan","Human","Corellia","IGFED forensic accountant","IGFED junior forensic auditor","IGFED","heroic","no","Coruscant — finance audit intake",
    "A principled and socially awkward Corellian ledger investigator who traces market anomalies.","Identify whether a bond prospectus contains a falsified underlying cargo reference.","Suspects shell companies with Murkhana ties; lacks proof.","He has not yet uncovered the 200 ABY conspiracy or obtained a senior audit appointment."),
  n("akkan-vuu","Akkan Vuu","Aqualish","Ando","Jedi Padawan, Mon Calamari satellite","Jedi youngling or novice apprentice","New Jedi Order","heroic","trained","Ossus — Jedi public visitors' hall",
    "An inquisitive Aqualish novice fascinated by marine ecology and repairs; learning restraint as well as compassion.","Request permission for supervised repair training.","Has a habit of examining prohibited mechanisms, not yet known to have tampered with Sith relics.","His later Mon Calamari posting and senior mentor arrangement have not occurred."),
  n("tarvyn-dree","Tarvyn Dree","Mirialan","Mirial","Self-appointed Jedi Shadow","Independent Jedi relic investigator","New Jedi Order, uneasy affiliation","senior","trained","Ossus — Jedi records portico",
    "A severe Mirialan raised amid Jedi fears of renewed Sith influence. Knows stealth but struggles to distinguish suspicion from proof.","Identify the legal chain of custody of a recovered Sith-era artifact.","May one day resort to extrajudicial violence; no such executions are assumed in 150 ABY.","The source says he was knighted during the Sith-Imperial War; verify ages and date before making that biography canonical."),
  n("vesla-kreel","Vesla Kreel","Twi'lek","Ryloth","Sith Apprentice, House Murkhana","Murkhana-associated Force-sensitive acolyte","House Murkhana","heroic","trained","Bonadan — private freight brokerage",
    "A young Twi'lek recruited from hardship by covert dark-side collectors; covets independence from every would-be master.","Secure a relic contact without revealing the sect's interest.","A sibling is vulnerable to slavers; her supposed Korvalis and Xeran mentorship remains unconfirmed.","She is not automatically trained in Force choke or granted Sith prestige status."),
  n("alar-marisk","Alar Mar'Isk","Chiss-raised Kiffar","Unknown Regions","Korvalis's lieutenant / Chiss-Kiffar hybrid","Cult interpreter and recruiter","Independent Sith cult associated with Korvalis","heroic","latent","Unknown Regions — neutral trade post",
    "A Kiffar raised among Chiss frontier traders. His persuasive cult rhetoric exceeds his undeveloped Force talent.","Recruit an independent slicer to translate a harmless public map index.","Has secretly retained a relic from a cult shipment.","Replaces biologically uncertain hybrid descent with a Kiffar raised in Chiss cultural space; Korvalis's private trust is unearned."),
  n("siathra-velle","Sia'thra Velle","Falleen","Falleen","Baroness, Hapan ambassador to CSA","Falleen diplomatic adviser to a Hapan trade mission","Hapes Consortium diplomatic mission","senior","no","Bonadan — Hapan trade attaché office",
    "A calculating Falleen court delegate whose pheromonal biology can affect interpersonal situations but is not Force sensitivity.","Negotiate a preliminary commercial review of Hapan supply routes.","Holds sealed material about a CSA deal, content not yet determined.","Her 200 ABY baronial ambassadorship is a possible promotion, not an earned 150 ABY office."),
  n("kora-veil","Ko'ra Veil","Rodian","Nar Shaddaa","Piratess, leader Veiled Corsairs","Independent Rodian freighter captain and privateer","Outer Rim freetrader networks","heroic","no","Nar Shaddaa — freighter services pier",
    "A clever Rodian navigator who grew up in Hutt space and despises being subordinate to smugglers.","Seek crew contracts for a difficult but legal short-haul route.","Keeps concealed logs of a previous captain's dealings.","The Veiled Corsairs may form later; she has not yet murdered a captain or seized an entire fleet."),
  n("taric-zelra","Taric Zelra","Sullustan","Sullust","Cybernetics Engineer","Independent cybernetic repair technician","Independent","heroic","no","Sullust — licensed biomedical workshop",
    "An exceptionally curious Sullustan mechanic who prefers machine diagnostics to persuasion.","Validate an aftermarket prosthetic's medical-safety certificate.","Once unknowingly sold parts to a questionable intermediary.","The advanced Sith-linked prosthetics scandal and prototype for Vardex remain future possibilities."),
  n("chhal-vidar","Ch'hal Vidar","Chiss","Unknown Regions","Rogue CEDF cartographer","Chiss frontier survey navigator","Independent / Chiss heritage","heroic","unknown","Unknown Regions — survey waystation",
    "A reserved Chiss navigator who distrusts outsiders exploiting survey charts. His precognitive impressions are unverified.","Compare a public navigation beacon with a civilian survey map.","Possesses incomplete unusual star-chart fragments; their Celestial provenance is not established.","No secret Hapan route or Celestial artifact powers are presumed revealed or mechanically owned."),
  n("kara-murson","Kara Murson","Togruta","Lothal","Human-Togruta hybrid bounty hunter","Independent Togruta tracker, raised by a human family","Independent","heroic","no","Lothal — licensed bounty board",
    "A practical Togruta tracker raised on Lothal who prioritizes her younger siblings over prestige.","Check the legal terms of a missing-person search.","Once sheltered a child pursued by violent recruiters; Korvalis's personal involvement is unconfirmed.","Changes an unsupported Human-Togruta hybrid claim to Togruta ancestry and human adoptive family."),
  // Major figures from GOC_main_npcs.
  n("aliyah-fel","Aliyah Fel","Human","Bastion","Empress of the Fel Empire; successor to Marasiah Fel","Fel court dignitary; potential dynastic heir","Fel Imperial dynasty","senior","trained","Bastion — Imperial Palace diplomatic wing",
    "A Force-sensitive member of the Fel household educated in statecraft and Imperial Knight discipline. Her precise succession is not established.","Safeguard an Imperial relief delegation and explore practical reconciliation.","Her eligibility and internal court factional alignments remain private.","Marasiah Fel's 150 ABY fate is not supplied; Aliyah MUST NOT be called Empress or treated as having inherited the throne."),
  n("jaed-sultar","Jaed Sultar","Human","Muunilinst","Supreme Commander of the Imperial Knights","Veteran Imperial Knight field commander","Imperial Knights","senior","trained","Bastion — Imperial Knights' training court",
    "A veteran trained in the Fel tradition with a preference for guarded saber technique and mentoring junior Knights.","Investigate an internal training breach without starting a factional purge.","His senior promotion path is open; source claims a relationship with Marasiah without dated confirmation.","Supreme Commander in 200 ABY is not an established 150 ABY appointment."),
  n("tavia-kuat-ardos","Tavia Kuat-Ardos","Human","Kuat","President (Prex) of the CSA","Kuat-descended industrial negotiator; CSA Direx liaison","Corporate Sector Authority","senior","no","Bonadan — Direx trade liaison suite",
    "A skilled corporate negotiator from a powerful Kuat-aligned industrial family. She prizes commercial stability and recognizes conflict between shareholders and governments.","Set terms for a lawful freighter-maintenance contract review.","Contingent links to future board coalitions are unverified.","The 200 ABY Prex title and CSA presidency cannot be backdated to 150 ABY."),
  n("keelo-greel","Keelo Greel","Nikto","Sriluur","CSA Viceprex of Resources and Security","CSA Espo security operations officer","Corporate Sector Authority","senior","no","Bonadan — corporate security planning desk",
    "A Nikto former Espo trooper ascending the corporate security apparatus through stubborn efficiency.","Review publicly filed transport security procedures.","Keeps private records of corporate security disciplinary cases.","He is not yet the 200 ABY Viceprex or commander of the Picket Fleet."),
  n("kala-morrin","Kala Morrin","Bothan","Bothawui","Head of the Ossus Jedi Enclave","Senior Jedi scholar and archivist","New Jedi Order","senior","trained","Ossus — Jedi archive meeting rooms",
    "A diplomatic Bothan Jedi whose experience of the Sith-Imperial conflict shaped a preference for mediation and corroborated history.","Recover a publicly releasable historic archive index.","Sensitive prophetic documents remain inside the Order.","Ossus Massacre survivor claim requires age scrutiny; being enclave head in 200 ABY does not make Kala the 150 ABY head."),
  n("shado-liang","Shado Liang","Ithorian","Felucia","Keeper of the Dantooine Enclave","Ithorian Jedi healer and agricultural restoration adviser","New Jedi Order","senior","trained","Dantooine — agricultural relief council",
    "A nonbinary Ithorian Jedi botanist trained in healing and nonviolent settlement disputes.","Help a frontier relief clinic select crops without overriding local farmers.","Holds informal relationships with displaced healers.","The source's 200 ABY Keeper title and completed Dantooine restoration remain future goals."),
  n("nir-varek","Nir Varek","Human","Unknown","Dark Lady, head of House Murkhana","House Murkhana Sith claimant and covert patron","House Murkhana","legendary","trained","Unknown Regions — hidden Murkhana enclave",
    "A Sith practitioner who uses wealth, secret organizations and illusion to gain leverage over competing factions.","Compete for custody of Sith-era financial records through intermediaries.","A sealed holocron and blackmail channels are known privately only to her cadre.","Whether she survived Darth Krayt's fall, and any title of supreme Sith ruler, require earned historical evidence."),
  n("darth-xeran","Darth Xeran","Chiss","Csilla","Sith relic-hunter / scientist","Dark-side artifact investigator; Murkhana affiliate","House Murkhana","senior","trained","Unknown Regions — relic survey camp",
    "A former Chiss scientist whose losses drove dangerous research. His trust in relic claims exceeds his trust in people.","Acquire a documented survey sample and test its provenance.","Retains incomplete Rakatan research notes with unknown reliability.","No Sith relic ability, artifact possession or named student relationship is mechanically awarded from biography."),
  n("airi-djo","Airi Djo","Human","Hapes","Queen Mother of Hapes","Hapan royal-court negotiator, possible Djo-line heir","Hapes Consortium","senior","latent","Hapes — royal audience antechamber",
    "A Hapan court diplomat descended in the GOC setting from Tenel Ka's house. Trained in court politics and selective trade.","Defend Hapan autonomy during foreign-route talks.","Dynastic succession remains unconfirmed and private.","Her source's 200 ABY reign is not presumed in 150 ABY; do not replace an established current Queen Mother without evidence."),
  n("kor-vess","Kor Vess","Human","Concord Dawn","Mand'alor, Supreme Warlord of Mandalorians","Mandalorian clan commander; contender for a future unifying title","Mandalorian clans","senior","no","Mandalore — clan negotiation ring",
    "An armored clan leader who balances protection contracts against the need for Mandalorian autonomy.","Negotiate neutral protection work while avoiding a new clan feud.","Keeps separate arrangements with two rivals; no global Mandalorian command is assured.","The 200 ABY title Mand'alor has NOT been earned at 150 ABY and beskar ownership must be backed by actual game state."),
  n("darth-korvalis","Darth Korvalis","Human","Unknown (Korriban rumored)","Dark Lord of Chaos, apex Sith antagonist","Sith cult master; one of several hidden Sith powers","Independent Sith cult","legendary","trained","Unknown Regions — guarded Sith redoubt",
    "A manipulative, highly trained Sith warrior who sees fear and hardship as instruments of domination, recruiting through staged tests and control of captives.",
    "Acquire secure relic networks and control a promising cadre without provoking premature exposure.",
    "Conducts the Ash trials and withholds knowledge of clandestine routes. Later contact with D'mir requires actual play.",
    "Saga CL12 baseline is provisional and needs complete legal heroic class/stat reconstruction. No Apex Immunity, automatic escapes, unavoidable captures, arbitrary dark-side points, or auto-awarded Sith prestige. The Trials are optional encounters with valid Saga attack/skill mechanics and consequences adjudicated through server rolls."),
];
export function findCanonNpc(name: string) {
  const normalized = (input: string) => input.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return CAMPAIGN_NPCS_150_ABY.find(npc => normalized(npc.name) === normalized(name)) || null;
}
/** Provide private GM context only for exact names actually mentioned; no global automatic cameos. */
export function canonicalNpcContext(text: string) {
  const passage = String(text || "");
  const selected = CAMPAIGN_NPCS_150_ABY.filter(npc =>
    new RegExp('(?:^|[^\\w])' + npc.name.replace(/[.*+?^$\x7b\x7d()|[\]\\]/g, '\\$&').replace(/\\ /g, '\\s+') + '(?:$|[^\\w])', 'i').test(passage)
  ).slice(0, 3);
  return selected.map(npc => ({ name:npc.name, species:npc.species, role150:npc.role150, affiliation:npc.affiliation,
    biography:npc.biography, objective:npc.objective, confidentiality:npc.confidential, eraCorrection:npc.revision }));
}
