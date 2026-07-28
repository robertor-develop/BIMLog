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
  contractCurrentViewExportData,
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
import { buildContractCurrentViewPdf, buildContractPdf, buildContractXlsx, type ContractExport, type ContractRegisterColumn, type ContractRegisterSection } from "../lib/financial-contract-export";

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
const statuses = new Set(["all", "draft", "submitted", "under_review", "approved", "executed", "returned", "rejected", "withdrawn", "superseded", "terminated", "voided", "closed"]);
const perspectives = new Set(["all", "downstream", "upstream"]);
const kinds = new Set(["all", "subcontract", "purchase_order", "consultant_agreement", "owner_prime", "other_commitment"]);
const sorts = new Set(["created_desc", "legal_asc", "legal_desc", "counterparty_asc", "status_asc", "value_desc", "value_asc", "approved_desc", "executed_desc"]);
const dateFields = new Set(["none", "approved", "executed"]);
const columns: ContractRegisterColumn[] = ["legalNumber", "title", "counterparty", "status", "type", "perspective", "originalValue", "currentCommitment", "currency", "approvedAt", "executedAt"];
const sections: ContractRegisterSection[] = ["summary", "filters", "contracts"];
const parseOne = (value: unknown, allowed: Set<string>, fallback: string, name: string) => {
  const text = typeof value === "string" && value.trim() ? value.trim() : fallback;
  if (!allowed.has(text)) throw new FinancialControlError(400, `CONTRACT_CURRENT_VIEW_${name.toUpperCase()}_INVALID`, `Invalid ${name} filter.`);
  return text;
};
const parseText = (value: unknown, fallback: string, max: number, name: string) => {
  const text = typeof value === "string" ? value.trim() : fallback;
  if (text.length > max) throw new FinancialControlError(400, `CONTRACT_CURRENT_VIEW_${name.toUpperCase()}_INVALID`, `Invalid ${name} filter.`);
  return text;
};
const parseList = <T extends string>(value: unknown, allowed: readonly T[], fallback: T[], name: string) => {
  if (typeof value === "string" && !value.trim()) throw new FinancialControlError(400, `CONTRACT_CURRENT_VIEW_${name.toUpperCase()}_REQUIRED`, `At least one ${name} selection is required.`);
  const raw = typeof value === "string" ? value.split(",").map((item) => item.trim()).filter(Boolean) : fallback;
  const unique = [...new Set(raw)];
  if (!unique.length) throw new FinancialControlError(400, `CONTRACT_CURRENT_VIEW_${name.toUpperCase()}_REQUIRED`, `At least one ${name} selection is required.`);
  if (unique.some((item) => !(allowed as readonly string[]).includes(item))) throw new FinancialControlError(400, `CONTRACT_CURRENT_VIEW_${name.toUpperCase()}_INVALID`, `Invalid ${name} selection.`);
  return unique as T[];
};
const parseDecimalFilter = (value: unknown, name: string) => {
  if (value == null || value === "") return null;
  const text = String(value).trim();
  if (!/^-?\d{1,15}(?:\.\d{1,4})?$/.test(text)) throw new FinancialControlError(400, `CONTRACT_CURRENT_VIEW_${name.toUpperCase()}_INVALID`, `Invalid ${name} filter.`);
  return Number(text);
};
const parseDateFilter = (value: unknown, name: string) => {
  if (value == null || value === "") return "";
  const text = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new FinancialControlError(400, `CONTRACT_CURRENT_VIEW_${name.toUpperCase()}_INVALID`, `Invalid ${name} filter.`);
  return text;
};
const numberValue = (value: unknown) => Number(String(value ?? "0").replace(/,/g, ""));
const safeFilePart = (value: string) => boundedText(value, "filename", 1, 120).replace(/[^A-Za-z0-9._-]/g, "-");
const human = (token: string) => token.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

