import { afterEach, describe, expect, it, vi } from "vitest";
import * as accounts from "./accounts";
import { openStorage } from "./storage";
import { saveAuthoritativeDatapad, readDatapad, type DatapadSnapshot } from "./datapad-save";
import { runGmTurn, gmSystemForCharacter, GM_SYSTEM } from "./gm";
import { NPC_TEST_ROSTER, ALL_NPC_TEST_ROSTER, type NpcTestSubject } from "./npc-test-roster";
import {
  applySagaFoundation, availableClassSkills, foundationRequirements,
} from "@/original/lib/sagaAdvancement";
import type { NvidiaRequest } from "./original-provider";

const provider = vi.hoisted(() => vi.fn());
vi.mock("./original-provider", async (importActual) => ({
  ...(await importActual<typeof import("./original-provider")>()),
  invokeNvidia: provider,
}));

type Scenario = { npc: NpcTestSubject; step: number; action: string };
const actions = new Map<string, Scenario>();
const makeActions = (npc: NpcTestSubject) => [
  `I ask the duty attendant how public ${npc.subject} records can be viewed.`,
  `I walk along the posted permitted route to ${npc.destination}.`,
  `I inspect the displayed ${npc.subject} entries for concealed discrepancies.`,
  `I ask the duty attendant for the authorized filing procedure concerning ${npc.subject}.`,
  `I thank the attendant and walk into the adjacent visitor waiting alcove.`,
];
for (const npc of ALL_NPC_TEST_ROSTER) makeActions(npc).forEach((action, step) => actions.set(action, { npc, step, action }));

function sceneContext(request: NvidiaRequest) {
  const raw = String(request.system || "").split("CURRENT AUTHORITATIVE CAMPAIGN STATE:\n")[1]?.split("\n\n")[0];
  if (!raw) throw new Error("Authoritative state missing in simulated GM request");
  return JSON.parse(raw) as { character: Record<string, unknown>; world: Record<string, unknown> };
}

