import { decideEdtRecordAuthorization,type EdtRecordAuthorizationInput } from "./edt-engine-authorization";
import { deterministicEdtId,edtFingerprint,EdtEngineConflict,withEdtTransaction,type EdtTransactionHost,type EdtTransactionClient } from "./edt-engine-transaction";
import { deliveryWorkflowFingerprint, validateDeliveryWorkflowDefinition } from "./delivery-workflow-template-contract";
type Actor=Pick<EdtRecordAuthorizationInput,"grants"|"actorUserId"|"actorCompanyId"|"actorProjectIds">&{eligibleRole:string};
const decimal=/^(0|[1-9]\d*)(\.\d{1,6})?$/;
function nonnegative(value:string,name:string){if(!decimal.test(value))throw new EdtEngineConflict("ECONOMIC_AMOUNT_INVALID",`${name} must be a non-negative decimal with at most six places.`);}
function decimalUnits(value:string){const [whole,fraction=""]=value.replace(/^-/,"").split(".");return BigInt(whole)*1000000n+BigInt(fraction.padEnd(6,"0"));}
function authorize(actor:Actor,permission:"JOB_OPERATE"|"TIME_SUBMIT"|"TIME_APPROVE",companyId:number,projectId:number,requester?:number){const decision=decideEdtRecordAuthorization({...actor,permission,recordCompanyId:companyId,recordProjectId:projectId,recordRequesterUserId:requester});if(!decision.allow)throw new EdtEngineConflict(decision.code,"Economic-operation authorization denied.");}

