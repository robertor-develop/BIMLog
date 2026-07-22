import crypto from "crypto";
import { Router } from "express";
import { pool } from "@workspace/db";
import { authMiddleware } from "../middlewares/auth";
import { singleFileUpload } from "../middlewares/multipart";
import { FinancialControlError } from "../lib/financial-control-contract";
import { boundedText, positiveId } from "../lib/financial-budget-contract";
import {
  approveAmendment,
  approveContract,
  contractExportData,
  createContractAmendment,
  createContractDraft,
  executeAmendment,
  executeContract,
  getContractWorkspace,
  setContractRecordGrant,
  transitionAmendment,
  transitionContract,
} from "../lib/financial-contract-service";
import { confirmContractImport, previewContractImport } from "../lib/financial-contract-import";
import { buildContractPdf, buildContractXlsx, type ContractExport } from "../lib/financial-contract-export";

const router = Router();
const upload = singleFileUpload({ fileSize: 10 * 1024 * 1024, files: 1, fields: 5, parts: 6, fieldSize: 4 * 1024 });
router.use("/projects/:projectId/financial/contracts", authMiddleware);

const run = (handler: (req: any, res: any) => Promise<void>) => async (req: any, res: any) => {
  try { await handler(req, res); }
  catch (error) {
    if (error instanceof FinancialControlError) { res.status(error.status).json({ code: error.code, error: { en: error.message, es: error.message } }); return; }
    console.error("[financial-contracts] request failed");
    res.status(500).json({ code: "CONTRACT_INTERNAL_ERROR", error: { en: "Financial contract controls are temporarily unavailable.", es: "Los controles de contratos financieros no están disponibles temporalmente." } });
  }
};
const project = (req: any) => positiveId(req.params.projectId, "projectId");

router.get("/projects/:projectId/financial/contracts", run(async (req, res) => res.json(await getContractWorkspace({ actorUserId: req.user.userId, projectId: project(req), contractId: req.query.contractId }))));
router.get("/projects/:projectId/financial/contracts/:contractId", run(async (req, res) => res.json(await getContractWorkspace({ actorUserId: req.user.userId, projectId: project(req), contractId: req.params.contractId }))));

router.post("/projects/:projectId/financial/contracts", run(async (req, res) => res.status(201).json(await createContractDraft({ ...req.body, actorUserId: req.user.userId, projectId: project(req) }))));
router.post("/projects/:projectId/financial/contracts/:contractId/versions/:versionId/actions", run(async (req, res) => res.json(await transitionContract({ actorUserId: req.user.userId, projectId: project(req), contractId: req.params.contractId, versionId: req.params.versionId, action: req.body.action, reason: req.body.reason, expectedRevision: req.body.expectedRevision }))));
router.post("/projects/:projectId/financial/contracts/:contractId/versions/:versionId/approve", run(async (req, res) => res.json(await approveContract({ actorUserId: req.user.userId, projectId: project(req), contractId: req.params.contractId, versionId: req.params.versionId, expectedRevision: req.body.expectedRevision, confirmationFingerprint: req.body.confirmationFingerprint, overBudgetReason: req.body.overBudgetReason }))));
router.post("/projects/:projectId/financial/contracts/:contractId/versions/:versionId/execute", run(async (req, res) => res.json(await executeContract({ actorUserId: req.user.userId, projectId: project(req), contractId: req.params.contractId, versionId: req.params.versionId, expectedRevision: req.body.expectedRevision, confirmationFingerprint: req.body.confirmationFingerprint, signedFileId: req.body.signedFileId }))));

router.post("/projects/:projectId/financial/contracts/:contractId/amendments", run(async (req, res) => res.status(201).json(await createContractAmendment({ ...req.body, actorUserId: req.user.userId, projectId: project(req), contractId: req.params.contractId }))));
router.post("/projects/:projectId/financial/contracts/:contractId/amendments/:amendmentId/versions/:versionId/actions", run(async (req, res) => res.json(await transitionAmendment({ actorUserId: req.user.userId, projectId: project(req), contractId: req.params.contractId, amendmentId: req.params.amendmentId, versionId: req.params.versionId, action: req.body.action, reason: req.body.reason, expectedRevision: req.body.expectedRevision }))));
router.post("/projects/:projectId/financial/contracts/:contractId/amendments/:amendmentId/versions/:versionId/approve", run(async (req, res) => res.json(await approveAmendment({ actorUserId: req.user.userId, projectId: project(req), contractId: req.params.contractId, amendmentId: req.params.amendmentId, versionId: req.params.versionId, expectedRevision: req.body.expectedRevision, confirmationFingerprint: req.body.confirmationFingerprint, overBudgetReason: req.body.overBudgetReason }))));
router.post("/projects/:projectId/financial/contracts/:contractId/amendments/:amendmentId/versions/:versionId/execute", run(async (req, res) => res.json(await executeAmendment({ actorUserId: req.user.userId, projectId: project(req), contractId: req.params.contractId, amendmentId: req.params.amendmentId, versionId: req.params.versionId, expectedRevision: req.body.expectedRevision, confirmationFingerprint: req.body.confirmationFingerprint, signedFileId: req.body.signedFileId }))));

