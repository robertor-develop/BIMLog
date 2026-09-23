import { createHash } from "node:crypto";
import { decideEdtRecordAuthorization, type EdtRecordAuthorizationInput } from "./edt-engine-authorization";
import { deterministicEdtId, edtFingerprint, EdtEngineConflict, withEdtTransaction, type EdtTransactionHost } from "./edt-engine-transaction";

type Actor = Pick<EdtRecordAuthorizationInput,"grants"|"actorUserId"|"actorCompanyId"|"actorProjectIds"> & { eligibleRole: string };
export type EdtPlanNode = Readonly<{ kind:"project"|"contract"|"deliverable"|"location"; sourceIdentity:string; parentSourceIdentity?:string; code:string; name:string; sequence:number; snapshot:Record<string,unknown> }>;
export type EdtPlanWorkItem = Readonly<{ id:string; edtNodeSourceIdentity:string; contractSourceIdentity:string; locationIdentity:string; locationSnapshot:Record<string,unknown>; tradeIdentity:string; tradeSnapshot:Record<string,unknown>; deliverableTypeIdentity:string; deliverableTypeSnapshot:Record<string,unknown>; displayCode:string }>;

export function makeEdtWorkItemCode(input:{project:EdtPlanNode;contract:EdtPlanNode;deliverable:EdtPlanNode;location:EdtPlanNode;tradeIdentity:string;tradeCode?:string}):string{
  if(!input.tradeIdentity.trim())throw new EdtEngineConflict("EDT_CODE_INVALID","A stable trade identity is required.");
  const segments=[input.project.code,input.contract.code,input.deliverable.code,input.location.code,input.tradeCode??input.tradeIdentity].map(value=>{
    const code=value.trim().toUpperCase().replace(/[^A-Z0-9]+/g,"-").replace(/^-|-$/g,"");
    if(!code||code.length>24)throw new EdtEngineConflict("EDT_CODE_INVALID","EDT identity codes must be nonempty and at most 24 normalized characters.");
    return code;
  });
  const identity=[input.project.sourceIdentity,input.contract.sourceIdentity,input.deliverable.sourceIdentity,input.location.sourceIdentity,input.tradeIdentity];
  const suffix=createHash("sha256").update(JSON.stringify(identity)).digest("hex").slice(0,10).toUpperCase();
  return `WI-${segments.join("-")}-${suffix}`;
}

export function validateEdtPlanNodes(nodes:readonly EdtPlanNode[]):void{
  if(nodes.length===0||nodes[0].kind!=="project"||nodes.filter(node=>node.kind==="project").length!==1)
    throw new EdtEngineConflict("EDT_PLAN_INCOMPLETE","EDT nodes must begin with exactly one project root.");
  const seen=new Map<string,EdtPlanNode>();
  const siblingSequences=new Set<string>();
  const siblingCodes=new Set<string>();
  const expectedParent:Record<EdtPlanNode["kind"],EdtPlanNode["kind"]|null>={project:null,contract:"project",deliverable:"contract",location:"deliverable"};
  for(const node of nodes){
    if(!node.sourceIdentity||!node.code||!node.name||!Number.isInteger(node.sequence)||node.sequence<=0||seen.has(node.sourceIdentity))
      throw new EdtEngineConflict("EDT_PLAN_INCOMPLETE","EDT nodes require unique identities, code, name and positive sequence.");
    const parent=node.parentSourceIdentity?seen.get(node.parentSourceIdentity):undefined;
    if(expectedParent[node.kind]===null?Boolean(node.parentSourceIdentity):!parent||parent.kind!==expectedParent[node.kind])
      throw new EdtEngineConflict("EDT_PLAN_INCOMPLETE","EDT nodes must be ordered project, contract, deliverable, location with a valid parent.");
    const siblingKey=`${node.parentSourceIdentity??"<root>"}:${node.sequence}`;
    if(siblingSequences.has(siblingKey))throw new EdtEngineConflict("EDT_PLAN_INCOMPLETE","Sibling EDT sequences must be unique.");
    const siblingCodeKey=JSON.stringify([node.parentSourceIdentity??null,node.code.trim().toUpperCase()]);
    if(siblingCodes.has(siblingCodeKey))throw new EdtEngineConflict("EDT_CODE_INVALID","Sibling EDT codes must be unique without regard to case.");
    siblingSequences.add(siblingKey);siblingCodes.add(siblingCodeKey);seen.set(node.sourceIdentity,node);
  }
}

