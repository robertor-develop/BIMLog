import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { projectsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { addPageNumbers, computeContentHash, createPdfDocument, drawBrandedHeader, PALETTE, REPORT_THEMES } from "../lib/pdf-kit";
import { drawOperationalRegisterTable } from "../lib/operational-register-table";
import { authMiddleware } from "../middlewares/auth";
import {
  CoordinatorRegisterError,
  loadCoordinatorActionRegister,
  parseRegisterQuery,
  type RegisterQuery,
} from "../lib/coordinator-action-register";
import {
  CoordinatorSavedViewError,
  createCoordinatorSavedView,
  deleteCoordinatorSavedView,
  listCoordinatorSavedViews,
  updateCoordinatorSavedView,
} from "../lib/coordinator-saved-views";
import {
  CoordinatorBulkActionError,
  executeCoordinatorMeetingLinks,
  previewCoordinatorMeetingLinks,
} from "../lib/coordinator-bulk-actions";
import { loadProjectInsightsSummary } from "../lib/project-insights-metrics";
import {
  ProjectAnalyticsExportError,
  buildProjectAnalyticsCurrentViewPdf,
  parseProjectAnalyticsExportLang,
  parseProjectAnalyticsExportSections,
} from "../lib/project-analytics-current-view-export";

const router: IRouter = Router();

const safeText = (value: unknown) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);

const pdfValue = (value: unknown) => safeText(value) || "—";

function writeWrapped(doc: PDFKit.PDFDocument, text: string, x: number, y: number, width: number, options: PDFKit.Mixins.TextOptions = {}) {
  doc.text(text, x, y, { width, lineGap: 2, ...options });
  return doc.y;
}

async function coordinatorProjectContext(projectId: number) {
  const [project] = await db
    .select({ id: projectsTable.id, name: projectsTable.name, code: projectsTable.code })
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId))
    .limit(1);
  return project ?? { id: projectId, name: `Project ${projectId}`, code: String(projectId) };
}

function coordinatorFilterSummary(query: RegisterQuery, lang: "en" | "es"): Array<[string, string]> {
  const label = (en: string, es: string) => (lang === "es" ? es : en);
  const fields: Array<[string, string]> = [];
  const valueText = (value: unknown) => Array.isArray(value) ? value.map(String).join(", ") : safeText(value);
  const push = (nameEn: string, nameEs: string, value: unknown, includeDefault = false) => {
    const text = valueText(value);
    if ((text && text !== "all") || (includeDefault && text)) fields.push([label(nameEn, nameEs), text]);
  };
  push("Built-in view", "Vista integrada", query.builtInView, true);
  push("Source modules", "Módulos fuente", query.modules, true);
  push("Legacy statuses", "Estados heredados", query.statuses);
  push("Lens statuses", "Estados Lens", query.lensStatuses);
  push("Original statuses", "Estados originales", query.originalStatuses);
  push("Presentation statuses", "Estados de presentación", query.presentationStatuses);
  push("Deadline", "Fecha límite", query.deadline);
  push("Due from", "Desde", query.dueFrom);
  push("Due to", "Hasta", query.dueTo);
  if (query.overdueOnly) fields.push([label("Overdue only", "Solo vencidas"), label("Yes", "Sí")]);
  push("Meeting", "Reunión", query.meetingId);
  push("Search", "Búsqueda", query.search);
  push("Responsible company", "Empresa responsable", query.responsibleCompany);
  push("Responsible person", "Persona responsable", query.responsiblePerson);
  push("Floor", "Piso", query.floor);
  push("Discipline", "Disciplina", query.discipline);
  push("Timezone", "Zona horaria", query.timezone, true);
  push("Page", "Página", String(query.page), true);
  push("Page size", "Tamaño de página", String(query.pageSize), true);
  return fields.length ? fields : [[label("Filters", "Filtros"), label("All actionable current records", "Todos los registros accionables vigentes")]];
}

