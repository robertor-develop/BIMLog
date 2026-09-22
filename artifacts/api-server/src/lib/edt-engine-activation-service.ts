import { decideEdtRecordAuthorization, type EdtRecordAuthorizationInput } from "./edt-engine-authorization";
import { deterministicEdtId, edtFingerprint, EdtEngineConflict, withEdtTransaction, type EdtTransactionHost } from "./edt-engine-transaction";

type Actor = Pick<EdtRecordAuthorizationInput,"grants"|"actorUserId"|"actorCompanyId"|"actorProjectIds"> & { eligibleRole: string };
export type EdtPlanNode = Readonly<{ kind:"project"|"contract"|"deliverable"|"location"; sourceIdentity:string; parentSourceIdentity?:string; code:string; name:string; sequence:number; snapshot:Record<string,unknown> }>;
export type EdtPlanWorkItem = Readonly<{ id:string; edtNodeSourceIdentity:string; locationIdentity:string; locationSnapshot:Record<string,unknown>; tradeIdentity:string; tradeSnapshot:Record<string,unknown>; deliverableTypeIdentity:string; deliverableTypeSnapshot:Record<string,unknown>; displayCode:string }>;

function requireAuthorization(input: EdtRecordAuthorizationInput) {
  const decision = decideEdtRecordAuthorization(input);
  if (!decision.allow) throw new EdtEngineConflict(decision.code, "EDT activation authorization denied.");
}

export async function requestEdtActivation(input: { actor:Actor; companyId:number; projectId:number; intakeId:string; intakeRevision:number; governanceVersionId:string; pricingVersionId:string; workflowVersionIds:string[]; reason:string; evidence:Record<string,unknown>; idempotencyKey:string }, host?:EdtTransactionHost) {
  requireAuthorization({ ...input.actor, permission:"JOB_ACTIVATION_REQUEST", recordCompanyId:input.companyId, recordProjectId:input.projectId });
  const fingerprint = edtFingerprint({ intakeId:input.intakeId, intakeRevision:input.intakeRevision, governanceVersionId:input.governanceVersionId, pricingVersionId:input.pricingVersionId, workflowVersionIds:[...input.workflowVersionIds].sort() });
  return withEdtTransaction(async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`edt-activation:${input.intakeId}`]);
    const intake=(await client.query<{company_id:number;project_id:number;revision:number;status:string}>("SELECT company_id,project_id,revision,status FROM job_intakes WHERE id=$1 FOR UPDATE",[input.intakeId])).rows[0];
    if (!intake || intake.company_id!==input.companyId || intake.project_id!==input.projectId) throw new EdtEngineConflict("INTAKE_SCOPE_MISMATCH","Intake is outside the requested company/project.");
    if (intake.revision!==input.intakeRevision || intake.status==="activated") throw new EdtEngineConflict("INTAKE_REVISION_CONFLICT","Intake must be current and not already activated.");
    const existing=(await client.query<{id:string;request_fingerprint:string;state:string}>("SELECT id,request_fingerprint,state FROM job_activation_requests WHERE intake_id=$1 AND idempotency_key=$2",[input.intakeId,input.idempotencyKey])).rows[0];
    if (existing) {
      if (existing.request_fingerprint!==fingerprint) throw new EdtEngineConflict("IDEMPOTENCY_CONFLICT","Idempotency key already represents different activation content.");
      return { id:existing.id, fingerprint, state:existing.state, idempotent:true };
    }
    const id=deterministicEdtId("activation-request",`${input.intakeId}:${input.idempotencyKey}`);
    await client.query("INSERT INTO job_activation_requests(id,company_id,project_id,intake_id,intake_revision,governance_version_id,pricing_version_id,workflow_version_ids,request_fingerprint,idempotency_key,requested_by_id,eligible_role,reason,evidence) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14::jsonb)",[id,input.companyId,input.projectId,input.intakeId,input.intakeRevision,input.governanceVersionId,input.pricingVersionId,JSON.stringify(input.workflowVersionIds),fingerprint,input.idempotencyKey,input.actor.actorUserId,input.actor.eligibleRole,input.reason,JSON.stringify(input.evidence)]);
    return { id, fingerprint, state:"pending", idempotent:false };
  },host);
}

