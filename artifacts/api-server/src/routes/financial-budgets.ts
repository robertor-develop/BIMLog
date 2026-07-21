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
  type BaselineExport,
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
