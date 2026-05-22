import { Router } from "express";
import { db } from "@workspace/db";
import { clashReportsTable, clashesTable } from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { projectsTable, usersTable, companiesTable } from "@workspace/db/schema";
import { authMiddleware, requireProjectMember, requirePermission } from "../middlewares/auth";
import multer from "multer";
import * as XLSX from "xlsx";
import Anthropic from "@anthropic-ai/sdk";

const router: Router = Router();
const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? "",
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL ?? undefined,
});
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.get("/projects/:projectId/clash-reports", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  try {
    const rows = await db.select().from(clashReportsTable)
      .where(eq(clashReportsTable.projectId, projectId))
      .orderBy(desc(clashReportsTable.createdAt));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "list_failed", message: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/projects/:projectId/clash-reports", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  const projectId = Number(req.params.projectId);
  try {
    const [report] = await db.insert(clashReportsTable).values({
      projectId,
      uploadedById: req.user!.userId,
      fileName: req.body?.fileName || "Manual Report",
      format: "manual",
      totalClashes: 0,
      status: "complete",
    }).returning();
    res.status(201).json(report);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/projects/:projectId/clash-reports/upload",
  authMiddleware,
  requirePermission("admin", "write"),
  upload.single("file"),
  async (req, res) => {
    const projectId = Number(req.params.projectId);
    try {
      if (!req.file) {
        res.status(400).json({ error: "no_file", message: "No file uploaded" });
        return;
      }
      const ext = req.file.originalname.split(".").pop()?.toLowerCase() ?? "";
      if (!["xlsx", "xls", "csv"].includes(ext)) {
        res.status(400).json({ error: "invalid_format", message: "Unsupported format. Use Excel or CSV." });
        return;
      }

      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[][];

      let headerIdx = rows.findIndex(r => r.filter((c: any) => String(c).trim()).length > 2);
      if (headerIdx === -1) headerIdx = 0;
      const headers = (rows[headerIdx] ?? []).map((h: any) => String(h).toLowerCase().trim());

      let bestSheet = workbook.Sheets[workbook.SheetNames[0]];
      let bestRowCount = 0;
      for (const sheetName of workbook.SheetNames) {
        const s = workbook.Sheets[sheetName];
        const r = XLSX.utils.sheet_to_json(s, { header: 1, defval: "" }) as any[][];
        const dataCount = r.filter((row: any[]) => row.filter((c: any) => String(c).trim()).length > 2).length;
        if (dataCount > bestRowCount) { bestRowCount = dataCount; bestSheet = s; }
      }
      const allRows = XLSX.utils.sheet_to_json(bestSheet, { header: 1, defval: "" }) as any[][];
      let hIdx = allRows.findIndex(r => r.filter((c: any) => String(c).trim()).length > 2);
      if (hIdx === -1) hIdx = 0;
      const hdrs = (allRows[hIdx] ?? []).map((h: any) => String(h).toLowerCase().trim());
      const dataRows = allRows.slice(hIdx + 1).filter((r: any[]) => r.some((c: any) => String(c).trim()));

      let mapping: Record<string, number> = { clashId: -1, description: -1, element1: -1, element2: -1, discipline: -1, level: -1, assignedTo: -1, status: -1, resolutionNotes: -1, deadline: -1, viewpoint: -1, holdUps: -1 };
      try {
        const mapMsg = await anthropic.messages.create({
          model: "claude-sonnet-4-5",
          max_tokens: 400,
          messages: [{
            role: "user",
            content: `Construction clash report headers (0-indexed array): ${JSON.stringify(hdrs)}
Sample row: ${JSON.stringify(dataRows[0] ?? [])}

Map to column indices. Return ONLY valid JSON, no markdown:
{"clashId":<idx or -1>,"description":<idx>,"holdUps":<idx or -1>,"discipline":<idx or -1>,"level":<idx or -1>,"assignedTo":<idx or -1>,"status":<idx or -1>,"resolutionNotes":<idx or -1>,"deadline":<idx or -1>,"viewpoint":<idx or -1>}

Rules: viewpoint=viewpoint ID column (UG.001 etc), holdUps=hold ups/blocking issues column, resolutionNotes=response/direction/resolution column, level=floor/level column, discipline=trade/discipline column, assignedTo=responsible/assigned column, clashId=sequence number column`
          }]
        });
        const mt = mapMsg.content[0]?.type === "text" ? mapMsg.content[0].text : "{}";
        mapping = { ...mapping, ...JSON.parse(mt.replace(/```json\n?|```/g, "").trim()) };
        console.log("[clash-upload] AI mapping:", JSON.stringify(mapping));
      } catch (e) {
        console.error("[clash-upload] AI mapping failed:", e);
        mapping = { clashId: 0, description: 3, holdUps: 7, discipline: 2, level: 1, assignedTo: 5, status: 8, resolutionNotes: 4, deadline: 9, viewpoint: 6, element1: -1, element2: -1 };
      }

      const get = (row: any[], idx: number) => idx >= 0 && row[idx] !== undefined && row[idx] !== null ? String(row[idx]).trim() : "";
      const getDate = (row: any[], idx: number) => { if (idx < 0 || !row[idx]) return null; try { const d = new Date(row[idx]); return isNaN(d.getTime()) ? null : d; } catch { return null; } };

      const parsed = dataRows
        .map((row: any[]) => ({
          clashIdOriginal: get(row, mapping.viewpoint) || get(row, mapping.clashId) || "",
          description: get(row, mapping.description),
          holdUps: get(row, mapping.holdUps),
          discipline1: get(row, mapping.discipline),
          level: get(row, mapping.level),
          assignedToName: get(row, mapping.assignedTo),
          resolutionNotes: get(row, mapping.resolutionNotes),
          status: "open",
          dueDate: getDate(row, mapping.deadline),
        }))
        .filter((r: any) => r.description || r.clashIdOriginal);
      console.log("[clash-upload] Parsed:", parsed.length, "rows. Sample:", JSON.stringify(parsed[0]));

      const [report] = await db.insert(clashReportsTable).values({
        projectId,
        uploadedById: req.user!.userId,
        fileName: req.file.originalname,
        format: "excel",
        totalClashes: parsed.length,
        status: "processing",
      }).returning();

      if (parsed.length > 0) {
        await db.insert(clashesTable).values(
          parsed.map(p => ({
            clashReportId: report.id,
            projectId,
            clashIdOriginal: p.clashIdOriginal || null,
            description: p.description || null,
            element1: p.holdUps || null,
            discipline1: p.discipline1 || null,
            level: p.level || null,
            assignedToName: p.assignedToName || null,
            resolutionNotes: p.resolutionNotes || null,
            dueDate: p.dueDate || null,
            status: "open",
          }))
        );
      }

      res.status(201).json({ clash_report_id: report.id, total_parsed: parsed.length, status: "processing" });
      rankClashesWithAI(report.id, projectId, parsed, anthropic).catch(console.error);
    } catch (err) {
      console.error("[clash-reports/upload] FAILED:", err);
      res.status(500).json({ error: "upload_failed", message: err instanceof Error ? err.message : String(err) });
    }
  }
);

async function rankClashesWithAI(reportId: number, _projectId: number, clashList: any[], anthropicClient: Anthropic) {
  try {
    console.log("[rankAI] Starting — clashList length:", clashList.length, "reportId:", reportId);
    if (clashList.length === 0) {
      console.log("[rankAI] EARLY EXIT — empty clashList");
      await db.update(clashReportsTable).set({ status: "complete" }).where(eq(clashReportsTable.id, reportId));
      return;
    }
    const msg = await anthropicClient.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      messages: [{
        role: "user",
        content: `You are a BIM coordination expert. Rank each clash by construction priority.
P1 = life safety or critical path blocker, resolve immediately.
P2 = must resolve this week, affects schedule.
P3 = monitor, resolve within 2 weeks.
P4 = cosmetic or minor, low urgency.
Return a JSON array only. No markdown. No explanation.
Each item: { "index": 0, "priority": "P1", "priority_reason": "one sentence" }

Clashes: ${JSON.stringify(clashList.map((c, i) => ({ index: i, description: c.description, element_1: c.element1, element_2: c.element2, discipline_1: c.discipline1, level: c.level })))}`,
      }],
    });
    const rawText = msg.content[0]?.type === "text" ? msg.content[0].text : "[]";
    console.log("[rankAI] Claude raw response:", rawText.slice(0, 500));
    // Strip markdown, find JSON array
    let jsonStr = rawText.replace(/```json\n?|```/g, "").trim();
    // Find the first [ and last ] to extract just the array
    const firstBracket = jsonStr.indexOf("[");
    const lastBracket = jsonStr.lastIndexOf("]");
    if (firstBracket !== -1 && lastBracket !== -1) {
      jsonStr = jsonStr.slice(firstBracket, lastBracket + 1);
    }
    console.log("[rankAI] Cleaned JSON:", jsonStr.slice(0, 200));
    const ranked = JSON.parse(jsonStr) as { index: number; priority: string; priority_reason: string }[];
    console.log("[rankAI] Ranked count:", ranked.length);
    // Validate priorities
    const validPriorities = ["P1", "P2", "P3", "P4"];
    const validRanked = ranked.filter(r => validPriorities.includes(r.priority));
    console.log("[rankAI] Valid ranked:", validRanked.length);
    const allClashes = await db.select().from(clashesTable).where(eq(clashesTable.clashReportId, reportId));
    console.log("[rankAI] Clashes in DB for report:", allClashes.length);
    for (const r of validRanked) {
      if (allClashes[r.index]) {
        console.log(`[rankAI] Updating clash ${allClashes[r.index].id} with priority ${r.priority}`);
        await db.update(clashesTable)
          .set({ priority: r.priority, priorityReason: r.priority_reason })
          .where(eq(clashesTable.id, allClashes[r.index].id));
      }
    }
    const p1 = validRanked.filter(r => r.priority === "P1").length;
    const p2 = validRanked.filter(r => r.priority === "P2").length;
    const p3 = validRanked.filter(r => r.priority === "P3").length;
    const p4 = validRanked.filter(r => r.priority === "P4").length;
    console.log("[rankAI] Updated clashes. P1:", p1, "P2:", p2, "P3:", p3, "P4:", p4);
    await db.update(clashReportsTable).set({
      status: "complete", p1Count: p1, p2Count: p2, p3Count: p3, p4Count: p4,
      aiSummary: `${p1} critical, ${p2} this week, ${p3} monitor, ${p4} low priority.`,
      updatedAt: new Date(),
    }).where(eq(clashReportsTable.id, reportId));
    console.log("[rankAI] Report updated to complete.");
  } catch (err) {
    console.error("[rankClashesWithAI] FAILED:", err);
    await db.update(clashReportsTable).set({ status: "complete" }).where(eq(clashReportsTable.id, reportId));
  }
}

