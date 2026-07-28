import { Router } from "express";
import crypto from "crypto";
import { singleFileUpload } from "../middlewares/multipart";
import { pool } from "@workspace/db";
import { authMiddleware } from "../middlewares/auth";
import { FinancialControlError } from "../lib/financial-control-contract";
import { authorizeFinancialOperation } from "../lib/financial-control-service";
import {
  createBudgetDraft,
  createCompanyCostLibrary,
  createProjectCostStructure,
  getFinancialBudgetWorkspace,
  approveBudget,
  transitionBudget,
} from "../lib/financial-budget-service";
import {
  confirmBudgetImport,
  previewBudgetImport,
} from "../lib/financial-budget-import";
import {
  buildBaselinePdf,
  buildBaselineXlsx,
  buildBudgetCurrentViewPdf,
  budgetCurrentViewFileName,
  type BaselineExport,
  type BudgetCurrentViewExport,
} from "../lib/financial-budget-export";
import { boundedText, positiveId } from "../lib/financial-budget-contract";

const router = Router(),
  upload = singleFileUpload({
    fileSize: 10 * 1024 * 1024,
    files: 1,
    fields: 3,
    parts: 4,
    fieldSize: 4 * 1024,
  });
router.use("/projects/:projectId/financial", authMiddleware);
const run =
  (handler: (req: any, res: any) => Promise<void>) =>
  async (req: any, res: any) => {
    try {
      await handler(req, res);
    } catch (error) {
      if (error instanceof FinancialControlError) {
        res
          .status(error.status)
          .json({
            code: error.code,
            error: { en: error.message, es: error.message },
          });
        return;
      }
      console.error("[financial-budgets] request failed");
      res
        .status(500)
        .json({
          code: "BUDGET_INTERNAL_ERROR",
          error: {
            en: "Financial budget controls are temporarily unavailable.",
            es: "Los controles de presupuesto no están disponibles temporalmente.",
          },
        });
    }
  };
const project = (req: any) => positiveId(req.params.projectId, "projectId");
const text = (value: unknown) => String(value ?? "");
const matchesSearch = (values: unknown[], search: string) =>
  !search || values.map(text).join(" ").toLowerCase().includes(search);
const statusLabel = (status: string) => status.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
const sortLabel = (sort: string, label: (en: string, es: string) => string) => {
  if (sort === "code_asc") return label("Cost code A-Z", "Codigo A-Z");
  if (sort === "amount_desc") return label("Amount high to low", "Monto mayor a menor");
  if (sort === "version_desc") return label("Newest version", "Version mas nueva");
  if (sort === "version_asc") return label("Oldest version", "Version mas antigua");
  if (sort === "status_asc") return label("Status A-Z", "Estado A-Z");
  return label("Default order", "Orden predeterminado");
};