export function validateEdtPlanWorkItems(nodes:readonly EdtPlanNode[],items:readonly EdtPlanWorkItem[]):void{
  if(items.length===0)throw new EdtEngineConflict("EDT_PLAN_INCOMPLETE","EDT approval requires Work Items.");
  const nodeById=new Map(nodes.map(node=>[node.sourceIdentity,node]));
  const ids=new Set<string>(),codes=new Set<string>();
  for(const item of items){
    const location=nodeById.get(item.edtNodeSourceIdentity);
    const deliverable=nodeById.get(location?.parentSourceIdentity??"");
    const contract=nodeById.get(deliverable?.parentSourceIdentity??"");
    const project=nodeById.get(contract?.parentSourceIdentity??"");
    if(!item.id||location?.kind!=="location"||deliverable?.kind!=="deliverable"||contract?.kind!=="contract"||project?.kind!=="project"||contract.sourceIdentity!==item.contractSourceIdentity||deliverable.sourceIdentity!==item.deliverableTypeIdentity||!item.locationIdentity||item.locationIdentity!==item.edtNodeSourceIdentity||!item.tradeIdentity||!item.displayCode||ids.has(item.id)||codes.has(item.displayCode))
      throw new EdtEngineConflict("EDT_PLAN_INCOMPLETE","Work Items need unique IDs and codes, a valid EDT node, and complete classification identities.");
    if(item.displayCode!==makeEdtWorkItemCode({project,contract,deliverable,location,tradeIdentity:item.tradeIdentity,tradeCode:typeof item.tradeSnapshot.code==="string"?item.tradeSnapshot.code:undefined}))
      throw new EdtEngineConflict("EDT_CODE_INVALID","Work Item visible code must be derived from its immutable classification identities.");
    ids.add(item.id);codes.add(item.displayCode);
  }
}

export function validateEdtPlanCoverage(savedWorkItemIds:readonly string[],plannedItems:readonly EdtPlanWorkItem[]):void{
  const saved=new Set(savedWorkItemIds);
  const planned=new Set(plannedItems.map(item=>item.id));
  if(saved.size===0||saved.size!==savedWorkItemIds.length||planned.size!==plannedItems.length||saved.size!==planned.size||[...saved].some(id=>!planned.has(id)))
    throw new EdtEngineConflict("EDT_PLAN_COVERAGE_MISMATCH","The EDT plan must cover every saved Work Item in this Intake exactly once.");
}

