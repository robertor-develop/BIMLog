import { Router } from "express";
import { authMiddleware } from "../middlewares/auth";
import { FinancialControlError } from "../lib/financial-control-contract";
import { addContractItemWorkflowNode, getContractItemWorkflow, initializeContractItemWorkflow, updateContractItemWorkflowNode } from "../lib/contract-item-workflow-service";

const router = Router();
router.use("/projects/:projectId/financial/contracts/:contractId/items/:stableLineId/workflow", authMiddleware);

const run = (handler: (req: any, res: any) => Promise<void>) => async (req: any, res: any) => {
  try { await handler(req, res); }
  catch (error) {
    if (error instanceof FinancialControlError) { res.status(error.status).json({ code: error.code, error: { en: error.message, es: error.message } }); return; }
    console.error("[contract-item-workflow] request failed");
    res.status(500).json({ code: "WORKFLOW_INTERNAL_ERROR", error: { en: "Contract Item workflow is temporarily unavailable.", es: "El flujo de la Partida de Contrato no está disponible temporalmente." } });
  }
};
const scope = (req: any) => ({ actorUserId: req.user.userId, projectId: req.params.projectId, contractId: req.params.contractId, stableLineId: req.params.stableLineId });

router.get("/projects/:projectId/financial/contracts/:contractId/items/:stableLineId/workflow", run(async (req, res) => res.json(await getContractItemWorkflow(scope(req)))));
router.post("/projects/:projectId/financial/contracts/:contractId/items/:stableLineId/workflow/initialize", run(async (req, res) => res.status(201).json(await initializeContractItemWorkflow(scope(req)))));
router.post("/projects/:projectId/financial/contracts/:contractId/items/:stableLineId/workflow/nodes", run(async (req, res) => res.status(201).json(await addContractItemWorkflowNode({ ...scope(req), parentId: req.body?.parentId, nodeType: req.body?.nodeType, name: req.body?.name, dueDate: req.body?.dueDate, assigneeUserId: req.body?.assigneeUserId }))));
router.patch("/projects/:projectId/financial/contracts/:contractId/items/:stableLineId/workflow/nodes/:nodeId", run(async (req, res) => res.json(await updateContractItemWorkflowNode({ ...scope(req), nodeId: req.params.nodeId, expectedRevision: req.body?.expectedRevision, status: req.body?.status }))));

export default router;