router.get(
  "/projects/:projectId/financial/workspace",
  run(async (req, res) =>
    res.json(
      await getFinancialBudgetWorkspace({
        actorUserId: req.user.userId,
        projectId: project(req),
      }),
    ),
  ),
);
router.get(
  "/projects/:projectId/financial/current-view/export.pdf",
  run(async (req, res) => {
    const projectId = project(req);
    await authorizeFinancialOperation({
      actorUserId: req.user.userId,
      projectId,
      featureKey: "cost.report.export",
      operation: "export",
    });
    const view = String(req.query.view ?? "");
    if (!["structure", "budget", "history", "snapshot"].includes(view))
      throw new FinancialControlError(400, "BUDGET_EXPORT_VIEW_INVALID", "Budget export view is not recognized.");
    const lang = req.query.lang === "es" ? "es" : "en";
    const label = (en: string, es: string) => lang === "es" ? es : en;
    const search = text(req.query.search).trim().toLowerCase();
    if (search.length > 120)
      throw new FinancialControlError(400, "BUDGET_EXPORT_SEARCH_INVALID", "Budget export search is too long.");
    const status = text(req.query.status || "all");
    const allowedStatuses = ["all", "draft", "submitted", "under_review", "approved", "returned", "rejected", "withdrawn"];
    if (!allowedStatuses.includes(status))
      throw new FinancialControlError(400, "BUDGET_EXPORT_STATUS_INVALID", "Budget export status is not recognized.");
    const sort = text(req.query.sort || "default");
    const allowedSorts = ["default", "code_asc", "amount_desc", "version_desc", "version_asc", "status_asc"];
    if (!allowedSorts.includes(sort))
      throw new FinancialControlError(400, "BUDGET_EXPORT_SORT_INVALID", "Budget export sort is not recognized.");
    const bool = (value: unknown, fallback = true) => {
      if (value === undefined) return fallback;
      if (value === "true") return true;
      if (value === "false") return false;
      throw new FinancialControlError(400, "BUDGET_EXPORT_OPTION_INVALID", "Budget export option is not recognized.");
    };
    const includeInactive = bool(req.query.include_inactive, true);
    const includeNotes = bool(req.query.include_notes, true);
    const includeTotals = bool(req.query.include_totals, true);
    const snapshotId = req.query.snapshotId ? boundedText(req.query.snapshotId, "snapshotId", 3, 100) : undefined;
    if (view === "snapshot" && !snapshotId)
      throw new FinancialControlError(400, "BUDGET_EXPORT_SNAPSHOT_REQUIRED", "Snapshot export requires a snapshot id.");
    const workspace = await getFinancialBudgetWorkspace({
      actorUserId: req.user.userId,
      projectId,
      snapshotId,
    });
    const selectedSnapshot = workspace.snapshot;
    const current = workspace.snapshots?.[0];
    const original = workspace.snapshots?.[workspace.snapshots.length - 1];
    const exportCurrency = text((workspace.budgets?.[0] as any)?.currency ?? "");
    const sortRows = <T extends Record<string, any>>(rows: T[]) => {
      if (sort === "code_asc") return [...rows].sort((a, b) => text(a.project_code ?? a.hierarchical_path).localeCompare(text(b.project_code ?? b.hierarchical_path)));
      if (sort === "amount_desc") return [...rows].sort((a, b) => Number(b.amount ?? b.calculated_total ?? 0) - Number(a.amount ?? a.calculated_total ?? 0));
      if (sort === "version_asc") return [...rows].sort((a, b) => Number(a.version ?? 0) - Number(b.version ?? 0));
      if (sort === "status_asc") return [...rows].sort((a, b) => text(a.status).localeCompare(text(b.status)) || Number(b.version ?? 0) - Number(a.version ?? 0));
      if (sort === "version_desc") return [...rows].sort((a, b) => Number(b.version ?? 0) - Number(a.version ?? 0));
      return [...rows];
    };
    const filters = [
      `${label("View", "Vista")}: ${label(view === "structure" ? "Cost Structure" : view === "budget" ? "Project Budget" : view === "history" ? "Version History" : "Approved Baseline Snapshot", view === "structure" ? "Estructura de Costos" : view === "budget" ? "Presupuesto del Proyecto" : view === "history" ? "Historial de Versiones" : "Instantanea de Linea Base Aprobada")}`,
      `${label("Search", "Busqueda")}: ${search || label("None", "Ninguna")}`,
      `${label("Sort", "Orden")}: ${sortLabel(sort, label)}`,
    ];
    if (view === "budget" || view === "history")
      filters.push(`${label("Status", "Estado")}: ${status === "all" ? label("All", "Todos") : statusLabel(status)}`);
    if (view === "structure")
      filters.push(`${label("Include inactive", "Incluir inactivos")}: ${includeInactive ? label("Yes", "Si") : "No"}`);
    if (view === "snapshot")
      filters.push(`${label("Include notes", "Incluir notas")}: ${includeNotes ? label("Yes", "Si") : "No"}`);
    if (view !== "structure")
      filters.push(`${label("Include totals", "Incluir totales")}: ${includeTotals ? label("Yes", "Si") : "No"}`);
    const totals = includeTotals && view !== "structure" ? [
      { label: label("Original Budget", "Presupuesto Original"), value: `${text(original?.originalTotal ?? "0")} ${exportCurrency}`.trim() },
      { label: label("Current Budget", "Presupuesto Actual"), value: `${text(current?.currentTotal ?? "0")} ${exportCurrency}`.trim() },
      { label: label("Difference", "Diferencia"), value: `${text(current?.differenceFromOriginal ?? "0")} ${exportCurrency}`.trim() },
    ] : [];
    let sections: BudgetCurrentViewExport["sections"] = [];
    if (view === "structure") {
      const nodes = sortRows((workspace.nodes ?? [])
        .filter((n: any) => includeInactive || n.active)
        .filter((n: any) => matchesSearch([n.project_code, n.project_name, n.mapping_provenance], search)));
      sections = [{
        title: label("Pinned Project Cost Structure", "Estructura de Costos Fijada"),
        emptyLabel: label("No cost structure rows match the current view.", "Ninguna fila de estructura coincide con la vista actual."),
        columns: [label("Code", "Codigo"), label("Name", "Nombre"), label("Mapping", "Mapeo")],
        rows: nodes.map((n: any) => [text(n.project_code), `${text(n.project_name)}${n.active ? "" : ` (${label("Deprecated", "Obsoleto")})`}`, text(n.mapping_provenance)]),
      }];
    } else if (view === "snapshot") {
      const lines = sortRows((selectedSnapshot?.lines ?? [])
        .filter((l: any) => {
          const searchValues = includeNotes
            ? [l.hierarchical_path, l.project_name, l.description, l.amount, l.notes]
            : [l.hierarchical_path, l.project_name, l.description, l.amount];
          return matchesSearch(searchValues, search);
        }));
      sections = [{
        title: label("Approved Baseline Snapshot Lines", "Lineas de Instantanea Aprobada"),
        emptyLabel: label("No snapshot lines match the current view.", "Ninguna linea de instantanea coincide con la vista actual."),
        columns: includeNotes ? [label("Cost Code", "Codigo"), label("Name", "Nombre"), label("Description", "Descripcion"), label("Amount", "Monto"), label("Notes", "Notas")] : [label("Cost Code", "Codigo"), label("Name", "Nombre"), label("Description", "Descripcion"), label("Amount", "Monto")],
        rows: lines.map((l: any) => includeNotes ? [text(l.hierarchical_path), text(l.project_name), text(l.description), `${text(l.amount)} ${exportCurrency}`.trim(), text(l.notes || "-")] : [text(l.hierarchical_path), text(l.project_name), text(l.description), `${text(l.amount)} ${exportCurrency}`.trim()]),
      }];
    } else {
      const budgets = sortRows((workspace.budgets ?? [])
        .filter((b: any) => status === "all" || b.status === status)
        .filter((b: any) => {
          const searchValues = view === "history"
            ? [b.version, b.status, b.purpose, b.calculated_total, b.currency]
            : [b.version, b.status, b.purpose, b.calculated_total, b.currency, b.content_fingerprint];
          return matchesSearch(searchValues, search);
        }));
      sections = view === "budget" ? [{
        title: label("Controlled Import Workflow", "Flujo de Importacion Controlado"),
        emptyLabel: label("Import workflow state is unavailable.", "El estado del flujo de importacion no esta disponible."),
        columns: [label("Area", "Area"), label("Current State", "Estado Actual"), label("Export Scope", "Alcance de Exportacion")],
        rows: [[
          label("CSV/XLSX budget import", "Importacion CSV/XLSX"),
          label("Visible on Project Budget screen", "Visible en la pantalla de Presupuesto"),
          label("Only confirmed budget versions are exported; unsaved local previews are not server-owned records.", "Solo se exportan versiones confirmadas; las vistas previas locales sin confirmar no son registros del servidor."),
        ]],
      }] : [];
      sections.push({
        title: view === "history" ? label("Budget Version History", "Historial de Versiones") : label("Controlled Budget Workflow", "Flujo Presupuestario Controlado"),
        emptyLabel: label("No budget versions match the current view.", "Ninguna version coincide con la vista actual."),
        columns: view === "history"
          ? [label("Version", "Version"), label("Status", "Estado"), label("Purpose", "Motivo"), label("Exact Total", "Total Exacto")]
          : [label("Version", "Version"), label("Status", "Estado"), label("Purpose", "Motivo"), label("Exact Total", "Total Exacto"), label("Fingerprint", "Huella")],
        rows: budgets.map((b: any) => view === "history"
          ? [`v${text(b.version)}`, statusLabel(text(b.status)), text(b.purpose), `${text(b.calculated_total)} ${text(b.currency)}`.trim()]
          : [`v${text(b.version)}`, statusLabel(text(b.status)), text(b.purpose), `${text(b.calculated_total)} ${text(b.currency)}`.trim(), text(b.content_fingerprint)]),
      });
    }
    const payload: BudgetCurrentViewExport = {
      project: workspace.project,
      generatedAt: new Date().toISOString(),
      generatedBy: req.user.fullName || "BIMLog user",
      reportTitle: label("Budget Current View PDF", "PDF de Vista Actual del Presupuesto"),
      reportNumber: `BUDGET-CURRENT-${workspace.project.code}-${Date.now()}`,
      view: view as BudgetCurrentViewExport["view"],
      language: lang,
      filters,
      totals,
      sections,
      hashPayload: { projectId, view, snapshotId, filters, sections, totals },
    };
    const output = await buildBudgetCurrentViewPdf(payload);
    res
      .type("application/pdf")
      .setHeader("Content-Disposition", `attachment; filename=${budgetCurrentViewFileName(payload)}`);
    res.send(output);
  }),
);
router.get(
  "/projects/:projectId/financial/snapshots/:snapshotId",
  run(async (req, res) =>
    res.json(
      await getFinancialBudgetWorkspace({
        actorUserId: req.user.userId,
        projectId: project(req),
        snapshotId: req.params.snapshotId,
      }),
    ),
  ),
);
router.post(
  "/projects/:projectId/financial/cost-libraries",
  run(async (req, res) =>
    res
      .status(201)
      .json(
        await createCompanyCostLibrary({
          actorUserId: req.user.userId,
          projectId: project(req),
          libraryId: req.body.libraryId,
          reason: req.body.reason,
          effectiveDate: req.body.effectiveDate,
          nodes: req.body.nodes,
        }),
      ),
  ),
);
router.post(
  "/projects/:projectId/financial/cost-structures",
  run(async (req, res) =>
    res
      .status(201)
      .json(
        await createProjectCostStructure({
          actorUserId: req.user.userId,
          projectId: project(req),
          libraryVersionId: req.body.libraryVersionId,
          structureId: req.body.structureId,
          reason: req.body.reason,
          nodes: req.body.nodes,
        }),
      ),
  ),
);
router.post(
  "/projects/:projectId/financial/budgets",
  run(async (req, res) =>
    res
      .status(201)
      .json(
        await createBudgetDraft({
          actorUserId: req.user.userId,
          projectId: project(req),
          structureVersionId: req.body.structureVersionId,
          budgetId: req.body.budgetId,
          currency: req.body.currency,
          purpose: req.body.purpose,
          lines: req.body.lines,
          sourceFileId: req.body.sourceFileId,
        }),
      ),
  ),
);
router.post(
  "/projects/:projectId/financial/budgets/:budgetVersionId/actions",
  run(async (req, res) =>
    res.json(
      await transitionBudget({
        actorUserId: req.user.userId,
        projectId: project(req),
        budgetVersionId: req.params.budgetVersionId,
        action: req.body.action,
        reason: req.body.reason,
        expectedRevision: req.body.expectedRevision,
      }),
    ),
  ),
);
router.post(
  "/projects/:projectId/financial/budgets/:budgetVersionId/approve",
  run(async (req, res) =>
    res.json(
      await approveBudget({
        actorUserId: req.user.userId,
        projectId: project(req),
        budgetVersionId: req.params.budgetVersionId,
        expectedRevision: req.body.expectedRevision,
        confirmationFingerprint: req.body.confirmationFingerprint,
      }),
    ),
  ),
);
router.post(
  "/projects/:projectId/financial/imports/preview",
  upload,
  run(async (req, res) => {
    if (!req.file)
      throw new FinancialControlError(
        400,
        "BUDGET_IMPORT_FILE_REQUIRED",
        "A CSV or XLSX file is required.",
      );
    res
      .status(201)
      .json(
        await previewBudgetImport({
          actorUserId: req.user.userId,
          projectId: project(req),
          sourceFileId: req.body.sourceFileId,
          fileName: req.file.originalname,
          bytes: req.file.buffer,
          currency: req.body.currency,
          idempotencyKey: req.body.idempotencyKey,
        }),
      );
  }),
);
router.post(
  "/projects/:projectId/financial/imports/:sessionId/confirm",
  run(async (req, res) =>
    res.json(
      await confirmBudgetImport({
        actorUserId: req.user.userId,
        projectId: project(req),
        sessionId: req.params.sessionId,
        fileHash: req.body.fileHash,
        parsedFingerprint: req.body.parsedFingerprint,
        currency: req.body.currency,
        total: req.body.total,
        structureVersionId: req.body.structureVersionId,
        purpose: req.body.purpose,
      }),
    ),
  ),
);
async function exportData(
  actorUserId: number,
  projectId: number,
  snapshotId: unknown,
): Promise<BaselineExport> {
  await authorizeFinancialOperation({
    actorUserId,
    projectId,
    featureKey: "cost.report.export",
    operation: "export",
  });
  const id = boundedText(snapshotId, "snapshotId", 3, 100);
  const head = (
    await pool.query(
      `SELECT s.*,p.name project_name,p.code project_code,c.name company_name,u.full_name approved_by_name FROM approved_budget_snapshots s JOIN projects p ON p.id=s.project_id JOIN companies c ON c.id=s.company_id JOIN users u ON u.id=s.approved_by_id WHERE s.id=$1 AND s.project_id=$2`,
      [id, projectId],
    )
  ).rows[0];
  if (!head)
    throw new FinancialControlError(
      404,
      "SNAPSHOT_NOT_FOUND",
      "Approved snapshot not found.",
    );
  const lines = (
    await pool.query(
      `SELECT project_code,project_name,hierarchical_path,description,amount,quantity,unit,unit_rate,notes,sort_order FROM approved_budget_snapshot_lines WHERE snapshot_id=$1 ORDER BY sort_order,stable_line_id`,
      [id],
    )
  ).rows;
  return {
    project: {
      name: head.project_name,
      code: head.project_code,
      companyName: head.company_name,
    },
    snapshot: {
      id,
      budgetVersion: Number(head.budget_version),
      currency: head.currency,
      originalTotal: String(head.original_total),
      currentTotal: String(head.current_total),
      differenceFromOriginal: String(head.difference_from_original),
      contentFingerprint: head.content_fingerprint,
      snapshotFingerprint: head.snapshot_fingerprint,
      approvedAt: new Date(head.approved_at).toISOString(),
      approvedByName: head.approved_by_name,
      approvalLimit: String(head.approval_limit),
      lines: lines.map((l: any) => ({
        projectCode: l.project_code,
        projectName: l.project_name,
        hierarchicalPath: l.hierarchical_path,
        description: l.description,
        amount: String(l.amount),
        quantity: l.quantity == null ? null : String(l.quantity),
        unit: l.unit,
        unitRate: l.unit_rate == null ? null : String(l.unit_rate),
        notes: l.notes,
        sortOrder: Number(l.sort_order),
      })),
    },
    generatedAt: new Date().toISOString(),
  };
}
async function recordSuccessfulExport(
  actorUserId: number,
  projectId: number,
  data: BaselineExport,
  kind: "pdf" | "xlsx",
) {
  await pool.query(
    `INSERT INTO financial_authority_journal(id,event_type,company_id,project_id,actor_user_id,entity_type,entity_id,decision,reason_code,explanation_en,explanation_es,evidence) SELECT $1,$2,s.company_id,$3,$4,'approved_budget_snapshot',$5,'allow','BUDGET_EXPORT_ALLOWED','Approved snapshot export completed.','Exportación de instantánea aprobada completada.',$6::jsonb FROM approved_budget_snapshots s WHERE s.id=$5 AND s.project_id=$3`,
    [
      crypto.randomUUID(),
      `budget_${kind}_exported`,
      projectId,
      actorUserId,
      data.snapshot.id,
      JSON.stringify({
        format: kind,
        snapshotFingerprint: data.snapshot.snapshotFingerprint,
      }),
    ],
  );
}
router.get(
  "/projects/:projectId/financial/snapshots/:snapshotId/export.pdf",
  run(async (req, res) => {
    const data = await exportData(
      req.user.userId,
      project(req),
      req.params.snapshotId,
    );
    const output = await buildBaselinePdf(data);
    await recordSuccessfulExport(req.user.userId, project(req), data, "pdf");
    res
      .type("application/pdf")
      .setHeader(
        "Content-Disposition",
        `attachment; filename=approved-budget-${data.snapshot.budgetVersion}.pdf`,
      );
    res.send(output);
  }),
);
router.get(
  "/projects/:projectId/financial/snapshots/:snapshotId/export.xlsx",
  run(async (req, res) => {
    const data = await exportData(
      req.user.userId,
      project(req),
      req.params.snapshotId,
    );
    const output = buildBaselineXlsx(data);
    await recordSuccessfulExport(req.user.userId, project(req), data, "xlsx");
    res
      .type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .setHeader(
        "Content-Disposition",
        `attachment; filename=approved-budget-${data.snapshot.budgetVersion}.xlsx`,
      );
    res.send(output);
  }),
);
export default router;
