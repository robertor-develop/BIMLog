import { authorizeFinancialOperation } from "./financial-control-service";
import { FinancialControlError } from "./financial-control-contract";
import { loadApprovedContractEconomicSource } from "./approved-contract-economic-source";
import { deterministicEdtId, edtFingerprint, type EdtTransactionClient } from "./edt-engine-transaction";

/** Internal write primitive; caller must provide its serializable transaction.
 * No caller-supplied money. Contract approval is the monetary authority.
 * A revised contract requires governed reconciliation, never another full reserve.
 */
export async function freezeApprovedContractPools(client: EdtTransactionClient, input: {
  actorUserId: number; projectId: number; contractVersionId: string;
  expectedContractId?:string; expectedContractFingerprint?:string;
}) {
  await authorizeFinancialOperation({actorUserId:input.actorUserId,projectId:input.projectId,
    featureKey:"cost.value_planner.prepare",operation:"prepare",client});
  const source=await loadApprovedContractEconomicSource(client,input);
  if((input.expectedContractId!==undefined&&input.expectedContractId!==source.contractId)||
    (input.expectedContractFingerprint!==undefined&&input.expectedContractFingerprint!==source.contractFingerprint))
    throw new FinancialControlError(409,"CONTRACT_POOLS_STALE","Reopen the exact approved contract before preparing its pools.");
  await client.query("SELECT id FROM financial_contracts WHERE id=$1 FOR UPDATE",[source.contractId]);
  // Preserve legacy monetary history. It needs explicit reconciliation, not an
  // additional contract reserve layered over an existing Work Item reserve.
  const legacy=await client.query(`SELECT id FROM job_activation_work_item_economic_plans
    WHERE contract_id=$1 AND (project_administrative_amount<>0 OR incentive_reserve_amount<>0 OR project_earnings_amount<>0) LIMIT 1`,[source.contractId]);
  if(legacy.rows.length)throw new FinancialControlError(409,"CONTRACT_POOLS_LEGACY_RECONCILIATION_REQUIRED",
    "Existing Work Item pools must be reconciled before creating contract funding.");
  const existing=(await client.query<any>("SELECT * FROM job_contract_economic_pools WHERE contract_id=$1 FOR UPDATE",[source.contractId])).rows[0];
  const {sourceFingerprint,...snapshot}=source;
  if(existing){
    if(existing.company_id!==source.companyId||existing.project_id!==source.projectId||
      existing.contract_version_id!==source.contractVersionId||existing.currency!==source.currency||
      existing.source_fingerprint!==sourceFingerprint||edtFingerprint(existing.source_snapshot)!==sourceFingerprint)
      throw new FinancialControlError(409,"CONTRACT_POOLS_RECONCILIATION_REQUIRED",
        "This contract already has a different frozen funding source. A governed reconciliation is required.");
    return {id:String(existing.id),source,idempotent:true};
  }
  const id=deterministicEdtId("approved-contract-economic-pools",source.contractId);
  await client.query(`INSERT INTO job_contract_economic_pools
    (id,company_id,project_id,contract_id,contract_version_id,currency,source_snapshot,source_fingerprint,created_by_id)
    VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)`,[id,source.companyId,source.projectId,source.contractId,
    source.contractVersionId,source.currency,JSON.stringify(snapshot),sourceFingerprint,input.actorUserId]);
  return {id,source,idempotent:false};
}
