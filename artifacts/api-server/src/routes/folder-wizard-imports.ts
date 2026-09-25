import { Router, type IRouter } from "express";
import { ZodError } from "zod/v4";
import { authMiddleware } from "../middlewares/auth";
import { createFolderWizardImportService, FolderWizardImportError } from "../lib/folder-wizard-import-service";

const router: IRouter = Router();
const service = createFolderWizardImportService();

function scope(req: { params: Record<string, unknown>; user?: { userId: number } }) {
  const projectId = Number(req.params.projectId);
  if (!Number.isSafeInteger(projectId) || projectId <= 0) throw new FolderWizardImportError("FOLDER_WIZARD_INVALID_PROJECT", 400);
  return { projectId, actorUserId: req.user!.userId };
}

function fail(res: { status(code: number): { json(data: unknown): unknown } }, error: unknown): void {
  if (error instanceof FolderWizardImportError) { res.status(error.status).json({ error: error.code }); return; }
  if (error instanceof ZodError) { res.status(400).json({ error: "FOLDER_WIZARD_INVALID_EXPORT", issues: error.issues.map(({ path, message }) => ({ path, message })) }); return; }
  if (error instanceof Error && /^FOLDER_WIZARD_EXPORT_/.test(error.message)) { res.status(400).json({ error: error.message }); return; }
  console.error("folder_wizard_import_failed", error instanceof Error ? error.name : "UnknownError");
  res.status(500).json({ error: "FOLDER_WIZARD_IMPORT_FAILED" });
}

router.get("/projects/:projectId/integrations/folder-wizard", authMiddleware, async (req, res) => {
  try { res.json({ current: await service.current(scope(req)) }); }
  catch (error) { fail(res, error); }
});

router.post("/projects/:projectId/integrations/folder-wizard", authMiddleware, async (req, res) => {
  try {
    const { sourceText, expectedCurrentSha256 } = req.body ?? {};
    if (typeof sourceText !== "string" || !(expectedCurrentSha256 === null || /^[a-f0-9]{64}$/.test(expectedCurrentSha256))) {
      throw new FolderWizardImportError("FOLDER_WIZARD_INVALID_REQUEST", 400);
    }
    res.status(201).json(await service.import(scope(req), sourceText, expectedCurrentSha256));
  } catch (error) { fail(res, error); }
});

export default router;
