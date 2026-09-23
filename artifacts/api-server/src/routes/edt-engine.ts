import { Router, type IRouter } from "express";
import { authMiddleware } from "../middlewares/auth";
import { edtProjectId, resolveEdtRouteActor, sendEdtRouteError } from "../lib/edt-engine-route-context";
import { EdtEngineConflict } from "../lib/edt-engine-transaction";
import { decideGovernedEdtChange, requestGovernedEdtChange } from "../lib/edt-engine-governed-change-service";
import { decideWorkItemQc, previewResultImport, submitWorkItemIssuance } from "../lib/edt-engine-qc-import-service";
import { previewActivatedEdtPlan } from "../lib/edt-engine-plan-projection";
import { previewEdtActivationCandidate } from "../lib/edt-engine-activation-candidate";

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
    const projectId=edtProjectId(req);await resolveEdtRouteActor(req,projectId);
    throw new EdtEngineConflict("ECONOMIC_PLAN_NOT_SERVER_RESOLVED","The immutable Economic Plan must be computed from approved Contract, APU and Workflow records, not request amounts.");
  }catch(error){sendEdtRouteError(res,error);}
});

router.post("/projects/:projectId/edt-engine/time-entries/:entryId/transition",authMiddleware,async(req,res):Promise<void>=>{
  try{
    const projectId=edtProjectId(req);await resolveEdtRouteActor(req,projectId);
    throw new EdtEngineConflict("TIME_AMOUNT_NOT_SERVER_RESOLVED","Time-entry budget impact must be derived from the stored entry, assignment and rate, not request amounts.");
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
