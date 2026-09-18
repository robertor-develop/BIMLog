import { createHash } from "node:crypto";

// Preview contract only. Runtime callers must resolve and verify this reference
// against the canonical, approved Commercial APU version before activation.
export type CommercialApuAllocationSource = {
  commercialApuVersionId: string;
  commercialApuFingerprint: string;
  currency: string;
  directProductionAmount: string;
  phases: Array<{ phaseId: string; code: string; name: string; percent: string }>;
};
export type AllocationProposal =
  | { method: "apu_default" }
  | { method: "proportional"; additions: Array<{ phaseId: string; code: string; name: string; percent: string }> }
  | { method: "deduct_specific"; additions: Array<{ phaseId: string; code: string; name: string; percent: string }>; deductions: Array<{ phaseId: string; percent: string }> }
  | { method: "custom"; phases: Array<{ phaseId: string; code: string; name: string; percent: string }>; approvalReason: string };

export class EconomicAllocationError extends Error {
  constructor(public readonly code: string, public readonly field: string) {
    super(`${code}: ${field}`);
  }
}
const fail = (code: string, field: string): never => { throw new EconomicAllocationError(code, field); };
const id = (value: string, field: string): string =>
  typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(value) ? value : fail("ALLOCATION_ID_INVALID", field);
const label = (value: string, field: string): string =>
  typeof value === "string" && !!value.trim() && value.trim().length <= 200 && !/[\u0000-\u001f\u007f]/.test(value) ? value.trim() : fail("ALLOCATION_LABEL_INVALID", field);
const decimal = (value: string, field: string, maxWhole: number): number => {
  if (typeof value !== "string" || !/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value)) fail("ALLOCATION_DECIMAL_INVALID", field);
  const [whole, fraction = ""] = value.split(".");
  const parsed = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(parsed) || parsed > maxWhole * 100) fail("ALLOCATION_DECIMAL_RANGE", field);
  return parsed;
};
const percent = (value: string, field: string) => decimal(value, field, 100);
const money = (value: number) => `${Math.floor(value / 100)}.${String(value % 100).padStart(2, "0")}`;
const pct = (value: number) => money(value);
type Phase = { phaseId: string; code: string; name: string; points: number };
const readPhases = (input: CommercialApuAllocationSource["phases"], field: string): Phase[] => {
  if (!Array.isArray(input) || input.length < 1 || input.length > 24) fail("ALLOCATION_PHASE_COUNT", field);
  const phases = input.map((row, i) => {
    if (!row || typeof row !== "object") fail("ALLOCATION_PHASE_INVALID", `${field}[${i}]`);
    return {
      phaseId: id(row.phaseId, `${field}[${i}].phaseId`),
      code: id(row.code, `${field}[${i}].code`),
      name: label(row.name, `${field}[${i}].name`),
      points: percent(row.percent, `${field}[${i}].percent`),
    };
  });
  if (new Set(phases.map(row => row.phaseId)).size !== phases.length ||
      new Set(phases.map(row => row.code)).size !== phases.length) fail("ALLOCATION_DUPLICATE_PHASE", field);
  return phases;
};
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const requireHundred = (phases: Phase[], field: string) => {
  if (sum(phases.map(row => row.points)) !== 10000) fail("ALLOCATION_TOTAL_NOT_100", field);
};
// Largest-remainder rounding preserves exact totals and deterministic input order.
function apportion(total: number, weights: number[]): number[] {
  const denominator = sum(weights);
  if (denominator <= 0) fail("ALLOCATION_ZERO_WEIGHT", "weights");
  const floors = weights.map(weight => Math.floor(total * weight / denominator));
  const remainders = weights.map((weight, index) => ({ index, remainder: (total * weight) % denominator }));
  remainders.sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  const remaining = total - sum(floors);
  for (let i = 0; i < remaining; i++) floors[remainders[i].index]++;
  return floors;
}

