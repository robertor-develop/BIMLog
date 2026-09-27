import { allocateMinorUnits } from "@workspace/api-zod";
import { decimalFromScaled, scaledSignedDecimal } from "./financial-budget-contract";
import { FinancialControlError } from "./financial-control-contract";
import { sourceFromVerifiedCommercialApu } from "./delivery-workflow-allocation-source-contract";
import { previewEconomicAllocation } from "./delivery-workflow-economic-allocation";
import { deliveryWorkflowFingerprint, validateDeliveryWorkflowDefinition } from "./delivery-workflow-template-contract";
import { freezeApprovedContractPools } from "./contract-economic-pool-service";
import { createWorkItemEconomicPlanWithClient } from "./edt-engine-economic-service";
import { EdtEngineConflict, withEdtTransaction, type EdtTransactionHost } from "./edt-engine-transaction";

type Actor=Parameters<typeof createWorkItemEconomicPlanWithClient>[0]["actor"];
type Source=Awaited<ReturnType<typeof freezeApprovedContractPools>>["source"];

/** Pure projection of already verified server records, not caller monetary authority. */
export function approvedItemPhaseAllocation(source:Source,stableLineId:string,workflow:{definition:unknown;fingerprint:string}){
  let definition:ReturnType<typeof validateDeliveryWorkflowDefinition>;
  try{definition=validateDeliveryWorkflowDefinition(workflow.definition);}
  catch{throw new EdtEngineConflict("ECONOMIC_WORKFLOW_SNAPSHOT_MISMATCH","The activated workflow definition is invalid.");}
  if(deliveryWorkflowFingerprint(definition)!==workflow.fingerprint)
    throw new EdtEngineConflict("ECONOMIC_WORKFLOW_SNAPSHOT_MISMATCH","The activated workflow fingerprint is invalid.");
  if(definition.economicAllocation?.sourceVersionId!==source.apu.versionId)
    throw new EdtEngineConflict("ECONOMIC_WORKFLOW_APU_MISMATCH","The activated workflow must use the approved contract APU version.");
  const items=source.allocations.filter(item=>item.stableLineId===stableLineId);
  if(items.length!==1)throw new EdtEngineConflict("ECONOMIC_ITEM_ALLOCATION_MISMATCH","Exactly one approved item allocation is required.");
  const reference=sourceFromVerifiedCommercialApu({definition:source.apu.definition,versionId:source.apu.versionId,
    fingerprint:source.apu.fingerprint,currency:source.currency});
  // Preview determines the approved weights only. Money remains exact to six
  // decimals, rather than being rounded to the preview's two-decimal amounts.
  let preview:ReturnType<typeof previewEconomicAllocation>;
  try{preview=previewEconomicAllocation({...reference,directProductionAmount:"0"},definition.economicAllocation.proposal);}
  catch{throw new EdtEngineConflict("ECONOMIC_WORKFLOW_PHASE_MISMATCH","The activated economic allocation is invalid.");}
  if(preview.rows.length!==definition.phases.length||preview.rows.some((row,index)=>
    row.phaseId!==definition.phases[index].id||row.code!==definition.phases[index].code))
    throw new EdtEngineConflict("ECONOMIC_WORKFLOW_PHASE_MISMATCH","Allocation phase identities and order must match the activated workflow.");
  const amount=items[0].productionAmount;
  const amounts=allocateMinorUnits(scaledSignedDecimal(amount),preview.rows.map(row=>scaledSignedDecimal(row.workflowPercent)));
  return {schemaVersion:1,authority:"approved_contract_item_and_activated_workflow",currency:source.currency,
    directProductionAmount:amount,method:preview.method,
    rows:preview.rows.map((row,index)=>({phaseId:row.phaseId,code:row.code,name:row.name,percent:row.workflowPercent,amount:decimalFromScaled(amounts[index])}))};
}

