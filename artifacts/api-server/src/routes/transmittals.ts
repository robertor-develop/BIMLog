import { Router } from "express";
import { db } from "@workspace/db";
import {
  transmittalsTable, transmittalItemsTable, activityLogTable,
  projectsTable, usersTable, filesTable, projectMembersTable,
  linkedItemsTable, agentInsightsTable,
} from "@workspace/db/schema";
import { eq, and, desc, count, isNull, or } from "drizzle-orm";
import { authMiddleware, requireProjectMember, requirePermission } from "../middlewares/auth";
import { sendEmail } from "../lib/email";
import { createNotification } from "./notifications";
import { singleFileUpload } from "../middlewares/multipart";
import { addPageNumbers, computeContentHash, createPdfDocument, drawBrandedHeader, drawFooter, drawTable, REPORT_THEMES, reportFileName } from "../lib/pdf-kit";
import { extractFileText } from "../lib/extract-file-text";
import { getAnthropicClientForUser, sendAiUsageError } from "../lib/ai-usage";

const router: Router = Router();

type TransmittalRow = typeof transmittalsTable.$inferSelect;

type TransmittalRegisterFilters = {
  status: string;
  search: string;
  sort: "created_desc" | "created_asc" | "sent_desc" | "title_asc" | "status_asc";
};

const TRANSMITTAL_STATUSES = new Set(["all", "draft", "sent", "acknowledged"]);
const TRANSMITTAL_SORTS = new Set(["created_desc", "created_asc", "sent_desc", "title_asc", "status_asc"]);

function textQuery(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value.trim();
}

function parseTransmittalRegisterFilters(query: Record<string, unknown>): TransmittalRegisterFilters {
  const status = textQuery(query.status, "all") || "all";
  const search = textQuery(query.search);
  const sort = textQuery(query.sort, "created_desc") || "created_desc";
  if (!TRANSMITTAL_STATUSES.has(status)) throw new Error("Invalid transmittal status filter.");
  if (!TRANSMITTAL_SORTS.has(sort)) throw new Error("Invalid transmittal sort.");
  if (search.length > 160) throw new Error("Transmittal search is too long.");
  return { status, search, sort: sort as TransmittalRegisterFilters["sort"] };
}

function transmittalRecipients(tx: TransmittalRow) {
  const recipients = Array.isArray(tx.sentTo) ? tx.sentTo as Array<{ name?: string; email?: string }> : [];
  return recipients
    .map(recipient => [recipient?.name, recipient?.email].filter(Boolean).join(" <"))
    .filter(Boolean)
    .join(", ") || "—";
}

