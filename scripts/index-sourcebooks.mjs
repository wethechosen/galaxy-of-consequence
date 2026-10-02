import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { indexSourceFile, listSourceDocuments } from "../lib/source-library.mjs";

const downloads = resolve(homedir(), "Downloads");
const books = [
  ["Saga Edition Core Rulebook.pdf", "Saga Edition Core Rulebook", "saga_core"],
  ["Legacy Era Campaign Guide.pdf", "Legacy Era Campaign Guide", "saga_supplement"],
  ["Galaxy of Intrigue.pdf", "Galaxy of Intrigue", "saga_supplement"],
  ["Galaxy at War.pdf", "Galaxy at War", "saga_supplement"],
  ["Jedi Academy Training Manual.pdf", "Jedi Academy Training Manual", "saga_supplement"],
  ["Threats of the Galaxy.pdf", "Threats of the Galaxy", "saga_supplement"],
  ["The Unknown Regions.pdf", "The Unknown Regions", "saga_supplement"],
  ["The Force Unleashed Campaign Guide.pdf", "The Force Unleashed Campaign Guide", "saga_supplement"],
  ["Scum and Villany.pdf", "Scum and Villainy", "saga_supplement"],
  ["Scavenger's Guide to Droids.pdf", "Scavenger's Guide to Droids", "saga_supplement"],
  ["Starships of the Galaxy.pdf", "Starships of the Galaxy", "saga_supplement"],
  ["Knights of the Old Rebuplic Campaign Guide.pdf", "Knights of the Old Republic Campaign Guide", "saga_supplement"],
  ["Coruscant and the Core Worlds.pdf", "Coruscant and the Core Worlds", "setting"],
  ["Geonosis and the Outer Rim Worlds.pdf", "Geonosis and the Outer Rim Worlds", "setting"],
  ["Galactic Campaign Guide.pdf", "Galactic Campaign Guide", "setting"],
  ["Arms and Equipment Guide.pdf", "Arms and Equipment Guide", "setting"],
  ["Ultimate Alien Anthology.pdf", "Ultimate Alien Anthology", "setting"],
  ["Revised Core Rulebook.pdf", "Revised Core Rulebook (pre-Saga)", "setting"],
  ["Star Wars Gamemaster Screen.pdf", "Star Wars Gamemaster Screen", "setting"],
  ["Han Solo and the Corporate Sector Sourcebook WEG40042.pdf", "Han Solo and the Corporate Sector Sourcebook (WEG)", "setting"],
  ["Book of Sith - Secrets from the Dark Side.pdf", "Book of Sith", "setting"],
  ["Star Wars - Dark Side Sourcebook (Sourcebook).pdf", "Dark Side Sourcebook (pre-Saga)", "setting"],
  ["Force and Destiny - Core Rulebook.pdf", "Force and Destiny (FFG; lore only)", "setting"],
  ["Star Wars - Force and Destiny - Nexus of Power - Force Worlds (Sourcebook).pdf", "Nexus of Power (FFG; lore only)", "setting"],
  ["Medical Sourcebook.pdf", "Medical Sourcebook", "setting"],
  ["Galaxy_of_Consequence_Sourcebook (1).pdf", "Galaxy of Consequence Campaign Sourcebook", "setting"],
  ["Instructions (2).pdf", "Campaign GM Instructions", "setting"],
];

const args = process.argv.slice(2);
const option = (name) => args[args.indexOf(name) + 1];
const only = args.includes("--only") ? String(option("--only") || "").toLowerCase() : "";
const maxPages = args.includes("--max-pages") ? Math.max(1, Number(option("--max-pages")) || 1) : Infinity;
const chosen = books.filter(([filename, title]) => (!only || filename.toLowerCase().includes(only) || title.toLowerCase().includes(only)) && existsSync(resolve(downloads, filename)));
if (!chosen.length) throw new Error("No matching local sourcebooks found in Downloads.");
for (const [filename, title, authority] of chosen) {
  try {
    const result = await indexSourceFile(resolve(downloads, filename), { title, authority, maxPages,
      onProgress: ({ page, pages, extraction, chars }) => {
        if (page === 1 || page % 25 === 0 || page === pages) console.log(`${title}: page ${page}/${pages}, ${extraction}, ${chars} chars`);
      },
    });
    console.log(`${result.title}: ${result.indexedPages}/${result.pages} pages indexed (${result.ocrPages} OCR)`);
  } catch (error) { console.error(`${title}: ${error instanceof Error ? error.message : String(error)}`); }
}
console.log(`${listSourceDocuments().length} private source documents in this campaign database.`);
