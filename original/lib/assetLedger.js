// Read-only projection of existing authoritative datapad fields.
// No invented values, ownership grants, pricing ticks, or save mutations.
const record = value => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const rows = value => Array.isArray(value) ? value.filter(record) : [];
const nonnegative = value => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
const positive = value => { const amount = nonnegative(value); return amount !== null && amount > 0 ? amount : null; };
const label = (value, fallback) => typeof value === "string" && value.trim() ? value.trim() : fallback;

export function buildAssetLedger(gameState = {}) {
  const state = record(gameState) ? gameState : {};
  // Missing historic balances are not evidence of a new transaction.
  const spendable = nonnegative(state.credits);
  const deposited = nonnegative(state.bankCredits ?? 0);
  const underworld = nonnegative(state.creditsCriminal ?? 0);
  const combined = spendable !== null && deposited !== null && Number.isSafeInteger(spendable + deposited)
    ? spendable + deposited : null;

  const holdings = [
    ...rows(state.properties).map((asset, index) => {
      const leased = asset.tenure === "leased" || asset.status === "leased"
        || record(asset.lease) || /\blease\b/i.test(String(asset.type || ""));
      return {
        id: label(asset.id, "property-" + index),
        category: "property", name: label(asset.name, "Unnamed property"),
        status: leased ? "leasehold" : "recorded holding",
        location: label(asset.location, "Location not recorded"),
        basisCredits: leased ? null : positive(asset.baseValue),
        // A tenant's refundable security deposit is held by the landlord, not banked credits.
        depositCredits: leased && record(asset.lease) ? nonnegative(asset.lease.refundableDepositCredits) : null,
        rentCredits: leased && record(asset.lease) ? nonnegative(asset.lease.rentCredits) : null,
      };
    }),
    ...rows(state.ships).map((asset, index) => ({
      id: label(asset.id, "ship-" + index),
      category: "ship", name: label(asset.name, "Unnamed vessel"),
      status: "recorded holding", location: label(asset.location, "Location not recorded"),
      basisCredits: positive(asset.baseValue),
      depositCredits: null, rentCredits: null,
    })),
    ...rows(state.investments).map((asset, index) => ({
      id: label(asset.id, "investment-" + index),
      category: "investment", name: label(asset.name, "Unnamed investment"),
      status: "recorded position", location: label(asset.type, "Instrument not recorded"),
      // Historical committed amount is not a current market valuation.
      basisCredits: positive(asset.amount),
      depositCredits: null, rentCredits: null,
    })),
  ];

  const legacyClaims = rows(state.legacyAssets).map((asset, index) => ({
    id: label(asset.id, "legacy-" + index),
    name: label(asset.name, "Unidentified claim"),
    status: label(asset.status, "unverified"),
    category: label(asset.category, "legacy claim"),
    // Never include estimated inheritance in liquid balances or owned holdings.
  }));

  const purchases = rows(state.tradeReceipts).slice(-8).reverse().map((entry, index) => ({
    id: label(entry.turnId, label(entry.id, "receipt-" + index)),
    seller: label(entry.sellerName, "Merchant not recorded"),
    amountCredits: nonnegative(entry.totalCredits),
    items: rows(entry.items).map(item => ({
      name: label(item.name, "Unnamed item"), quantity: positive(item.qty) ?? 1,
    })),
    lease: record(entry.lease),
  }));

  const transfers = rows(state.bankTransactions).slice(-8).reverse().map((entry, index) => ({
    id: label(entry.transactionId, "bank-" + index),
    action: entry.action === "deposit" || entry.action === "withdraw" ? entry.action : "transfer",
    amountCredits: nonnegative(entry.amount),
    committedAt: label(entry.committedAt, ""),
  }));

  return {
    balances: { spendable, deposited, totalGalactic: combined, underworld },
    holdings, legacyClaims, purchases, transfers,
    // Neither unknown asset values nor leases should be included in a made-up net worth.
    valuationStatus: "No automatic net-worth estimate; only recorded cash and historic bases are displayed.",
  };
}