router.get("/projects/:projectId/financial/contracts", run(async (req, res) => res.json(await getContractWorkspace({ actorUserId: req.user.userId, projectId: project(req), contractId: req.query.contractId }))));
router.get("/projects/:projectId/financial/contracts/current-view.pdf", run(async (req, res) => {
  const lang = req.query.lang === "es" ? "es" : "en";
  const label = (en: string, es: string) => lang === "es" ? es : en;
  const filters = {
    status: parseOne(req.query.status, statuses, "all", "status"),
    perspective: parseOne(req.query.perspective, perspectives, "all", "perspective"),
    contractType: parseOne(req.query.contract_type, kinds, "all", "contract_type"),
    currency: parseText(req.query.currency, "all", 12, "currency").toUpperCase(),
    counterparty: parseText(req.query.counterparty, "all", 160, "counterparty"),
    search: parseText(req.query.search, "", 200, "search").toLowerCase(),
    dateField: parseOne(req.query.date_field, dateFields, "none", "date_field"),
    dateFrom: parseDateFilter(req.query.date_from, "date_from"),
    dateTo: parseDateFilter(req.query.date_to, "date_to"),
    valueMin: parseDecimalFilter(req.query.value_min, "value_min"),
    valueMax: parseDecimalFilter(req.query.value_max, "value_max"),
    sort: parseOne(req.query.sort, sorts, "created_desc", "sort"),
    columns: parseList(req.query.columns, columns, ["legalNumber", "title", "counterparty", "status", "type", "perspective", "originalValue", "currentCommitment", "currency"], "columns"),
    sections: parseList(req.query.sections, sections, ["summary", "filters", "contracts"], "sections"),
  };
  if (filters.currency !== "ALL" && !/^[A-Z]{3}$/.test(filters.currency)) throw new FinancialControlError(400, "CONTRACT_CURRENT_VIEW_CURRENCY_INVALID", "Invalid currency filter.");
  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) throw new FinancialControlError(400, "CONTRACT_CURRENT_VIEW_DATE_RANGE_INVALID", "Invalid date range.");
  if (filters.valueMin != null && filters.valueMax != null && filters.valueMin > filters.valueMax) throw new FinancialControlError(400, "CONTRACT_CURRENT_VIEW_VALUE_RANGE_INVALID", "Invalid value range.");
  const data = await contractCurrentViewExportData({ actorUserId: req.user.userId, projectId: project(req) });
  const totalAccessible = data.contracts.length;
  const rows = data.contracts.filter((contract: any) => {
    const dateValue = filters.dateField === "approved" ? contract.approvedAt : filters.dateField === "executed" ? contract.executedAt : "";
    const value = filters.status === "executed" || contract.status === "executed" ? numberValue(contract.currentCommitment) : numberValue(contract.originalValue);
    if (filters.status !== "all" && contract.status !== filters.status) return false;
    if (filters.perspective !== "all" && contract.perspective !== filters.perspective) return false;
    if (filters.contractType !== "all" && contract.contractType !== filters.contractType) return false;
    if (filters.currency !== "ALL" && String(contract.currency).toUpperCase() !== filters.currency) return false;
    if (filters.counterparty !== "all" && contract.counterpartyName !== filters.counterparty) return false;
    if (filters.dateField !== "none" && (!dateValue || (filters.dateFrom && dateValue.slice(0, 10) < filters.dateFrom) || (filters.dateTo && dateValue.slice(0, 10) > filters.dateTo))) return false;
    if (filters.valueMin != null && value < filters.valueMin) return false;
    if (filters.valueMax != null && value > filters.valueMax) return false;
    if (!filters.search) return true;
    return [contract.bimlogId, contract.legalNumber, contract.title, contract.counterpartyName, contract.status, contract.perspective, contract.contractType, contract.currency, contract.originalValue, contract.currentCommitment, contract.approvedAt?.slice(0, 10), contract.executedAt?.slice(0, 10)].filter(Boolean).join(" ").toLowerCase().includes(filters.search);
  }).sort((a: any, b: any) => {
    if (filters.sort === "legal_asc") return String(a.legalNumber).localeCompare(String(b.legalNumber));
    if (filters.sort === "legal_desc") return String(b.legalNumber).localeCompare(String(a.legalNumber));
    if (filters.sort === "counterparty_asc") return String(a.counterpartyName).localeCompare(String(b.counterpartyName));
    if (filters.sort === "status_asc") return String(a.status).localeCompare(String(b.status)) || String(a.legalNumber).localeCompare(String(b.legalNumber));
    if (filters.sort === "value_asc") return numberValue(a.currentCommitment || a.originalValue) - numberValue(b.currentCommitment || b.originalValue);
    if (filters.sort === "value_desc") return numberValue(b.currentCommitment || b.originalValue) - numberValue(a.currentCommitment || a.originalValue);
    if (filters.sort === "approved_desc") return String(b.approvedAt ?? "").localeCompare(String(a.approvedAt ?? ""));
    if (filters.sort === "executed_desc") return String(b.executedAt ?? "").localeCompare(String(a.executedAt ?? ""));
    return 0;
  });
  const counts = { matching: rows.length, totalAccessible, executed: rows.filter((c: any) => c.status === "executed").length, approved: rows.filter((c: any) => c.status === "approved").length, draft: rows.filter((c: any) => c.status === "draft").length, companies: new Set(rows.map((c: any) => c.counterpartyName)).size };
  const executedTotal = rows.reduce((sum: number, contract: any) => contract.status === "executed" ? sum + numberValue(contract.currentCommitment) : sum, 0);
  const filterSummary = [
    `${label("Status", "Estado")}: ${filters.status === "all" ? label("All", "Todos") : human(filters.status)}`,
    `${label("Counterparty", "Contraparte")}: ${filters.counterparty === "all" ? label("All", "Todas") : filters.counterparty}`,
    `${label("Type", "Tipo")}: ${filters.contractType === "all" ? label("All", "Todos") : human(filters.contractType)}`,
    `${label("Perspective", "Perspectiva")}: ${filters.perspective === "all" ? label("All", "Todas") : human(filters.perspective)}`,
    `${label("Currency", "Moneda")}: ${filters.currency === "ALL" ? label("All", "Todas") : filters.currency}`,
    `${label("Search", "Busqueda")}: ${filters.search || label("None", "Ninguna")}`,
    `${label("Date", "Fecha")}: ${filters.dateField === "none" ? label("Not filtered", "Sin filtro") : `${human(filters.dateField)} ${filters.dateFrom || ".."} - ${filters.dateTo || ".."}`}`,
    `${label("Value", "Valor")}: ${filters.valueMin ?? ".."} - ${filters.valueMax ?? ".."}`,
    `${label("Sort", "Orden")}: ${human(filters.sort)}`,
    `${label("Rows", "Filas")}: ${rows.length}/${totalAccessible}`,
  ];
  const contentHash = crypto.createHash("sha256").update(JSON.stringify({ projectId: project(req), filters, rows: rows.map((contract: any) => ({ id: contract.id, versionId: contract.versionId, status: contract.status, revision: contract.revision, contentFingerprint: contract.contentFingerprint })) })).digest("hex");
  const generatedBy = [req.user.fullName, req.user.companyName].filter(Boolean).join(" - ") || req.user.email || `User ${req.user.userId}`;
  const output = await buildContractCurrentViewPdf({ ...data, generatedBy, contracts: rows, totals: { executedCommitments: executedTotal.toFixed(2), currencies: [...new Set(rows.map((contract: any) => contract.currency))] }, filters: filterSummary, counts, selectedColumns: filters.columns, selectedSections: filters.sections, sourceView: label("Contracts register current view", "Vista actual del registro de contratos"), contentHash });
  res.type("application/pdf").setHeader("Content-Disposition", `attachment; filename=contracts-current-view-${safeFilePart(data.project.code || String(project(req)))}.pdf`);
  res.send(output);
}));
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
