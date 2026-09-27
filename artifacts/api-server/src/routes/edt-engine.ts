import { Router, type IRouter } from "express";
import { authMiddleware } from "../middlewares/auth";
import { edtProjectId, resolveEdtRouteActor, sendEdtRouteError } from "../lib/edt-engine-route-context";
import { EdtEngineConflict } from "../lib/edt-engine-transaction";
import { transitionStoredTimeEntry } from "../lib/edt-engine-economic-service";
import { prepareApprovedWorkItemEconomicPlan } from "../lib/approved-work-item-economic-plan";
import { pool } from "@workspace/db";
import { decideGovernedEdtChange, requestGovernedEdtChange } from "../lib/edt-engine-governed-change-service";
import { decideWorkItemQc, previewResultImport, submitWorkItemIssuance } from "../lib/edt-engine-qc-import-service";
import { previewActivatedEdtPlan } from "../lib/edt-engine-plan-projection";
import { previewEdtActivationCandidate } from "../lib/edt-engine-activation-candidate";
import { changeEdtOperationsDirectorGrant, listEdtOperationsDirectorAssignments } from "../lib/edt-engine-operations-director";

const router: IRouter = Router();

function bodyRecord(value: unknown, field = "body"): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new EdtEngineConflict("REQUEST_BODY_INVALID", `${field} must be an object.`);
  return value as Record<string, unknown>;
}
function requiredText(body: Record<string, unknown>, field: string): string {
  const value = body[field];
  if (typeof value !== "string" || !value.trim()) throw new EdtEngineConflict("REQUEST_BODY_INVALID", `${field} is required.`);
  return value.trim();
}
function requiredInteger(body: Record<string, unknown>, field: string): number {
  const value = Number(body[field]);
  if (!Number.isInteger(value) || value < 0) throw new EdtEngineConflict("REQUEST_BODY_INVALID", `${field} must be a non-negative integer.`);
  return value;
}
function recordField(body: Record<string, unknown>, field: string): Record<string, unknown> {
  return bodyRecord(body[field], field);
}

router.get("/projects/:projectId/edt-engine/capabilities", authMiddleware, async (req, res): Promise<void> => {
  try {
    const projectId = edtProjectId(req);
    const actor = await resolveEdtRouteActor(req, projectId);
    res.json({ projectId, eligibleRole: actor.eligibleRole, grants: actor.grants });
  } catch (error) {
    sendEdtRouteError(res, error);
  }
});

router.get("/projects/:projectId/edt-engine/operations-director-grants", authMiddleware, async (req, res): Promise<void> => {
  try {
    const projectId = edtProjectId(req);
    const actor = await resolveEdtRouteActor(req, projectId);
    const assignments = await listEdtOperationsDirectorAssignments({
      actorUserId: actor.actorUserId, actorCompanyId: actor.actorCompanyId, projectId,
    });
    res.json({ projectId, assignments });
  } catch (error) { sendEdtRouteError(res, error); }
});

router.post("/projects/:projectId/edt-engine/operations-director-grants", authMiddleware, async (req, res): Promise<void> => {
  try {
    const projectId = edtProjectId(req);
    const actor = await resolveEdtRouteActor(req, projectId);
    const body = bodyRecord(req.body);
    const action = requiredText(body, "action");
    if (action !== "grant" && action !== "revoke")
      throw new EdtEngineConflict("REQUEST_BODY_INVALID", "Action must be grant or revoke.");
    const result = await changeEdtOperationsDirectorGrant({
      actorUserId: actor.actorUserId, actorCompanyId: actor.actorCompanyId, projectId,
      targetUserId: requiredInteger(body, "targetUserId"), action,
      reason: requiredText(body, "reason"),
    });
    res.status(result.idempotent ? 200 : action === "grant" ? 201 : 200).json(result);
  } catch (error) { sendEdtRouteError(res, error); }
});

