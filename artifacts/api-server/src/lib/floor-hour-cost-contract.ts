import crypto from "node:crypto";
import { FinancialControlError } from "./financial-control-contract";
import { decimalFromScaled, scaledSignedDecimal } from "./financial-budget-contract";

export const EXCESS_HOUR_RATE = "3.5";
export const ELIGIBLE_EXCESS_STATUSES = new Set(["approved", "legacy_recorded"]);

export type FloorHourCostEntry = {
  id: string;
  workDate: string;
  createdAt: string;
  hours: string;
  normalRate: string;
  status: string;
  supersededByEntryId?: string | null;
  userId?: number;
  assignmentId?: string | null;
};

export function canonicalFloorHourEstimate(value: unknown) {
  const scaled = scaledSignedDecimal(String(value ?? ""));
  if (scaled <= 0n) throw new FinancialControlError(400, "FLOOR_HOUR_ESTIMATE_INVALID", "Approved floor hours must be greater than zero.");
  return decimalFromScaled(scaled);
}

export function floorHourEstimateFingerprint(input: { projectId: number; workItemId: string; locationIdentity: string; version: number; approvedHours: string; excessRate: string; policyVersionId: string }) {
  return crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function money(hours: bigint, rate: bigint) { return (hours * rate + 500_000n) / 1_000_000n; }

export function allocateFloorHourCosts(input: { estimateVersionId: string; approvedHours: unknown; excessRate?: unknown; entries: readonly FloorHourCostEntry[] }) {
  const threshold = scaledSignedDecimal(canonicalFloorHourEstimate(input.approvedHours));
  const excessRate = scaledSignedDecimal(String(input.excessRate ?? EXCESS_HOUR_RATE));
  if (excessRate < 0n) throw new FinancialControlError(400, "EXCESS_HOUR_RATE_INVALID", "Excess-hour rate must be nonnegative.");
  let consumed = 0n;
  const eligible = input.entries
    .filter((entry) => ELIGIBLE_EXCESS_STATUSES.has(entry.status) && !entry.supersededByEntryId)
    .sort((a, b) => a.workDate.localeCompare(b.workDate) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const allocations = eligible.map((entry) => {
    const hours = scaledSignedDecimal(entry.hours);
    if (hours <= 0n) throw new FinancialControlError(400, "FLOOR_HOUR_ENTRY_INVALID", "Eligible time must be greater than zero.");
    const normalHours = consumed >= threshold ? 0n : (hours < threshold - consumed ? hours : threshold - consumed);
    const excessHours = hours - normalHours;
    const normalRate = scaledSignedDecimal(entry.normalRate);
    if (normalRate < 0n) throw new FinancialControlError(400, "FLOOR_HOUR_NORMAL_RATE_INVALID", "Normal member cost must be nonnegative.");
    const normalCost = money(normalHours, normalRate), excessCost = money(excessHours, excessRate);
    consumed += hours;
    const result = {
      entryId: entry.id, estimateVersionId: input.estimateVersionId, sequenceHoursBefore: decimalFromScaled(consumed - hours),
      normalHours: decimalFromScaled(normalHours), excessHours: decimalFromScaled(excessHours), normalRate: decimalFromScaled(normalRate),
      excessRate: decimalFromScaled(excessRate), normalCost: decimalFromScaled(normalCost), excessCost: decimalFromScaled(excessCost),
      totalCost: decimalFromScaled(normalCost + excessCost), customerBillingRateChanged: false as const,
    };
    return { ...result, calculationFingerprint: crypto.createHash("sha256").update(JSON.stringify(result)).digest("hex") };
  });
  const total = (key: "normalHours" | "excessHours" | "normalCost" | "excessCost" | "totalCost") => decimalFromScaled(allocations.reduce((sum, row) => sum + scaledSignedDecimal(row[key]), 0n));
  return { estimateVersionId: input.estimateVersionId, approvedHours: decimalFromScaled(threshold), excessRate: decimalFromScaled(excessRate), allocations, totals: { normalHours: total("normalHours"), excessHours: total("excessHours"), normalCost: total("normalCost"), excessCost: total("excessCost"), totalCost: total("totalCost") } };
}
