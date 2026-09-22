import { Router, type IRouter } from "express";
import { authMiddleware } from "../middlewares/auth";
import { edtProjectId, resolveEdtRouteActor, sendEdtRouteError } from "../lib/edt-engine-route-context";
import { approveEdtActivation, requestEdtActivation } from "../lib/edt-engine-activation-service";
import { EdtEngineConflict } from "../lib/edt-engine-transaction";

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

export default router;
