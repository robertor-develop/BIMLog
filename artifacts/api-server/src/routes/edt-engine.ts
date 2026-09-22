import { Router, type IRouter } from "express";
import { authMiddleware } from "../middlewares/auth";
import { edtProjectId, resolveEdtRouteActor, sendEdtRouteError } from "../lib/edt-engine-route-context";
import { approveEdtActivation, requestEdtActivation } from "../lib/edt-engine-activation-service";
import { EdtEngineConflict } from "../lib/edt-engine-transaction";
import { decideGovernedEdtChange, requestGovernedEdtChange } from "../lib/edt-engine-governed-change-service";
import { createWorkItemEconomicPlan, transitionTimeEntry } from "../lib/edt-engine-economic-service";

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

router.post("/projects/:projectId/edt-engine/activation-requests", authMiddleware, async (req, res): Promise<void> => {
  try {
    const projectId = edtProjectId(req); const actor = await resolveEdtRouteActor(req, projectId); const body = bodyRecord(req.body);
    const workflowVersionIds = body.workflowVersionIds;
    if (!Array.isArray(workflowVersionIds) || workflowVersionIds.some(value => typeof value !== "string" || !value)) throw new EdtEngineConflict("REQUEST_BODY_INVALID", "workflowVersionIds must be a string array.");
    const result = await requestEdtActivation({ actor, companyId: actor.actorCompanyId, projectId,
      intakeId: requiredText(body,"intakeId"), intakeRevision: requiredInteger(body,"intakeRevision"),
      governanceVersionId: requiredText(body,"governanceVersionId"), pricingVersionId: requiredText(body,"pricingVersionId"),
      workflowVersionIds, reason: requiredText(body,"reason"), evidence: recordField(body,"evidence"),
      idempotencyKey: requiredText(body,"idempotencyKey") });
    res.status(result.idempotent ? 200 : 201).json(result);
  } catch (error) { sendEdtRouteError(res,error); }
});

router.post("/projects/:projectId/edt-engine/activation-requests/:requestId/approve", authMiddleware, async (req, res): Promise<void> => {
  try {
    const projectId = edtProjectId(req); const actor = await resolveEdtRouteActor(req, projectId); const body = bodyRecord(req.body);
    if (!Array.isArray(body.nodes) || !Array.isArray(body.workItems)) throw new EdtEngineConflict("REQUEST_BODY_INVALID", "nodes and workItems must be arrays.");
    const result = await approveEdtActivation({ actor, companyId: actor.actorCompanyId, projectId,
      requestId: String(req.params.requestId), expectedFingerprint: requiredText(body,"expectedFingerprint"),
      reason: requiredText(body,"reason"), evidence: recordField(body,"evidence"),
      nodes: body.nodes as Parameters<typeof approveEdtActivation>[0]["nodes"],
      workItems: body.workItems as Parameters<typeof approveEdtActivation>[0]["workItems"] });
    res.json(result);
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
    const result=await createWorkItemEconomicPlan({actor,companyId:actor.actorCompanyId,projectId,
      intakeId:requiredText(body,"intakeId"),workItemId:requiredText(body,"workItemId"),contractId:requiredText(body,"contractId"),
      contractVersionId:requiredText(body,"contractVersionId"),pricingTemplateVersionId:requiredText(body,"pricingTemplateVersionId"),
      deliveryWorkflowVersionId:requiredText(body,"deliveryWorkflowVersionId"),currency:requiredText(body,"currency"),
      directProductionAmount:requiredText(body,"directProductionAmount"),projectAdministrativeAmount:requiredText(body,"projectAdministrativeAmount"),
      incentiveReserveAmount:requiredText(body,"incentiveReserveAmount"),taskEarningsAmount:requiredText(body,"taskEarningsAmount"),
      projectEarningsAmount:requiredText(body,"projectEarningsAmount"),resolvedAllocation:recordField(body,"resolvedAllocation"),sourceSnapshot:recordField(body,"sourceSnapshot")});
    res.status(result.idempotent?200:201).json(result);
  }catch(error){sendEdtRouteError(res,error);}
});

router.post("/projects/:projectId/edt-engine/time-entries/:entryId/transition",authMiddleware,async(req,res):Promise<void>=>{
  try{
    const projectId=edtProjectId(req);const actor=await resolveEdtRouteActor(req,projectId);const body=bodyRecord(req.body);
    const decision=requiredText(body,"decision");if(!["submit","approve","reject"].includes(decision))throw new EdtEngineConflict("REQUEST_BODY_INVALID","decision is not supported.");
    const pool=requiredText(body,"pool");if(pool!=="direct_production"&&pool!=="project_administrative")throw new EdtEngineConflict("REQUEST_BODY_INVALID","pool is not supported.");
    const result=await transitionTimeEntry({actor,companyId:actor.actorCompanyId,projectId,entryId:String(req.params.entryId),expectedVersion:requiredInteger(body,"expectedVersion"),
      decision:decision as "submit"|"approve"|"reject",budgetAccountId:requiredText(body,"budgetAccountId"),pool,amount:requiredText(body,"amount"),reason:requiredText(body,"reason"),evidence:recordField(body,"evidence")});
    res.json(result);
  }catch(error){sendEdtRouteError(res,error);}
});

export default router;