export async function createWorkItemEconomicPlan(input:{actor:Actor;companyId:number;projectId:number;intakeId:string;workItemId:string;contractId:string;contractVersionId:string;pricingTemplateVersionId:string;deliveryWorkflowVersionId:string;currency:string;directProductionAmount:string;projectAdministrativeAmount:string;incentiveReserveAmount:string;taskEarningsAmount:string;projectEarningsAmount:string;resolvedAllocation:Record<string,unknown>;sourceSnapshot:Record<string,unknown>},host?:EdtTransactionHost){
  authorize(input.actor,"JOB_OPERATE",input.companyId,input.projectId);
  for(const [name,value] of Object.entries({directProductionAmount:input.directProductionAmount,projectAdministrativeAmount:input.projectAdministrativeAmount,incentiveReserveAmount:input.incentiveReserveAmount,taskEarningsAmount:input.taskEarningsAmount,projectEarningsAmount:input.projectEarningsAmount}))nonnegative(value,name);
  if(!/^[A-Z]{3}$/.test(input.currency))throw new EdtEngineConflict("CURRENCY_INVALID","Currency must be an ISO-style three-letter code.");
  let sourceSnapshotJson: string;
  try {
    if (!input.sourceSnapshot || Array.isArray(input.sourceSnapshot) || typeof input.sourceSnapshot !== "object") throw new Error();
    sourceSnapshotJson = JSON.stringify(input.sourceSnapshot, (_key, value) => {
      if (["undefined", "function", "symbol", "bigint"].includes(typeof value) ||
          (typeof value === "number" && !Number.isFinite(value))) throw new Error();
      return value;
    });
    if (Buffer.byteLength(sourceSnapshotJson, "utf8") > 1024 * 1024 ||
        edtFingerprint(JSON.parse(sourceSnapshotJson)) !== edtFingerprint(input.sourceSnapshot)) throw new Error();
  } catch { throw new EdtEngineConflict("ECONOMIC_SOURCE_SNAPSHOT_INVALID", "Economic source evidence must be a bounded JSON object without lossy values."); }
  const sourceFingerprint=edtFingerprint(input.sourceSnapshot);const planFingerprint=edtFingerprint({workItemId:input.workItemId,contractVersionId:input.contractVersionId,pricingTemplateVersionId:input.pricingTemplateVersionId,deliveryWorkflowVersionId:input.deliveryWorkflowVersionId,currency:input.currency,amounts:[input.directProductionAmount,input.projectAdministrativeAmount,input.incentiveReserveAmount,input.taskEarningsAmount,input.projectEarningsAmount],resolvedAllocation:input.resolvedAllocation});
  return withEdtTransaction(async client=>{
    const item=(await client.query<any>("SELECT w.id,w.intake_id,w.project_id,w.contract_id,w.contract_version_id,w.economic_plan_fingerprint,i.status AS intake_status FROM job_activation_work_items w JOIN job_intakes i ON i.id=w.intake_id AND i.project_id=w.project_id WHERE w.id=$1 AND w.project_id=$2 AND i.company_id=$3 FOR UPDATE OF w",[input.workItemId,input.projectId,input.companyId])).rows[0];
    if(!item||item.intake_id!==input.intakeId||item.contract_id!==input.contractId||item.contract_version_id!==input.contractVersionId)throw new EdtEngineConflict("ECONOMIC_SCOPE_MISMATCH","Economic plan does not match the activated Work Item contract.");
    if(item.intake_status!=="activated")throw new EdtEngineConflict("ECONOMIC_INTAKE_NOT_ACTIVATED","Economic plans require an activated canonical Intake.");
    const contract=(await client.query<{currency:string;pricing_template_binding:Record<string,unknown>|null}>("SELECT v.currency,v.commercial_metadata->'pricingTemplateBinding' AS pricing_template_binding FROM financial_contract_versions v JOIN financial_contracts c ON c.id=v.contract_id WHERE v.id=$1 AND c.id=$2 AND c.project_id=$3 AND c.company_id=$4",[input.contractVersionId,input.contractId,input.projectId,input.companyId])).rows[0];
    if(!contract||contract.currency!==input.currency||contract.pricing_template_binding?.versionId!==input.pricingTemplateVersionId)
      throw new EdtEngineConflict("ECONOMIC_CONTRACT_VERSION_MISMATCH","Economic plan currency or APU version differs from the activated contract version.");
    // Resolve only the activated copy, never a newly published/latest template.
    const workflow=(await client.query<{version_id:string|null;definition:unknown;fingerprint:string}>(
      "SELECT version_id,definition,fingerprint FROM company_delivery_workflow_work_items WHERE work_item_id=$1 AND project_id=$2 AND company_id=$3 FOR SHARE",
      [input.workItemId,input.projectId,input.companyId])).rows[0];
    if(!workflow||workflow.version_id!==input.deliveryWorkflowVersionId)
      throw new EdtEngineConflict("ECONOMIC_WORKFLOW_VERSION_MISMATCH","Economic plan must use this Work Item's activated workflow version.");
    let definition:ReturnType<typeof validateDeliveryWorkflowDefinition>;
    try { definition=validateDeliveryWorkflowDefinition(workflow.definition); }
    catch { throw new EdtEngineConflict("ECONOMIC_WORKFLOW_SNAPSHOT_MISMATCH","The activated workflow definition failed integrity verification."); }
    if(deliveryWorkflowFingerprint(definition)!==workflow.fingerprint)
      throw new EdtEngineConflict("ECONOMIC_WORKFLOW_SNAPSHOT_MISMATCH","The activated workflow fingerprint failed integrity verification.");
    if(definition.economicAllocation?.sourceVersionId!==input.pricingTemplateVersionId)
      throw new EdtEngineConflict("ECONOMIC_WORKFLOW_APU_MISMATCH","The activated workflow must reference the same approved APU as the contract.");
    const existing=(await client.query<{plan_fingerprint:string;source_fingerprint:string}>("SELECT plan_fingerprint,source_fingerprint FROM job_activation_work_item_economic_plans WHERE work_item_id=$1",[input.workItemId])).rows[0];
    if(existing){
      if(existing.plan_fingerprint!==planFingerprint)throw new EdtEngineConflict("ECONOMIC_PLAN_IMMUTABLE","An activated Work Item economic plan cannot be replaced.");
      // Keep historical plan hashes stable while checking their separately stored source authority.
      if(existing.source_fingerprint!==sourceFingerprint)throw new EdtEngineConflict("ECONOMIC_PLAN_SOURCE_IMMUTABLE","An activated economic plan cannot be retried with a different source snapshot.");
      return{planFingerprint,idempotent:true};
    }
    await client.query("SELECT id FROM financial_contracts WHERE id=$1 AND project_id=$2 AND company_id=$3 FOR UPDATE",[input.contractId,input.projectId,input.companyId]);
    if([input.projectAdministrativeAmount,input.incentiveReserveAmount,input.projectEarningsAmount].some(amount=>decimalUnits(amount)!==0n)&&
      (await client.query("SELECT id FROM job_contract_economic_pools WHERE contract_id=$1",[input.contractId])).rows.length)
      throw new EdtEngineConflict("ECONOMIC_CONTRACT_POOLS_ALREADY_FROZEN","Contract-level pools cannot also be funded on a Work Item.");
    const id=deterministicEdtId("economic-plan",input.workItemId);
    await client.query("INSERT INTO job_activation_work_item_economic_plans(id,company_id,project_id,intake_id,work_item_id,contract_id,contract_version_id,pricing_template_version_id,delivery_workflow_version_id,currency,direct_production_amount,project_administrative_amount,incentive_reserve_amount,task_earnings_amount,project_earnings_amount,resolved_allocation,source_fingerprint,plan_fingerprint,created_by_id,source_snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17,$18,$19,$20::jsonb)",[id,input.companyId,input.projectId,input.intakeId,input.workItemId,input.contractId,input.contractVersionId,input.pricingTemplateVersionId,input.deliveryWorkflowVersionId,input.currency,input.directProductionAmount,input.projectAdministrativeAmount,input.incentiveReserveAmount,input.taskEarningsAmount,input.projectEarningsAmount,JSON.stringify(input.resolvedAllocation),sourceFingerprint,planFingerprint,input.actor.actorUserId,sourceSnapshotJson]);
    await client.query("UPDATE job_activation_work_items SET economic_plan_fingerprint=$2,updated_at=now() WHERE id=$1",[input.workItemId,planFingerprint]);
    return{planFingerprint,idempotent:false};
  },host);
}

