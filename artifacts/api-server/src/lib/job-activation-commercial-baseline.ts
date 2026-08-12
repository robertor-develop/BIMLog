import crypto from "node:crypto";
import { FinancialControlError } from "./financial-control-contract";
import { decimalFromScaled, scaledSignedDecimal } from "./financial-budget-contract";

export type ActivatedContractBaselineInput = {
  profileId: string; contractId: string; contractVersionId: string; contractNumber: string; currency: string;
  items: Array<{ stableLineId: string; displayName: string; projectCostNodeId: string; budgetSnapshotLineId: string; quantity: string; unit: string; unitRate: string; contractValue: string; apuPlanVersion?: number | null; workflowTemplate: string }>;
};
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  return JSON.stringify(value);
}
export const activationFingerprint = (value: unknown) => crypto.createHash("sha256").update(canonical(value)).digest("hex");

export function buildActivatedCommercialBaseline(input: { intakeId: string; projectId: number; currency: string; contracts: ActivatedContractBaselineInput[]; workflowInstances: number; workItems: number; tasks: number; resourceAssignments: number }) {
  if (!input.contracts.length) throw new FinancialControlError(409, "ACTIVATION_CONTRACTS_REQUIRED", "At least one activated contract is required.");
  const accounts = new Map<string,{ amount: bigint; contractIds: Set<string>; lineIds: string[] }>();
  const contractItems = input.contracts.flatMap(contract => contract.items.map(item => {
    const expected = (scaledSignedDecimal(item.quantity) * scaledSignedDecimal(item.unitRate) + 500_000n) / 1_000_000n;
    if (expected !== scaledSignedDecimal(item.contractValue)) throw new FinancialControlError(409, "ACTIVATION_ITEM_VALUE_MISMATCH", "Contract Item baseline does not match quantity and unit rate.");
    const budgetAccountId = `budget-account:${input.projectId}:${item.projectCostNodeId}`;
    const account = accounts.get(budgetAccountId) ?? { amount: 0n, contractIds: new Set<string>(), lineIds: [] };
    account.amount += scaledSignedDecimal(item.contractValue); account.contractIds.add(contract.contractId); account.lineIds.push(item.stableLineId); accounts.set(budgetAccountId, account);
    const pricingSnapshot = { quantity:item.quantity, unit:item.unit, unitRate:item.unitRate, contractValue:item.contractValue, apuPlanVersion:item.apuPlanVersion ?? null };
    return { id:`contract-item-baseline:${contract.contractVersionId}:${item.stableLineId}`, contractId:contract.contractId, contractVersionId:contract.contractVersionId, contractNumber:contract.contractNumber, stableLineId:item.stableLineId, displayName:item.displayName, projectCostNodeId:item.projectCostNodeId, budgetAccountId, budgetSnapshotLineId:item.budgetSnapshotLineId, workflowTemplate:item.workflowTemplate, pricingSnapshot, snapshotFingerprint:activationFingerprint(pricingSnapshot) };
  }));
  const budgetAccounts = [...accounts.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([id,a])=>({ id, projectCostNodeId:id.split(":").slice(2).join(":"), amount:decimalFromScaled(a.amount), contractIds:[...a.contractIds].sort(), contractItemIds:[...a.lineIds].sort() }));
  const projectBudget = { currency:input.currency, total:decimalFromScaled(budgetAccounts.reduce((s,a)=>s+scaledSignedDecimal(a.amount),0n)), contractCount:input.contracts.length, contractItemCount:contractItems.length, budgetAccountCount:budgetAccounts.length };
  const drillDown = input.contracts.map(contract=>({ contractId:contract.contractId, contractVersionId:contract.contractVersionId, contractNumber:contract.contractNumber, items:contractItems.filter(i=>i.contractId===contract.contractId).map(i=>({ stableLineId:i.stableLineId, displayName:i.displayName, budgetAccountId:i.budgetAccountId, amount:i.pricingSnapshot.contractValue })) }));
  const content = { schemaVersion:1, intakeId:input.intakeId, projectId:input.projectId, projectBudget, budgetAccounts, contractItems, drillDown, executionBaseline:{ workflowInstances:input.workflowInstances, workItems:input.workItems, tasks:input.tasks, resourceAssignments:input.resourceAssignments } };
  return { ...content, contentFingerprint:activationFingerprint(content) };
}

export async function persistActivatedCommercialBaselineWithClient(client: any, baseline: ReturnType<typeof buildActivatedCommercialBaseline>, actorUserId: number) {
  for (const a of baseline.budgetAccounts) await client.query(`INSERT INTO job_activation_budget_accounts(id,intake_id,project_id,project_cost_node_id,currency,amount,contract_ids,contract_item_ids,content_fingerprint,created_by_id) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10) ON CONFLICT(intake_id,project_cost_node_id) DO NOTHING`,[a.id,baseline.intakeId,baseline.projectId,a.projectCostNodeId,baseline.projectBudget.currency,a.amount,JSON.stringify(a.contractIds),JSON.stringify(a.contractItemIds),activationFingerprint(a),actorUserId]);
  for (const i of baseline.contractItems) await client.query(`INSERT INTO job_activation_contract_item_baselines(id,intake_id,project_id,contract_id,contract_version_id,stable_line_id,budget_account_id,pricing_snapshot,snapshot_fingerprint,created_by_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10) ON CONFLICT(contract_version_id,stable_line_id) DO NOTHING`,[i.id,baseline.intakeId,baseline.projectId,i.contractId,i.contractVersionId,i.stableLineId,i.budgetAccountId,JSON.stringify(i.pricingSnapshot),i.snapshotFingerprint,actorUserId]);
  await client.query(`INSERT INTO job_activation_execution_baselines(id,intake_id,project_id,content,content_fingerprint,created_by_id) VALUES($1,$2,$3,$4::jsonb,$5,$6) ON CONFLICT(intake_id) DO NOTHING`,[`execution-baseline:${baseline.intakeId}`,baseline.intakeId,baseline.projectId,JSON.stringify(baseline),baseline.contentFingerprint,actorUserId]);
  const stored=(await client.query(`SELECT content_fingerprint FROM job_activation_execution_baselines WHERE intake_id=$1`,[baseline.intakeId])).rows[0];
  if(!stored||stored.content_fingerprint!==baseline.contentFingerprint) throw new FinancialControlError(409,"ACTIVATION_BASELINE_CONFLICT","The immutable activation baseline conflicts with the existing activation.");
}
