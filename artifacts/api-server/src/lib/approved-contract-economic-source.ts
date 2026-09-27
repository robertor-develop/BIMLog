import {authorizeFinancialOperation} from "./financial-control-service";
import {FinancialControlError} from "./financial-control-contract";
import {exactPositiveAmount} from "./financial-contract-contract";
import {scaledSignedDecimal} from "./financial-budget-contract";
import {validatePricingTemplate,resolvePricingPoolAmounts} from "./company-pricing-template-contract";
import {activationFingerprint} from "./job-activation-commercial-baseline";
import {edtFingerprint} from "./edt-engine-transaction";

type Client={query(sql:string,values?:unknown[]):Promise<{rows:any[]}>};
const fail=(code:string,message:string):never=>{throw new FinancialControlError(409,code,message);};

/** Resolve a historical, independently approved contract version. Call inside the
 * caller's transaction so these source locks also cover any dependent write.
 * Returns contract-scoped pools ONCE, never a reserve duplicated for each item.
 */
export async function loadApprovedContractEconomicSource(client:Client,input:{actorUserId:number;projectId:number;contractVersionId:string}) {
  const auth=await authorizeFinancialOperation({actorUserId:input.actorUserId,projectId:input.projectId,
    featureKey:"cost.commitment.view",operation:"read",client});
  const version=(await client.query(`SELECT v.*,c.company_id,c.project_id FROM financial_contract_versions v
    JOIN financial_contracts c ON c.id=v.contract_id
    WHERE v.id=$1 AND c.project_id=$2 AND c.company_id=$3 FOR SHARE OF v,c`,
    [input.contractVersionId,input.projectId,auth.scope.companyId])).rows[0];
  if(!version)fail("ECONOMIC_CONTRACT_NOT_FOUND","The contract version is not available in this company and project.");
  const access=(await client.query(`SELECT state FROM financial_contract_record_grants
    WHERE contract_id=$1 AND user_id=$2 AND permission='view' ORDER BY version DESC LIMIT 1`,
    [version.contract_id,input.actorUserId])).rows[0];
  if(access?.state!=="active")throw new FinancialControlError(403,"CONTRACT_RECORD_PERMISSION_DENIED","Contract view permission is required.");
  if(!["approved","executed"].includes(version.status)||!version.approved_at||!version.approval_policy_id||
    !version.approved_by_id||Number(version.approved_by_id)===Number(version.prepared_by_id))
    fail("ECONOMIC_CONTRACT_APPROVAL_REQUIRED","Funding requires the exact independently approved contract version, not a draft or saved Intake.");
  const budget=(await client.query(`SELECT id,currency,snapshot_fingerprint FROM approved_budget_snapshots
    WHERE id=$1 AND project_id=$2 AND company_id=$3 FOR SHARE`,[version.budget_snapshot_id,input.projectId,auth.scope.companyId])).rows[0];
  if(!budget||budget.currency!==version.currency)fail("ECONOMIC_APPROVED_BUDGET_MISMATCH","The contract's approved budget source is unavailable or has a different currency.");
  const binding=version.commercial_metadata?.pricingTemplateBinding;
  const apu=(await client.query(`SELECT id,template_id,currency,content_fingerprint,provenance FROM generic_apu_template_versions
    WHERE id=$1 AND company_id=$2 AND project_id IS NULL AND status='published' FOR SHARE`,
    [binding?.versionId??null,auth.scope.companyId])).rows[0];
  if(!apu||apu.currency!==version.currency||apu.template_id!==binding?.templateId)
    fail("ECONOMIC_APPROVED_APU_MISMATCH","The contract's frozen APU version is unavailable or inconsistent.");
  let validated:ReturnType<typeof validatePricingTemplate>;
  try{validated=validatePricingTemplate(apu.provenance?.definition);}
  catch{return fail("ECONOMIC_APPROVED_APU_MISMATCH","The frozen APU definition failed validation.");}
  if(!validated.definition.economicPools||validated.definition.currency!==version.currency||validated.fingerprint!==apu.content_fingerprint||
    validated.fingerprint!==binding.fingerprint||validated.fingerprint!==apu.provenance?.definitionFingerprint)
    fail("ECONOMIC_APPROVED_APU_MISMATCH","The frozen APU classification or fingerprint is inconsistent.");
  const pools=resolvePricingPoolAmounts(validated.definition).amounts;
  if(!binding.economicPools||edtFingerprint(pools)!==edtFingerprint(binding.economicPools))
    fail("ECONOMIC_APPROVED_APU_MISMATCH","The frozen contract pools differ from the approved APU version.");
  const lines=(await client.query(`SELECT l.stable_line_id,l.contract_item_snapshot,b.pricing_snapshot,b.snapshot_fingerprint
    FROM financial_contract_sov_lines l JOIN job_activation_contract_item_baselines b
      ON b.contract_version_id=l.contract_version_id AND b.stable_line_id=l.stable_line_id AND b.project_id=$2
    WHERE l.contract_version_id=$1 ORDER BY l.stable_line_id FOR SHARE OF l,b`,[version.id,input.projectId])).rows;
  const count=Number((await client.query("SELECT count(*)::int n FROM financial_contract_sov_lines WHERE contract_version_id=$1",[version.id])).rows[0].n);
  if(!lines.length||lines.length!==count)fail("ECONOMIC_ALLOCATION_BASELINE_REQUIRED","Every contract item requires its frozen activation allocation.");
  const allocations=lines.map(line=>{
    const approved=line.contract_item_snapshot?.productionAllocation;
    const frozen=line.pricing_snapshot?.productionAllocation;
    if(approved===undefined||frozen===undefined||approved!==frozen||
      activationFingerprint(line.pricing_snapshot)!==line.snapshot_fingerprint)
      fail("ECONOMIC_ALLOCATION_BASELINE_MISMATCH","The approved allocation must match the exact frozen Intake baseline.");
    return {stableLineId:String(line.stable_line_id),productionAmount:exactPositiveAmount(approved),baselineFingerprint:String(line.snapshot_fingerprint)};
  });
  if(allocations.reduce((total,line)=>total+scaledSignedDecimal(line.productionAmount),0n)!==scaledSignedDecimal(pools.directProduction))
    fail("ECONOMIC_ALLOCATION_TOTAL_MISMATCH","Approved item allocations must reconcile exactly to the contract production pool.");
  const source={contractId:String(version.contract_id),contractVersionId:String(version.id),companyId:auth.scope.companyId,
    projectId:input.projectId,currency:String(version.currency),contractFingerprint:String(version.content_fingerprint),
    approval:{approvedById:Number(version.approved_by_id),policyId:String(version.approval_policy_id),approvedAt:new Date(version.approved_at).toISOString()},
    budget:{id:String(budget.id),fingerprint:String(budget.snapshot_fingerprint)},
    apu:{versionId:String(apu.id),fingerprint:validated.fingerprint,definition:validated.definition},contractPools:pools,allocations};
  return {...source,sourceFingerprint:edtFingerprint(source)};
}
