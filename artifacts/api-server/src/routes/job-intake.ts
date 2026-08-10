import { Router } from "express";
import { authMiddleware } from "../middlewares/auth";
import { singleFileUpload } from "../middlewares/multipart";
import { FinancialControlError } from "../lib/financial-control-contract";
import {
  activateJobIntake,
  getJobIntake,
  initializeJobIntake,
  removeJobIntakeDocument,
  saveJobIntake,
  uploadJobIntakeDocument,
} from "../lib/job-intake-service";

const router = Router();
const upload = singleFileUpload({ fileSize: 25 * 1024 * 1024, files: 1, fields: 2, parts: 3, fieldSize: 2 * 1024 });
router.use("/projects/:projectId/intake", authMiddleware);

const run = (handler: (req: any, res: any) => Promise<void>) => async (req: any, res: any) => {
  try { await handler(req, res); }
  catch (error) {
    if (error instanceof FinancialControlError) {
      res.status(error.status).json({ code: error.code, error: { en: error.message, es: error.message } });
      return;
    }
    console.error("[job-intake] request failed", error);
    res.status(500).json({ code: "JOB_INTAKE_INTERNAL_ERROR", error: { en: "Job Intake is temporarily unavailable.", es: "El ingreso de trabajo no esta disponible temporalmente." } });
  }
};

router.get("/projects/:projectId/intake", run(async (req, res) => {
  res.json(await getJobIntake({ actorUserId: req.user.userId, projectId: req.params.projectId }));
}));
router.post("/projects/:projectId/intake", run(async (req, res) => {
  res.status(201).json(await initializeJobIntake({ actorUserId: req.user.userId, projectId: req.params.projectId }));
}));
router.put("/projects/:projectId/intake", run(async (req, res) => {
  res.json(await saveJobIntake({ actorUserId: req.user.userId, projectId: req.params.projectId, expectedRevision: req.body?.expectedRevision, data: req.body?.data }));
}));
router.post("/projects/:projectId/intake/documents", upload, run(async (req, res) => {
  if (!req.file) throw new FinancialControlError(400, "JOB_INTAKE_DOCUMENT_REQUIRED", "Choose a PDF, Word, Excel, or CSV source document.");
  res.status(201).json(await uploadJobIntakeDocument({ actorUserId: req.user.userId, projectId: req.params.projectId, category: req.body.category, revisionLabel: req.body.revisionLabel, fileName: req.file.originalname, mimeType: req.file.mimetype, bytes: req.file.buffer }));
}));
router.delete("/projects/:projectId/intake/documents/:documentId", run(async (req, res) => {
  res.json(await removeJobIntakeDocument({ actorUserId: req.user.userId, projectId: req.params.projectId, documentId: req.params.documentId, expectedRevision: req.query.expectedRevision }));
}));
router.post("/projects/:projectId/intake/activate", run(async (req, res) => {
  res.json(await activateJobIntake({ actorUserId: req.user.userId, projectId: req.params.projectId, expectedRevision: req.body?.expectedRevision, confirmationFingerprint: req.body?.confirmationFingerprint }));
}));

export default router;
