import { Router, type RequestHandler } from "express";
import { FinancialControlError } from "../lib/financial-control-contract";
import { GenericApuBudgetControlError } from "../lib/generic-apu-budget-control";
import type {
  EvaluateAuthorizedGenericApuBudgetControlInput,
  GenericApuBudgetAuthorityService,
  ReverseAuthorizedGenericApuBudgetOverrideInput,
} from "../lib/apu-budget-authority-service";

const defaultService: GenericApuBudgetAuthorityService = {
  evaluate: async (input) => {
    const service = await import("../lib/apu-budget-authority-service");
    return service.evaluateAuthorizedGenericApuBudgetControl(input);
  },
  reverse: async (input) => {
    const service = await import("../lib/apu-budget-authority-service");
    return service.reverseAuthorizedGenericApuBudgetOverride(input);
  },
};

const defaultAuthenticate: RequestHandler = async (req, res, next) => {
  const middleware = await import("../middlewares/auth");
  middleware.authMiddleware(req, res, next);
};

function closedBody(body: unknown, allowed: readonly string[]): asserts body is Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new FinancialControlError(400, "APU_AUTHORITY_PAYLOAD_INVALID", "The request body must be an object.");
  const unexpected = Object.keys(body).filter((key) => !allowed.includes(key));
  if (unexpected.length > 0)
    throw new FinancialControlError(400, "APU_AUTHORITY_PAYLOAD_CLOSED", `The request body contains unsupported properties: ${unexpected.sort().join(", ")}.`);
}

function sendError(error: unknown, res: Parameters<RequestHandler>[1]): void {
  if (error instanceof FinancialControlError || error instanceof GenericApuBudgetControlError) {
    res.status(error.status).json({ code: error.code, error: error.message });
    return;
  }
  console.error("[generic-apu-budget-controls] request failed");
  res.status(500).json({ code: "APU_AUTHORITY_INTERNAL_ERROR", error: "Generic APU budget authority is temporarily unavailable." });
}

export function createGenericApuBudgetControlsRouter(
  service: GenericApuBudgetAuthorityService = defaultService,
  authenticate: RequestHandler = defaultAuthenticate,
) {
  const router = Router();
  router.use("/projects/:projectId/financial/generic-apu", authenticate);
  router.post(
    "/projects/:projectId/financial/generic-apu/:projectApuVersionId/budget-control/evaluate",
    async (req, res) => {
      try {
        if (!req.user)
          throw new FinancialControlError(401, "APU_AUTHENTICATION_REQUIRED", "Authentication is required.");
        closedBody(req.body, ["approvalReason", "control"]);
        const request: EvaluateAuthorizedGenericApuBudgetControlInput = {
          actorUserId: req.user.userId,
          projectId: req.params.projectId,
          projectApuVersionId: req.params.projectApuVersionId,
          approvalReason: req.body.approvalReason,
          control: req.body.control as EvaluateAuthorizedGenericApuBudgetControlInput["control"],
        };
        res.json(await service.evaluate(request));
      } catch (error) {
        sendError(error, res);
      }
    },
  );
  router.post(
    "/projects/:projectId/financial/generic-apu/:projectApuVersionId/budget-control/overrides/:receiptId/reverse",
    async (req, res) => {
      try {
        if (!req.user)
          throw new FinancialControlError(401, "APU_AUTHENTICATION_REQUIRED", "Authentication is required.");
        closedBody(req.body, ["reason", "idempotencyKey"]);
        const request: ReverseAuthorizedGenericApuBudgetOverrideInput = {
          actorUserId: req.user.userId,
          projectId: req.params.projectId,
          projectApuVersionId: req.params.projectApuVersionId,
          receiptId: req.params.receiptId,
          reason: req.body.reason,
          idempotencyKey: req.body.idempotencyKey,
        };
        res.json(await service.reverse(request));
      } catch (error) {
        sendError(error, res);
      }
    },
  );
  return router;
}

export default createGenericApuBudgetControlsRouter();