router.get("/projects/:projectId/edt-engine/intakes/:intakeId/plan-preview", authMiddleware, async (req, res): Promise<void> => {
  try {
    const projectId = edtProjectId(req);
    const actor = await resolveEdtRouteActor(req, projectId);
    const intakeId = String(req.params.intakeId ?? "").trim();
    if (!intakeId) throw new EdtEngineConflict("REQUEST_BODY_INVALID", "An Intake ID is required.");
    const plan = await previewActivatedEdtPlan({ companyId: actor.actorCompanyId, projectId, intakeId });
    res.json({ projectId, intakeId, ...plan });
  } catch (error) { sendEdtRouteError(res, error); }
});

router.get("/projects/:projectId/edt-engine/intakes/:intakeId/activation-candidate", authMiddleware, async (req, res): Promise<void> => {
  try {
    const projectId = edtProjectId(req);
    const actor = await resolveEdtRouteActor(req, projectId);
    const intakeId = String(req.params.intakeId ?? "").trim();
    if (!intakeId) throw new EdtEngineConflict("REQUEST_BODY_INVALID", "An Intake ID is required.");
    const candidate = await previewEdtActivationCandidate({ companyId: actor.actorCompanyId, projectId, intakeId });
    res.json({ projectId, ...candidate });
  } catch (error) { sendEdtRouteError(res, error); }
});

router.post("/projects/:projectId/edt-engine/activation-requests", authMiddleware, async (req, res): Promise<void> => {
  try {
    const projectId = edtProjectId(req);
    await resolveEdtRouteActor(req, projectId);
    throw new EdtEngineConflict("ACTIVATION_PLAN_NOT_SERVER_RESOLVED", "Governed EDT activation cannot start until versions and the EDT plan are resolved from saved server records. Use the existing Intake activation for now.");
  } catch (error) { sendEdtRouteError(res,error); }
});

router.post("/projects/:projectId/edt-engine/activation-requests/:requestId/approve", authMiddleware, async (req, res): Promise<void> => {
  try {
    const projectId = edtProjectId(req);
    await resolveEdtRouteActor(req, projectId);
    throw new EdtEngineConflict("ACTIVATION_PLAN_NOT_SERVER_RESOLVED", "Governed EDT activation cannot approve a client-supplied plan. Complete the existing Intake activation while server-side plan resolution is integrated.");
  } catch (error) { sendEdtRouteError(res,error); }
});

router.post("/projects/:projectId/edt-engine/change-requests", authMiddleware, async (req, res): Promise<void> => {
  try {
    const projectId=edtProjectId(req); const actor=await resolveEdtRouteActor(req,projectId); const body=bodyRecord(req.body);
    const actionType=requiredText(body,"actionType");
    if (!(["redistribute_work_item","redistribute_contract","extra_hours","code_correction","split_work_item","reopen_work_item"] as string[]).includes(actionType)) throw new EdtEngineConflict("REQUEST_BODY_INVALID","actionType is not supported.");
    const result=await requestGovernedEdtChange({ actor,companyId:actor.actorCompanyId,projectId,
      workItemId:typeof body.workItemId==="string"&&body.workItemId?body.workItemId:undefined,
      actionType:actionType as Parameters<typeof requestGovernedEdtChange>[0]["actionType"],
      targetVersion:requiredInteger(body,"targetVersion"),beforeState:recordField(body,"beforeState"),afterState:recordField(body,"afterState"),
      reason:requiredText(body,"reason"),evidence:recordField(body,"evidence"),idempotencyKey:requiredText(body,"idempotencyKey") });
    res.status(result.idempotent?200:201).json(result);
  } catch(error){sendEdtRouteError(res,error);}
});

router.post("/projects/:projectId/edt-engine/change-requests/:requestId/decision", authMiddleware, async (req,res):Promise<void>=>{
  try{
    const projectId=edtProjectId(req);const actor=await resolveEdtRouteActor(req,projectId);const body=bodyRecord(req.body);
    const outcome=requiredText(body,"outcome");if(outcome!=="approved"&&outcome!=="rejected")throw new EdtEngineConflict("REQUEST_BODY_INVALID","outcome must be approved or rejected.");
    const result=await decideGovernedEdtChange({actor,companyId:actor.actorCompanyId,projectId,requestId:String(req.params.requestId),
      expectedFingerprint:requiredText(body,"expectedFingerprint"),outcome,reason:requiredText(body,"reason"),evidence:recordField(body,"evidence")});
    res.json(result);
  }catch(error){sendEdtRouteError(res,error);}
});

