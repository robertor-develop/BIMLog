import { Router, type IRouter } from "express";
import { ZodError } from "zod/v4";
import { authMiddleware, requireProjectMember } from "../middlewares/auth";
import { FolderWizardImportError } from "../lib/folder-wizard-import-service";
import { createFolderWizardRoutingService } from "../lib/folder-wizard-routing-service";
import { createFolderWizardPublishReadinessStore } from "../lib/folder-wizard-publish-readiness-store";

const router: IRouter = Router();
const service = createFolderWizardRoutingService();
const publishingReadiness = createFolderWizardPublishReadinessStore();
const getScope = (req: { params: Record<string, unknown>; user?: { userId: number } }) => {
  const projectId = Number(req.params.projectId);
  if (!Number.isSafeInteger(projectId) || projectId <= 0) throw new FolderWizardImportError("FOLDER_WIZARD_INVALID_PROJECT", 400);
  return { projectId, actorUserId: req.user!.userId };
};
function fail(res: { status(code: number): { json(value: unknown): unknown } }, error: unknown) {
  if (error instanceof FolderWizardImportError) { res.status(error.status).json({ error: error.code }); return; }
  if (error instanceof ZodError) { res.status(400).json({ error: "FOLDER_WIZARD_ROUTING_INVALID", issues: error.issues.map(({ path, message }) => ({ path, message })) }); return; }
  if (error instanceof Error && /^FOLDER_WIZARD_/.test(error.message)) { res.status(400).json({ error: error.message }); return; }
  console.error("folder_wizard_routing_failed", error instanceof Error ? error.name : "UnknownError");
  res.status(500).json({ error: "FOLDER_WIZARD_ROUTING_FAILED" });
}
router.get("/projects/:projectId/integrations/folder-wizard/routing", authMiddleware, requireProjectMember(), async (req, res) => {
  try { res.json(await service.current(getScope(req))); } catch (error) { fail(res, error); }
});
router.get("/projects/:projectId/integrations/folder-wizard/publishing-readiness", authMiddleware, requireProjectMember(), async (req, res) => {
  try { res.json(await publishingReadiness.read(getScope(req))); } catch (error) { fail(res, error); }
});
router.post("/projects/:projectId/integrations/folder-wizard/routing", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const { scopeType, definition, expectedFingerprint } = req.body ?? {};
    if (!(["project", "company"].includes(scopeType)) || !(expectedFingerprint === null || /^[a-f0-9]{64}$/.test(expectedFingerprint))) {
      throw new FolderWizardImportError("FOLDER_WIZARD_ROUTING_REQUEST_INVALID", 400);
    }
    res.status(201).json(await service.save(getScope(req), { scopeType, definition, expectedFingerprint }));
  } catch (error) { fail(res, error); }
});
router.post("/projects/:projectId/integrations/folder-wizard/routing/preview", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const { definition, tags, filename } = req.body ?? {};
    if (!tags || typeof tags !== "object" || Array.isArray(tags) || Object.keys(tags).length > 64 ||
        Object.entries(tags).some(([key, value]) => !/^[a-z][a-z0-9_]{0,63}$/.test(key) || typeof value !== "string" || value.length > 160) ||
        typeof filename !== "string" || filename.length > 255) throw new FolderWizardImportError("FOLDER_WIZARD_PREVIEW_INVALID", 400);
    res.json(await service.preview(getScope(req), { definition, tags, filename }));
  } catch (error) { fail(res, error); }
});
export default router;
