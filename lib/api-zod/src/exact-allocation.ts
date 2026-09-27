export const economicPoolKeys = ["fixedCompanyCost", "directProduction", "projectAdministration", "incentiveReserve", "projectEarnings"] as const;
export type EconomicPoolKey = typeof economicPoolKeys[number];
export type EconomicPoolNodes = Record<EconomicPoolKey, string[]>;

/** Apportion integer minor units without a negative residual. Ties use input order.
 * Pure arithmetic only: callers supply the authorized weights and funding source.
 */
export function allocateMinorUnits(total: bigint, weights: readonly bigint[]): bigint[] {
  if (total < 0n || !weights.length || weights.some(weight => weight < 0n))
    throw new RangeError("Allocation requires non-negative units and weights.");
  const denominator = weights.reduce((sum, weight) => sum + weight, 0n);
  if (denominator === 0n) throw new RangeError("Allocation weights must have a positive total.");
  const amounts = weights.map(weight => total * weight / denominator);
  let remaining = total - amounts.reduce((sum, amount) => sum + amount, 0n);
  const order = weights.map((weight, index) => ({ index, remainder: total * weight % denominator }))
    .sort((a, b) => a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1);
  for (const entry of order) {
    if (remaining === 0n) break;
    amounts[entry.index] = amounts[entry.index]! + 1n;
    remaining--;
  }
  return amounts;
}