router.post("/projects/:projectId/financial/contracts/:contractId/grants", run(async (req, res) => res.status(201).json(await setContractRecordGrant({ actorUserId: req.user.userId, projectId: project(req), contractId: req.params.contractId, userId: req.body.userId, permission: req.body.permission, state: req.body.state, reason: req.body.reason }))));

router.post("/projects/:projectId/financial/contracts/imports/preview", upload, run(async (req, res) => {
  if (!req.file) throw new FinancialControlError(400, "CONTRACT_IMPORT_FILE_REQUIRED", "A CSV or XLSX file is required.");
  res.status(201).json(await previewContractImport({ actorUserId: req.user.userId, projectId: project(req), sourceFileId: req.body.sourceFileId, fileName: req.file.originalname, bytes: req.file.buffer, currency: req.body.currency, budgetSnapshotId: req.body.budgetSnapshotId, idempotencyKey: req.body.idempotencyKey }));
}));
router.post("/projects/:projectId/financial/contracts/imports/:sessionId/confirm", run(async (req, res) => res.json(await confirmContractImport({ actorUserId: req.user.userId, projectId: project(req), sessionId: req.params.sessionId, fileHash: req.body.fileHash, parsedFingerprint: req.body.parsedFingerprint, total: req.body.total, currency: req.body.currency, legalNumber: req.body.legalNumber, perspective: req.body.perspective, contractType: req.body.contractType, counterpartyName: req.body.counterpartyName, title: req.body.title, effectiveDate: req.body.effectiveDate, completionDate: req.body.completionDate, paymentTerms: req.body.paymentTerms, commercialMetadata: req.body.commercialMetadata, initialGrants: req.body.initialGrants }))));

async function recordExport(actorUserId: number, projectId: number, data: ContractExport, format: "pdf" | "xlsx") {
  await pool.query(`INSERT INTO financial_contract_history(id,company_id,project_id,contract_id,contract_version_id,actor_user_id,event_type,reason_code,evidence) SELECT $1,c.company_id,c.project_id,c.id,$2,$3,$4,'CONTRACT_EXPORT_ALLOWED',$5::jsonb FROM financial_contracts c WHERE c.id=$6 AND c.project_id=$7`, [crypto.randomUUID(), data.contract.versionId, actorUserId, `contract_${format}_exported`, JSON.stringify({ format, contentFingerprint: data.contract.contentFingerprint }), data.contract.id, projectId]);
}
router.get("/projects/:projectId/financial/contracts/:contractId/export.pdf", run(async (req, res) => { const projectId = project(req), data = await contractExportData({ actorUserId: req.user.userId, projectId, contractId: req.params.contractId }), output = await buildContractPdf(data); await recordExport(req.user.userId, projectId, data, "pdf"); res.type("application/pdf").setHeader("Content-Disposition", `attachment; filename=contract-${boundedText(data.contract.legalNumber, "legalNumber", 1, 100).replace(/[^A-Za-z0-9._-]/g, "-")}.pdf`); res.send(output); }));
router.get("/projects/:projectId/financial/contracts/:contractId/export.xlsx", run(async (req, res) => { const projectId = project(req), data = await contractExportData({ actorUserId: req.user.userId, projectId, contractId: req.params.contractId }), output = buildContractXlsx(data); await recordExport(req.user.userId, projectId, data, "xlsx"); res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").setHeader("Content-Disposition", `attachment; filename=contract-${boundedText(data.contract.legalNumber, "legalNumber", 1, 100).replace(/[^A-Za-z0-9._-]/g, "-")}.xlsx`); res.send(output); }));

export default router;
