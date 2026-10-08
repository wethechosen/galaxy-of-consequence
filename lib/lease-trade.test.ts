import { afterEach, describe, expect, it, vi } from "vitest";
import { parseEngineResponse } from "@/original/lib/engineState";
import * as accounts from "./accounts";
import type { Account } from "./accounts";
import { openStorage } from "./storage";
import { readDatapad, saveAuthoritativeDatapad, type DatapadSnapshot } from "./datapad-save";
import { assertMaterialAuthority, runGmTurn } from "./gm";
import {
  applyConversationPurchase, commitConversationTradeState, conversationTradeInstruction, currentTradeOffers,
  isVerifiedConversationTradeDelta, planConversationTrade, reconcileConversationTradeDelta, validateTradeOffers,
} from "./conversation-trade";
import type { NvidiaRequest } from "./original-provider";

const provider = vi.hoisted(() => vi.fn());
vi.mock("./original-provider", async (importOriginal) => ({
  ...await importOriginal<typeof import("./original-provider")>(), invokeNvidia: provider,
}));
const databases: ReturnType<typeof openStorage>[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  provider.mockReset();
  databases.splice(0).forEach(db => db.close());
});

const LOCATION = "Coruscant — Docking Bay 94 — Jax's brokerage desk";
const lease = {
  propertyName: "Unit 3-G", propertyLocation: "Coruscant — Level 512 — Unit 3-G",
  landlord: "Vestara Holdings LLC", termMonths: 6, rentCredits: 108_000,
  refundableDepositCredits: 18_000, accessDescription: "Apartment access chip and six months of tenancy",
};
const offer = {
  sellerName: "Jax", totalCredits: 126_000,
  items: [{ name: "Unit 3-G apartment access chip", qty: 1, tag: "access" }], lease,
};
const ACCEPT = "I accept Jax's offer and pay the agreed price.";
const snapshot = (): DatapadSnapshot => ({
  character: { name: "D'mir Holloran", level: 1, experience: 700, equipArmor: "Armored flight suit" },
  gameState: {
    credits: 1_199_996_506, creditsCriminal: 0, location: LOCATION, health: 26,
    campaignTimeMinutes: 180, combat: { status: "escaped" }, properties: [],
    inventory: [{ id: "pistol", name: "Blaster pistol", qty: 1, tag: "weapon" }],
  }, messages: [], comms: [], settings: {},
});
const quotedSnapshot = () => {
  const initial = snapshot();
  return { ...initial, gameState: commitConversationTradeState(initial.gameState, { tradeOfferAdd: [offer] }, null, "lease_quote_01") };
};