export async function prepareApprovedWorkItemEconomicPlan(input:{actor:Actor;projectId:number;workItemId:string;
  expectedContractFingerprint:string;expectedWorkflowFingerprint:string},host?:EdtTransactionHost){
  return withEdtTransaction(async client=>{
    const item=(await client.query<any>(`SELECT w.*,i.company_id,i.status AS intake_status
      FROM job_activation_work_items w JOIN job_intakes i ON i.id=w.intake_id AND i.project_id=w.project_id
      WHERE w.id=$1 AND w.project_id=$2 AND i.company_id=$3 FOR UPDATE OF w`,
      [input.workItemId,input.projectId,input.actor.actorCompanyId])).rows[0];
    if(!item)throw new EdtEngineConflict("ECONOMIC_WORK_ITEM_NOT_FOUND","The Work Item is not available in this company and project.");
    if(item.intake_status!=="activated")throw new EdtEngineConflict("ECONOMIC_INTAKE_NOT_ACTIVATED","Activate Intake before preparing Work Item funding.");
    const {source,id:contractPoolId}=await freezeApprovedContractPools(client,{actorUserId:input.actor.actorUserId,
      projectId:input.projectId,contractVersionId:item.contract_version_id,expectedContractId:item.contract_id,
      expectedContractFingerprint:input.expectedContractFingerprint});
    // The contract lock in freezeApprovedContractPools serializes this check.
    // Splits must have separately approved funding, never a repeated full item.
    const duplicates=await client.query(`SELECT p.id FROM job_activation_work_item_economic_plans p
      JOIN job_activation_work_items w ON w.id=p.work_item_id
      WHERE p.contract_id=$1 AND w.stable_scope_item_id=$2 AND w.id<>$3 LIMIT 1`,
      [source.contractId,item.stable_scope_item_id,item.id]);
    if(duplicates.rows.length)throw new EdtEngineConflict("ECONOMIC_ITEM_ALREADY_FUNDED","This contract item already funds another Work Item; governed reconciliation is required.");
    const workflow=(await client.query<any>(`SELECT version_id,definition,fingerprint FROM company_delivery_workflow_work_items
      WHERE work_item_id=$1 AND project_id=$2 AND company_id=$3 FOR SHARE`,[item.id,input.projectId,input.actor.actorCompanyId])).rows[0];
    if(!workflow?.version_id||workflow.fingerprint!==input.expectedWorkflowFingerprint)
      throw new EdtEngineConflict("ECONOMIC_WORKFLOW_STALE","Reopen the activated workflow before preparing its economic plan.");
    const allocation=approvedItemPhaseAllocation(source,item.stable_scope_item_id,workflow);
    const result=await createWorkItemEconomicPlanWithClient({actor:input.actor,companyId:source.companyId,projectId:input.projectId,
      intakeId:item.intake_id,workItemId:item.id,contractId:source.contractId,contractVersionId:source.contractVersionId,
      pricingTemplateVersionId:source.apu.versionId,deliveryWorkflowVersionId:workflow.version_id,currency:source.currency,
      directProductionAmount:allocation.directProductionAmount,projectAdministrativeAmount:"0",incentiveReserveAmount:"0",
      taskEarningsAmount:"0",projectEarningsAmount:"0",resolvedAllocation:allocation,
      sourceSnapshot:{contractPoolId,approvedContract:source,workItemId:item.id,stableLineId:item.stable_scope_item_id,
        workflow:{versionId:workflow.version_id,fingerprint:workflow.fingerprint,definition:workflow.definition}}},client);
    return {...result,workItemId:item.id,contractPoolId,allocation};
  },host).catch((error:unknown)=>{
    if(error&&typeof error==="object"&&"code" in error&&["40001","40P01"].includes(String(error.code)))
      throw new FinancialControlError(409,"ECONOMIC_PLAN_STALE","A concurrent change occurred. Refresh and retry.");
    throw error;
  });
}
