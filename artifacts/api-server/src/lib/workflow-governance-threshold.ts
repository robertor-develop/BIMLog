import { FinancialControlError, parseCurrency, scaledDecimal } from "./financial-control-contract";
import { activationFingerprint } from "./job-activation-commercial-baseline";

export type GovernanceMoney = { amount: string; currency: string };
export function governanceThresholdApplies(threshold: { amountMinor: number; currency: string } | null,
  money: GovernanceMoney | null): boolean {
  if (!threshold) return true;
  const currency = parseCurrency(threshold.currency);
  if (!Number.isSafeInteger(threshold.amountMinor) || threshold.amountMinor < 0)
    throw new FinancialControlError(409, "WORKFLOW_POLICY_THRESHOLD_INVALID", "The policy threshold must use exact nonnegative minor units.");
  if (!money) throw new FinancialControlError(409, "WORKFLOW_POLICY_AMOUNT_REQUIRED", "An immutable contract-item value is required to evaluate this approval threshold.");
  if (money.currency !== currency)
    throw new FinancialControlError(409, "WORKFLOW_POLICY_CURRENCY_MISMATCH", "The frozen contract currency must match the policy threshold; no automatic currency conversion is permitted.");
  const digits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits;
  if (digits == null || digits > 6) throw new FinancialControlError(409, "WORKFLOW_POLICY_THRESHOLD_INVALID", "Unsupported currency precision.");
  // Strictly exceeds, not rounded equality. Retain all six stored decimal places.
  return scaledDecimal(money.amount) > BigInt(threshold.amountMinor) * 10n ** BigInt(6 - digits);
}

export async function frozenWorkflowMoney(client: { query(sql: string, values?: any[]): Promise<{rows:any[]}> },
  workItemId: string, companyId: number, projectId: number): Promise<GovernanceMoney> {
  const row = (await client.query(`SELECT b.pricing_snapshot,b.snapshot_fingerprint,a.currency
    FROM job_activation_work_items w
    JOIN job_intakes i ON i.id=w.intake_id AND i.company_id=$2
    JOIN job_activation_contract_item_baselines b ON b.intake_id=w.intake_id AND b.project_id=w.project_id
      AND b.contract_version_id=w.contract_version_id AND b.stable_line_id=w.stable_scope_item_id
    JOIN job_activation_budget_accounts a ON a.id=b.budget_account_id AND a.intake_id=w.intake_id AND a.project_id=w.project_id
    WHERE w.id=$1 AND w.project_id=$3`, [workItemId, companyId, projectId])).rows[0];
  if (!row) throw new FinancialControlError(409, "WORKFLOW_POLICY_AMOUNT_REQUIRED", "The Work Item has no immutable contract-item economic baseline.");
  if (activationFingerprint(row.pricing_snapshot) !== row.snapshot_fingerprint)
    throw new FinancialControlError(409, "WORKFLOW_POLICY_AMOUNT_MISMATCH", "The frozen contract-item value failed integrity verification.");
  return { amount: row.pricing_snapshot.contractValue, currency: row.currency };
}