export function sendCoordinatorPdf(res: Response, input: {
  project: { id: number; name: string; code: string };
  companyName: string;
  generatedAt: Date;
  lang: "en" | "es";
  filters: Array<[string, string]>;
  result: Awaited<ReturnType<typeof loadCoordinatorActionRegister>>;
}) {
  const label = (en: string, es: string) => (input.lang === "es" ? es : en);
  const doc = createPdfDocument({ size: "LETTER", layout: "landscape", margin: 36, bufferPages: true, autoFirstPage: true });
  const filename = `Coordinator-Command-Center-${input.project.code || input.project.id}.pdf`.replace(/[^A-Za-z0-9._-]/g, "-");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  doc.pipe(res);

  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const title = label("Coordinator Command Center", "Centro de Control de Coordinación");
  const pageHeader = () => drawBrandedHeader(doc, {
    margin: 36,
    companyName: input.companyName,
    title,
    projectName: input.project.name,
    projectCode: input.project.code,
    reportDate: input.generatedAt,
    theme: REPORT_THEMES.platform.standard,
  }) + 10;
  let y = pageHeader();
  doc.fillColor(PALETTE.TEXT).font("Helvetica-Bold").fontSize(10).text(label("Active filter summary", "Resumen de filtros activos"), doc.page.margins.left, y);
  y = doc.y + 4;
  doc.font("Helvetica").fontSize(8).fillColor(PALETTE.TEXT);
  for (const [name, value] of input.filters) {
    y = writeWrapped(doc, `${name}: ${value}`, doc.page.margins.left, y, width);
  }
  y += 8;
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(PALETTE.MUTED)
    .text(
      `${label("Rows in exported visible page", "Filas en la página visible exportada")}: ${input.result.items.length} · ${label("Filtered total", "Total filtrado")}: ${input.result.total}`,
      doc.page.margins.left,
      y,
    );
  y = doc.y + 10;

  if (input.result.items.length === 0) {
    doc
      .roundedRect(doc.page.margins.left, y, width, 50, 6)
      .strokeColor(PALETTE.BORDER)
      .stroke()
      .fillColor(PALETTE.TEXT)
      .font("Helvetica-Bold")
      .fontSize(11)
      .text(label("No actions match the current filters.", "Ninguna acción coincide con los filtros actuales."), doc.page.margins.left + 12, y + 14, { width: width - 24 });
  } else {
    const left = doc.page.margins.left;
    y = drawOperationalRegisterTable(doc, {
      x: left,
      startY: y,
      columns: [
        { label: label("Source", "Fuente"), width: 70, format: (item) => pdfValue(item.sourceModule) },
        { label: label("ID", "ID"), width: 80, format: (item) => pdfValue(item.displayIdentifier) },
        { label: label("Action", "Acción"), width: 190, format: (item) => pdfValue(item.title) },
        { label: label("Status", "Estado"), width: 75, format: (item) => pdfValue(item.presentationStatus) },
        {
          label: label("Responsible", "Responsable"),
          width: 125,
          format: (item) => pdfValue([item.responsibility.company, item.responsibility.person].filter(Boolean).join(" · ")),
        },
        {
          label: label("Floor / discipline", "Piso / disciplina"),
          width: 105,
          format: (item) => pdfValue([item.floor, item.discipline].filter(Boolean).join(" / ")),
        },
        { label: label("Deadline", "Fecha límite"), width: 75, format: (item) => pdfValue(item.dueAt) },
      ],
      rows: input.result.items,
      fontSize: 8.5,
      headerFontSize: 8.5,
      rowMinHeight: 30,
      cellPadX: 4,
      cellPadY: 5,
      pageBottom: doc.page.height - 52,
      onPageBreak: () => {
        doc.addPage({ size: "LETTER", layout: "landscape", margins: { top: 36, right: 36, bottom: 36, left: 36 } });
        return pageHeader();
      },
    });
  }
  addPageNumbers(doc, {
    margin: 36,
    footerY: doc.page.height - 24,
    fingerprintY: doc.page.height - 36,
    companyName: input.companyName,
    projectName: input.project.name,
    timestamp: input.generatedAt.toISOString(),
    contentHash: computeContentHash({ projectId: input.project.id, filters: input.filters, rows: input.result.items }),
  });
  doc.end();
}

const scope = (req: Request) => ({
  userId: req.user!.userId,
  projectId: Number(req.params.projectId),
  superAdminAccess: String(req.header("x-bimlog-super-admin-access") ?? ""),
  superAdminReason: String(req.header("x-bimlog-super-admin-reason") ?? ""),
});

function savedViewFailure(res: Response, error: unknown) {
  if (error instanceof CoordinatorSavedViewError) {
    res.status(error.status).json({ error: error.code, message: error.message, messageEs: error.messageEs });
    return;
  }
  if (error instanceof CoordinatorRegisterError) {
    res.status(error.status).json({ error: error.code, message: error.message, messageEs: "No se pudo autorizar la operación de la vista guardada." });
    return;
  }
  res.status(500).json({
    error: "SAVED_VIEW_OPERATION_FAILED",
    message: "The saved-view operation could not be completed.",
    messageEs: "No se pudo completar la operación de la vista guardada.",
  });
}

function assertSavedViewBody(req: Request) {
  if (Buffer.byteLength(JSON.stringify(req.body ?? {}), "utf8") > 8192)
    throw new CoordinatorSavedViewError(413, "SAVED_VIEW_PAYLOAD_TOO_LARGE", "The saved-view request is too large.", "La solicitud de la vista guardada es demasiado grande.");
}