function narrated(scenario: Scenario, request: NvidiaRequest) {
  const { npc, step, action } = scenario;
  const context = sceneContext(request);
  const currentLocation = String(context.world.location || "");
  if (context.character.name !== npc.name) throw new Error(`Wrong campaign active for ${npc.id}`);
  const destination = step === 1 ? npc.destination : step === 4 ? `${npc.destination} — visitor waiting alcove` : currentLocation;
  const location = destination;
  const rollRaw = String(request.system || "").split("AUTHORITATIVE SAGA RESULT:\n")[1]?.split("\n")[0] || "";
  const roll = rollRaw.startsWith("{") ? JSON.parse(rollRaw) as Record<string, unknown> : null;
  const passed = roll?.outcome === "success";
  const deltas: Array<Record<string, unknown>> = [
    { discoveryAdd: [{ title: `${npc.subject}: posted public process`, detail: `The ${npc.contact.toLowerCase()} identifies the permitted request channel; restricted records remain private.` }] },
    { location: npc.destination, timeAdvanceMinutes: 7 },
    passed ? { discoveryAdd: [{ title: `${npc.subject}: anomalous public entry`, detail: "The visible public page contains an out-of-sequence registry number; this is an observation, not evidence of misconduct." }] } : {},
    {},
    { location: destination, timeAdvanceMinutes: 2 },
  ];
  const outcomes = [
    `The ${npc.contact.toLowerCase()} indicates the available permitted request channel for ${npc.subject}. Access to private files is not offered. You now know where and how to review the posted documents, but no privileged access or payment has been arranged.`,
    `You follow the openly posted corridor to ${npc.destination}. The permitted reading desk is staffed, its directory legible, and the records available for ordinary inspection. Your movement is completed; nothing is bought, seized, or transferred.`,
    passed
      ? `Your scrutiny of the exposed ${npc.subject} entry identifies one out-of-sequence registry number among otherwise orderly public rows. You record this limited anomaly without inferring fraud, gaining hidden records, or claiming anyone's property.`
      : `A shifting screen protector masks the disputed line in the ${npc.subject} list. You cannot determine whether the entry is altered from this attempt; the attendant points out the authorized review process as an available next step.`,
    `The ${npc.contact.toLowerCase()} explains that a public discrepancy concern is logged through a written service request. No assertion of wrongdoing is confirmed, and the employee neither guarantees an outcome nor accepts a formal claim on your behalf.`,
    `You leave the inspection desk and enter the adjacent visitor waiting alcove. A direction display and wall-mounted clock mark the normal visitor route. The inspection is over for now, and your observations remain available in your personal campaign record.`,
  ];
  const scenes = [
    `You face the ${npc.contact.toLowerCase()} across a marked visitor counter. An amber terminal reflects on the counter rail while ventilation hums overhead. Your request for public ${npc.subject} information gets the attendant's attention, and the available procedure is explained without resistance.`,
    `You step away from the reception counter and move beneath the public direction plates. Pale overhead lights mark the safe visitor corridor while service workers sort portable holotabs behind a partition. The passage to the reading desk is open, and you arrive without any private clearance.`,
    `You stand close to the registry display, following the numbered lines with your eyes. The projector emits a faint electrical buzz and the reader's glass shows an imperfect reflection. Your careful inspection meets the physical limits of what the openly displayed text can establish.`,
    `You return your attention to the duty attendant on the other side of the reading desk. A stamp terminal chimes from the far corner, and the clerk straightens a stack of official forms. Your request concerns how to file an observation, not an accusation or a purchase.`,
    `You leave the desk at a normal walking pace and cross the clearly marked visitor threshold. The waiting alcove is illuminated by cool strips along the wall, and a muted HoloNet directory scrolls beside the seats. The nearby staff continue normal duties as the brief inspection concludes.`,
  ];
  const stateDelta = deltas[step];
  const result = outcomes[step];
  const check = roll ? `${String(roll.label || "Perception")} ${String(roll.formula || "1d20")} yields ${String(roll.total || "")}.\nRESULT: ${String(roll.outcome).toUpperCase()}` : "No check required.";
  const resultText = `## LOCATION\n${location}\n\n## SCENE\n${scenes[step]}\n\n## GM ADJUDICATION\nThe declared activity is resolved only at the recorded public location. ${roll ? "The server-owned Saga skill result determines whether a hidden inconsistency is recognized." : "This is an accessible, ordinary public procedure and requires no contested check."}\n\n## GAMEPLAY RESULT\n${result}\n\n## SAGA CHECK\n${check}\n\n## STATE UPDATE\n${Object.keys(stateDelta).length ? "The observed change is recorded without awarding property or currency." : "No persistent change."}\n\n## PLAYER OPTIONS\nA. Review another accessible public notice.\nB. Ask the staff about permitted hours.\nYou may declare another action.\n<!--STATE:${JSON.stringify(stateDelta)}-->`;
  return { provider: "nvidia", model: "offline-npc-simulation", finishReason: "stop", content: resultText };
}

