import { positiveActionText } from "./action-intent";

type Ledger = Record<string, unknown>;

/**
 * A player may handle or examine merchandise without that becoming a purchase.
 * Use the complete declaration so a model paraphrase cannot silently turn an
 * inspection into a transfer of ownership.
 */
export function isReadOnlyGoodsInspection(action: string) {
  const text = positiveActionText(action).replace(/[’]/g, "'");
  // Only a direct physical merchandise examination qualifies. Do not
  // reclassify "check a database on my datapad" or "check seed condition"
  // as a retail action merely because they contain generic inspection words.
  const physicalGoods = /\b(?:item|merchandise|goods?|wares?|medpacs?|med[- ]?packs?|weapon|armor|clothing|outfit|robe|coat|suit|gear|device|datapad|droid|vehicle|ship)\b/i;
  const inspectionTarget = /\b(?:inspect|examine|look\s+(?:at|over)|check(?:\s+the)?)\b[^.!?]{0,90}?\b(?:item|merchandise|goods?|wares?|medpacs?|med[- ]?packs?|weapon|armor|clothing|outfit|robe|coat|suit|gear|device|datapad|droid|vehicle|ship)\b/i.test(text);
  const retailDetails = /\b(?:seal|label|expiration|expiry|package|packaging)\b/i.test(text)
    && /\b(?:vendor|seller|merchant|offered|on display|on a shelf|on the shelf|for sale|medpacs?|med[- ]?packs?|armor|clothing|gear|wares?|merchandise|item)\b/i.test(text);
  const nonRetailContext = /\b(?:databases?|archives?|logs?|records?|reports?|registry|certification|clinical|diagnos(?:e|is|tic)|germination|soil|seeds?|test plots?|pressure decay|calibrat(?:e|ion)|readings|survey maps?|sensor data|research|investigat(?:e|ion)|analy[sz]e)\b/i.test(text);
  const materialAction = /\b(?:buy|purchase|pay|charge|accept\s+(?:the\s+)?(?:offer|deal)|sell|trade|keep|pocket|steal|rob|consume|use\s+(?:the|a|an|my)|equip|wear|put\s+(?:(?:it|them|the\s+\w+)\s+)?on|take\s+(?:it|them|the\s+\w+)\s+(?:away|with\s+me|home))\b/i.test(text);
  return (inspectionTarget && physicalGoods.test(text) || retailDetails)
    && !nonRetailContext && !materialAction;
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
