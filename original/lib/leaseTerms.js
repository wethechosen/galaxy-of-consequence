// A lease grants occupancy, not property ownership. The deposit remains a
// refundable liability of the landlord; it is not spendable player cash.
export function validatePriceComponents(value, totalCredits) {
  if (!Array.isArray(value) || !value.length || value.length > 12) throw new Error("Invalid price components.");
  const parts = value.map(part => {
    if (!part || typeof part !== "object" || typeof part.label !== "string" || !part.label.trim() || part.label.length > 160
      || !Number.isSafeInteger(part.credits) || part.credits < 0) throw new Error("Invalid price component.");
    return { label: part.label.trim(), credits: part.credits };
  });
  const total = parts.reduce((sum, part) => sum + part.credits, 0);
  if (!Number.isSafeInteger(total) || total !== totalCredits) throw new Error("Price components must equal the offer total.");
  return parts;
}

export function validateLeaseTerms(value, totalCredits) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid lease terms.");
  const terms = {};
  for (const field of ["propertyName", "propertyLocation", "landlord", "accessDescription"]) {
    if (typeof value[field] !== "string" || !value[field].trim() || value[field].length > 500) throw new Error(`Invalid lease ${field}.`);
    terms[field] = value[field].trim();
  }
  for (const field of ["termMonths", "rentCredits", "refundableDepositCredits"]) {
    if (!Number.isSafeInteger(value[field]) || value[field] < (field === "refundableDepositCredits" ? 0 : 1)) throw new Error(`Invalid lease ${field}.`);
    terms[field] = value[field];
  }
  if (terms.termMonths > 120 || !Number.isSafeInteger(totalCredits) || terms.rentCredits + terms.refundableDepositCredits !== totalCredits) {
    throw new Error("Lease total must equal the rent plus refundable deposit.");
  }
  return terms;
}
