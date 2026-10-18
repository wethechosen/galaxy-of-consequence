/**
 * New Jedi Order institution at 150 ABY — GM-owned setting and records.
 *
 * Published LEGENDS history through the conclusion of Legacy vol.2 (~139 ABY)
 * is immutable. Invented history after publication is explicitly GOC material.
 * A restored Order is not a dissolved fugitive cabal; neither is its precise
 * postwar Council, treasury, enrollment or personnel count published canon.
 * Nothing here mutates the campaign ledger or grants Jedi powers to a player.
 */
import {GOC_NPC_INDEX_BY_ID} from "./npc-canonical-index";
export type JediAuthority="legends-established"|"goc-institution"|"not-established";
export type JediOffice={id:string;description:string;mandate:string;leaderId:string|null;membershipAuthority:JediAuthority;rankRequirements:string;independence:string};
export type JediSite={id:string;name:string;world:string;historicalStatus:string;state150:"reclaimed"|"recovering"|"liaison-only"|"destroyed-historical";authority:JediAuthority;facilities:readonly string[];restriction:string};
export type JediMandate={id:string;mission:string;method:string;ethicalBoundary:string;sourceRequirements:readonly string[];autonomousPurpose:string;durationMinutes:number};
export type JediHistoricalAnchor={yearABY:number;event:string;authority:"legends-established";people:string[];consequence:string};
export type JediNamedRecord={name:string;id:string|null;status150:"active-goc"|"historical-deceased"|"last-seen-unknown"|"independent-last-seen";position:string;authority:JediAuthority;knowableAsPublic:boolean;notes:string};
export const JEDI_LEGENDS_HISTORY:readonly JediHistoricalAnchor[]=Object.freeze([
 {yearABY:130,event:"Massacre at Ossus and Third Jedi Purge",authority:"legends-established",people:["Kol Skywalker","Wolf Sazen","Darth Nihl"],consequence:"The New Jedi Order suffers severe losses and retreats into scattered survival networks."},
 {yearABY:137,event:"Taivas Hidden Temple Council during the purge",authority:"legends-established",people:["K'Kruhk","Tili Qua","T'ra Saa"],consequence:"Surviving Jedi retain recognizable High Council governance while concealed."},
 {yearABY:138,event:"Attack on Taivas Hidden Temple",authority:"legends-established",people:["T'ra Saa","K'Kruhk"],consequence:"T'ra Saa dies ensuring evacuation; Taivas is not an operational headquarters at 150 ABY."},
 {yearABY:138,event:"Battle of Coruscant and end of the Third Jedi Purge",authority:"legends-established",people:["Cade Skywalker","Wolf Sazen","Darth Krayt"],consequence:"Krayt falls; Wolf Sazen dies confronting Darth Stryfe; the Jedi regain Coruscant and reclaim the former Sith Temple."},
 {yearABY:138,event:"Formation of Galactic Federation Triumvirate",authority:"legends-established",people:["K'Kruhk","Marasiah Fel","Gar Stazi"],consequence:"The Jedi become a publicly recognized independent founding institution, not a subordinate unit of the Fel Empire."},
 {yearABY:139,event:"Darth Wredd insurgency and Battle of Mala",authority:"legends-established",people:["Darth Wredd","Marasiah Fel","Jao Assam"],consequence:"A major surviving Sith force is confronted; extermination of every dark-side survivor is NOT verified."}
]);
export const JEDI_LEGENDS_PEOPLE:readonly JediNamedRecord[]=Object.freeze([
 {id:null,name:"K'Kruhk",status150:"last-seen-unknown",position:"138 ABY Jedi Triumvir and senior High Council member",authority:"legends-established",knowableAsPublic:true,notes:"Alive in published 138 ABY history; 150 ABY survival, Triumvirate term and any Grand Master appointment not asserted."},
 {id:null,name:"Tili Qua",status150:"last-seen-unknown",position:"Hidden Temple High Council Master in 137 ABY",authority:"legends-established",knowableAsPublic:true,notes:"Later service or death not established by the published endpoint; not automatically a 150 ABY councillor."},
 {id:null,name:"T'ra Saa",status150:"historical-deceased",position:"Hidden Temple High Council Master, died 138 ABY",authority:"legends-established",knowableAsPublic:true,notes:"Died on Taivas during the Hidden Temple evacuation; may appear only in archives, historical footage or flashbacks."},
 {id:null,name:"Wolf Sazen",status150:"historical-deceased",position:"Jedi Master, died 138 ABY",authority:"legends-established",knowableAsPublic:true,notes:"Died fighting Darth Stryfe in the Battle of Coruscant; no living 150 ABY spawn."},
 {id:null,name:"Kol Skywalker",status150:"historical-deceased",position:"Jedi Master killed at Ossus in 130 ABY",authority:"legends-established",knowableAsPublic:true,notes:"No retcon of the massacre."},
 {id:null,name:"Cade Skywalker",status150:"independent-last-seen",position:"Independent Force-user who defeated Darth Krayt",authority:"legends-established",knowableAsPublic:true,notes:"Not automatically a Grand Master, member of the current Council, or assigned an active GOC mission."},
 {id:null,name:"Shado Vao",status150:"last-seen-unknown",position:"Jedi who fought the One Sith",authority:"legends-established",knowableAsPublic:true,notes:"No invented 150 ABY office, fate or Force advancement."}
]);
export const JEDI_OFFICES_150:readonly JediOffice[]=Object.freeze([
 {id:"high-council",description:"Jedi High Council",mandate:"Independent deliberation about Force ethics, education, endangered populations and serious threat response; meetings are not unconditional Triumvirate votes.",leaderId:null,membershipAuthority:"not-established",rankRequirements:"Recognized Masters appointed according to Jedi tradition and committed GOC records; no self-promotion.",independence:"Council may disagree with its own Triumvir and cannot direct other sovereigns unilaterally."},
 {id:"triumvirate-delegation",description:"Jedi delegation to the Galactic Federation Triumvirate",mandate:"Represent the Order in postwar galactic governance, coordinate civil recovery and negotiate constitutional boundaries.",leaderId:null,membershipAuthority:"not-established",rankRequirements:"Delegated authority; K'Kruhk held the founding representative office in 138 ABY, not automatically forever.",independence:"Jedi diplomatic authority is not Fel military command."},
 {id:"temple-stewardship",description:"Temple stewardship and archive preservation",mandate:"Restore and steward the returned Coruscant Temple, preserve copies of prepurge archives and evaluate access requests.",leaderId:null,membershipAuthority:"goc-institution",rankRequirements:"Assigned caretakers and qualified researchers; Kala Morrin is an archival scholar, not appointed Chief Librarian by default.",independence:"Court orders or institutional rank do not erase archival chain-of-custody rules."},
 {id:"educators",description:"Apprenticeship, welfare and instruction service",mandate:"Train Force-sensitive novices, supervise mentors, ensure lawful guardianship and pastoral care.",leaderId:null,membershipAuthority:"goc-institution",rankRequirements:"Only a qualified instructor who passes the Saga mechanical/character background tests may teach a relevant power.",independence:"No universal conscription of Force-sensitive children or guarantee of acceptance."},
 {id:"medical-relief",description:"Jedi healing and planetary recovery missions",mandate:"Support local hospitals, agricultural revival, trauma recovery and restoration agreements without commandeering public services.",leaderId:null,membershipAuthority:"goc-institution",rankRequirements:"Healing capabilities and resource allocation are determined by an identified healer, medical access and authoritative mechanics.",independence:"Neutral relief facilities retain their own sovereignty; Shado Liang is a healer, not a guaranteed enclave head."},
 {id:"archives-fieldwork",description:"Historical studies and responsible relic investigations",mandate:"Document endangered Force texts and artifacts; verify provenance without turning every rumor into a Sith conspiracy.",leaderId:null,membershipAuthority:"goc-institution",rankRequirements:"Legal chain of custody, informed consent and documented investigator training.",independence:"Tarvyn Dree is a relic investigator, not entitled to execute presumed cultists."},
 {id:"mediation-security",description:"Jedi field mediation and civilian protection",mandate:"Resolve threats, protect refugees and coordinate with authorized authorities while upholding Jedi independence.",leaderId:null,membershipAuthority:"goc-institution",rankRequirements:"Qualified Knights and Masters subject to actual mission commissions and personal XP/rules.",independence:"Does not become an Imperial police bureau, military junta, or universal anti-Sith surveillance force."}
]);
export const JEDI_SITES_150:readonly JediSite[]=Object.freeze([
 {id:"coruscant",name:"Reclaimed Jedi Temple",world:"Coruscant",historicalStatus:"Recovered from Krayt's Temple of the Sith in 138 ABY; returned to its Jedi role.",state150:"reclaimed",authority:"legends-established",facilities:["Temple administration","archives recovery","mediation chambers","teaching facilities (capacity not established)"],restriction:"Do not assert a restored pre-130 ABY enrollment, functioning High Council meeting room occupancy or a fixed garrison without GOC event records."},
 {id:"ossus",name:"Ossus restoration and scholarly enclave",world:"Ossus",historicalStatus:"The Jedi Academy suffered devastation in 130 ABY; old ground remains central to Jedi history.",state150:"recovering",authority:"goc-institution",facilities:["Archive recovery","heritage preservation","visiting Jedi researchers","local liaison"],restriction:"Recovery does not automatically imply a rebuilt main academy, high enrollment or completed capital project."},
 {id:"dantooine",name:"Dantooine agricultural and healing liaison",world:"Dantooine",historicalStatus:"GOC's Shado Liang operates alongside agricultural restoration partners.",state150:"liaison-only",authority:"goc-institution",facilities:["Medical consultations","crop restoration partnership","emergency aid coordination"],restriction:"This is not automatically a formal Jedi Temple or a completed 200 ABY enclave."},
 {id:"taivas",name:"Taivas Hidden Temple — historical ruin",world:"Taivas",historicalStatus:"Evacuated under attack in 138 ABY; T'ra Saa died defending evacuation.",state150:"destroyed-historical",authority:"legends-established",facilities:["Historical evidence and memorial records only"],restriction:"Never spawn an intact 150 ABY Jedi High Council in the destroyed Hidden Temple."}
]);
export const JEDI_FIELD_MANDATES_150:readonly JediMandate[]=Object.freeze([
 {id:"return-temple",mission:"Restore archive access and structural continuity in the reclaimed Coruscant Temple",method:"reconstruction",ethicalBoundary:"No arbitrary asset grant or new construction without funds, permits and personnel.",sourceRequirements:["Jedi archival administration","Coruscant facility engineering","Triumvirate access decisions"],autonomousPurpose:"Institutional recovery after a purge",durationMinutes:10080},
 {id:"educate",mission:"Evaluate volunteer novice placements and qualified mentorship",method:"education",ethicalBoundary:"Protect minor welfare, guardian consent, ethical training and individual free agency.",sourceRequirements:["Verified instructors","available housing","applicant/guardian facts"],autonomousPurpose:"A viable next Jedi generation, independent of the player",durationMinutes:10080},
 {id:"relief",mission:"Respond to an identified civilian medical or ecological relief request",method:"humanitarian",ethicalBoundary:"Avoid exploiting local governments, claiming supernatural universal healing, or forcing recipients into the Order.",sourceRequirements:["Established local need","transport","named medical/Jedi personnel"],autonomousPurpose:"Civilian support with actual resource constraints",durationMinutes:4320},
 {id:"history",mission:"Investigate contested postpurge artifact provenance without assuming Sith culpability",method:"scholarship",ethicalBoundary:"Chain of custody, evidence, and no forced confrontations.",sourceRequirements:["Verifiable artifact source","qualified researcher","access permissions"],autonomousPurpose:"Protect endangered knowledge",durationMinutes:2880},
 {id:"diplomacy",mission:"Negotiate policy boundaries between Jedi independence and Triumvirate requests",method:"diplomacy",ethicalBoundary:"A Jedi representative cannot unilaterally decree Fel or Alliance policy.",sourceRequirements:["Authentic Triumvirate agenda","Jedi delegated authority","named interlocutors"],autonomousPurpose:"Sustainable constitutional role",durationMinutes:2880},
 {id:"oversight",mission:"Review Jedi field-use-of-Force practice and accountability",method:"ethics",ethicalBoundary:"No guilty verdict, forced exile or new Force powers by simulation fiat.",sourceRequirements:["Specific recorded report","credible testimony","due process"],autonomousPurpose:"Institutional ethical coherence",durationMinutes:1440}
]);
export const JEDI_EXISTING_GOC_PEOPLE:readonly JediNamedRecord[]=Object.freeze([
 {id:"akkan-vuu",name:"Akkan Vuu",status150:"active-goc",position:"Aqualish novice/apprentice studying moderation and field repair",authority:"goc-institution",knowableAsPublic:true,notes:"No automatic field command or advanced Force mastery."},
 {id:"tarvyn-dree",name:"Tarvyn Dree",status150:"active-goc",position:"Mirialan independent Jedi relic investigator",authority:"goc-institution",knowableAsPublic:true,notes:"Not an appointed Jedi Shadow division commander; classified artifact knowledge follows individual access."},
 {id:"kala-morrin",name:"Kala Morrin",status150:"active-goc",position:"Bothan senior Jedi scholar and archivist",authority:"goc-institution",knowableAsPublic:true,notes:"An old sourcebook's 200 ABY title of Ossus enclave head is not automatically valid in 150 ABY."},
 {id:"shado-liang",name:"Shado Liang",status150:"active-goc",position:"Ithorian Jedi healer and ecological restoration adviser",authority:"goc-institution",knowableAsPublic:true,notes:"Dantooine environmental liaison, not automatically Keeper of a restored Jedi Temple."}
]);
export function jediInstitution150(){
 for(const n of JEDI_EXISTING_GOC_PEOPLE){
  if(!n.id||!GOC_NPC_INDEX_BY_ID.has(n.id))throw Error("Unreconciled GOC Jedi: "+n.name);
 }
 return {eraABY:150,identity:"Restored New Jedi Order",institutionalStatus:"publicly-recognized-triumvirate-participant",
  politicalAuthority:"Founding Jedi member institution; no automatic control over the Fel Empire, Alliance, or other governments.",
  council150:"Existing High Council tradition confirmed, exact 150 ABY appointments not yet established by GOC events.",
  grandMaster150:null as string|null,certifiedOrderSize150:null as number|null,
  canonicalHistoricalEvents:JEDI_LEGENDS_HISTORY,offices:JEDI_OFFICES_150,
  sites:JEDI_SITES_150,mandates:JEDI_FIELD_MANDATES_150,
  historicalPersonalities:JEDI_LEGENDS_PEOPLE,
  existingOriginalGocJedi:JEDI_EXISTING_GOC_PEOPLE,
  finance:"Authorized Jedi/partner facilities, support and donations. No invented treasury or institutional balance.",
  security:"No omniscience about the XIII/IGFED, Korvalis, or D'mir. Force use requires a verified individual Saga Edition sheet.",
  independentObjectives:"Recovery, education, science, charity, ethical deliberation and diplomacy; no scripted war or chosen one."
 };
}
export function publicJediInstitution150(){
 const x=jediInstitution150();
 return {eraABY:x.eraABY,identity:x.identity,institutionalStatus:x.institutionalStatus,
  politicalAuthority:x.politicalAuthority,council150:x.council150,
  canonicalHistoricalEvents:x.canonicalHistoricalEvents,
  offices:x.offices.map(o=>({id:o.id,description:o.description,mandate:o.mandate})),
  sites:x.sites.map(s=>({id:s.id,name:s.name,world:s.world,historicalStatus:s.historicalStatus,state150:s.state150,facilities:s.facilities})),
  historicalPersonalities:x.historicalPersonalities.filter(p=>p.knowableAsPublic),
  publicMissions:x.mandates.map(m=>({id:m.id,mission:m.mission,method:m.method})),
  note:"The 150 ABY Council roster, Grand Master, personnel count, and specific assignments remain undetermined until a committed GOC world event establishes them."};
}
