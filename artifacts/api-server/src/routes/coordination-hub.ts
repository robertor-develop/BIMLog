import { randomUUID } from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { ZodError } from "zod/v4";
import { authMiddleware, requireProjectMember } from "../middlewares/auth";
import { CoordinationConflictError, CoordinationHubService } from "../lib/coordination-hub-service";
import { postgresCoordinationHubStore } from "../lib/coordination-hub-postgres-store";
import { ConnectorValidationUnavailableError, CoordinationHubConfigurationService } from "../lib/coordination-hub-configuration-service";
import { postgresCoordinationHubConfigurationStore } from "../lib/coordination-hub-configuration-postgres-store";
import { createRuntimeSharePointCredentialValidator } from "../lib/sharepoint-credential-validator";
import { runtimeConnectorValidationOperationsService } from "../lib/connector-validation-operations-postgres-store";

const router: IRouter = Router();
const service = new CoordinationHubService(postgresCoordinationHubStore);
const configurationService = new CoordinationHubConfigurationService(postgresCoordinationHubConfigurationStore, createRuntimeSharePointCredentialValidator());

function trustedCommand(req: Request): Record<string, unknown> {
  return {
    ...(req.body && typeof req.body === "object" ? req.body : {}),
    scope: {
      projectId: Number(req.params.projectId),
      companyId: req.user!.companyId,
      actorUserId: req.user!.userId,
    },
  };
}

function fail(res: Response, error: unknown): void {
  if (error instanceof ZodError) {
    res.status(400).json({ error: "COORDINATION_INPUT_INVALID", issues: error.issues.map(({ path, message }) => ({ path, message })) });
    return;
  }
  if (error instanceof CoordinationConflictError) {
    res.status(409).json({ error: error.code, message: error.message });
    return;
  }
  if (error instanceof ConnectorValidationUnavailableError) {
    res.status(503).json({ error: error.code });
    return;
  }
  const correlationId = randomUUID();
  console.error(JSON.stringify({ event: "coordination_hub_route_failure", correlationId, exception: error instanceof Error ? error.name : "UnknownError" }));
  res.status(500).json({ error: "COORDINATION_OPERATION_FAILED", correlationId });
}

router.get("/projects/:projectId/coordination-hub/summary", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const result = await service.getSummary({
      projectId: Number(req.params.projectId),
      companyId: req.user!.companyId,
      actorUserId: req.user!.userId,
    });
    res.json(result);
  } catch (error) { fail(res, error); }
});

router.get("/projects/:projectId/coordination-hub/credential-validation-operations", authMiddleware, requireProjectMember("project_admin"), async (req, res) => {
  try {
    const result = await runtimeConnectorValidationOperationsService.list({
      scope: {
        projectId: Number(req.params.projectId),
        companyId: req.user!.companyId,
        actorUserId: req.user!.userId,
      },
      limit: req.query.limit === undefined ? 20 : Number(req.query.limit),
    });
    res.json(result);
  } catch (error) { fail(res, error); }
});

router.post("/projects/:projectId/coordination-hub/credentials", authMiddleware, requireProjectMember("project_admin"), async (req, res) => {
  try {
    const result = await configurationService.registerCredential(trustedCommand(req));
    res.status(result.result === "created" ? 201 : 200).json(result);
  } catch (error) { fail(res, error); }
});

router.post("/projects/:projectId/coordination-hub/credentials/:credentialId/validate", authMiddleware, requireProjectMember("project_admin"), async (req, res) => {
  try {
    const result = await configurationService.validateCredential({
      ...trustedCommand(req),
      credentialId: req.params.credentialId,
    });
    res.status(result.result === "activated" ? 201 : 200).json(result);
  } catch (error) { fail(res, error); }
});

router.post("/projects/:projectId/coordination-hub/sharepoint-mapping", authMiddleware, requireProjectMember("project_admin"), async (req, res) => {
  try {
    const result = await configurationService.configureSharePointProject(trustedCommand(req));
    res.status(result.result === "created" ? 201 : 200).json(result);
  } catch (error) { fail(res, error); }
});

router.post("/projects/:projectId/coordination-hub/revisions", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const result = await service.registerRevision(trustedCommand(req));
    res.status(result.result === "created" ? 201 : 200).json(result);
  } catch (error) { fail(res, error); }
});

router.post("/projects/:projectId/coordination-hub/jobs", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const result = await service.enqueueJob(trustedCommand(req));
    res.status(result.result === "queued" ? 202 : 200).json(result);
  } catch (error) { fail(res, error); }
});

export default router;