describe("typed, authoritative apartment leases", () => {
  it("saves the exact lease quote without granting access, ownership, cash, or XP", () => {
    const initial = snapshot();
    const quoted = quotedSnapshot();
    expect(currentTradeOffers(quoted.gameState)).toEqual([expect.objectContaining(offer)]);
    expect(quoted.gameState.credits).toBe(initial.gameState.credits);
    expect(quoted.gameState.inventory).toEqual(initial.gameState.inventory);
    expect(quoted.gameState.properties).toEqual([]);
    expect(quoted.character).toEqual(initial.character);
    expect(initial.gameState).not.toHaveProperty("tradeOffers");
  });

  it("persists typed lease terms through the generated-ledger allowlist", () => {
    const parsed = parseEngineResponse(`Jax offers the apartment.\n<!--STATE:${JSON.stringify({ tradeOfferAdd: [offer] })}-->`, { requireState: true });
    expect(parsed.delta).toEqual({ tradeOfferAdd: [offer] });
  });

  it("validates rent and refundable deposit as a whole-credit decomposition of the agreed total", () => {
    expect(validateTradeOffers([offer])).toEqual([offer]);
    const invalid = [
      { ...offer, totalCredits: 108_000 },
      { ...offer, lease: { ...lease, refundableDepositCredits: -1 } },
      { ...offer, lease: { ...lease, rentCredits: 107_999.5 } },
      { ...offer, lease: { ...lease, termMonths: 0 } },
      { ...offer, lease: { ...lease, landlord: "" } },
      { ...offer, lease: { ...lease, propertyLocation: "" } },
    ];
    for (const item of invalid) {
      expect(() => validateTradeOffers([item])).toThrow();
      expect(() => parseEngineResponse(`Offer\n<!--STATE:${JSON.stringify({ tradeOfferAdd: [item] })}-->`, { requireState: true })).toThrow();
    }
  });

  it("commits the 126,000-credit payment, tenancy, deposit liability, access, and receipt together", () => {
    const prior = quotedSnapshot();
    const completed = applyConversationPurchase(prior, ACCEPT, "lease_payment_01");
    expect(completed.gameState.credits).toBe(1_199_870_506);
    expect(completed.gameState.creditsCriminal).toBe(0);
    expect(completed.gameState.inventory).toEqual([
      { id: "pistol", name: "Blaster pistol", qty: 1, tag: "weapon" },
      expect.objectContaining(offer.items[0]),
    ]);
    expect(completed.gameState.properties).toEqual([expect.objectContaining({
      name: lease.propertyName, location: lease.propertyLocation, tenure: "leased", status: "active",
      baseValue: 0, income: 0, upkeep: 0,
      lease: expect.objectContaining({ ...lease, offerId: "offer:lease_quote_01:0", startedAtCampaignMinute: 180 }),
    })]);
    const property = (completed.gameState.properties as Record<string, unknown>[])[0];
    expect(JSON.stringify(property)).toContain("leased");
    expect(JSON.stringify(property)).toContain("Vestara Holdings LLC");
    expect(JSON.stringify(property)).toContain("18000");
    expect(property.baseValue || 0).toBe(0);
    expect(property.income || 0).toBe(0);
    expect(property.ownership).not.toBe("owned");
    expect(Number((property.lease as Record<string, unknown>).endsAtCampaignMinute)).toBeGreaterThan(180);
    expect(completed.gameState.tradeReceipts).toEqual([expect.objectContaining({ turnId: "lease_payment_01", totalCredits: 126_000, lease })]);
    expect(completed.character).toEqual(prior.character);
    expect(completed.gameState.campaignTimeMinutes).toBe(180);
    expect(completed.gameState.location).toBe(LOCATION);
  });

  it("is idempotent on retries, restored saves, and a repeated acceptance under a new turn id", () => {
    const completed = applyConversationPurchase(quotedSnapshot(), ACCEPT, "lease_payment_01");
    expect(applyConversationPurchase(completed, ACCEPT, "lease_payment_01")).toBe(completed);
    expect(applyConversationPurchase(structuredClone(completed), ACCEPT, "lease_payment_02")).toEqual(completed);
    expect(currentTradeOffers(completed.gameState)).toEqual([]);
    expect(completed.gameState.tradeReceipts).toHaveLength(1);
    expect(completed.gameState.properties).toHaveLength(1);
  });

  it("requires saved terms and sufficient funds, not another authorization or successful roll", () => {
    const quoted = quotedSnapshot();
    const trade = planConversationTrade(ACCEPT, quoted.gameState, "lease_payment_01");
    expect(trade).toMatchObject({ status: "accepted", offer });
    expect(conversationTradeInstruction(trade)).toContain("requires no Saga check");
    const delta = reconcileConversationTradeDelta({}, trade)!;
    expect(isVerifiedConversationTradeDelta(delta, trade)).toBe(true);
    expect(() => assertMaterialAuthority(delta, ACCEPT, null, quoted.gameState, trade)).not.toThrow();

    const broke = { ...quoted, gameState: { ...quoted.gameState, credits: 125_999 } };
    expect(planConversationTrade(ACCEPT, broke.gameState, "lease_payment_01")).toMatchObject({ status: "insufficient-funds" });
    expect(applyConversationPurchase(broke, ACCEPT, "lease_payment_01")).toBe(broke);
    const unquoted = snapshot();
    expect(applyConversationPurchase(unquoted, ACCEPT, "lease_payment_01")).toBe(unquoted);
    expect(() => assertMaterialAuthority({ credits: -126_000, propertyAdd: [{ name: "Unit 3-G" }] }, ACCEPT, null, unquoted.gameState)).toThrow();
  });

  it("does not turn the refundable deposit into a cash refund or permit unrelated asset grants", () => {
    const quoted = quotedSnapshot();
    const trade = planConversationTrade(ACCEPT, quoted.gameState, "lease_payment_01");
    const reconciled = reconcileConversationTradeDelta({ credits: 18_000, creditsCriminal: 18_000, inventoryAdd: [{ name: "Star Destroyer", qty: 1 }] }, trade)!;
    expect(reconciled.credits).toBe(-126_000);
    expect(reconciled.creditsCriminal).toBe(0);
    expect(reconciled.inventoryAdd).toEqual(offer.items);
    expect(() => assertMaterialAuthority({ ...reconciled, propertyAdd: [{ name: "Unquoted palace" }] }, ACCEPT, null, quoted.gameState, trade)).toThrow();
    expect(() => assertMaterialAuthority({ ...reconciled, shipAdd: [{ name: "Star Destroyer" }] }, ACCEPT, null, quoted.gameState, trade)).toThrow();
  });

  it("verifies the exact granted items and tags, not repeated matches for the same item", () => {
    const quoted = quotedSnapshot();
    const trade = planConversationTrade(ACCEPT, quoted.gameState, "lease_payment_01");
    const delta = reconcileConversationTradeDelta({}, trade)!;
    expect(isVerifiedConversationTradeDelta({ ...delta, inventoryAdd: [{ ...offer.items[0], tag: "weapon" }] }, trade)).toBe(false);
    expect(isVerifiedConversationTradeDelta({ ...delta, inventoryAdd: [offer.items[0], offer.items[0]] }, trade)).toBe(false);
    expect(isVerifiedConversationTradeDelta({ ...delta, inventoryAdd: [{ ...offer.items[0], qty: 2 }] }, trade)).toBe(false);
  });
});