function bulkFailure(res: Response, error: unknown) {
  if (error instanceof CoordinatorBulkActionError) {
    res.status(error.status).json({
      error: error.code,
      message: error.message,
      messageEs: error.messageEs,
    });
    return;
  }
  res.status(500).json({
    error: "COORDINATOR_BULK_OPERATION_FAILED",
    message: "The controlled bulk operation could not be completed.",
    messageEs: "No se pudo completar la operación masiva controlada.",
  });
}

function assertBulkBody(req: Request) {
  if (Buffer.byteLength(JSON.stringify(req.body ?? {}), "utf8") > 32768)
    throw new CoordinatorBulkActionError(
      413,
      "COORDINATOR_BULK_PAYLOAD_TOO_LARGE",
      "The bulk-action request is too large.",
      "La solicitud de acción masiva es demasiado grande.",
    );
}

router.get(
  "/projects/:projectId/coordinator-actions",
  authMiddleware,
  async (req, res) => {
    try {
      const result = await loadCoordinatorActionRegister({
        userId: req.user!.userId,
        projectId: Number(req.params.projectId),
        query: parseRegisterQuery(req.query as Record<string, unknown>),
        superAdminAccess: String(
          req.header("x-bimlog-super-admin-access") ?? "",
        ),
        superAdminReason: String(
          req.header("x-bimlog-super-admin-reason") ?? "",
        ),
      });
      res.setHeader("Cache-Control", "private, no-store");
      res.json(result);
    } catch (error) {
      if (error instanceof CoordinatorRegisterError) {
        res
          .status(error.status)
          .json({ error: error.code, message: error.message });
        return;
      }
      res
        .status(500)
        .json({
          error: "COORDINATOR_REGISTER_FAILED",
          message: "The action register could not be loaded.",
        });
    }
  },
);

router.get(
  "/projects/:projectId/coordinator-actions/export.pdf",
  authMiddleware,
  async (req, res) => {
    try {
      const projectId = Number(req.params.projectId);
      const lang = req.query.lang === "es" ? "es" : "en";
      const generatedAt = new Date();
      const parsedQuery = parseRegisterQuery(req.query as Record<string, unknown>);
      const [project, result] = await Promise.all([
        coordinatorProjectContext(projectId),
        loadCoordinatorActionRegister({
          userId: req.user!.userId,
          projectId,
          query: parsedQuery,
          superAdminAccess: String(req.header("x-bimlog-super-admin-access") ?? ""),
          superAdminReason: String(req.header("x-bimlog-super-admin-reason") ?? ""),
        }),
      ]);
      res.setHeader("Cache-Control", "private, no-store");
      sendCoordinatorPdf(res, {
        project,
        companyName: req.user!.companyName || "Company",
        generatedAt,
        lang,
        filters: coordinatorFilterSummary(parsedQuery, lang),
        result,
      });
    } catch (error) {
      if (error instanceof CoordinatorRegisterError) {
        res.status(error.status).json({ error: error.code, message: error.message });
        return;
      }
      res.status(500).json({
        error: "COORDINATOR_REGISTER_PDF_FAILED",
        message: "The Command Center PDF could not be exported.",
        messageEs: "No se pudo exportar el PDF del Centro de Control.",
      });
    }
  },
);

router.get(
  "/projects/:projectId/project-insights",
  authMiddleware,
  async (req, res) => {
    try {
      const timezone =
        typeof req.query.timezone === "string" && req.query.timezone.trim()
          ? req.query.timezone.trim()
          : "UTC";
      res.setHeader("Cache-Control", "private, no-store");
      res.json(
        await loadProjectInsightsSummary({
          userId: req.user!.userId,
          projectId: Number(req.params.projectId),
          timezone,
          superAdminAccess: String(
            req.header("x-bimlog-super-admin-access") ?? "",
          ),
          superAdminReason: String(
            req.header("x-bimlog-super-admin-reason") ?? "",
          ),
        }),
      );
    } catch (error) {
      if (error instanceof CoordinatorRegisterError) {
        res
          .status(error.status)
          .json({ error: error.code, message: error.message });
        return;
      }
      res.status(500).json({
        error: "PROJECT_INSIGHTS_FAILED",
        message: "Project Insights & Reports could not be loaded.",
        messageEs:
          "No se pudieron cargar las Perspectivas e Informes del Proyecto.",
      });
    }
  },
);


