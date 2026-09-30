export type FinancialReconciliationSnapshot = Readonly<{
  currency: string;
  totals: Readonly<Record<string, string>>;
  versionIds: readonly string[];
  approvalIds: readonly string[];
  roleGrants: readonly string[];
}>;

export type FinancialReconciliationResult = Readonly<{
  status: "pass" | "mismatch";
  mismatches: readonly Readonly<{ field: string; before: string; after: string }>[];
}>;

const DECIMAL = /^-?(?:0|[1-9]\d*)(?:\.\d{1,6})?$/;

function exactAmount(value: string): bigint {
  if (!DECIMAL.test(value)) throw new Error("INVALID_EXACT_FINANCIAL_AMOUNT");
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = value.replace("-", "").split(".");
  const scaled = BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
  return negative ? -scaled : scaled;
}

const normalizedSet = (values: readonly string[], label: string) => {
  if (values.some((value) => !value.trim()) || new Set(values).size !== values.length) throw new Error(`INVALID_${label}_SET`);
  return [...values].sort();
};

export function reconcileFinancialAuthority(before: FinancialReconciliationSnapshot, after: FinancialReconciliationSnapshot): FinancialReconciliationResult {
  const mismatches: Array<{ field: string; before: string; after: string }> = [];
  if (before.currency !== after.currency) mismatches.push({ field: "currency", before: before.currency, after: after.currency });

  const totalKeys = [...new Set([...Object.keys(before.totals), ...Object.keys(after.totals)])].sort();
  for (const key of totalKeys) {
    const prior = before.totals[key];
    const current = after.totals[key];
    if (prior == null || current == null || exactAmount(prior) !== exactAmount(current)) mismatches.push({ field: `total:${key}`, before: prior ?? "MISSING", after: current ?? "MISSING" });
  }

  const compareSet = (field: "versionIds" | "approvalIds" | "roleGrants") => {
    const prior = normalizedSet(before[field], field);
    const current = normalizedSet(after[field], field);
    if (JSON.stringify(prior) !== JSON.stringify(current)) mismatches.push({ field, before: prior.join("|"), after: current.join("|") });
  };
  compareSet("versionIds");
  compareSet("approvalIds");
  compareSet("roleGrants");
  return Object.freeze({ status: mismatches.length ? "mismatch" : "pass", mismatches });
}