function makeCharacter(npc: NpcTestSubject) {
  return {
    name: npc.name, age: String(npc.age), species: npc.species, homeworld: npc.homeworld,
    background: npc.background, allegiance: npc.allegiance, forceSensitive: npc.id === "kelvek" ? "No" : "Unknown", forceAlignment: "Gray",
    appearance: npc.appearance, equipPrimary: "No weapon drawn", equipSecondary: "None",
    equipArmor: "Ordinary civilian clothing", equipSpecial: "Personal datapad",
    skills: "Public procedures, observation and professional knowledge", goal: npc.objective,
    contacts: npc.contact, imageHeadshot: "", imageFullBody: "",
    level: 1, experience: 0, talents: "", feats: "", forcePowers: "None known",
    abilityScores: { strength: 10, dexterity: 12, constitution: 12, intelligence: 10, wisdom: 12, charisma: 10 },
  };
}
function initialSave(npc: NpcTestSubject): DatapadSnapshot {
  const snapshot: DatapadSnapshot = {
    character: makeCharacter(npc),
    gameState: {
      location: npc.location, credits: 350, health: 26, inventory: [], timeAdvanceMinutes: 0,
      campaignTimeMinutes: npc.yearABY === 147 ? 147 * 525600 : 150 * 525600,
      scene: { location: npc.location, beat: 1, summary: `At ${npc.location}, ${npc.name} begins an independent public-record inspection. ${npc.background}` },
      objectives: [{ title: npc.objective, status: "active" }], turnEvents: [],
    },
    messages: [], comms: [], settings: { tone: "grounded" },
  };
  if (npc.species !== "Human") return snapshot; // Non-human Heroic foundation is not supported by the present verified builder.
  const character = snapshot.character!;
  const available = availableClassSkills(character, npc.classId).map((entry: {id:string}) => entry.id);
  const requirement = foundationRequirements(character, npc.classId);
  const needed = Number(requirement.trainedSkillCount);
  if (available.length < needed) throw new Error(`Insufficient class skill options for ${npc.id}`);
  const choices = {
    advancementId: `npc-foundation-${npc.id}`, classId: npc.classId,
    trainedSkillIds: available.slice(0, needed),
    generalFeatId: "improved-defenses", humanBonusFeatId: "toughness",
    talentId: npc.talentId, languageIds: [],
  };
  return applySagaFoundation(snapshot, choices, "2026-10-16T00:00:00.000Z") as DatapadSnapshot;
}

afterEach(() => { vi.restoreAllMocks(); provider.mockReset(); });