function filterTransmittalsForRegisterPdf(rows: TransmittalRow[], filters: TransmittalRegisterFilters) {
  const q = filters.search.toLowerCase();
  return rows
    .filter(tx => filters.status === "all" || tx.status === filters.status)
    .filter(tx => {
      if (!q) return true;
      return [tx.number, tx.title, tx.purpose, tx.status, transmittalRecipients(tx)]
        .some(value => String(value || "").toLowerCase().includes(q));
    })
    .sort((a, b) => {
      if (filters.sort === "created_asc") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (filters.sort === "sent_desc") return new Date(b.sentAt || b.createdAt).getTime() - new Date(a.sentAt || a.createdAt).getTime();
      if (filters.sort === "title_asc") return String(a.title || "").localeCompare(String(b.title || ""));
      if (filters.sort === "status_asc") return String(a.status || "").localeCompare(String(b.status || "")) || String(a.number || "").localeCompare(String(b.number || ""));
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
}

function fmtDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US");
}

function renderTransmittalsCurrentViewPdf(args: {
  transmittals: TransmittalRow[];
  totalCount: number;
  project: typeof projectsTable.$inferSelect | undefined;
  generatedAt: Date;
  generatedBy: string;
  filters: TransmittalRegisterFilters;
}) {
  const title = "Transmittals — Current View";
  const filename = reportFileName(title);
  const contentHash = computeContentHash({
    title,
    projectId: args.project?.id ?? null,
    generatedAt: args.generatedAt.toISOString(),
    generatedBy: args.generatedBy,
    filters: args.filters,
    totalCount: args.totalCount,
    transmittals: args.transmittals.map(tx => ({
      id: tx.id,
      number: tx.number,
      title: tx.title,
      purpose: tx.purpose,
      status: tx.status,
      recipients: transmittalRecipients(tx),
      createdAt: tx.createdAt,
      sentAt: tx.sentAt,
      acknowledgedAt: tx.acknowledgedAt,
    })),
  });
  const doc = createPdfDocument({ size: "LETTER", margin: 40, bufferPages: true });
  const chunks: Buffer[] = [];
  const buffer = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  const theme = REPORT_THEMES.transmittal.log;
  const reportDate = args.generatedAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  const filterSummary = [
    `Status: ${args.filters.status === "all" ? "All" : args.filters.status}`,
    args.filters.search ? `Search: ${args.filters.search}` : "",
    `Sort: ${args.filters.sort.replace(/_/g, " ")}`,
    `Rows: ${args.transmittals.length} of ${args.totalCount}`,
    `Prepared by: ${args.generatedBy}`,
  ].filter(Boolean).join(" | ");

  doc.y = drawBrandedHeader(doc, {
    margin: 40,
    companyName: "BIMLog",
    title,
    subtitle: "Current filtered Transmittals view",
    projectName: args.project?.name ?? "Project",
    projectCode: args.project?.code,
    reportDate: args.generatedAt,
    theme,
  }) + 12;
  doc.fontSize(8).font("Helvetica").fillColor("#4B5563").text(filterSummary, 40, doc.y, { width: 532 });
  doc.moveDown(0.8);

  const columns = [
    { label: "Number", width: 68, format: (tx: TransmittalRow) => tx.number || "—" },
    { label: "Title", width: 136, wrap: true, format: (tx: TransmittalRow) => tx.title || "—" },
    { label: "Status", width: 70, format: (tx: TransmittalRow) => String(tx.status || "—").toUpperCase() },
    { label: "Recipients", width: 128, wrap: true, format: (tx: TransmittalRow) => transmittalRecipients(tx) },
    { label: "Created", width: 58, format: (tx: TransmittalRow) => fmtDate(tx.createdAt) },
    { label: "Sent/Ack.", width: 72, format: (tx: TransmittalRow) => [fmtDate(tx.sentAt), fmtDate(tx.acknowledgedAt)].filter(v => v !== "—").join(" / ") || "—" },
  ];

  if (args.transmittals.length === 0) {
    doc.fontSize(12).font("Helvetica-Bold").fillColor(theme.dark).text("No transmittals match the selected view.", 40, doc.y + 20, { width: 532, align: "center" });
  } else {
    drawTable(doc, {
      x: 40,
      startY: doc.y,
      columns,
      rows: args.transmittals,
      fontSize: 7,
      headerFontSize: 7,
      rowMinHeight: 26,
      pageBottom: 720,
      headerFill: theme.primary,
      onPageBreak: () => {
        doc.addPage();
        return drawBrandedHeader(doc, {
          margin: 40,
          companyName: "BIMLog",
          title,
          projectName: args.project?.name ?? "Project",
          projectCode: args.project?.code,
          theme,
        }) + 10;
      },
    });
  }

  addPageNumbers(doc, {
    margin: 40,
    footerY: 756,
    fingerprintY: 742,
    contentHash,
    companyName: "BIMLog",
    projectName: args.project?.name,
    timestamp: reportDate,
  });
  doc.end();
  return { title, filename, contentHash, buffer };
}

async function nextTransmittalNumber(projectId: number, projectCode: string): Promise<string> {
  const existing = await db.select({ id: transmittalsTable.id })
    .from(transmittalsTable).where(eq(transmittalsTable.projectId, projectId));
  const seq = String(existing.length + 1).padStart(4, "0");
  return `T-${projectCode}-${seq}`;
}

// ── GET /projects/:projectId/transmittals ─────────────────────────────────────
router.get("/projects/:projectId/transmittals", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  try {
    const rows = await db.select().from(transmittalsTable)
      .where(and(eq(transmittalsTable.projectId, projectId), isNull(transmittalsTable.deletedAt)))
      .orderBy(desc(transmittalsTable.createdAt));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── POST /projects/:projectId/transmittals ────────────────────────────────────
router.post("/projects/:projectId/transmittals", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const body = req.body as { title: string; purpose?: string; sent_to?: unknown[]; items?: { file_id?: number; description?: string; revision?: string }[] };
  if (!body.title) { res.status(400).json({ error: "title required" }); return; }
  try {
    const project = await db.select({ code: projectsTable.code }).from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
    const number = await nextTransmittalNumber(projectId, project[0]?.code ?? "PRJ");

    const [tx] = await db.insert(transmittalsTable).values({
      projectId, number, title: body.title,
      purpose: body.purpose ?? null,
      sentById: req.user!.userId,
      sentTo: body.sent_to ?? null,
      status: "draft",
    }).returning();

    if (body.items?.length) {
      await db.insert(transmittalItemsTable).values(
        body.items.map(i => ({ transmittalId: tx.id, fileId: i.file_id ?? null, description: i.description ?? null, revision: i.revision ?? null }))
      );
    }

    await db.insert(activityLogTable).values({
      projectId, userId: req.user!.userId,
      userFullName: req.user!.fullName, userCompanyName: req.user!.companyName,
      actionType: "create", entityType: "transmittal", entityId: tx.id,
      fileNameBefore: null, fileNameAfter: null,
      details: `Created transmittal ${number}: ${body.title}`,
    });
    res.status(201).json(tx);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── GET /projects/:projectId/transmittals/export-pdf ──────────────────────────
router.get("/projects/:projectId/transmittals/export-pdf", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  if (!Number.isInteger(projectId) || projectId <= 0) { res.status(400).json({ error: "Invalid project id." }); return; }
  try {
    const filters = parseTransmittalRegisterFilters(req.query as Record<string, unknown>);
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
    const allTransmittals = await db.select().from(transmittalsTable)
      .where(and(eq(transmittalsTable.projectId, projectId), isNull(transmittalsTable.deletedAt)))
      .orderBy(desc(transmittalsTable.createdAt));
    const transmittals = filterTransmittalsForRegisterPdf(allTransmittals, filters);
    const generatedAt = new Date();
    const output = renderTransmittalsCurrentViewPdf({
      transmittals,
      totalCount: allTransmittals.length,
      project,
      generatedAt,
      generatedBy: req.user!.fullName || "BIMLog user",
      filters,
    });
    const buffer = await output.buffer;
    await db.insert(activityLogTable).values({
      projectId,
      userId: req.user!.userId,
      userFullName: req.user!.fullName || "User",
      userCompanyName: req.user!.companyName || "",
      actionType: "export",
      entityType: "transmittal",
      entityId: projectId,
      fileNameBefore: null,
      fileNameAfter: output.filename,
      details: JSON.stringify({
        event: "transmittal.current_view_pdf_exported",
        title: output.title,
        filename: output.filename,
        filters,
        matchingTransmittals: transmittals.length,
        totalTransmittals: allTransmittals.length,
        generatedAt: generatedAt.toISOString(),
        contentHash: output.contentHash,
      }),
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${output.filename}"`);
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transmittals PDF export failed.";
    if (message.startsWith("Invalid") || message.includes("too long")) {
      res.status(400).json({ error: message });
      return;
    }
    console.error("[transmittals.current_view_pdf_failed]", { name: err instanceof Error ? err.name : "UnknownError" });
    res.status(500).json({ error: "Transmittals current-view PDF export failed." });
  }
});

// ── GET /projects/:projectId/transmittals/:transmittalId ──────────────────────
router.get("/projects/:projectId/transmittals/:transmittalId", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const txId = Number(req.params.transmittalId);
  try {
    const [tx] = await db.select().from(transmittalsTable)
      .where(and(eq(transmittalsTable.id, txId), eq(transmittalsTable.projectId, projectId)));
    if (!tx) { res.status(404).json({ error: "Not found" }); return; }
    const items = await db.select().from(transmittalItemsTable).where(eq(transmittalItemsTable.transmittalId, txId));
    res.json({ ...tx, items });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── PATCH /projects/:projectId/transmittals/:transmittalId ────────────────────
router.patch("/projects/:projectId/transmittals/:transmittalId", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const txId = Number(req.params.transmittalId);
  const body = req.body as Partial<{ title: string; purpose: string; sent_to: unknown[] }>;
  try {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.title)    updates.title    = body.title;
    if (body.purpose !== undefined) updates.purpose = body.purpose;
    if (body.sent_to)  updates.sentTo   = body.sent_to;
    const [updated] = await db.update(transmittalsTable).set(updates as any)
      .where(and(eq(transmittalsTable.id, txId), eq(transmittalsTable.projectId, projectId))).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── POST /projects/:projectId/transmittals/:transmittalId/send ────────────────
router.post("/projects/:projectId/transmittals/:transmittalId/send", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const txId = Number(req.params.transmittalId);
  try {
    const [tx] = await db.select().from(transmittalsTable)
      .where(and(eq(transmittalsTable.id, txId), eq(transmittalsTable.projectId, projectId)));
    if (!tx) { res.status(404).json({ error: "Not found" }); return; }

    const sentAt = new Date();
    await db.update(transmittalsTable).set({ status: "sent", sentAt, updatedAt: new Date() })
      .where(eq(transmittalsTable.id, txId));

    const recipients = (tx.sentTo as { email?: string; userId?: number; name?: string }[]) ?? [];
    const appUrl = process.env.APP_URL || "https://bimlog.app";

    for (const r of recipients) {
      if (r.email) {
        setImmediate(async () => {
          try {
            await sendEmail({
              to: r.email!,
              subject: `Transmittal ${tx.number}: ${tx.title}`,
              html: `<p>Hi ${r.name ?? ""},</p>
<p>A transmittal has been sent to you from BIMLog.</p>
<p><strong>${tx.number}</strong> — ${tx.title}</p>
${tx.purpose ? `<p>${tx.purpose}</p>` : ""}
<p><a href="${appUrl}/projects/${projectId}/transmittals/${txId}">View Transmittal</a></p>`,
            });
          } catch { /* non-fatal */ }
        });
      }
      if (r.userId) {
        await createNotification(r.userId, projectId, "transmittal_received",
          `Transmittal: ${tx.number}`, `${tx.title} — sent by ${req.user!.fullName}`,
          `/projects/${projectId}/transmittals`);
      }
    }

    await db.insert(activityLogTable).values({
      projectId, userId: req.user!.userId,
      userFullName: req.user!.fullName, userCompanyName: req.user!.companyName,
      actionType: "send", entityType: "transmittal", entityId: txId,
      fileNameBefore: null, fileNameAfter: null,
      details: `Sent transmittal ${tx.number} to ${recipients.length} recipient(s)`,
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── POST /projects/:projectId/transmittals/:transmittalId/acknowledge ─────────
router.post("/projects/:projectId/transmittals/:transmittalId/acknowledge", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const txId = Number(req.params.transmittalId);
  try {
    await db.update(transmittalsTable).set({ status: "acknowledged", acknowledgedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(transmittalsTable.id, txId), eq(transmittalsTable.projectId, projectId)));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── POST /projects/:projectId/transmittals/:transmittalId/ai-draft ────────────
router.post("/projects/:projectId/transmittals/:transmittalId/ai-draft", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const txId = Number(req.params.transmittalId);
  try {
    const [tx] = await db.select().from(transmittalsTable)
      .where(and(eq(transmittalsTable.id, txId), eq(transmittalsTable.projectId, projectId)));
    if (!tx) { res.status(404).json({ error: "Not found" }); return; }
    const items = await db.select().from(transmittalItemsTable).where(eq(transmittalItemsTable.transmittalId, txId));
    const project = await db.select({ name: projectsTable.name, code: projectsTable.code })
      .from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);

    const prompt = `You are a construction document control expert. Draft a concise purpose statement for a transmittal.
Project: ${project[0]?.name} (${project[0]?.code})
Transmittal Title: ${tx.title}
Items: ${items.map(i => i.description ?? `File ${i.fileId}`).join(", ")}
Return JSON only: { "purpose": "...", "description": "..." }`;

    const anthropic = await getAnthropicClientForUser({
      userId: req.user!.userId,
      projectId,
      feature: "transmittal_ai_draft",
    });
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-5", max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "{}";
    const parsed = JSON.parse(text.replace(/```json\n?|```/g, "").trim());

    await db.update(transmittalsTable).set({ aiDraftUsed: true, updatedAt: new Date() })
      .where(eq(transmittalsTable.id, txId));
    res.json(parsed);
  } catch (err) {
    if (sendAiUsageError(res, err)) return;
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── GET /projects/:projectId/transmittals/:transmittalId/export ───────────────
router.get("/projects/:projectId/transmittals/:transmittalId/export", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const txId = Number(req.params.transmittalId);
  try {
    const [tx] = await db.select().from(transmittalsTable)
      .where(and(eq(transmittalsTable.id, txId), eq(transmittalsTable.projectId, projectId)));
    if (!tx) { res.status(404).json({ error: "Not found" }); return; }
    const items = await db.select().from(transmittalItemsTable).where(eq(transmittalItemsTable.transmittalId, txId));
    const project = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);

    const doc = createPdfDocument({ size: "LETTER", margin: 50 });
    const title = `${tx.number} - Transmittal Report`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${reportFileName(title)}"`);
    doc.pipe(res);

    doc.y = drawBrandedHeader(doc, { margin: 50, companyName: "BIMLog", title, projectName: project[0]?.name ?? "Project", projectCode: project[0]?.code, theme: REPORT_THEMES.transmittal.detail }) + 12;

    // Fields
    const field = (label: string, value: string) => {
      doc.fontSize(9).font("Helvetica-Bold").text(label + ": ", { continued: true });
      doc.font("Helvetica").text(value);
    };
    field("Number", tx.number);
    field("Title", tx.title);
    field("Status", tx.status.toUpperCase());
    field("Date", tx.sentAt ? new Date(tx.sentAt).toLocaleDateString() : new Date(tx.createdAt).toLocaleDateString());
    if (tx.purpose) field("Purpose", tx.purpose);
    doc.moveDown();

    // Items table
    if (items.length > 0) {
      doc.fontSize(10).font("Helvetica-Bold").text("Items:");
      doc.moveDown(0.3);
      items.forEach((item, i) => {
        doc.fontSize(9).font("Helvetica").text(`${i + 1}. ${item.description ?? "—"}${item.revision ? ` (Rev: ${item.revision})` : ""}`);
      });
    }

    drawFooter(doc, { margin: 50, y: doc.page.height - 30, projectName: project[0]?.name, timestamp: new Date().toLocaleDateString("en-US") });
    doc.end();
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

router.post("/projects/:projectId/transmittals/import",
  authMiddleware,
  requirePermission("admin", "write"),
  singleFileUpload({ fileSize: 50 * 1024 * 1024 }),
  async (req, res) => {
    const projectId = Number(req.params.projectId);
    try {
      if (!req.file) { res.status(400).json({ error: "no_file" }); return; }
      const anthropic = await getAnthropicClientForUser({
        userId: req.user!.userId,
        projectId,
        feature: "transmittal_import",
      });
      const { chunks, isPdf, pdfBase64 } = await extractFileText(req.file.buffer, req.file.originalname);
      let records: any[] = [];
      if (isPdf && pdfBase64) {
        try {
          const extractMsg = await anthropic.messages.create({
            model: "claude-sonnet-4-5",
            max_tokens: 4000,
            messages: [{
              role: "user",
              content: [
                { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
                { type: "text", text: `Extract all transmittal records from this PDF document. Return ONLY a JSON array, no markdown. If none found return []:
[{"number":"T-001","title":"transmittal title","purpose":"purpose or notes","recipient":"recipient name","status":"draft/sent/acknowledged","sentDate":"date or null"}]` }
              ] as any
            }]
          });
          const extractText = extractMsg.content[0]?.type === "text" ? extractMsg.content[0].text : "[]";
          records = JSON.parse(extractText.replace(/```json\n?|```/g, "").trim()) as any[];
          console.log("[transmittal-import] PDF direct extraction:", records.length, "records");
        } catch (e) {
          console.error("[transmittal-import] PDF direct extraction failed:", e);
        }
      } else {
      for (const chunk of chunks) {
        try {
          const extractMsg = await anthropic.messages.create({
            model: "claude-sonnet-4-5",
            max_tokens: 4000,
            messages: [{
              role: "user",
              content: `Extract all transmittal records from this construction document chunk. Return ONLY a JSON array, no markdown. If none found return []:
[{"number":"T-001","title":"transmittal title","purpose":"purpose or notes","recipient":"recipient name","status":"draft/sent/acknowledged","sentDate":"date or null"}]
Document chunk:
${chunk}`
            }]
          });
          const extractText = extractMsg.content[0]?.type === "text" ? extractMsg.content[0].text : "[]";
          const chunkRecords = JSON.parse(extractText.replace(/```json\n?|```/g, "").trim()) as any[];
          records = [...records, ...chunkRecords];
        } catch (e) {
          console.error("[transmittal-import] chunk extraction failed:", e);
        }
      }
      } // end else (non-PDF)

      const forceImport = req.body?.forceImport === "true";
      if (!forceImport && records.length > 0) {
        const { checkImportIntelligence } = await import("../lib/import-intelligence");
        const intelligence = await checkImportIntelligence(req.user!.userId, projectId, records, "transmittal");
        if (intelligence.warnings.length > 0) {
          res.json({ requiresConfirmation: true, warnings: intelligence.warnings, crossLinks: intelligence.crossLinks, safeCount: intelligence.safeIndices.length, total: records.length });
          return;
        }
      }

      const existingTx = await db.select({ number: transmittalsTable.number })
        .from(transmittalsTable).where(eq(transmittalsTable.projectId, projectId));
      const usedTxNums = new Set(existingTx.map(r => r.number));
      const getDrfTx = (num: string): string => {
        if (!usedTxNums.has(num)) return num;
        let i = 1;
        while (usedTxNums.has(`${num}-DRF-${String(i).padStart(3,"0")}`)) i++;
        return `${num}-DRF-${String(i).padStart(3,"0")}`;
      };
      let imported = 0;
      const renamedTx: { original: string; renamed: string }[] = [];
      for (const r of records) {
        if (!r.title && !r.number) continue;
        const proposed = r.number || `T-${String(imported + 1).padStart(3, "0")}`;
        const finalNum = getDrfTx(proposed);
        if (finalNum !== proposed) renamedTx.push({ original: proposed, renamed: finalNum });
        usedTxNums.add(finalNum);
        await db.insert(transmittalsTable).values({
          projectId,
          number: finalNum,
          title: r.title || "Imported Transmittal",
          purpose: r.purpose || null,
          sentById: req.user!.userId,
          sentTo: r.recipient ? [r.recipient] : [],
          status: r.status || "draft",
          sentAt: r.sentDate ? new Date(r.sentDate) : null,
        });
        imported++;
      }
      await db.insert(activityLogTable).values({
        projectId, userId: req.user!.userId,
        userFullName: req.user!.fullName ?? "", userCompanyName: req.user!.companyName ?? "",
        actionType: "import", entityType: "transmittal", entityId: projectId,
        details: `Imported ${imported} transmittals from ${req.file.originalname}`,
      });
      res.json({ imported, message: `${imported} transmittals imported`, renamed: renamedTx, renameCount: renamedTx.length });
    } catch (err) {
      if (sendAiUsageError(res, err)) return;
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  }
);

// ── DELETE transmittal (soft delete) ──────────────────────────────────────────
router.delete("/projects/:projectId/transmittals/:transmittalId",
  authMiddleware, requirePermission("admin", "write"), async (req, res) => {
    const projectId = Number(req.params.projectId);
    const transmittalId = Number(req.params.transmittalId);
    const reason = (req.body?.reason as string | undefined) ?? null;
    try {
      const [existing] = await db.select().from(transmittalsTable)
        .where(and(eq(transmittalsTable.id, transmittalId), eq(transmittalsTable.projectId, projectId)));
      if (!existing) { res.status(404).json({ error: "not_found" }); return; }

      await db.update(transmittalsTable)
        .set({ deletedAt: new Date(), deleteReason: reason })
        .where(and(eq(transmittalsTable.id, transmittalId), eq(transmittalsTable.projectId, projectId)));

      await db.delete(transmittalItemsTable).where(eq(transmittalItemsTable.transmittalId, transmittalId));

      await db.delete(linkedItemsTable).where(and(
        eq(linkedItemsTable.projectId, projectId),
        or(
          and(eq(linkedItemsTable.fromType, "transmittal"), eq(linkedItemsTable.fromId, transmittalId)),
          and(eq(linkedItemsTable.toType, "transmittal"), eq(linkedItemsTable.toId, transmittalId)),
        ),
      ));

      await db.insert(activityLogTable).values({
        projectId, userId: req.user!.userId,
        userFullName: req.user!.fullName ?? "",
        userCompanyName: req.user!.companyName ?? "",
        actionType: "delete", entityType: "transmittal", entityId: transmittalId,
        details: JSON.stringify({ reason, number: existing.number, title: existing.title }),
      });

      await db.insert(agentInsightsTable).values({
        projectId, agentType: "transmittal", entityType: "transmittal", entityId: transmittalId,
        insightType: "delete_pattern",
        message: `Transmittal ${existing.number} deleted: ${reason ?? "no reason"}`,
        recommendation: "Review transmittal delete patterns to detect drafting churn or duplicates.",
        severity: "info",
      });

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  }
);

export default router;


