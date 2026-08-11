import { Router } from "express";
import { authMiddleware } from "../middlewares/auth";
import { singleFileUpload } from "../middlewares/multipart";
import { FinancialControlError } from "../lib/financial-control-contract";
import {
  applyJobIntakeDocumentMapping,
  activateJobIntake,
  getJobIntake,
  initializeJobIntake,
  previewJobIntakeDocumentMapping,
  removeJobIntakeDocument,
  saveJobIntake,
  uploadJobIntakeDocument,
} from "../lib/job-intake-service";

const router = Router();
const upload = singleFileUpload({
  fileSize: 25 * 1024 * 1024,
  files: 1,
  fields: 3,
  parts: 4,
  fieldSize: 2 * 1024,
});
router.use("/projects/:projectId/intake", authMiddleware);

const errorEs: Record<string, string> = {
  JOB_INTAKE_PROJECT_NOT_FOUND: "No se encontró el proyecto.",
  JOB_INTAKE_PROJECT_ACCESS_REQUIRED: "Debe ser miembro activo del proyecto.",
  JOB_INTAKE_COMPANY_MISMATCH: "El proyecto pertenece a otra empresa.",
  JOB_INTAKE_NOT_FOUND: "Primero debe iniciar el ingreso del trabajo.",
  JOB_INTAKE_REVISION_INVALID: "Se requiere una revisión esperada válida.",
  JOB_INTAKE_STALE: "El ingreso cambió. Recargue la página antes de continuar.",
  JOB_INTAKE_ACTIVATED: "El ingreso ya fue activado y no puede modificarse.",
  JOB_INTAKE_CORE_IMMUTABLE:
    "El alcance, la entrega y las horas operativas no pueden cambiar después de activar; solamente puede completar datos comerciales recién habilitados.",
  JOB_INTAKE_NOT_READY:
    "Complete todos los requisitos visibles antes de activar el trabajo.",
  JOB_INTAKE_DOCUMENT_REQUIRED:
    "Seleccione un documento PDF, Word, Excel o CSV.",
  JOB_INTAKE_DOCUMENT_CATEGORY_INVALID:
    "Seleccione una categoría de documento reconocida.",
  JOB_INTAKE_DOCUMENT_TYPE_INVALID:
    "Solamente se aceptan documentos PDF, Word, Excel y CSV.",
  JOB_INTAKE_DOCUMENT_SIZE_INVALID:
    "El documento debe tener entre 1 byte y 25 MB.",
  JOB_INTAKE_DOCUMENT_NOT_FOUND: "No se encontró el documento activo.",
  JOB_INTAKE_SPREADSHEET_PARSE_FAILED:
    "No se pudo analizar la hoja de cálculo de forma segura. Confirme el tipo de archivo y expórtela nuevamente.",
  JOB_INTAKE_MAPPING_SOURCE_INVALID:
    "Solamente puede mapear una hoja de cálculo preservada.",
  JOB_INTAKE_MAPPING_SHEET_INVALID: "Seleccione una hoja preservada válida.",
  JOB_INTAKE_MAPPING_HEADER_INVALID:
    "Seleccione una fila de encabezados válida.",
  JOB_INTAKE_MAPPING_COLUMNS_INVALID:
    "Vincule Nombre de la Partida y Cantidad a dos columnas diferentes.",
  JOB_INTAKE_MAPPING_STALE:
    "El mapeo confirmado ya no coincide con la vista preservada.",
  JOB_INTAKE_MAPPING_HAS_ISSUES:
    "Resuelva cada problema de fila antes de importar las Partidas de Contrato.",
  JOB_INTAKE_MAPPING_EMPTY:
    "El mapeo confirmado no contiene Partidas de Contrato.",
  JOB_INTAKE_SCOPE_ID_REQUIRED:
    "Cada Partida de Contrato necesita un ID estable generado automáticamente.",
  JOB_INTAKE_SCOPE_ID_DUPLICATE:
    "Los IDs de Partida de Contrato deben ser únicos.",
  CONTRACT_ITEM_APU_CURRENCY_MISMATCH:
    "La moneda del APU de la Partida de Contrato debe coincidir con la moneda del Contrato.",
  JOB_ACTIVATION_ASSIGNMENT_SCOPE_INVALID:
    "Cada asignación debe corresponder a una partida activada.",
  JOB_INTAKE_ID_INVALID: "El identificador proporcionado no es válido.",
};

