import { Router } from "express";
import { db } from "@workspace/db";
import { submittalReportsTable, submittalItemsTable } from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { getCompanyLogo } from "../lib/pdf-logo";
import { projectsTable, usersTable, companiesTable, activityLogTable } from "@workspace/db/schema";
import { authMiddleware, requireProjectMember, requirePermission } from "../middlewares/auth";
import multer from "multer";
import * as XLSX from "xlsx";
import Anthropic from "@anthropic-ai/sdk";
import PDFDocument from "pdfkit";
import jwt from "jsonwebtoken";
import { extractFileText } from "../lib/extract-file-text";

const router: Router = Router();
const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? "",
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL ?? undefined,
});
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 }, fileFilter: (_req: any, _file: any, cb: any) => cb(null, true) });

// GET all reports
router.get("/projects/:projectId/submittal-reports", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  try {
    const rows = await db.select().from(submittalReportsTable)
      .where(eq(submittalReportsTable.projectId, projectId))
      .orderBy(desc(submittalReportsTable.createdAt));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// POST create empty report
router.post("/projects/:projectId/submittal-reports", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  const projectId = Number(req.params.projectId);
  try {
    const existingReports = await db.select({ rn: submittalReportsTable.reportNumber })
      .from(submittalReportsTable).where(eq(submittalReportsTable.projectId, projectId));
    const existingNums = new Set(existingReports.map(r => r.rn));
    const [proj] = await db.select({ code: projectsTable.code }).from(projectsTable).where(eq(projectsTable.id, projectId));
    let counter = existingReports.length + 1;
    let autoNum = `${proj?.code ?? "PRJ"}-ST-${String(counter).padStart(3,"0")}`;
    while (existingNums.has(autoNum)) { counter++; autoNum = `${proj?.code ?? "PRJ"}-ST-${String(counter).padStart(3,"0")}`; }
    const [report] = await db.insert(submittalReportsTable).values({
      projectId,
      uploadedById: req.user!.userId,
      fileName: req.body?.fileName || "New Submittal Tracker",
      format: "manual",
      totalItems: 0,
      status: "complete",
      reportNumber: autoNum,
    }).returning();
    await db.insert(activityLogTable).values({
      projectId,
      userId: req.user!.userId,
      userFullName: req.user!.fullName ?? "",
      userCompanyName: req.user!.companyName ?? "",
      actionType: "create",
      entityType: "submittal_report",
      entityId: report.id,
      details: `Created submittal tracker: ${report.fileName} (${autoNum})`,
    });
    res.status(201).json(report);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// POST upload Excel
router.post("/projects/:projectId/submittal-reports/upload",
  authMiddleware,
  requirePermission("admin", "write"),
  upload.single("file"),
  async (req, res) => {
    const projectId = Number(req.params.projectId);
    try {
      if (!req.file) { res.status(400).json({ error: "no_file", message: "No file uploaded" }); return; }
      const ext = req.file.originalname.split(".").pop()?.toLowerCase() ?? "";
      let fileText = "";
      const useXLSX = ["xlsx","xls","csv"].includes(ext);

      let workbook: any = null;
      if (useXLSX) {
        workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      } else {
        const { text: extractedText } = await extractFileText(req.file.buffer, req.file.originalname);
        fileText = extractedText;
      }

      let allRows: any[][] = [];
      if (useXLSX && workbook) {
        let bestSheet = workbook.Sheets[workbook.SheetNames[0]];
        let bestRowCount = 0;
        for (const sheetName of workbook.SheetNames) {
          const s = workbook.Sheets[sheetName];
          const r = XLSX.utils.sheet_to_json(s, { header: 1, defval: "" }) as any[][];
          const dataCount = r.filter((row: any[]) => row.filter((c: any) => String(c).trim()).length > 2).length;
          if (dataCount > bestRowCount) { bestRowCount = dataCount; bestSheet = s; }
        }
        allRows = XLSX.utils.sheet_to_json(bestSheet, { header: 1, defval: "" }) as any[][];
      }

      let parsed: any[] = [];

      if (!useXLSX || allRows.length === 0) {
        try {
          const extractMsg = await anthropic.messages.create({
            model: "claude-sonnet-4-5",
            max_tokens: 4000,
            messages: [{
              role: "user",
              content: `You are analyzing a construction submittal tracking document. Extract all submittal records from this document.

Document content:
${fileText || allRows.map(r => r.join("\t")).join("\n").slice(0, 8000)}

Return a JSON array of submittal objects. Each object should have these fields (use null if not found):
{
  "trade": "trade/discipline name",
  "submittalType": "SHOP/SLEEVE/etc",
  "floor": "floor/level",
  "fileName": "document file name",
  "revision": "revision number like R-0 R-1",
  "version": "version number like V-0 V-1",
  "submittalStatus": "open/closed/pending/approved etc — interpret YES as open, NO as pending",
  "date": "date string",
  "description": "description",
  "openItems": "open items or pending equipment",
  "rfiOpen": "open RFI number or null",
  "rfiClose": "closed RFI number or null",
  "rfiDescription": "RFI description",
  "pdfUrl": "URL or link to document"
}

Return ONLY a JSON array. No markdown. No explanation.`
            }]
          });
          const extractText = extractMsg.content[0]?.type === "text" ? extractMsg.content[0].text : "[]";
          const cleanExtract = extractText.replace(/```json\n?|```/g, "").trim();
          parsed = JSON.parse(cleanExtract);
          console.log("[submittal-upload] AI extracted:", parsed.length, "items from non-Excel file");
        } catch (e) {
          console.error("[submittal-upload] AI extraction failed:", e);
          parsed = [];
        }
      } else {
        let hIdx = allRows.findIndex(r => r.filter((c: any) => String(c).trim()).length > 2);
        if (hIdx === -1) hIdx = 0;
        const hdrs = (allRows[hIdx] ?? []).map((h: any) => String(h).toLowerCase().trim());
        const dataRows = allRows.slice(hIdx + 1).filter((r: any[]) => r.some((c: any) => String(c).trim()));

        let mapping: Record<string, number> = { trade: -1, type: -1, floor: -1, fileName: -1, revision: -1, version: -1, status: -1, date: -1, description: -1, openItems: -1, rfiOpen: -1, rfiClose: -1, rfiDescription: -1, pdfUrl: -1 };
        try {
          const mapMsg = await anthropic.messages.create({
            model: "claude-sonnet-4-5",
            max_tokens: 500,
            messages: [{
              role: "user",
              content: `Construction submittal tracking spreadsheet headers (0-indexed): ${JSON.stringify(hdrs)}
Sample rows: ${JSON.stringify(dataRows.slice(0, 3))}

Map to column indices. Return ONLY valid JSON, no markdown:
{"trade":<idx or -1>,"type":<idx or -1>,"floor":<idx or -1>,"fileName":<idx or -1>,"revision":<idx or -1>,"version":<idx or -1>,"status":<idx or -1>,"date":<idx or -1>,"description":<idx or -1>,"openItems":<idx or -1>,"rfiOpen":<idx or -1>,"rfiClose":<idx or -1>,"rfiDescription":<idx or -1>,"pdfUrl":<idx or -1>}

CRITICAL RULES:
- status = the column that indicates if document is open/active/pending — look for: OpenDocument, IsOpen, Status, Active, Open
- If status values are YES/NO: YES means open/active, NO means pending/not yet submitted
- trade = discipline/trade/system/contractor
- type = SHOP/SLEEVE/submittal type
- floor = floor/level/area
- fileName = file name/document name/drawing name
- revision = revision/rev (R-0, R-1 etc)
- version = version/ver (V-0, V-1 etc)
- openItems = open items/pending equipment/equipment list
- rfiOpen = open RFI number
- pdfUrl = SharePoint URL/link/url`
            }]
          });
          const mt = mapMsg.content[0]?.type === "text" ? mapMsg.content[0].text : "{}";
          mapping = { ...mapping, ...JSON.parse(mt.replace(/```json\n?|```/g, "").trim()) };
          console.log("[submittal-upload] AI mapping:", JSON.stringify(mapping));
        } catch (e) {
          console.error("[submittal-upload] AI mapping failed:", e);
        }

        const get = (row: any[], idx: number) => idx >= 0 && row[idx] !== undefined ? String(row[idx]).trim() : "";
        const getStatus = (row: any[], idx: number) => {
          const raw = get(row, idx).toUpperCase();
          if (raw === "YES" || raw === "OPEN" || raw === "ACTIVE" || raw === "1" || raw === "TRUE") return "open";
          if (raw === "NO" || raw === "CLOSED" || raw === "COMPLETE" || raw === "0" || raw === "FALSE") return "pending";
          return raw || "pending";
        };

        parsed = dataRows
          .map((row: any[]) => ({
            trade: get(row, mapping.trade),
            submittalType: get(row, mapping.type),
            floor: get(row, mapping.floor),
            fileName: get(row, mapping.fileName),
            revision: get(row, mapping.revision),
            version: get(row, mapping.version),
            submittalStatus: getStatus(row, mapping.status),
            date: get(row, mapping.date),
            description: get(row, mapping.description),
            openItems: get(row, mapping.openItems),
            rfiOpen: get(row, mapping.rfiOpen),
            rfiClose: get(row, mapping.rfiClose),
            rfiDescription: get(row, mapping.rfiDescription),
            pdfUrl: get(row, mapping.pdfUrl),
          }))
          .filter((r: any) => r.fileName || r.description || r.trade);
      }

      const existingReportsU = await db.select({ rn: submittalReportsTable.reportNumber })
        .from(submittalReportsTable).where(eq(submittalReportsTable.projectId, projectId));
      const existingNumsU = new Set(existingReportsU.map(r => r.rn));
      const [projU] = await db.select({ code: projectsTable.code }).from(projectsTable).where(eq(projectsTable.id, projectId));
      let counterU = existingReportsU.length + 1;
      let autoNumU = `${projU?.code ?? "PRJ"}-ST-${String(counterU).padStart(3,"0")}`;
      while (existingNumsU.has(autoNumU)) { counterU++; autoNumU = `${projU?.code ?? "PRJ"}-ST-${String(counterU).padStart(3,"0")}`; }
      const [report] = await db.insert(submittalReportsTable).values({
        projectId,
        uploadedById: req.user!.userId,
        fileName: req.file.originalname,
        format: "excel",
        totalItems: parsed.length,
        status: "complete",
        reportNumber: autoNumU,
      }).returning();

      if (parsed.length > 0) {
        await db.insert(submittalItemsTable).values(
          parsed.map(p => ({ reportId: report.id, projectId, ...p }))
        );
      }

      await db.insert(activityLogTable).values({
        projectId,
        userId: req.user!.userId,
        userFullName: req.user!.fullName ?? "",
        userCompanyName: req.user!.companyName ?? "",
        actionType: "upload",
        entityType: "submittal_report",
        entityId: report.id,
        details: `Uploaded submittal tracker: ${req.file.originalname} — ${parsed.length} items imported (${autoNumU})`,
      });
      res.status(201).json({ report_id: report.id, total_parsed: parsed.length, status: "complete" });
    } catch (err) {
      console.error("[submittal-upload] FAILED:", err);
      res.status(500).json({ error: "upload_failed", message: err instanceof Error ? err.message : String(err) });
    }
  }
);

// GET single report with items
router.get("/projects/:projectId/submittal-reports/:reportId", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const reportId = Number(req.params.reportId);
  try {
    const [report] = await db.select().from(submittalReportsTable)
      .where(and(eq(submittalReportsTable.id, reportId), eq(submittalReportsTable.projectId, projectId)));
    if (!report) { res.status(404).json({ error: "not_found" }); return; }
    const items = await db.select().from(submittalItemsTable)
      .where(eq(submittalItemsTable.reportId, reportId));
    res.json({ report, items });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// PATCH rename report
router.patch("/projects/:projectId/submittal-reports/:reportId/rename", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const reportId = Number(req.params.reportId);
  try {
    const [updated] = await db.update(submittalReportsTable)
      .set({
        ...(req.body.fileName !== undefined ? { fileName: req.body.fileName } : {}),
        ...(req.body.reportNumber !== undefined ? { reportNumber: req.body.reportNumber } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(submittalReportsTable.id, reportId), eq(submittalReportsTable.projectId, projectId)))
      .returning();
    if (!updated) { res.status(404).json({ error: "not_found" }); return; }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// PATCH update item
router.patch("/projects/:projectId/submittal-reports/:reportId/items/:itemId", authMiddleware, requireProjectMember(), async (req, res) => {
  const reportId = Number(req.params.reportId);
  const itemId = Number(req.params.itemId);
  try {
    const allowed: Record<string, any> = { updatedAt: new Date() };
    const fields = ["trade","submittalType","floor","fileName","revision","version","submittalStatus","date","description","openItems","rfiOpen","rfiClose","rfiDescription","pdfUrl","notes","status"];
    for (const f of fields) {
      if (req.body[f] !== undefined) allowed[f] = req.body[f];
    }
    const [updated] = await db.update(submittalItemsTable).set(allowed)
      .where(and(eq(submittalItemsTable.id, itemId), eq(submittalItemsTable.reportId, reportId)))
      .returning();
    if (!updated) { res.status(404).json({ error: "not_found" }); return; }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// POST add item
router.post("/projects/:projectId/submittal-reports/:reportId/items", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const reportId = Number(req.params.reportId);
  try {
    const [report] = await db.select().from(submittalReportsTable).where(eq(submittalReportsTable.id, reportId));
    if (!report) { res.status(404).json({ error: "not_found" }); return; }
    const [item] = await db.insert(submittalItemsTable).values({
      reportId, projectId,
      trade: req.body.trade ?? null,
      submittalType: req.body.submittalType ?? null,
      floor: req.body.floor ?? null,
      fileName: req.body.fileName ?? null,
      description: req.body.description ?? null,
      status: "active",
    }).returning();
    await db.update(submittalReportsTable)
      .set({ totalItems: (report.totalItems ?? 0) + 1 })
      .where(eq(submittalReportsTable.id, reportId));
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// DELETE report
router.delete("/projects/:projectId/submittal-reports/:reportId", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const reportId = Number(req.params.reportId);
  try {
    const [report] = await db.select().from(submittalReportsTable)
      .where(and(eq(submittalReportsTable.id, reportId), eq(submittalReportsTable.projectId, projectId)));
    if (!report) { res.status(404).json({ error: "not_found" }); return; }
    await db.delete(submittalItemsTable).where(eq(submittalItemsTable.reportId, reportId));
    await db.delete(submittalReportsTable).where(eq(submittalReportsTable.id, reportId));
    await db.insert(activityLogTable).values({
      projectId,
      userId: req.user!.userId,
      userFullName: req.user!.fullName ?? "",
      userCompanyName: req.user!.companyName ?? "",
      actionType: "delete",
      entityType: "submittal_report",
      entityId: reportId,
      details: `Deleted submittal tracker: ${report.fileName}`,
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// DELETE item
router.delete("/projects/:projectId/submittal-reports/:reportId/items/:itemId", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  const itemId = Number(req.params.itemId);
  const reportId = Number(req.params.reportId);
  try {
    await db.delete(submittalItemsTable).where(and(eq(submittalItemsTable.id, itemId), eq(submittalItemsTable.reportId, reportId)));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// GET PDF export
router.get("/projects/:projectId/submittal-reports/:reportId/pdf", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1] || (req.query.token as string);
  if (!token) { res.status(401).json({ error: "Authentication required" }); return; }
  let userId: number;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    userId = decoded.userId || decoded.id;
  } catch { res.status(401).json({ error: "Invalid token" }); return; }

  const projectId = Number(req.params.projectId);
  const reportId = Number(req.params.reportId);
  try {
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }

    const [user] = await db.select({
      fullName: usersTable.fullName,
      email: usersTable.email,
      companyName: companiesTable.name,
    }).from(usersTable)
      .leftJoin(companiesTable, eq(companiesTable.id, usersTable.companyId))
      .where(eq(usersTable.id, userId));

    const { logoBase64, logoType } = await getCompanyLogo(userId);

    const [report] = await db.select().from(submittalReportsTable)
      .where(and(eq(submittalReportsTable.id, reportId), eq(submittalReportsTable.projectId, projectId)));
    if (!report) { res.status(404).json({ error: "Report not found" }); return; }

    const items = await db.select().from(submittalItemsTable)
      .where(eq(submittalItemsTable.reportId, reportId));

    const doc = new PDFDocument({ size: "LETTER", layout: "landscape", margin: 40, bufferPages: true, autoFirstPage: true });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="submittal-tracker-${project.code}-${reportId}.pdf"`);
    doc.pipe(res);

    const W = doc.page.width;
    const M = 40;
    const CW = W - M * 2;

    // Header
    doc.rect(0, 0, W, 120).fill("#1E3A5F");
    if (logoBase64 && logoType) {
      try {
        doc.image(logoBase64, M, 15, { height: 50, fit: [120, 50] });
        doc.fontSize(18).font("Helvetica-Bold").fillColor("white")
          .text(user?.companyName ?? "Company", M + 130, 22);
      } catch {
        doc.fontSize(30).font("Helvetica-Bold").fillColor("white")
          .text(user?.companyName ?? "Company", M, 22);
      }
    } else {
      doc.fontSize(30).font("Helvetica-Bold").fillColor("white")
        .text(user?.companyName ?? "Company", M, 22);
    }
    doc.fontSize(12).font("Helvetica-Bold").fillColor("white").text("SUBMITTAL TRACKING REPORT", M, 22, { align: "right", width: CW });
    doc.moveTo(M, 62).lineTo(W - M, 62).strokeColor("#4B7EC8").lineWidth(0.5).stroke();
    doc.fontSize(9).font("Helvetica").fillColor("#BFDBFE").text(`Prepared by: ${user?.fullName ?? ""}`, M, 70);
    doc.fontSize(9).font("Helvetica").fillColor("#BFDBFE").text(new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), M, 84);
    doc.fontSize(9).font("Helvetica").fillColor("#BFDBFE").text(user?.email ?? "", M, 70, { align: "right", width: CW });
    doc.fontSize(8).font("Helvetica-Bold").fillColor("#BFDBFE").text("Powered by BIMLog by IgniteSmart", M, 98, { align: "right", width: CW });

    doc.rect(0, 120, W, 45).fill("#F0F4F8");
    doc.fontSize(18).font("Helvetica-Bold").fillColor("#1E3A5F").text(project.name, M, 130);
    doc.fontSize(10).font("Helvetica").fillColor("#6B7280")
      .text(`${report.reportNumber ? `Report: ${report.reportNumber}  |  ` : ""}Project Code: ${project.code}  |  Source: ${report.fileName}  |  Total Items: ${report.totalItems}`, M, 152);

    doc.y = 185;

    doc.fontSize(13).font("Helvetica-Bold").fillColor("#111827").text("Submittal Register", M);
    doc.moveDown(0.5);

    const cols = [
      { label: "Trade", w: 55 },
      { label: "Type", w: 50 },
      { label: "Floor", w: 55 },
      { label: "File Name", w: 130 },
      { label: "Rev", w: 35 },
      { label: "Ver", w: 35 },
      { label: "Status", w: 80 },
      { label: "Date", w: 60 },
      { label: "Open Items", w: 100 },
      { label: "RFI Open", w: 60 },
      { label: "RFI Close", w: 60 },
    ];

    const drawHeader = () => {
      const hY = doc.y;
      doc.rect(M, hY, CW, 18).fill("#1E3A5F");
      let x = M;
      cols.forEach(col => {
        doc.fontSize(7).font("Helvetica-Bold").fillColor("white")
          .text(col.label.toUpperCase(), x + 3, hY + 5, { width: col.w - 6 });
        x += col.w;
      });
      doc.y = hY + 20;
    };

    drawHeader();

    items.forEach((item, idx) => {
      const rowH = 22;
      if (doc.y + rowH > doc.page.height - 50) {
        doc.addPage();
        doc.rect(0, 0, W, 25).fill("#1E3A5F");
        doc.fontSize(8).font("Helvetica-Bold").fillColor("white")
          .text(`${user?.companyName ?? ""} | ${project.name} — Submittal Tracking Report`, M, 8, { width: CW });
        doc.y = 35;
        drawHeader();
      }
      const rY = doc.y;
      doc.rect(M, rY, CW, rowH).fill(idx % 2 === 0 ? "white" : "#F9FAFB");
      let x = M;
      const vals = [
        item.trade ?? "—",
        item.submittalType ?? "—",
        item.floor ?? "—",
        item.fileName ?? "—",
        item.revision ?? "—",
        item.version ?? "—",
        item.submittalStatus ?? "—",
        item.date ?? "—",
        item.openItems ?? "—",
        item.rfiOpen ?? "—",
        item.rfiClose ?? "—",
      ];
      vals.forEach((val, i) => {
        doc.fontSize(7).font("Helvetica").fillColor("#111827")
          .text(String(val), x + 2, rY + 7, { width: cols[i].w - 4, lineBreak: false, ellipsis: true });
        x += cols[i].w;
      });
      doc.rect(M, rY, CW, rowH).stroke("#E5E7EB");
      doc.y = rY + rowH;
    });

    const range = doc.bufferedPageRange();
    const footerDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    const footerReportNum = report.reportNumber ? `${report.reportNumber} | ` : "";
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc.fontSize(7).font("Helvetica").fillColor("#9CA3AF")
        .text(
          `${user?.companyName ?? ""} | ${project.name} | ${footerReportNum}${footerDate} | Page ${i + 1} of ${range.count} | Powered by BIMLog | IgniteSmart.ai`,
          M, 560, { align: "center", width: CW, lineBreak: false }
        );
    }
    doc.end();
  } catch (err) {
    console.error("[submittal-pdf] FAILED:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
