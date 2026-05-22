import { Router } from "express";
import { db } from "@workspace/db";
import { clashReportsTable, clashesTable } from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";
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

      function colIdx(keywords: string[]): number {
        for (const kw of keywords) {
          const i = headers.findIndex(h => h.includes(kw));
          if (i >= 0) return i;
        }
        return -1;
      }

      const idCol = colIdx(["clash", "id", "number", "#"]);
      const descCol = colIdx(["description", "issue", "name", "title", "comment"]);
      const el1Col = colIdx(["element 1", "item 1", "component 1", "layer 1"]);
      const el2Col = colIdx(["element 2", "item 2", "component 2", "layer 2"]);
      const disc1Col = colIdx(["discipline", "trade", "system", "category"]);
      const disc2Col = colIdx(["discipline 2", "trade 2", "system 2"]);
      const locCol = colIdx(["location", "grid", "area", "gridpoint"]);
      const levelCol = colIdx(["level", "floor", "elevation"]);
      const typeCol = colIdx(["type", "clash type", "kind"]);
      const assignCol = colIdx(["responsible", "assigned", "owner", "contractor"]);

      console.log("[clash-upload] Total rows:", rows.length);
      console.log("[clash-upload] Header row index:", headerIdx);
      console.log("[clash-upload] Headers found:", headers);
      console.log("[clash-upload] idCol:", idCol, "descCol:", descCol, "el1Col:", el1Col);
      const dataRows = rows.slice(headerIdx + 1);
      const parsed = dataRows
        .map((row: any[]) => ({
          clashIdOriginal: String(row[idCol] ?? row[0] ?? "").trim(),
          description: String(row[descCol] ?? row[1] ?? "").trim(),
          element1: String(row[el1Col] ?? row[2] ?? "").trim(),
          element2: String(row[el2Col] ?? row[3] ?? "").trim(),
          discipline1: String(row[disc1Col] ?? row[4] ?? "").trim(),
          discipline2: String(row[disc2Col] ?? "").trim(),
          gridLocation: String(row[locCol] ?? row[5] ?? "").trim(),
          level: String(row[levelCol] ?? row[6] ?? "").trim(),
          clashType: String(row[typeCol] ?? "").trim(),
          assignedToName: String(row[assignCol] ?? "").trim(),
          status: "open",
        }))
        .filter((r: any) => r.description || r.clashIdOriginal);
      console.log("[clash-upload] Parsed rows count:", parsed.length);
      if (parsed.length > 0) console.log("[clash-upload] First parsed row:", JSON.stringify(parsed[0]));
      if (parsed.length === 0) console.log("[clash-upload] WARNING: 0 rows parsed — first 3 data rows:", JSON.stringify(rows.slice(headerIdx + 1, headerIdx + 4)));

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
            element1: p.element1 || null,
            element2: p.element2 || null,
            discipline1: p.discipline1 || null,
            discipline2: p.discipline2 || null,
            gridLocation: p.gridLocation || null,
            level: p.level || null,
            clashType: p.clashType || null,
            assignedToName: p.assignedToName || null,
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
      model: "claude-sonnet-4-20250514",
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
    const { status, resolutionNotes, assignedToName, assignedToEmail, dueDate } = req.body ?? {};
    if (status !== undefined) allowed.status = status;
    if (resolutionNotes !== undefined) allowed.resolutionNotes = resolutionNotes;
    if (assignedToName !== undefined) allowed.assignedToName = assignedToName;
    if (assignedToEmail !== undefined) allowed.assignedToEmail = assignedToEmail;
    if (dueDate !== undefined) allowed.dueDate = dueDate ? new Date(dueDate) : null;
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

export default router;
