import { CAMPAIGN_NPCS_150_ABY } from "./npc-canon-roster";
/** Isolated GM-controlled NPC test subjects. These are scenario seeds, not D'mir-canon. */
export type NpcTestSubject = {
  id: string; name: string; species: string; age: number | "Unknown"; yearABY: number; homeworld: string;
  background: string; allegiance: string; role: string; classId: "noble"|"scoundrel"|"scout"|"soldier";
  appearance: string; objective: string; location: string; destination: string; subject: string;
  contact: string; talentId: string; 
};
export const NPC_TEST_ROSTER: NpcTestSubject[] = [
  {
    id:"kelvek", name:"Kelvek", species:"Muun", age:57, yearABY:147, homeworld:"Muunilinst",
    background:"Former IGBC executive who accumulated concealed wealth by skimming financial orders before Muun displacement. Most peers took new work with IGFED; Kelvek instead worked as paid library staff at the Coruscant juvenile detention center and tutored incarcerated youths, including Dmir. He was not a prisoner. This is a historical flashback prior to his death.",
    allegiance:"Detention-center staff librarian; politically watched former banker", role:"Financial archivist", classId:"noble",
    appearance:"Tall pale Muun, charcoal staff cardigan, meticulous posture and carefully repaired spectacles.",
    objective:"Keep the prison library's public study rules intact without exposing confidential financial information.",
    location:"Coruscant — detention complex, prison library desk", destination:"Coruscant — detention complex, public catalogue alcove",
    subject:"approved study materials", contact:"Infirmary records clerk", talentId:"educated",
  },
  {
    id:"jena-lorr", name:"Jena Lorr", species:"Human", age:35, yearABY:150, homeworld:"Bonadan",
    background:"An industrial compliance auditor who refuses to sign an unverified freight-cost allocation. Her family survived years of contract labor under powerful firms.",
    allegiance:"Independent commercial audit service", role:"Logistics auditor", classId:"noble",
    appearance:"Copper-brown skin, dark practical tunic with a clean collar and compact ledger datapad.",
    objective:"Find a lawful explanation for a disputed public freight surcharge without implicating anyone prematurely.",
    location:"Bonadan — industrial tariff registry front counter", destination:"Bonadan — tariff registry public records hall",
    subject:"freight surcharge schedules", contact:"Tariff desk registrar", talentId:"educated",
  },
  {
    id:"orlan-vale", name:"Orlan Vale", species:"Human", age:41, yearABY:150, homeworld:"Bastion",
    background:"A disciplined ex-garrison logistician now employed to inspect lawful shipping records. He will not mistake a civilian clerk for a combatant.",
    allegiance:"Civilian contract; former Fel military service", role:"Retired supply sergeant", classId:"soldier",
    appearance:"Close-cropped gray hair, work-worn field jacket and a metal brace on his left wrist.",
    objective:"Determine whether emergency ration requisitions have the appropriate public approval trail.",
    location:"Bastion — municipal provisioning desk", destination:"Bastion — public provisioning archive",
    subject:"emergency ration orders", contact:"Municipal supply clerk", talentId:"armored-defense",
  },
  {
    id:"ari-vess", name:"Ari Vess", species:"Human", age:27, yearABY:150, homeworld:"Taris",
    background:"A salvage-yard clerk who grew up among the dismantled terraces of Taris and now tries to keep legal salvage separate from stolen cargo.",
    allegiance:"Independent salvage cooperative", role:"Salvage registry runner", classId:"scoundrel",
    appearance:"Rough brown boots, green utility vest, a small eyebrow scar and oil on the fingertips.",
    objective:"Verify a disputed salvage registration without claiming ownership of missing equipment.",
    location:"Taris — civic salvage counter", destination:"Taris — civic salvage reading room",
    subject:"salvage permit entries", contact:"Salvage registrar", talentId:"knack",
  },
  {
    id:"mirren-sol", name:"Mirren Sol", species:"Human", age:33, yearABY:150, homeworld:"Dantooine",
    background:"Survey technician from a farming settlement who marks damaged utility corridors for repair crews. She prefers measured evidence to rumors.",
    allegiance:"Rural survey cooperative", role:"Frontier survey scout", classId:"scout",
    appearance:"Weathered tan skin, braided dark hair, dusty knee guards and a folding rangefinder.",
    objective:"Identify an inconsistency in posted survey access without entering a restricted site.",
    location:"Dantooine — frontier civic kiosk", destination:"Dantooine — public survey map desk",
    subject:"land survey access plans", contact:"Survey office duty clerk", talentId:"acute-senses",
  },
  {
    id:"torin-kade", name:"Torin Kade", species:"Human", age:29, yearABY:150, homeworld:"Corellia",
    background:"A junior shipwright displaced by a failing contractor; he has become careful about salvage invoices and shipyard safety certifications.",
    allegiance:"Independent ship mechanics guild", role:"Shipyard claims technician", classId:"scoundrel",
    appearance:"Short curly hair, reinforced gloves and a dark blue welding jacket with a patched shoulder.",
    objective:"Compare public safety inspections against a disputed hull-work docket.",
    location:"Corellia — dockside inspection counter", destination:"Corellia — dockside public file gallery",
    subject:"shipyard inspection notices", contact:"Harbor safety clerk", talentId:"knack",
  },
  {
    id:"lenna-fen", name:"Lenna Fen", species:"Human", age:38, yearABY:150, homeworld:"Coruscant",
    background:"A supply coordinator for an independent public medcenter who insists on documented batches before accepting replacement equipment.",
    allegiance:"Independent medical relief network", role:"Medcenter procurement agent", classId:"noble",
    appearance:"Black hair pulled beneath a plain cloth wrap, silver medcenter pin and a faded brown uniform.",
    objective:"Track a public recall notice without accessing patient records.",
    location:"Coruscant — municipal medcenter reception", destination:"Coruscant — medcenter public supply terminal",
    subject:"medical supply recall notices", contact:"Medcenter supply officer", talentId:"educated",
  },
  {
    id:"tesa-norr", name:"Tesa Norr", species:"Human", age:30, yearABY:150, homeworld:"Anaxes",
    background:"Former defensive fleet quartermaster working on civilian equipment inventory after a demobilization. She maintains careful separation of public and classified manifests.",
    allegiance:"Independent fleet-veteran cooperative", role:"Depot inspection officer", classId:"soldier",
    appearance:"Tall woman with tightly bound hair, clean slate-gray fatigues and a worn mechanical wrist chronometer.",
    objective:"Confirm whether a returned field kit was publicly inventoried, without taking military stock.",
    location:"Anaxes — civilian depot permit office", destination:"Anaxes — depot public filing annex",
    subject:"returned field-kit receipts", contact:"Depot filing officer", talentId:"armored-defense",
  },
  {
    id:"bren-varo", name:"Bren Varo", species:"Human", age:24, yearABY:150, homeworld:"Socorro",
    background:"A desert route guide whose mother ran a repair shelter for wayward freighter crews. He now insists that public docking charts match legal emergency routes.",
    allegiance:"Independent guide", role:"Route surveyor", classId:"scout",
    appearance:"Sand-colored cloak, respirator slung at the belt, sun-darkened skin and wind-scuffed eye shields.",
    objective:"Resolve an ambiguity in public shelter wayfinding without trespassing on restricted hangars.",
    location:"Socorro — freeport public route board", destination:"Socorro — freeport navigation kiosk",
    subject:"emergency shelter routes", contact:"Transit chart keeper", talentId:"acute-senses",
  },
  {
    id:"sorin-pell", name:"Sorin Pell", species:"Human", age:46, yearABY:150, homeworld:"Ossus",
    background:"Civilian custodian of duplicate public cultural catalogues. He does not claim Jedi initiation or knowledge of sealed holocrons.",
    allegiance:"Neutral scholarly archive", role:"Archive conservator", classId:"noble",
    appearance:"Gray-flecked beard, ink on sleeve cuffs and a dark simple robe under a weather cloak.",
    objective:"Reconcile a mislabeled public catalogue sheet while protecting private archival collections.",
    location:"Ossus — civilian archive reception", destination:"Ossus — public catalogue vestibule",
    subject:"public artifact catalogues", contact:"Archive duty librarian", talentId:"educated",
  },
];