router.get(
  "/projects/:projectId/project-insights/export-pdf",
  authMiddleware,
  async (req, res) => {
    try {
      const timezone =
        typeof req.query.timezone === "string" && req.query.timezone.trim()
          ? req.query.timezone.trim()
          : "UTC";
      const result = await buildProjectAnalyticsCurrentViewPdf({
        userId: req.user!.userId,
        fullName: req.user!.fullName,
        companyName: req.user!.companyName,
        projectId: Number(req.params.projectId),
        timezone,
        language: parseProjectAnalyticsExportLang(req.query.lang),
        sections: parseProjectAnalyticsExportSections(req.query.sections),
        superAdminAccess: String(req.header("x-bimlog-super-admin-access") ?? ""),
        superAdminReason: String(req.header("x-bimlog-super-admin-reason") ?? ""),
      });
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${result.fileName}"`);
      res.setHeader("X-BIMLog-Content-SHA256", result.contentHash);
      res.send(result.buffer);
    } catch (error) {
      if (error instanceof CoordinatorRegisterError) {
        res.status(error.status).json({ error: error.code, message: error.message });
        return;
      }
      if (error instanceof ProjectAnalyticsExportError) {
        res.status(error.status).json({
          error: "PROJECT_INSIGHTS_EXPORT_INVALID_CURRENT_VIEW",
          message: error.message,
          messageEs: error.messageEs,
        });
        return;
      }
      const status = typeof (error as { status?: unknown })?.status === "number" ? Number((error as { status: number }).status) : 500;
      res.status(status).json({
        error: status === 404 ? "PROJECT_NOT_FOUND" : "PROJECT_INSIGHTS_EXPORT_FAILED",
        message: "Project Insights current-view PDF could not be generated.",
        messageEs: "No se pudo generar el PDF de la vista actual de Perspectivas del Proyecto.",
      });
    }
  },
);
router.post(
  "/projects/:projectId/coordinator-actions/meeting-links/preview",
  authMiddleware,
  async (req, res) => {
    try {
      assertBulkBody(req);
      res.setHeader("Cache-Control", "private, no-store");
      res.json(
        await previewCoordinatorMeetingLinks({
          userId: req.user!.userId,
          projectId: Number(req.params.projectId),
          body: req.body,
        }),
      );
    } catch (error) {
      bulkFailure(res, error);
    }
  },
);

router.post(
  "/projects/:projectId/coordinator-actions/meeting-links/execute",
  authMiddleware,
  async (req, res) => {
    try {
      assertBulkBody(req);
      res.setHeader("Cache-Control", "private, no-store");
      const result = await executeCoordinatorMeetingLinks({
        userId: req.user!.userId,
        projectId: Number(req.params.projectId),
        body: req.body,
      });
      res.status(result.idempotent ? 200 : 201).json(result);
    } catch (error) {
      bulkFailure(res, error);
    }
  },
);

router.get(
  "/projects/:projectId/coordinator-saved-views",
  authMiddleware,
  async (req, res) => {
    try {
      res.setHeader("Cache-Control", "private, no-store");
      res.json(await listCoordinatorSavedViews(scope(req)));
    } catch (error) {
      savedViewFailure(res, error);
    }
  },
);

router.post(
  "/projects/:projectId/coordinator-saved-views",
  authMiddleware,
  async (req, res) => {
    try {
      assertSavedViewBody(req);
      const result = await createCoordinatorSavedView({
        ...scope(req),
        name: req.body?.name,
        configuration: req.body?.configuration,
        isDefault: req.body?.isDefault,
        idempotencyKey: req.body?.idempotencyKey,
      });
      res.status(result.idempotent ? 200 : 201).json(result);
    } catch (error) {
      savedViewFailure(res, error);
    }
  },
);

router.patch(
  "/projects/:projectId/coordinator-saved-views/:savedViewId",
  authMiddleware,
  async (req, res) => {
    try {
      assertSavedViewBody(req);
      res.json(
        await updateCoordinatorSavedView({
          ...scope(req),
          savedViewId: String(req.params.savedViewId),
          name: req.body?.name,
          configuration: req.body?.configuration,
          isDefault: req.body?.isDefault,
          expectedVersion: req.body?.expectedVersion,
          idempotencyKey: req.body?.idempotencyKey,
        }),
      );
    } catch (error) {
      savedViewFailure(res, error);
    }
  },
);

router.delete(
  "/projects/:projectId/coordinator-saved-views/:savedViewId",
  authMiddleware,
  async (req, res) => {
    try {
      assertSavedViewBody(req);
      res.json(
        await deleteCoordinatorSavedView({
          ...scope(req),
          savedViewId: String(req.params.savedViewId),
          expectedVersion: req.body?.expectedVersion,
          idempotencyKey: req.body?.idempotencyKey,
        }),
      );
    } catch (error) {
      savedViewFailure(res, error);
    }
  },
);

export default router;
