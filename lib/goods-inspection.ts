import { positiveActionText } from "./action-intent";

type Ledger = Record<string, unknown>;

/**
 * A player may handle or examine merchandise without that becoming a purchase.
 * Use the complete declaration so a model paraphrase cannot silently turn an
 * inspection into a transfer of ownership.
 */
export function isReadOnlyGoodsInspection(action: string) {
  const text = positiveActionText(action).replace(/[’]/g, "'");
  const inspection = /\b(?:inspect|examine|look\s+(?:at|over)|check(?:\s+the)?|read)\b/i.test(text);
  const goods = /\b(?:item|merchandise|goods?|wares?|medpacs?|med[- ]?packs?|seal|label|expiration|expiry|condition|package|packaging|weapon|armor|clothing|outfit|robe|coat|suit|gear|device|datapad|droid|vehicle|ship)\b/i.test(text);
  const materialAction = /\b(?:buy|purchase|pay|charge|accept\s+(?:the\s+)?(?:offer|deal)|sell|trade|keep|pocket|steal|rob|consume|use\s+(?:the|a|an|my)|equip|wear|put\s+(?:(?:it|them|the\s+\w+)\s+)?on|take\s+(?:it|them|the\s+\w+)\s+(?:away|with\s+me|home))\b/i.test(text);
  return inspection && goods && !materialAction;
}

/** Inspection is observational, never an implicit account or ownership event. */
export function constrainReadOnlyGoodsInspectionDelta(delta: Ledger | null, action: string, acceptedTrade = false): Ledger | null {
  if (!delta || acceptedTrade || !isReadOnlyGoodsInspection(action)) return delta;
  return {
    ...delta,
    credits: 0,
    creditsCriminal: 0,
    bankCredits: 0,
    inventoryAdd: [],
    inventoryRemove: [],
    propertyAdd: [],
    shipAdd: [],
    investmentAdd: [],
  };
}
