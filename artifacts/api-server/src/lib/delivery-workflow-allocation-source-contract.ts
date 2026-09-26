import { FinancialControlError } from "./financial-control-contract";
import { validatePricingTemplate } from "./company-pricing-template-contract";
import type { CommercialApuAllocationSource } from "./delivery-workflow-economic-allocation";

function cents(value: string): bigint {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value))
    throw new FinancialControlError(409, "WORKFLOW_APU_AMOUNT_INVALID", "The published APU contains an invalid monetary amount.");
  const [whole, fractional = ""] = value.split(".");
  return BigInt(whole) * 100n + BigInt(fractional.padEnd(2, "0"));
}
const money = (value: bigint) => `${value / 100n}.${String(value % 100n).padStart(2, "0")}`;

export function economicCheckerAllowed(input: {
  creatorId: number;
  lastEditorId: number;
  checkerId: number;
  hasFinanceGrant: boolean;
}): boolean {
  return input.hasFinanceGrant && workflowTemplateCheckerAllowed(input);
}

export function workflowTemplateCheckerAllowed(input: {
  creatorId: number;
  lastEditorId: number;
  checkerId: number;
}): boolean {
  return Number.isSafeInteger(input.checkerId) && input.checkerId > 0 &&
    input.checkerId !== input.creatorId && input.checkerId !== input.lastEditorId;
}

/** Eligibility is advisory; the locked approval command still rechecks all authority. */
export function workflowReviewEligibility(input: {
  state: string; canManage: boolean; creatorId: number; lastEditorId: number;
  checkerId: number; economic: boolean; hasFinanceGrant: boolean;
}): { eligible: boolean; code: string } {
  if (!input.canManage) return { eligible:false, code:"DELIVERY_WORKFLOW_PMO_REQUIRED" };
  if (input.state !== "draft") return { eligible:false, code:"DELIVERY_WORKFLOW_NOT_DRAFT_OR_STALE" };
  if (!workflowTemplateCheckerAllowed(input)) return { eligible:false, code:"DELIVERY_WORKFLOW_INDEPENDENT_CHECKER_REQUIRED" };
  if (input.economic && !input.hasFinanceGrant) return { eligible:false, code:"DELIVERY_WORKFLOW_FINANCE_CHECKER_REQUIRED" };
  return { eligible:true, code:"DELIVERY_WORKFLOW_REVIEW_ELIGIBLE" };
}

export function sourceFromVerifiedCommercialApu(input: {
  definition: unknown;
  versionId: string;
  fingerprint: string;
  currency: string;
}): CommercialApuAllocationSource {
  let validated: ReturnType<typeof validatePricingTemplate>;
  try { validated = validatePricingTemplate(input.definition); }
  catch { throw new FinancialControlError(409, "WORKFLOW_APU_INTEGRITY", "The published APU definition failed verification."); }
  if (validated.fingerprint !== input.fingerprint || validated.definition.currency !== input.currency)
    throw new FinancialControlError(409, "WORKFLOW_APU_INTEGRITY", "The published APU identity or currency changed.");
  const allocation = validated.definition.economicAllocation;
  if (!allocation) throw new FinancialControlError(409, "WORKFLOW_APU_PHASE_DEFAULTS_MISSING",
    "This APU version has no approved direct-production phase schedule; publish a new APU version with one.");
  const selected = new Set(allocation.directProductionNodeIds);
  const amount = validated.preview.lines.reduce((total, line) => total + (selected.has(line.id) ? cents(line.roundedAmount) : 0n), 0n);
  if (amount > 100_000_000_000n) throw new FinancialControlError(409, "WORKFLOW_APU_AMOUNT_RANGE", "The direct-production amount is outside the preview range.");
  return {
    commercialApuVersionId: input.versionId,
    commercialApuFingerprint: input.fingerprint,
    currency: input.currency,
    directProductionAmount: money(amount),
    phases: allocation.phases,
  };
}
