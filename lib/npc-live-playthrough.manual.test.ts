import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { accountStore, createAccount, type Account } from "./accounts";
import { readDatapad, saveAuthoritativeDatapad, type DatapadSnapshot } from "./datapad-save";
import { runGmTurn } from "./gm";
import { NPC_TEST_ROSTER } from "./npc-test-roster";

const enabled = process.env.GOC_LIVE_NPC_TEST === "1";
const character = NPC_TEST_ROSTER.find(npc => npc.id === "kelvek")!;
const declarations = [
  "I approach the prison librarian duty counter and ask which public study materials I may consult today.",
  "I review the public catalogue display without requesting privileged or personal records.",
  "I ask the duty clerk what the procedure is for reserving a public catalogue workstation.",
];

describe.skipIf(!enabled)("LIVE NVIDIA / three decisions / Kelvek 147 ABY flashback", () => {
  it("commits actual model-generated outcomes and rereads each preserved turn", async () => {
    const db = accountStore();
    const username = "npc-kelvek-live-test";
    let actor = db.prepare("SELECT id, username, displayName, role FROM accounts WHERE username = ?").get(username) as Account | undefined;
    if (!actor) actor = createAccount(username, randomBytes(36).toString("hex"), "Kelvek (NPC test)", "player", db);
    let record = readDatapad(actor, null, db);
    if (!record.snapshot) {
      const snapshot: DatapadSnapshot = {
        character: {
          name: character.name, age: character.age, species: "Muun", homeworld: "Muunilinst",
          background: character.background, allegiance: character.allegiance,
          appearance: character.appearance, forceSensitive: "No", forceAlignment: "Gray",
          equipPrimary: "None", equipSecondary: "None", equipArmor: "Detention tunic",
          equipSpecial: "Library access credential", skills: "Knowledge (bureaucracy), Knowledge (galactic lore)",
          goal: character.objective, contacts: character.contact, level: 1, experience: 0,
          sagaStats: "STR 8 | DEX 10 | CON 10 | INT 16 | WIS 14 | CHA 12",
          talents: "", feats: "", forcePowers: "None known",
        },
        gameState: {
          location: character.location, credits: 0, creditsCriminal: 0, health: 18,
          campaignTimeMinutes: 147 * 525600, campaignYearABY: 147, inventory: [],
          scene: { location: character.location, beat: 1, summary: "Detention library. A public catalogue display is accessible under supervision. No secret assets are available or known." },
          turnEvents: [], objectives: [{title:character.objective,status:"active"}],
        },
        messages: [], comms: [], settings: { tone: "grounded" },
      };
      saveAuthoritativeDatapad(actor,null,0,snapshot,db);
      record = readDatapad(actor,null,db);
    }
    for (const [step, action] of declarations.entries()) {
      const turnId = "npc-kelvek-live-147aby-step-" + (step+1);
      // Preserve previously committed outcomes across repeated manual test runs.
      const prior = (record.snapshot?.gameState?.turnEvents as any[] || []).find(e => e.turnId === turnId);
      if (prior) {
        console.info("LIVE_NPC_PRIOR", JSON.stringify({step:step+1,revision:record.revision,turnId}));
        continue;
      }
      const result = await runGmTurn(actor,{revision:record.revision,action,turnId});
      expect(result.receipt.status).toBe("committed");
      record = readDatapad(actor,null,db);
      expect(record.revision).toBe(result.revision);
      expect(record.snapshot?.character?.name).toBe("Kelvek");
      console.info("LIVE_NPC_SUCCESS", JSON.stringify({
        step: step+1, turnId, revision:record.revision,
        narration:result.narration.slice(0,2400),
        credits:record.snapshot?.gameState.credits, location:record.snapshot?.gameState.location,
        xp:record.snapshot?.character?.experience
      }));
      const replay=await runGmTurn(actor,{revision:result.revision-1,action,turnId});
      expect(replay.revision).toBe(record.revision);
      expect(readDatapad(actor,null,db).revision).toBe(record.revision);
    }
  },180000);
});