export function validateEdtPlanSourceBindings(savedRows:readonly {id:string;contractId:string|null;stableScopeItemId:string}[],plannedItems:readonly EdtPlanWorkItem[]):void{
  const saved=new Map(savedRows.map(row=>[row.id,row]));
  for(const item of plannedItems){
    const row=saved.get(item.id);
    if(!row?.contractId||row.contractId!==item.contractSourceIdentity||!row.stableScopeItemId)
      throw new EdtEngineConflict("EDT_PLAN_SOURCE_MISMATCH","Every EDT Work Item must retain its saved canonical Contract and scope identity.");
  }
}

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
    if(request.state==="approved"){
      const decision=(await client.query<{id:string;outcome:string;request_fingerprint:string}>("SELECT id,outcome,request_fingerprint FROM job_activation_decisions WHERE request_id=$1 AND company_id=$2 AND project_id=$3",[request.id,input.companyId,input.projectId])).rows[0];
      if(decision?.outcome==="approved"&&decision.request_fingerprint===input.expectedFingerprint)return{decisionId:decision.id,idempotent:true};
      throw new EdtEngineConflict("ACTIVATION_DECISION_INCONSISTENT","Approved request has no matching immutable decision.");
    }
    const intake=(await client.query<{revision:number;status:string}>("SELECT revision,status FROM job_intakes WHERE id=$1 AND project_id=$2 AND company_id=$3 FOR UPDATE",[request.intake_id,input.projectId,input.companyId])).rows[0];
    if(!intake||intake.revision!==request.intake_revision||intake.status==="activated"||request.state!=="pending")throw new EdtEngineConflict("INTAKE_REVISION_CONFLICT","The saved Intake changed or was activated after this EDT request. Create a new request from the current Intake.");
    validateEdtPlanNodes(input.nodes);
    validateEdtPlanWorkItems(input.nodes,input.workItems);
    const savedWorkItems=(await client.query<{id:string;contractId:string|null;stableScopeItemId:string}>("SELECT id,contract_id AS \"contractId\",stable_scope_item_id AS \"stableScopeItemId\" FROM job_activation_work_items WHERE intake_id=$1 AND project_id=$2 AND status<>'cancelled' ORDER BY id FOR UPDATE",[request.intake_id,input.projectId])).rows;
    validateEdtPlanCoverage(savedWorkItems.map(item=>item.id),input.workItems);
    validateEdtPlanSourceBindings(savedWorkItems,input.workItems);
    const decisionId=deterministicEdtId("activation-decision",`${request.id}:${input.expectedFingerprint}`);
    const existing=(await client.query<{id:string}>("SELECT id FROM job_activation_decisions WHERE request_id=$1",[request.id])).rows[0];
    if (existing) throw new EdtEngineConflict("ACTIVATION_DECISION_INCONSISTENT","Pending request already has an immutable decision.");
    const bySource=new Map<string,string>();
    for(const node of input.nodes){
      const id=deterministicEdtId("edt-node",`${request.intake_id}:${node.kind}:${node.sourceIdentity}`); bySource.set(node.sourceIdentity,id);
      await client.query("INSERT INTO job_activation_edt_nodes(id,company_id,project_id,intake_id,parent_id,node_kind,source_identity,code,name,sequence,source_snapshot,source_fingerprint,created_by_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13) ON CONFLICT(intake_id,node_kind,source_identity) DO NOTHING",[id,input.companyId,input.projectId,request.intake_id,node.parentSourceIdentity?bySource.get(node.parentSourceIdentity)??null:null,node.kind,node.sourceIdentity,node.code,node.name,node.sequence,JSON.stringify(node.snapshot),edtFingerprint(node.snapshot),input.actor.actorUserId]);
    }
    for(const item of input.workItems){
      const identity={locationIdentity:item.locationIdentity,tradeIdentity:item.tradeIdentity,deliverableTypeIdentity:item.deliverableTypeIdentity};
      const updated=await client.query("UPDATE job_activation_work_items SET edt_node_id=$2,location_identity=$3,location_snapshot=$4::jsonb,trade_identity=$5,trade_snapshot=$6::jsonb,deliverable_type_identity=$7,deliverable_type_snapshot=$8::jsonb,display_code=$9,revision_number=0,issuance_version=0,identity_fingerprint=$10,updated_at=now() WHERE id=$1 AND project_id=$11 AND intake_id=$12",[item.id,bySource.get(item.edtNodeSourceIdentity),item.locationIdentity,JSON.stringify(item.locationSnapshot),item.tradeIdentity,JSON.stringify(item.tradeSnapshot),item.deliverableTypeIdentity,JSON.stringify(item.deliverableTypeSnapshot),item.displayCode,edtFingerprint(identity),input.projectId,request.intake_id]);
      if(updated.rowCount!==1)throw new EdtEngineConflict("EDT_WORK_ITEM_SCOPE_MISMATCH","Every planned Work Item must exist in this Intake before approval.");
    }
    await client.query("INSERT INTO job_activation_decisions(id,request_id,company_id,project_id,outcome,request_fingerprint,decided_by_id,eligible_role,reason,evidence) VALUES($1,$2,$3,$4,'approved',$5,$6,$7,$8,$9::jsonb)",[decisionId,request.id,input.companyId,input.projectId,input.expectedFingerprint,input.actor.actorUserId,input.actor.eligibleRole,input.reason,JSON.stringify(input.evidence)]);
    await client.query("UPDATE job_activation_requests SET state='approved',decided_at=now(),optimistic_version=optimistic_version+1 WHERE id=$1 AND state='pending'",[request.id]);
    return { decisionId, idempotent:false, nodeCount:input.nodes.length, workItemCount:input.workItems.length };
  },host);
}