export function previewEconomicAllocation(source: CommercialApuAllocationSource, proposal: AllocationProposal) {
  if (!source || typeof source !== "object") fail("ALLOCATION_SOURCE_REQUIRED", "source");
  id(source.commercialApuVersionId, "commercialApuVersionId");
  if (typeof source.commercialApuFingerprint !== "string" || !/^[a-f0-9]{64}$/.test(source.commercialApuFingerprint)) fail("ALLOCATION_SOURCE_FINGERPRINT_INVALID", "commercialApuFingerprint");
  if (typeof source.currency !== "string" || !/^[A-Z]{3}$/.test(source.currency)) fail("ALLOCATION_CURRENCY_INVALID", "currency");
  const amountCents = decimal(source.directProductionAmount, "directProductionAmount", 1_000_000_000);
  const defaults = readPhases(source.phases, "source.phases");
  requireHundred(defaults, "source.phases");
  if (!proposal || typeof proposal !== "object") fail("ALLOCATION_PROPOSAL_REQUIRED", "proposal");
  let effective: Phase[];
  switch (proposal.method) {
    case "apu_default":
      effective = defaults.map(row => ({ ...row }));
      break;
    case "proportional": {
      const additions = readPhases(proposal.additions, "additions");
      const added = sum(additions.map(row => row.points));
      if (added >= 10000) fail("ALLOCATION_ADDITION_TOO_LARGE", "additions");
      const redistributed = apportion(10000 - added, defaults.map(row => row.points));
      effective = [...defaults.map((row, i) => ({ ...row, points: redistributed[i] })), ...additions];
      break;
    }
    case "deduct_specific": {
      const additions = readPhases(proposal.additions, "additions");
      if (!Array.isArray(proposal.deductions) || proposal.deductions.length < 1) fail("ALLOCATION_DEDUCTIONS_REQUIRED", "deductions");
      const deductions = new Map<string, number>();
      for (const [index, row] of proposal.deductions.entries()) {
        if (!row || typeof row !== "object") fail("ALLOCATION_DEDUCTION_INVALID", `deductions[${index}]`);
        const phaseId = id(row.phaseId, `deductions[${index}].phaseId`);
        if (deductions.has(phaseId)) fail("ALLOCATION_DUPLICATE_DEDUCTION", "deductions");
        deductions.set(phaseId, percent(row.percent, `deductions[${index}].percent`));
      }
      if (sum([...deductions.values()]) !== sum(additions.map(row => row.points))) fail("ALLOCATION_DEDUCTION_MISMATCH", "deductions");
      effective = [...defaults.map(row => {
        const deduction = deductions.get(row.phaseId) ?? 0;
        if (deduction > row.points) fail("ALLOCATION_DEDUCTION_EXCEEDS_PHASE", row.phaseId);
        return { ...row, points: row.points - deduction };
      }), ...additions];
      for (const key of deductions.keys()) if (!defaults.some(row => row.phaseId === key)) fail("ALLOCATION_UNKNOWN_PHASE", key);
      break;
    }
    case "custom":
      label(proposal.approvalReason, "approvalReason");
      effective = readPhases(proposal.phases, "phases");
      break;
    default:
      return fail("ALLOCATION_METHOD_INVALID", "method");
  }
  if (effective.length > 24) fail("ALLOCATION_PHASE_COUNT", "phases");
  if (new Set(effective.map(row => row.phaseId)).size !== effective.length ||
      new Set(effective.map(row => row.code)).size !== effective.length) fail("ALLOCATION_DUPLICATE_PHASE", "phases");
  requireHundred(effective, "phases");
  const cents = apportion(amountCents, effective.map(row => row.points));
  const base = new Map(defaults.map(row => [row.phaseId, row.points]));
  const rows = effective.map((row, index) => ({
    phaseId: row.phaseId, code: row.code, name: row.name,
    apuDefaultPercent: pct(base.get(row.phaseId) ?? 0),
    workflowPercent: pct(row.points),
    deltaPercent: pct(Math.abs(row.points - (base.get(row.phaseId) ?? 0))),
    deltaDirection: Math.sign(row.points - (base.get(row.phaseId) ?? 0)),
    amount: money(cents[index]),
  }));
  const snapshot = {
    schemaVersion: 1 as const,
    authority: "commercial_apu_preview_only" as const,
    commercialApuVersionId: source.commercialApuVersionId,
    commercialApuFingerprint: source.commercialApuFingerprint,
    currency: source.currency,
    directProductionAmount: money(amountCents),
    method: proposal.method,
    requiresApproval: proposal.method === "custom",
    approvalReason: proposal.method === "custom" ? proposal.approvalReason.trim() : null,
    rows,
  };
  return { ...snapshot, fingerprint: createHash("sha256").update(JSON.stringify(snapshot)).digest("hex") };
}
