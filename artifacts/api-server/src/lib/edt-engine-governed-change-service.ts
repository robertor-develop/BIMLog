import { decideEdtRecordAuthorization, type EdtRecordAuthorizationInput } from "./edt-engine-authorization";
import { deterministicEdtId, edtFingerprint, EdtEngineConflict, withEdtTransaction, type EdtTransactionHost } from "./edt-engine-transaction";

type Actor=Pick<EdtRecordAuthorizationInput,"grants"|"actorUserId"|"actorCompanyId"|"actorProjectIds">&{eligibleRole:string};
export type GovernedAction="redistribute_work_item"|"redistribute_contract"|"extra_hours"|"code_correction"|"split_work_item"|"reopen_work_item";
const approverRoles:Record<GovernedAction,readonly string[]>={redistribute_work_item:["PMO"],redistribute_contract:["OPERATIONS_DIRECTOR"],extra_hours:["OPERATIONS_DIRECTOR"],code_correction:["PMO"],split_work_item:["PMO","OPERATIONS_DIRECTOR"],reopen_work_item:["PROJECT_MANAGER","QC_MANAGER"]};

function authorize(actor:Actor,permission:"GOVERNED_CHANGE_REQUEST"|"GOVERNED_CHANGE_APPROVE",companyId:number,projectId:number,requesterId?:number){
  const decision=decideEdtRecordAuthorization({...actor,permission,recordCompanyId:companyId,recordProjectId:projectId,recordRequesterUserId:requesterId});
  if(!decision.allow) throw new EdtEngineConflict(decision.code,"Governed change authorization denied.");
}

export async function requestGovernedEdtChange(input:{actor:Actor;companyId:number;projectId:number;workItemId?:string;actionType:GovernedAction;targetVersion:number;beforeState:Record<string,unknown>;afterState:Record<string,unknown>;reason:string;evidence:Record<string,unknown>;idempotencyKey:string},host?:EdtTransactionHost){
  authorize(input.actor,"GOVERNED_CHANGE_REQUEST",input.companyId,input.projectId);
  if(input.reason.trim().length<8) throw new EdtEngineConflict("REASON_REQUIRED","A meaningful governed-change reason is required.");
  const fingerprint=edtFingerprint({actionType:input.actionType,workItemId:input.workItemId??null,targetVersion:input.targetVersion,beforeState:input.beforeState,afterState:input.afterState});
  return withEdtTransaction(async client=>{
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))",[`edt-change:${input.projectId}:${input.idempotencyKey}`]);
    if(input.workItemId){const item=(await client.query<{id:string}>("SELECT id FROM job_activation_work_items WHERE id=$1 AND project_id=$2 FOR UPDATE",[input.workItemId,input.projectId])).rows[0];if(!item)throw new EdtEngineConflict("WORK_ITEM_SCOPE_MISMATCH","Work Item is outside this project.");}
    const existing=(await client.query<{id:string;request_fingerprint:string;state:string}>("SELECT id,request_fingerprint,state FROM job_governed_change_requests WHERE project_id=$1 AND idempotency_key=$2",[input.projectId,input.idempotencyKey])).rows[0];
    if(existing){if(existing.request_fingerprint!==fingerprint)throw new EdtEngineConflict("IDEMPOTENCY_CONFLICT","Idempotency key represents different change content.");return{id:existing.id,fingerprint,state:existing.state,idempotent:true};}
    const id=deterministicEdtId("governed-change",`${input.projectId}:${input.idempotencyKey}`);
    await client.query("INSERT INTO job_governed_change_requests(id,company_id,project_id,work_item_id,action_type,target_version,before_state,after_state,request_fingerprint,idempotency_key,requested_by_id,eligible_role,reason,evidence) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11,$12,$13,$14::jsonb)",[id,input.companyId,input.projectId,input.workItemId??null,input.actionType,input.targetVersion,JSON.stringify(input.beforeState),JSON.stringify(input.afterState),fingerprint,input.idempotencyKey,input.actor.actorUserId,input.actor.eligibleRole,input.reason.trim(),JSON.stringify(input.evidence)]);
    return{id,fingerprint,state:"pending",idempotent:false};
  },host);
}

export async function decideGovernedEdtChange(input:{actor:Actor;companyId:number;projectId:number;requestId:string;expectedFingerprint:string;outcome:"approved"|"rejected";reason:string;evidence:Record<string,unknown>},host?:EdtTransactionHost){
  return withEdtTransaction(async client=>{
    const request=(await client.query<any>("SELECT * FROM job_governed_change_requests WHERE id=$1 FOR UPDATE",[input.requestId])).rows[0];
    if(!request)throw new EdtEngineConflict("CHANGE_REQUEST_NOT_FOUND","Governed change request was not found.");
    authorize(input.actor,"GOVERNED_CHANGE_APPROVE",request.company_id,request.project_id,request.requested_by_id);
    if(request.company_id!==input.companyId||request.project_id!==input.projectId||request.request_fingerprint!==input.expectedFingerprint||request.state!=="pending")throw new EdtEngineConflict("CHANGE_REQUEST_CONFLICT","Governed change request is stale or mismatched.");
    if(!approverRoles[request.action_type as GovernedAction]?.includes(input.actor.eligibleRole))throw new EdtEngineConflict("APPROVER_ROLE_INELIGIBLE","Actor role cannot decide this change type.");
    const decisionId=deterministicEdtId("governed-change-decision",`${request.id}:${request.request_fingerprint}`);
    await client.query("INSERT INTO job_governed_change_decisions(id,request_id,company_id,project_id,outcome,request_fingerprint,decided_by_id,eligible_role,reason,evidence) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)",[decisionId,request.id,input.companyId,input.projectId,input.outcome,input.expectedFingerprint,input.actor.actorUserId,input.actor.eligibleRole,input.reason,JSON.stringify(input.evidence)]);
    if(input.outcome==="approved"&&request.action_type==="code_correction"){
      const before=request.before_state as Record<string,unknown>,after=request.after_state as Record<string,unknown>; const oldCode=String(before.displayCode??""); const newCode=String(after.displayCode??"");
      if(!oldCode||!newCode||oldCode===newCode)throw new EdtEngineConflict("CODE_CORRECTION_INVALID","Code correction requires distinct old and new codes.");
      await client.query("INSERT INTO job_activation_work_item_code_aliases(id,company_id,project_id,work_item_id,alias_code,change_request_id,decision_id,reason,created_by_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",[deterministicEdtId("work-item-alias",`${request.work_item_id}:${oldCode}`),input.companyId,input.projectId,request.work_item_id,oldCode,request.id,decisionId,input.reason,input.actor.actorUserId]);
      const updated=await client.query("UPDATE job_activation_work_items SET display_code=$2,updated_at=now() WHERE id=$1 AND project_id=$3 AND display_code=$4",[request.work_item_id,newCode,input.projectId,oldCode]);
      if(updated.rowCount!==1)throw new EdtEngineConflict("CODE_CORRECTION_STALE","Work Item code changed before approval.");
    }
    await client.query("UPDATE job_governed_change_requests SET state=$2,decided_at=now(),optimistic_version=optimistic_version+1 WHERE id=$1 AND state='pending'",[request.id,input.outcome]);
    return{decisionId,outcome:input.outcome};
  },host);
}