type TimeDecision = {actor:Actor;companyId:number;projectId:number;entryId:string;expectedVersion:number;decision:"submit"|"approve"|"reject";budgetAccountId:string;pool:"direct_production"|"project_administrative";amount:string;reason:string;evidence:Record<string,unknown>};
export async function transitionTimeEntry(input:TimeDecision,host?:EdtTransactionHost){
  return withEdtTransaction(client => transitionTimeEntryWithClient(input, client), host);
}
async function transitionTimeEntryWithClient(input:TimeDecision,client:EdtTransactionClient){
  nonnegative(input.amount,"amount");
    const entry=(await client.query<any>("SELECT e.*,w.project_id,w.intake_id FROM job_activation_time_entries e JOIN job_activation_work_items w ON w.id=e.work_item_id JOIN job_intakes i ON i.id=w.intake_id AND i.project_id=w.project_id WHERE e.id=$1 AND w.project_id=$2 AND i.company_id=$3 FOR UPDATE OF e",[input.entryId,input.projectId,input.companyId])).rows[0];
    if(!entry||Number(entry.optimistic_version)!==input.expectedVersion)throw new EdtEngineConflict("TIME_ENTRY_STALE","Time entry is missing or stale.");
    const account=(await client.query<{id:string}>("SELECT a.id FROM job_activation_budget_accounts a JOIN job_intakes i ON i.id=a.intake_id AND i.project_id=a.project_id WHERE a.id=$1 AND a.intake_id=$2 AND a.project_id=$3 AND i.company_id=$4 FOR UPDATE OF a",[input.budgetAccountId,entry.intake_id,input.projectId,input.companyId])).rows[0];
    if(!account)throw new EdtEngineConflict("BUDGET_ACCOUNT_SCOPE_MISMATCH","Time impact must use a budget account belonging to this Intake and company.");
    const submit=input.decision==="submit";authorize(input.actor,submit?"TIME_SUBMIT":"TIME_APPROVE",input.companyId,input.projectId,submit?undefined:entry.submitted_by_id);
    if(submit&&!(["legacy_recorded","draft","rejected"].includes(entry.status)))throw new EdtEngineConflict("TIME_TRANSITION_INVALID","Only unreviewed or rejected time may be submitted.");
    if(!submit&&entry.status!=="submitted")throw new EdtEngineConflict("TIME_TRANSITION_INVALID","Only submitted time may be decided.");
    if(submit&&entry.user_id!==input.actor.actorUserId)throw new EdtEngineConflict("TIME_ENTRY_OWNER_REQUIRED","Only the time-entry owner may submit it.");
    if(!submit && [entry.user_id,entry.created_by_id,entry.submitted_by_id].includes(input.actor.actorUserId))throw new EdtEngineConflict("SELF_APPROVAL_PROHIBITED","The owner, recorder and submitter cannot decide this time entry.");
    if(!submit){
      const commitment=(await client.query<{budget_account_id:string;pool:string;amount_delta:string;hours_delta:string}>("SELECT budget_account_id,pool,amount_delta::text,hours_delta::text FROM job_activation_budget_ledger_entries WHERE time_entry_id=$1 AND source_version=$2 AND ledger_state='committed_pending' FOR UPDATE",[input.entryId,input.expectedVersion-1])).rows[0];
      if(!commitment||commitment.budget_account_id!==input.budgetAccountId||commitment.pool!==input.pool||decimalUnits(commitment.amount_delta)!==decimalUnits(input.amount)||decimalUnits(commitment.hours_delta)!==decimalUnits(String(entry.hours)))
        throw new EdtEngineConflict("TIME_COMMITMENT_MISMATCH","Time decision must use the stored submitted budget account, pool, amount and hours.");
    }
    const next=submit?"submitted":input.decision==="approve"?"approved":"rejected";
    const updated=await client.query("UPDATE job_activation_time_entries SET status=$2,optimistic_version=optimistic_version+1,submitted_by_id=CASE WHEN $2='submitted' THEN $3 ELSE submitted_by_id END,submitted_at=CASE WHEN $2='submitted' THEN now() ELSE submitted_at END,decided_by_id=CASE WHEN $2 IN ('approved','rejected') THEN $3 ELSE decided_by_id END,decided_at=CASE WHEN $2 IN ('approved','rejected') THEN now() ELSE decided_at END,decision_reason=$4 WHERE id=$1 AND optimistic_version=$5",[input.entryId,next,input.actor.actorUserId,input.reason,input.expectedVersion]);
    if(updated.rowCount!==1)throw new EdtEngineConflict("TIME_ENTRY_STALE","Concurrent time-entry update detected.");
    const base=`time:${input.entryId}:v${input.expectedVersion}:${input.decision}`;const ledger=async(state:string,amountDelta:string,hoursDelta:string,suffix:string)=>client.query("INSERT INTO job_activation_budget_ledger_entries(id,company_id,project_id,intake_id,budget_account_id,work_item_id,task_id,assignment_id,time_entry_id,pool,ledger_state,amount_delta,hours_delta,idempotency_key,source_version,source_fingerprint,actor_user_id,reason,evidence) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb) ON CONFLICT(project_id,idempotency_key) DO NOTHING",[deterministicEdtId("budget-ledger",`${base}:${suffix}`),input.companyId,input.projectId,entry.intake_id,input.budgetAccountId,entry.work_item_id,entry.task_id,entry.assignment_id??null,input.entryId,input.pool,state,amountDelta,hoursDelta,`${base}:${suffix}`,input.expectedVersion,edtFingerprint({entryId:input.entryId,version:input.expectedVersion,decision:input.decision,suffix}),input.actor.actorUserId,input.reason,JSON.stringify(input.evidence)]);
    if(submit)await ledger("committed_pending",`-${input.amount}`,`-${entry.hours}`,"commit");
    else{await ledger("released",input.amount,String(entry.hours),"release");if(input.decision==="approve")await ledger("approved_consumed",`-${input.amount}`,`-${entry.hours}`,"consume");}
    return{entryId:input.entryId,status:next,version:input.expectedVersion+1};
}