describe("lease turns through the actual GM save pipeline", () => {
  it("uses the player's ordinary acceptance, needs no roll, and reloads a single paid lease", async () => {
    const db = accounts.accountStore(openStorage(":memory:"));
    databases.push(db);
    const actor: Account = { id: "lease-test-dmir", username: "dmir@galaxy.local", displayName: "D'mir", role: "player" };
    db.prepare("INSERT INTO accounts VALUES (?, ?, ?, ?, '', '')").run(actor.id, actor.username, actor.displayName, actor.role);
    vi.spyOn(accounts, "accountStore").mockReturnValue(db);
    const initial = quotedSnapshot();
    saveAuthoritativeDatapad(actor, null, 0, initial, db);
    provider.mockImplementation(async (request: NvidiaRequest) => {
      if (!request.sourceQuery) return { provider: "nvidia", model: "intent-fixture", finishReason: "stop", content: JSON.stringify({
        intent: "commerce", canonicalAction: ACCEPT, declaredSpan: ACCEPT, checkNeeded: false, skill: null,
        rationale: "Acceptance of the broker's established affordable lease.", travelTarget: null,
      }) };
      return { provider: "nvidia", model: "lease-fixture", finishReason: "stop", content: `## LOCATION
${LOCATION}

## SCENE
Jax angles the payment terminal toward your hand across the scratched brokerage desk. Beyond the office partition, cargo repulsors whine along the docking lane. The six-month tenancy agreement remains open beside the terminal, listing Vestara Holdings LLC as landlord and Unit 3-G on Level 512 as the apartment. An access chip rests in its fitted slot.

## GM ADJUDICATION
You accepted Jax's recorded terms and have sufficient funds. Paying the agreed amount requires no Saga check.

## GAMEPLAY RESULT
The terminal confirms your payment of 126,000 credits: 108,000 for the six-month tenancy and 18,000 held as a refundable deposit. Jax countersigns the lease and hands you the access chip. You hold tenancy and access, not ownership of the apartment.

## SAGA CHECK
No check required.

## STATE UPDATE
126,000 credits paid. Six-month lease and 18,000-credit refundable deposit recorded. Unit 3-G access chip received.

## PLAYER OPTIONS
A. Ask Jax for directions to the apartment.
B. Review the building's entry instructions.
You may declare another action.
<!--STATE:{}-->` };
    });
    const input = { turnId: "lease_integration_01", revision: 1, action: ACCEPT };
    const result = await runGmTurn(actor, input);
    expect(result.roll).toBeNull();
    expect(result.fallbackReason).toBeNull();
    expect(result.snapshot.gameState.credits).toBe(1_199_870_506);
    expect(result.snapshot.gameState.properties).toHaveLength(1);
    expect(result.snapshot.gameState.tradeReceipts).toHaveLength(1);
    expect(result.snapshot.character).toMatchObject({ level: 1, experience: 700 });
    expect(readDatapad(actor, null, db).snapshot).toEqual(result.snapshot);
    const calls = provider.mock.calls.length;
    expect(await runGmTurn(actor, input)).toEqual(result);
    expect(provider).toHaveBeenCalledTimes(calls);
    expect(readDatapad(actor, null, db).revision).toBe(2);
  });
});
