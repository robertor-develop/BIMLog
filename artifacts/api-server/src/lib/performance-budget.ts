export const PERFORMANCE_BUDGETS = Object.freeze({
  applicationReadyMs: 8_000,
  apiP95Ms: 1_000,
  largestBrowserAssetBytes: 750 * 1024,
  totalBrowserJavaScriptBytes: 4 * 1024 * 1024,
  lensPayloadBytes: 500 * 1024 * 1024,
  reportGenerationMs: 10_000,
});

export function percentile(values: readonly number[], fraction: number): number {
  if (!values.length) throw new Error("PERFORMANCE_SAMPLE_REQUIRED");
  if (!Number.isFinite(fraction) || fraction <= 0 || fraction > 1) {
    throw new Error("PERFORMANCE_PERCENTILE_INVALID");
  }
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * fraction) - 1]!;
}

export function assertWithinBudget(name: string, measured: number, budget: number): void {
  if (!Number.isFinite(measured) || measured < 0) throw new Error(`${name}_MEASUREMENT_INVALID`);
  if (measured > budget) throw new Error(`${name}_BUDGET_EXCEEDED:${measured}>${budget}`);
}