const run =
  (handler: (req: any, res: any) => Promise<void>) =>
  async (req: any, res: any) => {
    try {
      await handler(req, res);
    } catch (error) {
      if (error instanceof FinancialControlError) {
        res.status(error.status).json({
          code: error.code,
          error: {
            en: error.message,
            es:
              errorEs[error.code] ??
              "No se pudo completar la operación de ingreso del trabajo.",
          },
        });
        return;
      }
      console.error("[job-intake] request failed", error);
      res.status(500).json({
        code: "JOB_INTAKE_INTERNAL_ERROR",
        error: {
          en: "Job Intake is temporarily unavailable.",
          es: "El ingreso de trabajo no está disponible temporalmente.",
        },
      });
    }
  };

router.get(
  "/projects/:projectId/intake",
  run(async (req, res) => {
    res.json(
      await getJobIntake({
        actorUserId: req.user.userId,
        projectId: req.params.projectId,
      }),
    );
  }),
);
router.post(
  "/projects/:projectId/intake",
  run(async (req, res) => {
    res.status(201).json(
      await initializeJobIntake({
        actorUserId: req.user.userId,
        projectId: req.params.projectId,
      }),
    );
  }),
);
router.put(
  "/projects/:projectId/intake",
  run(async (req, res) => {
    res.json(
      await saveJobIntake({
        actorUserId: req.user.userId,
        projectId: req.params.projectId,
        expectedRevision: req.body?.expectedRevision,
        data: req.body?.data,
      }),
    );
  }),
);
router.post(
  "/projects/:projectId/intake/documents",
  upload,
  run(async (req, res) => {
    if (!req.file)
      throw new FinancialControlError(
        400,
        "JOB_INTAKE_DOCUMENT_REQUIRED",
        "Choose a PDF, Word, Excel, or CSV source document.",
      );
    res.status(201).json(
      await uploadJobIntakeDocument({
        actorUserId: req.user.userId,
        projectId: req.params.projectId,
        category: req.body.category,
        revisionLabel: req.body.revisionLabel,
        expectedRevision: req.body.expectedRevision,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        bytes: req.file.buffer,
      }),
    );
  }),
);
router.delete(
  "/projects/:projectId/intake/documents/:documentId",
  run(async (req, res) => {
    res.json(
      await removeJobIntakeDocument({
        actorUserId: req.user.userId,
        projectId: req.params.projectId,
        documentId: req.params.documentId,
        expectedRevision: req.query.expectedRevision,
      }),
    );
  }),
);
router.post(
  "/projects/:projectId/intake/documents/:documentId/mapping-preview",
  run(async (req, res) => {
    res.json(
      await previewJobIntakeDocumentMapping({
        actorUserId: req.user.userId,
        projectId: req.params.projectId,
        documentId: req.params.documentId,
        sheetName: req.body?.sheetName,
        headerRow: req.body?.headerRow,
        nameColumn: req.body?.nameColumn,
        quantityColumn: req.body?.quantityColumn,
      }),
    );
  }),
);
router.post(
  "/projects/:projectId/intake/documents/:documentId/mapping-apply",
  run(async (req, res) => {
    res.json(
      await applyJobIntakeDocumentMapping({
        actorUserId: req.user.userId,
        projectId: req.params.projectId,
        documentId: req.params.documentId,
        expectedRevision: req.body?.expectedRevision,
        mappingFingerprint: req.body?.mappingFingerprint,
        sheetName: req.body?.sheetName,
        headerRow: req.body?.headerRow,
        nameColumn: req.body?.nameColumn,
        quantityColumn: req.body?.quantityColumn,
      }),
    );
  }),
);
router.post(
  "/projects/:projectId/intake/activate",
  run(async (req, res) => {
    res.json(
      await activateJobIntake({
        actorUserId: req.user.userId,
        projectId: req.params.projectId,
        expectedRevision: req.body?.expectedRevision,
        confirmationFingerprint: req.body?.confirmationFingerprint,
      }),
    );
  }),
);

export default router;