router.get("/projects/:projectId/clash-reports/:reportId", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const reportId = Number(req.params.reportId);
  try {
    const [report] = await db.select().from(clashReportsTable)
      .where(and(eq(clashReportsTable.id, reportId), eq(clashReportsTable.projectId, projectId)));
    if (!report) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    let clashes = await db.select().from(clashesTable).where(eq(clashesTable.clashReportId, reportId));
    const { priority, status, discipline } = req.query;
    if (typeof priority === "string" && priority !== "all") clashes = clashes.filter(c => c.priority === priority);
    if (typeof status === "string" && status !== "all") clashes = clashes.filter(c => c.status === status);
    if (typeof discipline === "string" && discipline !== "all") clashes = clashes.filter(c => c.discipline1 === discipline);
    res.json({ report, clashes });
  } catch (err) {
    res.status(500).json({ error: "fetch_failed", message: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/projects/:projectId/clash-reports/:reportId/rerank",
  authMiddleware,
  requirePermission("admin", "write"),
  async (req, res) => {
    const projectId = Number(req.params.projectId);
    const reportId = Number(req.params.reportId);
    try {
      const [report] = await db.select().from(clashReportsTable)
        .where(eq(clashReportsTable.id, reportId));
      if (!report) { res.status(404).json({ error: "not_found" }); return; }
      const clashes = await db.select().from(clashesTable)
        .where(eq(clashesTable.clashReportId, reportId));
      console.log("[rerank] Report ID:", reportId, "Clashes found:", clashes.length);
      if (clashes.length === 0) {
        res.status(400).json({ error: "no_clashes", message: `No clashes found for report ${reportId}. Found 0 rows.` });
        return;
      }
      const clashList = clashes.map(c => ({
        clashIdOriginal: c.clashIdOriginal,
        description: c.description,
        element1: c.element1,
        element2: c.element2,
        discipline1: c.discipline1,
        level: c.level,
      }));
      await db.update(clashReportsTable)
        .set({ status: "processing", p1Count: 0, p2Count: 0, p3Count: 0, p4Count: 0 })
        .where(eq(clashReportsTable.id, reportId));
      try {
        await rankClashesWithAI(reportId, projectId, clashList, anthropic);
        const updated = await db.select().from(clashReportsTable).where(eq(clashReportsTable.id, reportId));
        res.json({ message: "Re-ranking complete", total_clashes: clashes.length, report: updated[0] });
      } catch (err) {
        console.error("[rerank] FAILED:", err);
        res.status(500).json({ error: "rerank_failed", message: err instanceof Error ? err.message : String(err) });
      }
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  }
);

router.patch("/projects/:projectId/clash-reports/:reportId/clashes/:clashId", authMiddleware, requireProjectMember(), async (req, res) => {
  const reportId = Number(req.params.reportId);
  const clashId = Number(req.params.clashId);
  try {
    const allowed: Record<string, any> = {};
    const { status, resolutionNotes, assignedToName, assignedToEmail, dueDate,
            clashIdOriginal, description, element1, element2, discipline1, level, priority } = req.body ?? {};
    if (status !== undefined) allowed.status = status;
    if (resolutionNotes !== undefined) allowed.resolutionNotes = resolutionNotes;
    if (assignedToName !== undefined) allowed.assignedToName = assignedToName;
    if (assignedToEmail !== undefined) allowed.assignedToEmail = assignedToEmail;
    if (dueDate !== undefined) allowed.dueDate = dueDate ? new Date(dueDate) : null;
    if (clashIdOriginal !== undefined) allowed.clashIdOriginal = clashIdOriginal;
    if (description !== undefined) allowed.description = description;
    if (element1 !== undefined) allowed.element1 = element1;
    if (element2 !== undefined) allowed.element2 = element2;
    if (discipline1 !== undefined) allowed.discipline1 = discipline1;
    if (level !== undefined) allowed.level = level;
    if (priority !== undefined) allowed.priority = priority;
    allowed.updatedAt = new Date();
    const [updated] = await db.update(clashesTable).set(allowed)
      .where(and(eq(clashesTable.id, clashId), eq(clashesTable.clashReportId, reportId))).returning();
    if (!updated) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "update_failed", message: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/projects/:projectId/clash-reports/:reportId/clashes",
  authMiddleware,
  requirePermission("admin", "write"),
  async (req, res) => {
    const projectId = Number(req.params.projectId);
    const reportId = Number(req.params.reportId);
    try {
      const [report] = await db.select().from(clashReportsTable)
        .where(and(eq(clashReportsTable.id, reportId), eq(clashReportsTable.projectId, projectId)));
      if (!report) { res.status(404).json({ error: "not_found" }); return; }
      const body = req.body ?? {};
      const [clash] = await db.insert(clashesTable).values({
        clashReportId: reportId,
        projectId,
        clashIdOriginal: body.clashIdOriginal ?? null,
        description: body.description ?? null,
        element1: body.element1 ?? null,
        element2: body.element2 ?? null,
        discipline1: body.discipline1 ?? null,
        level: body.level ?? null,
        status: "open",
        priority: body.priority ?? null,
      }).returning();
      await db.update(clashReportsTable)
        .set({ totalClashes: report.totalClashes + 1 })
        .where(eq(clashReportsTable.id, reportId));
      res.status(201).json(clash);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  }
);

router.delete("/projects/:projectId/clash-reports/:reportId", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const reportId = Number(req.params.reportId);
  try {
    const [report] = await db.select().from(clashReportsTable).where(and(eq(clashReportsTable.id, reportId), eq(clashReportsTable.projectId, projectId)));
    if (!report) { res.status(404).json({ error: "not_found" }); return; }
    await db.delete(clashesTable).where(eq(clashesTable.clashReportId, reportId));
    await db.delete(clashReportsTable).where(eq(clashReportsTable.id, reportId));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "delete_failed", message: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/projects/:projectId/clash-reports/:reportId/pdf",
  async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1] || (req.query.token as string);
    if (!token) { res.status(401).json({ error: "Authentication required" }); return; }
    let userId: number;
    try {
      const jwt = await import("jsonwebtoken");
      const decoded = jwt.default.verify(token, process.env.JWT_SECRET!) as any;
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

      const [report] = await db.select().from(clashReportsTable)
        .where(and(eq(clashReportsTable.id, reportId), eq(clashReportsTable.projectId, projectId)));
      if (!report) { res.status(404).json({ error: "Report not found" }); return; }

      const clashes = await db.select().from(clashesTable)
        .where(eq(clashesTable.clashReportId, reportId));

      clashes.sort((a, b) => {
        const order: Record<string, number> = { P1: 0, P2: 1, P3: 2, P4: 3 };
        return (order[a.priority ?? ""] ?? 4) - (order[b.priority ?? ""] ?? 4);
      });

      const PDFDocument = (await import("pdfkit")).default;
      const doc = new PDFDocument({ size: "LETTER", margin: 50, bufferPages: true });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="clash-report-${project.code}-${reportId}.pdf"`);
      doc.pipe(res);

      const W = doc.page.width;
      const M = 50;
      const CW = W - M * 2;

      doc.rect(0, 0, W, 120).fill("#1E3A5F");
      doc.fontSize(28).font("Helvetica-Bold").fillColor("white").text("BIMLog", M, 30);
      doc.fontSize(11).font("Helvetica").fillColor("#93C5FD").text("by IgniteSmart", M, 62);
      doc.fontSize(14).font("Helvetica-Bold").fillColor("white")
        .text("CLASH COORDINATION REPORT", M, 35, { align: "right", width: CW });
      doc.fontSize(10).font("Helvetica").fillColor("#93C5FD")
        .text(new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), M, 58, { align: "right", width: CW });

      doc.rect(0, 120, W, 60).fill("#F8FAFC");
      doc.fontSize(16).font("Helvetica-Bold").fillColor("#1E3A5F").text(project.name, M, 135);
      doc.fontSize(10).font("Helvetica").fillColor("#6B7280")
        .text(`Project Code: ${project.code}  |  Source: ${report.fileName}  |  Total Clashes: ${report.totalClashes}`, M, 158);

      doc.y = 210;

      doc.fontSize(13).font("Helvetica-Bold").fillColor("#111827").text("Executive Summary", M, doc.y);
      doc.moveDown(0.5);

      const cardY = doc.y;
      const cardW = (CW - 30) / 4;
      const cards = [
        { label: "P1 CRITICAL", value: report.p1Count, bg: "#FEE2E2", text: "#DC2626", border: "#FECACA" },
        { label: "P2 THIS WEEK", value: report.p2Count, bg: "#FEF3C7", text: "#D97706", border: "#FDE68A" },
        { label: "P3 MONITOR", value: report.p3Count, bg: "#FEF9C3", text: "#CA8A04", border: "#FDE68A" },
        { label: "P4 LOW", value: report.p4Count, bg: "#F3F4F6", text: "#6B7280", border: "#E5E7EB" },
      ];
      cards.forEach((card, i) => {
        const x = M + i * (cardW + 10);
        doc.rect(x, cardY, cardW, 70).fillAndStroke(card.bg, card.border);
        doc.fontSize(28).font("Helvetica-Bold").fillColor(card.text)
          .text(String(card.value), x, cardY + 10, { width: cardW, align: "center" });
        doc.fontSize(8).font("Helvetica-Bold").fillColor(card.text)
          .text(card.label, x, cardY + 46, { width: cardW, align: "center" });
      });

      doc.y = cardY + 85;

      if (report.aiSummary) {
        doc.rect(M, doc.y, CW, 40).fill("#EFF6FF");
        doc.fontSize(10).font("Helvetica").fillColor("#1E40AF")
          .text(`AI Assessment: ${report.aiSummary}`, M + 10, doc.y + 8, { width: CW - 20 });
        doc.y += 50;
      }

      doc.moveDown(0.5);

      doc.fontSize(9).font("Helvetica").fillColor("#6B7280")
        .text(`Generated by: ${user?.fullName ?? "Unknown"}  |  ${user?.companyName ?? ""}  |  ${user?.email ?? ""}`, M);
      doc.moveDown(0.3);
      doc.moveTo(M, doc.y).lineTo(W - M, doc.y).strokeColor("#E5E7EB").lineWidth(1).stroke();
      doc.moveDown(0.5);

      doc.fontSize(13).font("Helvetica-Bold").fillColor("#111827").text("Clash Register", M);
      doc.moveDown(0.5);

      const cols = [
        { label: "Priority", w: 45 },
        { label: "Viewpoint", w: 45 },
        { label: "Description", w: 155 },
        { label: "Hold Ups", w: 80 },
        { label: "Trade", w: 55 },
        { label: "Floor", w: 50 },
        { label: "Status", w: 55 },
        { label: "Responsible", w: 70 },
      ];

      const drawTableHeader = () => {
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

      drawTableHeader();

      const P_COLORS_PDF: Record<string, { bg: string; text: string }> = {
        P1: { bg: "#FEE2E2", text: "#DC2626" },
        P2: { bg: "#FEF3C7", text: "#D97706" },
        P3: { bg: "#FEF9C3", text: "#CA8A04" },
        P4: { bg: "#F3F4F6", text: "#6B7280" },
      };

      clashes.forEach((c, idx) => {
        const rowH = 22;
        if (doc.y + rowH > doc.page.height - 70) {
          doc.addPage();
          doc.rect(0, 0, W, 30).fill("#1E3A5F");
          doc.fontSize(8).font("Helvetica-Bold").fillColor("white")
            .text(`${project.name} (${project.code}) — Clash Report`, M, 10);
          doc.fontSize(7).font("Helvetica").fillColor("#93C5FD")
            .text(`Page ${doc.bufferedPageRange().count}`, M, 10, { align: "right", width: CW });
          doc.y = 45;
          drawTableHeader();
        }

        const rY = doc.y;
        const rowBg = idx % 2 === 0 ? "white" : "#F9FAFB";
        doc.rect(M, rY, CW, rowH).fill(rowBg);

        let x = M;
        const pColor = P_COLORS_PDF[c.priority ?? ""] ?? { bg: "#F3F4F6", text: "#6B7280" };
        doc.rect(x + 2, rY + 4, 38, 14).fill(pColor.bg);
        doc.fontSize(8).font("Helvetica-Bold").fillColor(pColor.text)
          .text(c.priority ?? "—", x + 2, rY + 7, { width: 38, align: "center" });
        x += cols[0].w;

        const vals = [
          c.clashIdOriginal ?? "—",
          c.description ?? "—",
          c.element1 ?? "—",
          c.element2 ?? "—",
          c.discipline1 ?? "—",
          c.level ?? "—",
          c.status ?? "—",
          c.assignedToName ?? "—",
        ];
        vals.forEach((val, i) => {
          doc.fontSize(7).font("Helvetica").fillColor("#111827")
            .text(String(val).slice(0, 30), x + 2, rY + 7, { width: cols[i + 1].w - 4, lineBreak: false });
          x += cols[i + 1].w;
        });

        doc.rect(M, rY, CW, rowH).stroke("#E5E7EB");
        doc.y = rY + rowH;

        if (c.resolutionNotes) {
          const nY = doc.y;
          doc.rect(M, nY, CW, 16).fill("#F0F9FF");
          doc.fontSize(7).font("Helvetica").fillColor("#1E40AF")
            .text(`Note: ${c.resolutionNotes.slice(0, 120)}`, M + 5, nY + 4, { width: CW - 10 });
          doc.y = nY + 18;
        }
      });

      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        doc.fontSize(7).font("Helvetica").fillColor("#9CA3AF")
          .text(`Confidential — Generated by BIMLog by IgniteSmart | ${project.name} | Page ${i + 1} of ${range.count}`,
            M, doc.page.height - 35, { align: "center", width: CW });
      }

      doc.end();
    } catch (err) {
      console.error("[clash-pdf] FAILED:", err);
      res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
    }
  }
);

export default router;