/**
 * The 25 PDF-based major actors are played in independent level-one referee
 * rehearsal sandboxes. Such test avatars are NOT their high-level canon builds:
 * this verifies save creation, turn resolution, skill rolls and dossier durability
 * without awarding unearned Sith/Jedi powers or rewriting historical status.
 */
export const ALL_NPC_TEST_ROSTER: NpcTestSubject[] = [
  ...NPC_TEST_ROSTER,
  ...CAMPAIGN_NPCS_150_ABY.map((entry): NpcTestSubject => {
    const classId = /Jedi|Sith|Knight|cult/i.test(entry.role150) ? "scoundrel"
      : /fleet|marshal|Espo|security|commander|captain|hunter|guard/i.test(entry.role150) ? "soldier"
      : /survey|pilot|cartograph|scout|explorer|track|navigator/i.test(entry.role150) ? "scout"
      : "noble";
    return {
      id: entry.id, name: entry.name, species: entry.species, age: "Unknown",
      yearABY: 150, homeworld: entry.birthworld,
      background: entry.biography + " This is a level-one REHEARSAL version of an established NPC, not that NPC's complete mechanical progression.",
      allegiance: entry.affiliation, role: entry.role150, classId,
      appearance: entry.role150 + " at a private workplace or approved administrative post.",
      objective: entry.objective,
      location: entry.location150,
      destination: entry.location150 + " — permitted records alcove",
      subject: entry.id.replace(/-/g," ") + " authorized worksite notices",
      contact: "Duty records assistant",
      talentId: classId === "soldier" ? "armored-defense" : classId === "scout" ? "acute-senses" : classId === "scoundrel" ? "knack" : "educated",
    };
  }),
];