export async function approveEdtActivation(input:{ actor:Actor; companyId:number; projectId:number; requestId:string; expectedFingerprint:string; reason:string; evidence:Record<string,unknown>; nodes:EdtPlanNode[]; workItems:EdtPlanWorkItem[] }, host?:EdtTransactionHost) {
  return withEdtTransaction(async client=>{
    const request=(await client.query<any>("SELECT * FROM job_activation_requests WHERE id=$1 FOR UPDATE",[input.requestId])).rows[0];
    if (!request) throw new EdtEngineConflict("ACTIVATION_REQUEST_NOT_FOUND","Activation request was not found.");
    requireAuthorization({ ...input.actor, permission:"JOB_ACTIVATION_APPROVE", recordCompanyId:request.company_id, recordProjectId:request.project_id, recordRequesterUserId:request.requested_by_id });
    if (request.company_id!==input.companyId || request.project_id!==input.projectId || request.request_fingerprint!==input.expectedFingerprint) throw new EdtEngineConflict("ACTIVATION_REQUEST_MISMATCH","Activation scope or fingerprint changed.");
    const intake=(await client.query<{revision:number;status:string}>("SELECT revision,status FROM job_intakes WHERE id=$1 AND project_id=$2 AND company_id=$3 FOR UPDATE",[request.intake_id,input.projectId,input.companyId])).rows[0];
    if(!intake||intake.revision!==request.intake_revision||intake.status==="activated"||request.state!=="pending")throw new EdtEngineConflict("INTAKE_REVISION_CONFLICT","The saved Intake changed or was activated after this EDT request. Create a new request from the current Intake.");
    const decisionId=deterministicEdtId("activation-decision",`${request.id}:${input.expectedFingerprint}`);
    const existing=(await client.query<{id:string}>("SELECT id FROM job_activation_decisions WHERE request_id=$1",[request.id])).rows[0];
    if (existing) return { decisionId:existing.id, idempotent:true };
    const bySource=new Map<string,string>();
    for(const node of input.nodes){
      const id=deterministicEdtId("edt-node",`${request.intake_id}:${node.kind}:${node.sourceIdentity}`); bySource.set(node.sourceIdentity,id);
      await client.query("INSERT INTO job_activation_edt_nodes(id,company_id,project_id,intake_id,parent_id,node_kind,source_identity,code,name,sequence,source_snapshot,source_fingerprint,created_by_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13) ON CONFLICT(intake_id,node_kind,source_identity) DO NOTHING",[id,input.companyId,input.projectId,request.intake_id,node.parentSourceIdentity?bySource.get(node.parentSourceIdentity)??null:null,node.kind,node.sourceIdentity,node.code,node.name,node.sequence,JSON.stringify(node.snapshot),edtFingerprint(node.snapshot),input.actor.actorUserId]);
    }
    for(const item of input.workItems){
      const identity={locationIdentity:item.locationIdentity,tradeIdentity:item.tradeIdentity,deliverableTypeIdentity:item.deliverableTypeIdentity};
      await client.query("UPDATE job_activation_work_items SET edt_node_id=$2,location_identity=$3,location_snapshot=$4::jsonb,trade_identity=$5,trade_snapshot=$6::jsonb,deliverable_type_identity=$7,deliverable_type_snapshot=$8::jsonb,display_code=$9,revision_number=0,issuance_version=0,identity_fingerprint=$10,updated_at=now() WHERE id=$1 AND project_id=$11",[item.id,bySource.get(item.edtNodeSourceIdentity),item.locationIdentity,JSON.stringify(item.locationSnapshot),item.tradeIdentity,JSON.stringify(item.tradeSnapshot),item.deliverableTypeIdentity,JSON.stringify(item.deliverableTypeSnapshot),item.displayCode,edtFingerprint(identity),input.projectId]);
    }
    await client.query("INSERT INTO job_activation_decisions(id,request_id,company_id,project_id,outcome,request_fingerprint,decided_by_id,eligible_role,reason,evidence) VALUES($1,$2,$3,$4,'approved',$5,$6,$7,$8,$9::jsonb)",[decisionId,request.id,input.companyId,input.projectId,input.expectedFingerprint,input.actor.actorUserId,input.actor.eligibleRole,input.reason,JSON.stringify(input.evidence)]);
    await client.query("UPDATE job_activation_requests SET state='approved',decided_at=now(),optimistic_version=optimistic_version+1 WHERE id=$1 AND state='pending'",[request.id]);
    return { decisionId, idempotent:false, nodeCount:input.nodes.length, workItemCount:input.workItems.length };
  },host);
}