router.post("/projects/:projectId/edt-engine/economic-plans",authMiddleware,async(req,res):Promise<void>=>{
  try{
    const projectId=edtProjectId(req);const actor=await resolveEdtRouteActor(req,projectId);const body=bodyRecord(req.body);
    if(Object.keys(body).some(key=>!["workItemId","expectedContractFingerprint","expectedWorkflowFingerprint"].includes(key)))
      throw new EdtEngineConflict("ECONOMIC_PLAN_NOT_SERVER_RESOLVED","Economic amounts and versions must come from approved server records, not request data.");
    const expectedContractFingerprint=requiredText(body,"expectedContractFingerprint");
    const expectedWorkflowFingerprint=requiredText(body,"expectedWorkflowFingerprint");
    if(![expectedContractFingerprint,expectedWorkflowFingerprint].every(value=>/^[a-f0-9]{64}$/.test(value)))
      throw new EdtEngineConflict("REQUEST_BODY_INVALID","Current contract and workflow fingerprints are required.");
    const result=await prepareApprovedWorkItemEconomicPlan({actor,projectId,workItemId:requiredText(body,"workItemId"),
      expectedContractFingerprint,expectedWorkflowFingerprint});
    res.status(result.idempotent?200:201).json(result);
  }catch(error){sendEdtRouteError(res,error);}
});

router.get("/projects/:projectId/edt-engine/time-review",authMiddleware,async(req,res):Promise<void>=>{
  try{
    const projectId=edtProjectId(req);const actor=await resolveEdtRouteActor(req,projectId);
    const review=actor.grants.includes("TIME_APPROVE");
    const entries=(await pool.query(`SELECT e.id,e.user_id,e.created_by_id,e.submitted_by_id,e.status,e.optimistic_version AS version,
      e.work_date::text AS "workDate",e.hours::text,e.note,e.decision_reason AS "decisionReason",u.full_name AS "userName",t.name_en AS "taskName",t.name_es AS "taskNameEs"
      FROM job_activation_time_entries e JOIN users u ON u.id=e.user_id JOIN job_activation_tasks t ON t.id=e.task_id
      JOIN job_intakes i ON i.id=e.intake_id AND i.project_id=e.project_id
      WHERE e.project_id=$1 AND i.company_id=$2 AND ($3::boolean OR e.user_id=$4)
        AND e.superseded_by_entry_id IS NULL AND e.status NOT IN ('corrected','superseded')
      ORDER BY e.work_date DESC,e.created_at DESC,e.id DESC LIMIT 500`,[projectId,actor.actorCompanyId,review,actor.actorUserId])).rows;
    res.json({entries:entries.map(row=>({id:row.id,status:row.status,version:row.version,workDate:row.workDate,hours:row.hours,note:row.note,decisionReason:row.decisionReason,userName:row.userName,taskName:row.taskName,taskNameEs:row.taskNameEs,
      canSubmit:actor.grants.includes("TIME_SUBMIT")&&row.user_id===actor.actorUserId&&["legacy_recorded","draft","rejected"].includes(row.status),
      canDecide:review&&row.status==="submitted"&&![row.user_id,row.created_by_id,row.submitted_by_id].includes(actor.actorUserId)})),limit:500});
  }catch(error){sendEdtRouteError(res,error);}
});