describe("35 independent NPC campaign playthroughs / offline scripted provider", () => {
  it("does not leak the primary campaign prompt into NPC histories", () => {
    expect(gmSystemForCharacter({ name: "D'mir Holloran" })).toBe(GM_SYSTEM);
    for (const npc of ALL_NPC_TEST_ROSTER) {
      const prompt = gmSystemForCharacter({ name: npc.name });
      expect(prompt).toContain(`NPC TEST CAMPAIGN: ${npc.name}`);
      expect(prompt).not.toContain("D'mir's creator may clarify");
      expect(prompt).not.toContain("D'mir continuity anchors are binding");
      expect(prompt).not.toContain("D'mir is actively seeking");
    }
  });

  it("runs creation -> five gameplay turns -> committed replay -> save reload for all 35 NPCs", async () => {
    const db = accounts.accountStore(openStorage(":memory:"));
    vi.spyOn(accounts, "accountStore").mockReturnValue(db);
    const byId = new Map(ALL_NPC_TEST_ROSTER.map(npc => [npc.id,npc]));
    const outcomes: Array<Record<string, unknown>> = [];
    provider.mockImplementation(async (request: NvidiaRequest) => {
      if (!request.sourceQuery) {
        const source = String(request.messages.at(-1)?.content || "");
        const declaration = source.split("PLAYER DECLARATION:\n")[1]?.trim() || "";
        const candidate = actions.get(declaration);
        const found = candidate?.step === 4
          ? { ...candidate, npc: ALL_NPC_TEST_ROSTER.find(npc => source.includes(`"name":"${npc.name}"`))! }
          : candidate;
        if (!found?.npc) throw new Error(`No NPC test action registered: ${declaration.slice(0,80)}`);
        const intent = found.step === 1 || found.step === 4 ? "travel" : found.step === 2 ? "search" : "dialogue";
        return { provider:"nvidia", model:"npc-intent-fixture", finishReason:"stop",
          content: JSON.stringify({
            intent, canonicalAction: declaration, declaredSpan: declaration,
            checkNeeded: intent === "search", skill: intent === "search" ? "Perception" : null,
            rationale:"Public routine, travel or a Saga Perception check as declared.",
            travelTarget: intent === "travel" ? (found.step === 1 ? found.npc.destination : `${found.npc.destination} — visitor waiting alcove`) : null,
          }) };
      }
      const candidate = actions.get(String(request.sourceQuery));
      const activeName = sceneContext(request).character.name;
      const found = candidate?.step === 4
        ? { ...candidate, npc: ALL_NPC_TEST_ROSTER.find(npc => npc.name === activeName)! }
        : candidate;
      if (!found?.npc) throw new Error("Unrecognized GM source query during NPC campaign test");
      return narrated(found, request);
    });
    try {
      for (const npc of ALL_NPC_TEST_ROSTER) {
        const actor: accounts.Account = {
          id: `npc-test-${npc.id}`, username: `npc-${npc.id}@isolated.goc`,
          displayName: npc.name, role: "player",
        };
        db.prepare("INSERT INTO accounts VALUES (?, ?, ?, ?, '', '')").run(actor.id, actor.username, actor.displayName, actor.role);
        const seeded = initialSave(npc);
        expect(seeded.character?.name).toBe(npc.name);
        expect(seeded.character?.species).toBe(npc.species);
        expect(seeded.gameState.location).toBe(npc.location);
        if (npc.species === "Human") {
          expect(seeded.character?.talentSelections).toEqual([expect.objectContaining({ id: npc.talentId })]);
          expect(seeded.character?.classLevels).toMatchObject({ [npc.classId]: 1 });
        } else {
          expect(seeded.character?.talentSelections).toBeUndefined();
        }
        saveAuthoritativeDatapad(actor, null, 0, seeded, db);
        let revision = 1;
        let lastResult: Awaited<ReturnType<typeof runGmTurn>> | null = null;
        for (const [step, action] of makeActions(npc).entries()) {
          const turnId = `npc-${npc.id}-step-${step}-sim`;
          const result = await runGmTurn(actor, { revision, action, turnId });
          expect(result.revision).toBe(revision + 1);
          expect(result.receipt.status).toBe("committed");
          expect(result.narration).toContain("GAMEPLAY RESULT");
          expect(result.snapshot.character?.name).toBe(npc.name);
          expect(result.snapshot.gameState.credits).toBe(350);
          const reloaded = readDatapad(actor, null, db);
          expect(reloaded.revision).toBe(result.revision);
          expect(reloaded.snapshot).toEqual(result.snapshot);
          const replay = await runGmTurn(actor, { revision, action, turnId });
          expect(replay.revision).toBe(result.revision);
          expect(readDatapad(actor, null, db).revision).toBe(result.revision);
          revision = result.revision;
          lastResult = result;
        }
        expect(lastResult).not.toBeNull();
        expect(lastResult!.snapshot.gameState.turnEvents).toHaveLength(5);
        expect(lastResult!.snapshot.gameState.location).toContain("visitor waiting alcove");
        expect(lastResult!.snapshot.messages.filter((m: any) => m.role === "assistant")).toHaveLength(5);
        expect(lastResult!.snapshot.gameState.credits).toBe(350);
        outcomes.push({
          id: npc.id, name: npc.name, species: npc.species, yearABY: npc.yearABY,
          level: lastResult!.snapshot.character?.level, xp: lastResult!.snapshot.character?.experience,
          location: lastResult!.snapshot.gameState.location, turns: 5,
          talent: lastResult!.snapshot.character?.talents,
          successfulChecks: (lastResult!.snapshot.gameState.turnEvents as Array<any>).filter(event => event.roll?.outcome === "success").length,
        });
      }
      expect(outcomes).toHaveLength(35);
      expect(new Set(outcomes.map(row => row.name)).size).toBe(35);
      console.info("NPC_PLAYTHROUGHS", JSON.stringify(outcomes));
    } finally {
      db.close();
    }
  }, 120_000);
});
