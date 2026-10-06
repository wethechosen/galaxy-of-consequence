import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("./original-provider", () => ({ invokeNvidia: vi.fn() }));
import { invokeNvidia } from "./original-provider";
import { buildSemanticSagaCheck, interpretSagaAction, validateSagaSemanticAction } from "./saga-action-plan";
import type { SagaSemanticAction } from "./saga-action-plan";

const character = { name: "D'mir Holloran", level: 1, sagaStats: "STR 12 | DEX 14 | CON 10 | INT 12 | WIS 10 | CHA 11", trainedSkills: ["Use Computer"] };
const state = { location: "Coruscant — lower-city market", credits: 5000, inventory: [] };
const semantic = (action: string, patch: Partial<SagaSemanticAction> = {}): SagaSemanticAction => ({
  intent: "dialogue", canonicalAction: action, declaredSpan: action, checkNeeded: false, skill: null,
  rationale: "An ordinary request for information from the merchant.", travelTarget: null, ...patch,
});
const reply = (plan: SagaSemanticAction) => vi.mocked(invokeNvidia).mockResolvedValueOnce({ content: JSON.stringify(plan), provider: "nvidia", model: "test", finishReason: "stop" });

beforeEach(() => vi.resetAllMocks());

describe("semantic interpretation before Saga mechanics", () => {
  it("resolves equivalent computer intents without demanding trigger words", async () => {
    for (const declaration of ["I slice the locked terminal", "I work around the terminal's access restrictions", "I get the restricted terminal to show me its files"] ) {
      reply(semantic(declaration, { intent: "manipulate", canonicalAction: "I bypass the locked terminal's authentication using its computer interface", checkNeeded: true, skill: "Use Computer", rationale: "The terminal denies access; overcoming its access control is uncertain." }));
      const result = await interpretSagaAction(declaration, character, state);
      expect(result.fallbackReason).toBeNull();
      expect(result.semantic?.declaredSpan).toBe(declaration);
      expect(buildSemanticSagaCheck(result.semantic!, character, state)).toMatchObject({ label: "Use Computer", modifier: 6, kind: "skill", target: 15 });
    }
  });

  it("treats dialogue, quoted acceptance, normal travel, safe rest, and waiting as ordinary no-check acts", async () => {
    for (const [declaration, intent] of [
      ['"Ain\'t looking for free. Where can I pay for a room?"', "dialogue"],
      ['I grab the suit and tunic. "Where can I rest?"', "commerce"],
      ["I make my way back to the market", "travel"], ["I get some sleep in my paid room", "rest"], ["I give him a moment to answer", "wait"],
    ] as const) {
      reply(semantic(declaration, { intent, travelTarget: intent === "travel" ? "the market" : null }));
      const result = await interpretSagaAction(declaration, character, state);
      expect(result.semantic?.intent).toBe(intent);
      expect(buildSemanticSagaCheck(result.semantic!, character, state)).toBeNull();
    }
  });

  it("understands a sale acceptance without a coded buy phrase and retains the real scene context", async () => {
    const action = 'I set the credits on the counter. "Wrap that outfit. Know where I can sleep?"';
    reply(semantic(action, { intent: "commerce", canonicalAction: "I buy the suit and tunic at the quoted price", declaredSpan: 'I set the credits on the counter. "Wrap that outfit.', rationale: "The player is accepting the merchant's quoted bundle and then asking for lodging directions." }));
    const result = await interpretSagaAction(action, character, {
      ...state, scene: { summary: "A Twi'lek vendor displays a suit and tunic at 1500 credits." },
      sceneMerchant: { name: "Clothing vendor", species: "Twi'lek" }, turnEvents: [{ action: "I ask for armored clothes" }],
    });
    expect(result.semantic?.canonicalAction).toBe("I buy the suit and tunic at the quoted price");
    expect(buildSemanticSagaCheck(result.semantic!, character, state)).toBeNull();
    const request = vi.mocked(invokeNvidia).mock.calls[0][0];
    expect(request.messages[0].content).toContain("A Twi'lek vendor displays a suit and tunic");
    expect(request.messages[0].content).toContain('"recentTurnActions":[{"action":"I ask for armored clothes"}]');
    expect(request.messages[0].content).toContain(action);
  });

  it("does not let an interpretation impose a Persuasion check on every spoken line", () => {
    const action = 'I ask the vendor "Where can I get a room?"';
    const result = validateSagaSemanticAction(semantic(action, { checkNeeded: true, skill: "Persuasion" }), action);
    expect(result.checkNeeded).toBe(false);
    expect(result.skill).toBeNull();
    expect(buildSemanticSagaCheck(result, character, state)).toBeNull();
  });

  it("preserves contested social attempts while no-check speech remains playable", async () => {
    const action = '"Call it twelve hundred and we have a deal."';
    reply(semantic(action, { intent: "social", canonicalAction: "I negotiate a discount on the quoted suit", checkNeeded: true, skill: "Persuasion", rationale: "The vendor's price is established and the player is requesting a concession." }));
    const result = await interpretSagaAction(action, character, state);
    expect(buildSemanticSagaCheck(result.semantic!, character, state)).toMatchObject({ label: "Persuasion", modifier: 0, target: 15 });
  });
  it("does not erase explicit uncertainty just because an intent is commerce or rest", () => {
    const bargain = 'I bargain for a lower price';
    const unsafeRest = 'I try to sleep through the freezing storm';
    expect(buildSemanticSagaCheck(validateSagaSemanticAction(semantic(bargain, { intent: "commerce", checkNeeded: true, skill: "Persuasion" }), bargain), character, state)?.label).toBe("Persuasion");
    expect(buildSemanticSagaCheck(validateSagaSemanticAction(semantic(unsafeRest, { intent: "rest", checkNeeded: true, skill: "Endurance" }), unsafeRest), character, state)?.label).toBe("Endurance");
  });

  it("ignores negated hostilities and recognizes the affirmative alternative", async () => {
    const action = "I do not attack anyone; I ask the vendor for directions";
    reply(semantic(action, { declaredSpan: "I ask the vendor for directions", canonicalAction: "I ask the vendor for directions" }));
    const result = await interpretSagaAction(action, character, state);
    expect(result.semantic?.intent).toBe("dialogue");
    expect(buildSemanticSagaCheck(result.semantic!, character, state)).toBeNull();
    expect(() => validateSagaSemanticAction(semantic("I do not attack anyone", { intent: "attack", checkNeeded: true }), "I do not attack anyone")).toThrow(/negated/);
  });

  it("preserves future direction without granting present success or mechanics", async () => {
    const action = "Eventually I want to leave Coruscant and build a financial empire";
    reply(semantic(action, { intent: "goal", canonicalAction: action, rationale: "This is intended campaign direction, not an attempted action now." }));
    const result = await interpretSagaAction(action, character, state);
    expect(result.semantic?.intent).toBe("goal");
    expect(buildSemanticSagaCheck(result.semantic!, character, state)).toBeNull();
    expect(result.semantic).not.toHaveProperty("credits");
  });

  it("allows a declared attack paraphrase to use the existing combat referee", async () => {
    const action = "I put a blaster bolt into the trooper's chest";
    reply(semantic(action, { intent: "attack", canonicalAction: "I shoot the trooper with my blaster pistol", checkNeeded: true, skill: "Initiative", rationale: "The player initiates a hostile attack against an actual trooper." }));
    const result = await interpretSagaAction(action, character, state);
    expect(buildSemanticSagaCheck(result.semantic!, character, state)).toMatchObject({ kind: "initiative", modifier: 2, damage: null });
  });

  it("uses stored stats and training, with no model authority over DCs, dice, or outcomes", () => {
    const action = "I get around the security terminal's access controls";
    const plan = semantic(action, { intent: "manipulate", checkNeeded: true, skill: "Use Computer", rationale: "A meaningful computer-access obstacle." });
    expect(buildSemanticSagaCheck(plan, { ...character, level: 4, abilityScores: { intelligence: 16 } }, state)).toMatchObject({ modifier: 10, target: 20 });
    for (const extra of [{ credits: 100000 }, { outcome: "success" }, { modifier: 100 }, { target: 1 }, { inventoryAdd: [{ name: "Holocron" }] }]) {
      expect(() => validateSagaSemanticAction({ ...plan, ...extra }, action)).toThrow(/state changes/);
    }
    expect(() => validateSagaSemanticAction({ ...plan, skill: "Force Move" }, action)).toThrow(/Saga Edition skills/);
  });

  it("never gives unearned Force training or powers through interpretation", () => {
    const action = "I reach out with the Force to lift the slab";
    const plan = semantic(action, { intent: "force", checkNeeded: true, skill: "Use the Force", rationale: "A deliberate Force technique is being attempted." });
    expect(buildSemanticSagaCheck(plan, character, state)).toBeNull();
    expect(buildSemanticSagaCheck(plan, { ...character, trainedSkills: ["Use the Force"], forcePowers: "None recorded" }, state)).toBeNull();
    expect(buildSemanticSagaCheck(plan, { ...character, trainedSkills: ["Use the Force"], forcePowers: "Move Object" }, state)).toMatchObject({ label: "Use the Force", modifier: 5 });
    expect(character.trainedSkills).toEqual(["Use Computer"]);
  });

  it("marks unavailable build stats and untrained technical tasks provisional", () => {
    const action = "I work around the terminal's access restrictions";
    const plan = semantic(action, { intent: "manipulate", canonicalAction: "I bypass the terminal's access restrictions", checkNeeded: true, skill: "Use Computer" });
    expect(buildSemanticSagaCheck(plan, { level: 1, sagaStats: "unestablished" }, state)).toMatchObject({ provisional: true, modifier: 0 });
    expect(buildSemanticSagaCheck(plan, { ...character, trainedSkills: [] }, state)).toMatchObject({ provisional: true, modifier: 1 });
  });

  it("returns a reason and the deterministic fallback path when provider output is unavailable or invalid", async () => {
    vi.mocked(invokeNvidia).mockRejectedValueOnce(new Error("Provider timed out"));
    expect(await interpretSagaAction("I walk to the market", character, state)).toEqual({ semantic: null, fallbackReason: "Provider timed out" });
    vi.mocked(invokeNvidia).mockResolvedValueOnce({ content: "not json", provider: "nvidia", model: "test", finishReason: "stop" });
    expect((await interpretSagaAction("I walk to the market", character, state)).semantic).toBeNull();
    reply(semantic("I fly away", { intent: "travel", travelTarget: "Coruscant" }));
    expect(await interpretSagaAction("I stay here", character, state)).toMatchObject({ semantic: null, fallbackReason: expect.stringMatching(/exact declaration/) });
  });
});