/** Public workflow resolves monetary authority under the same transaction locks as the decision. */
export async function transitionStoredTimeEntry(input:Omit<TimeDecision,"budgetAccountId"|"pool"|"amount"|"evidence">,host?:EdtTransactionHost){
  if(!Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<1||!input.reason.trim()||input.reason.length>1000)
    throw new EdtEngineConflict("TIME_DECISION_INVALID","A current version and a reason of at most 1000 characters are required.");
  if(!["submit","approve","reject"].includes(input.decision))throw new EdtEngineConflict("TIME_DECISION_INVALID","Unsupported time decision.");
  return withEdtTransaction(async client=>{
    const entry=(await client.query<any>(`SELECT e.*,w.project_cost_node_id,w.contract_version_id,w.stable_scope_item_id
      FROM job_activation_time_entries e JOIN job_activation_work_items w ON w.id=e.work_item_id AND w.project_id=e.project_id
      JOIN job_intakes i ON i.id=w.intake_id AND i.project_id=w.project_id
      WHERE e.id=$1 AND e.project_id=$2 AND i.company_id=$3 AND i.status='activated' FOR UPDATE OF e`,[input.entryId,input.projectId,input.companyId])).rows[0];
    if(!entry||Number(entry.optimistic_version)!==input.expectedVersion)throw new EdtEngineConflict("TIME_ENTRY_STALE","Time entry is missing or stale.");
    let authority:{budgetAccountId:string;pool:TimeDecision["pool"];amount:string;evidence:Record<string,unknown>};
    if(input.decision==="submit"){
      const stored=(await client.query<any>(`SELECT b.budget_account_id,r.internal_hourly_rate::text rate,r.version assignment_version,
        round(e.hours*r.internal_hourly_rate,6)::text amount,a.currency,b.snapshot_fingerprint
        FROM job_activation_time_entries e JOIN job_activation_work_items w ON w.id=e.work_item_id
        JOIN job_activation_resource_assignments r ON r.id=e.assignment_id AND r.task_id=e.task_id AND r.work_item_id=w.id AND r.user_id=e.user_id
        JOIN job_activation_contract_item_baselines b ON b.intake_id=w.intake_id AND b.project_id=w.project_id
          AND b.contract_version_id=w.contract_version_id AND b.stable_line_id=w.stable_scope_item_id
        JOIN job_activation_budget_accounts a ON a.id=b.budget_account_id AND a.project_cost_node_id=w.project_cost_node_id
        WHERE e.id=$1 AND r.internal_hourly_rate IS NOT NULL AND r.internal_hourly_rate>=0 FOR SHARE OF r,b,a`,[input.entryId])).rows[0];
      if(!stored)throw new EdtEngineConflict("TIME_AMOUNT_NOT_SERVER_RESOLVED","This time entry needs its priced assignment and activated contract budget mapping before submission.");
      authority={budgetAccountId:stored.budget_account_id,pool:"direct_production",amount:stored.amount,evidence:{source:"stored_assignment_and_activated_contract",assignmentVersion:stored.assignment_version,rate:stored.rate,currency:stored.currency,baselineFingerprint:stored.snapshot_fingerprint}};
    }else{
      const stored=(await client.query<any>(`SELECT budget_account_id,pool,(-amount_delta)::text amount,evidence FROM job_activation_budget_ledger_entries
        WHERE time_entry_id=$1 AND project_id=$2 AND company_id=$3 AND source_version=$4 AND ledger_state='committed_pending' FOR UPDATE`,[input.entryId,input.projectId,input.companyId,input.expectedVersion-1])).rows[0];
      if(!stored)throw new EdtEngineConflict("TIME_COMMITMENT_MISMATCH","The submitted time commitment is missing.");
      authority={budgetAccountId:stored.budget_account_id,pool:stored.pool,amount:stored.amount,evidence:stored.evidence};
    }
    return transitionTimeEntryWithClient({...input,...authority},client);
  },host).catch((error: unknown) => {
    if (error && typeof error === "object" && "code" in error && ["40001", "40P01"].includes(String(error.code)))
      throw new EdtEngineConflict("TIME_ENTRY_STALE", "A concurrent decision changed this entry. Refresh before trying again.");
    throw error;
  });
}