router.post("/projects/:projectId/edt-engine/time-entries/:entryId/transition",authMiddleware,async(req,res):Promise<void>=>{
  try{
    const projectId=edtProjectId(req);const actor=await resolveEdtRouteActor(req,projectId);const body=bodyRecord(req.body);
    if(Object.keys(body).some(key=>!["decision","expectedVersion","reason"].includes(key)))
      throw new EdtEngineConflict("TIME_AMOUNT_NOT_SERVER_RESOLVED","Time-entry budget impact must be derived from the stored entry, assignment and rate, not request amounts.");
    const decision=requiredText(body,"decision");
    if(!["submit","approve","reject"].includes(decision))throw new EdtEngineConflict("TIME_DECISION_INVALID","Unsupported time decision.");
    const result=await transitionStoredTimeEntry({actor,companyId:actor.actorCompanyId,projectId,entryId:String(req.params.entryId),expectedVersion:requiredInteger(body,"expectedVersion"),decision:decision as "submit"|"approve"|"reject",reason:requiredText(body,"reason")});
    res.json(result);
  }catch(error){sendEdtRouteError(res,error);}
});

router.post("/projects/:projectId/edt-engine/work-items/:workItemId/issuances",authMiddleware,async(req,res):Promise<void>=>{
  try{
    const projectId=edtProjectId(req);const actor=await resolveEdtRouteActor(req,projectId);const body=bodyRecord(req.body);const kind=requiredText(body,"kind");
    if(!["initial","internal_issuance","external_revision","corrected_resubmittal","reopen"].includes(kind))throw new EdtEngineConflict("REQUEST_BODY_INVALID","kind is not supported.");
    const evidenceFileId=body.evidenceFileId===undefined?undefined:requiredInteger(body,"evidenceFileId");
    const result=await submitWorkItemIssuance({actor,companyId:actor.actorCompanyId,projectId,workItemId:String(req.params.workItemId),
      kind:kind as Parameters<typeof submitWorkItemIssuance>[0]["kind"],packageSnapshot:recordField(body,"packageSnapshot"),evidenceFileId,sourceEvidence:recordField(body,"sourceEvidence")});
    res.status(result.idempotent?200:201).json(result);
  }catch(error){sendEdtRouteError(res,error);}
});

router.post("/projects/:projectId/edt-engine/issuances/:issuanceId/qc-decisions",authMiddleware,async(req,res):Promise<void>=>{
  try{
    const projectId=edtProjectId(req);const actor=await resolveEdtRouteActor(req,projectId);const body=bodyRecord(req.body);
    const decisionKind=requiredText(body,"decisionKind"),outcome=requiredText(body,"outcome");
    if(!["review","final_approval","reopen_approval"].includes(decisionKind)||!["approved","rejected"].includes(outcome))throw new EdtEngineConflict("REQUEST_BODY_INVALID","QC decision is not supported.");
    if ("conflictUserIds" in body) throw new EdtEngineConflict("REQUEST_BODY_INVALID", "QC conflicts are resolved from stored assignments, not request input.");
    const result=await decideWorkItemQc({actor,companyId:actor.actorCompanyId,projectId,issuanceId:String(req.params.issuanceId),
      decisionKind:decisionKind as Parameters<typeof decideWorkItemQc>[0]["decisionKind"],outcome:outcome as "approved"|"rejected",reason:requiredText(body,"reason"),evidence:recordField(body,"evidence")});
    res.status(201).json(result);
  }catch(error){sendEdtRouteError(res,error);}
});

router.post("/projects/:projectId/edt-engine/intakes/:intakeId/result-imports/preview",authMiddleware,async(req,res):Promise<void>=>{
  try{
    const projectId=edtProjectId(req);const actor=await resolveEdtRouteActor(req,projectId);const body=bodyRecord(req.body);
    if(!Array.isArray(body.rows))throw new EdtEngineConflict("REQUEST_BODY_INVALID","rows must be an array.");
    const result=await previewResultImport({actor,companyId:actor.actorCompanyId,projectId,intakeId:String(req.params.intakeId),intakeRevision:requiredInteger(body,"intakeRevision"),
      fileId:requiredInteger(body,"fileId"),fileSha256:requiredText(body,"fileSha256"),parserVersion:requiredText(body,"parserVersion"),structuralRange:requiredText(body,"structuralRange"),rows:body.rows as Parameters<typeof previewResultImport>[0]["rows"]});
    res.status(result.idempotent?200:201).json(result);
  }catch(error){sendEdtRouteError(res,error);}
});

export default router;
