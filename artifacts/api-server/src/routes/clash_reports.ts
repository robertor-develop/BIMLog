import { Router } from "express";
import { db } from "@workspace/db";
import { clashReportsTable, clashesTable, lensViewpointsTable, lensViewpointReportsTable, lensViewpointEventsTable, lensViewpointSequenceCountersTable } from "@workspace/db/schema";
import { eq, desc, and, isNull, isNotNull, ne, or, sql, inArray } from "drizzle-orm";
import { getCompanyLogo } from "../lib/pdf-logo";
import {
  PALETTE, statusText, priorityText, computeContentHash,
  drawCoverPage, sectionBar, drawTable, addPageNumbers,
} from "../lib/pdf-kit";
import { projectsTable, usersTable, companiesTable, activityLogTable, linkedItemsTable, agentInsightsTable } from "@workspace/db/schema";
import { authMiddleware, requireProjectMember, requirePermission } from "../middlewares/auth";
import multer from "multer";
import * as XLSX from "xlsx";
import Anthropic from "@anthropic-ai/sdk";

// String-aware repair for the Navisworks plugin's malformed JSON. The plugin
// runs under a non-invariant locale (e.g. es-*) so .NET formats decimal numbers
// with a comma separator (0,0000 / 2112,4409) which is invalid JSON. It also
// emits trailing/double commas when it omits null fields. This repair:
//   1) converts a comma between two digits inside an OBJECT into a "." (decimal
//      separator), while leaving commas inside arrays alone so numeric arrays
//      like [1,2,3] are never corrupted;
//   2) drops structural comma noise (a comma immediately followed by } ] or ,).
// It never touches characters inside string literals, so clash data values are
// preserved exactly. Returns the repaired text and the number of fixes applied
// (0 means nothing was changed).
function repairPluginJson(text: string): { repaired: string; fixes: number } {
  let out = "";
  let fixes = 0;
  let inStr = false;
  let esc = false;
  const stack: string[] = [];
  const isDigit = (c: string) => c >= "0" && c <= "9";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      out += ch;
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; out += ch; continue; }
    if (ch === "{" || ch === "[") { stack.push(ch); out += ch; continue; }
    if (ch === "}" || ch === "]") { stack.pop(); out += ch; continue; }
    if (ch === ",") {
      let p = out.length - 1;
      while (p >= 0 && /\s/.test(out[p])) p--;
      const prev = p >= 0 ? out[p] : "";
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) j++;
      const nxt = j < text.length ? text[j] : "";
      const top = stack[stack.length - 1];
      if (top === "{" && isDigit(prev) && isDigit(nxt)) { out += "."; fixes++; continue; }
      if (nxt === "}" || nxt === "]" || nxt === ",") { fixes++; continue; }
    }
    out += ch;
  }
  return { repaired: out, fixes };
}

// The Navisworks plugin serializes Issue Notes without escaping control
// characters, so a multi-line note injects raw line breaks (and tabs) INSIDE a
// JSON string literal. JSON forbids unescaped control chars (charCode < 0x20)
// inside strings, so JSON.parse throws "Bad control character in string literal"
// and the whole request is rejected. This walks the text string-aware and
// escapes only control chars that fall inside a string literal (whitespace
// between tokens stays untouched). Returns the repaired text and fix count.
function escapeJsonStringControlChars(text: string): { repaired: string; fixes: number } {
  let out = "";
  let fixes = 0;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) { out += ch; esc = false; continue; }
      if (ch === "\\") { out += ch; esc = true; continue; }
      if (ch === '"') { out += ch; inStr = false; continue; }
      const code = text.charCodeAt(i);
      if (code < 0x20) {
        if (ch === "\n") out += "\\n";
        else if (ch === "\r") out += "\\r";
        else if (ch === "\t") out += "\\t";
        else if (ch === "\b") out += "\\b";
        else if (ch === "\f") out += "\\f";
        else out += "\\u" + code.toString(16).padStart(4, "0");
        fixes++;
        continue;
      }
      out += ch;
      continue;
    }
    if (ch === '"') { inStr = true; out += ch; continue; }
    out += ch;
  }
  return { repaired: out, fixes };
}

const router: Router = Router();

// Thrown inside the reassign transaction when the old row is no longer active by
// the time we go to supersede it (concurrent double-submit). Maps to HTTP 409.
class ReassignConflict extends Error {
  constructor() {
    super("Viewpoint is no longer active");
    this.name = "ReassignConflict";
  }
}

// Atomic Trade+Floor sequence assignment (Part 2). One round-trip: creates the
// counter row on first use and atomically increments it under concurrency — no
// read-then-write race. trade/floor are coalesced to "" so a row with no trade or
// floor still gets a stable, deterministic counter key.
async function assignTradeFloorSeq(
  projectId: number,
  trade: string | null,
  floor: string | null,
  claimedSeq: number | null,
  exec: { execute: (q: ReturnType<typeof sql>) => Promise<unknown> } = db,
): Promise<{ seq: number; correction: number | null }> {
  const tradeKey = trade ?? "";
  const floorKey = floor ?? "";
  const result = await exec.execute(sql`
    INSERT INTO lens_viewpoint_sequence_counters (project_id, trade, floor, current_seq)
    VALUES (${projectId}, ${tradeKey}, ${floorKey}, 1)
    ON CONFLICT (project_id, trade, floor)
    DO UPDATE SET current_seq = lens_viewpoint_sequence_counters.current_seq + 1
    RETURNING current_seq
  `);
  const rows = (result as unknown as { rows: Array<{ current_seq: number }> }).rows;
  const seq = Number(rows?.[0]?.current_seq);
  // Correction ("R" number): only when the plugin optimistically claimed a number
  // that does not match the real assigned one. Absent today (plugin sends none).
  const correction = claimedSeq != null && claimedSeq !== seq ? 1 : null;
  return { seq, correction };
}

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
    const existingReports2 = await db.select({ reportNumber: clashReportsTable.reportNumber }).from(clashReportsTable).where(eq(clashReportsTable.projectId, projectId));
    const [project2] = await db.select({ code: projectsTable.code }).from(projectsTable).where(eq(projectsTable.id, projectId));
    const usedNums2 = new Set(existingReports2.map(r => r.reportNumber).filter(Boolean));
    let seqNum2 = existingReports2.length + 1;
    let autoNum2 = `${project2?.code ?? "PRJ"}-CR-${String(seqNum2).padStart(3, "0")}`;
    while (usedNums2.has(autoNum2)) {
      seqNum2++;
      autoNum2 = `${project2?.code ?? "PRJ"}-CR-${String(seqNum2).padStart(3, "0")}`;
    }
    const [report] = await db.insert(clashReportsTable).values({
      projectId,
      uploadedById: req.user!.userId,
      fileName: req.body?.fileName || "Manual Report",
      format: "manual",
      totalClashes: 0,
      status: "complete",
      reportNumber: autoNum2,
    }).returning();
    await db.insert(activityLogTable).values({
      projectId,
      userId: req.user!.userId,
      userFullName: req.user!.fullName ?? "",
      userCompanyName: req.user!.companyName ?? "",
      actionType: "create",
      entityType: "clash_report",
      entityId: report.id,
      details: `Created manual clash report: ${report.fileName} (${autoNum2})`,
    });
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
      const isSpreadsheet = ["xlsx", "xls", "csv"].includes(ext);
      const isXml = ext === "xml";

      let parsed: { clashIdOriginal: string; description: string; holdUps: string; discipline1: string; level: string; assignedToName: string; resolutionNotes: string | null; status: string; dueDate: Date | null }[] = [];

      if (isXml) {
        try {
          const xmlContent = req.file.buffer.toString("utf-8");
          console.log("[clash-upload] XML file size:", xmlContent.length, "chars");

          // Split into chunks if large
          const CHUNK_SIZE = 80000;
          const xmlChunks: string[] = [];
          for (let i = 0; i < xmlContent.length; i += CHUNK_SIZE) {
            xmlChunks.push(xmlContent.slice(i, i + CHUNK_SIZE));
          }
          console.log("[clash-upload] XML chunks:", xmlChunks.length);

          for (const chunk of xmlChunks) {
            try {
              const extractMsg = await anthropic.messages.create({
                model: "claude-sonnet-4-5",
                max_tokens: 8192,
                system: `You are a Navisworks XML coordination report analyzer. Extract ALL clash viewpoints from Navisworks XML export files. Never skip viewpoints. Always return valid JSON.`,
                messages: [{
                  role: "user",
                  content: `Analyze this Navisworks XML chunk and extract ALL coordination viewpoints found in this chunk.

RULES:
- Extract every <view name="..."> element inside any viewfolder
- Viewpoint ID = prefix before first space (C.123, 12.001, UG.000)
- Description = everything after the ID
- Discipline: FP=fire/sprinkler, PB=plumbing/sanitary/CW, HVAC=duct/mechanical, ELEC=conduit/electrical, STRUCT=structural, COORD=default
- Level from ID: C.=CELLAR, UG.=UNDERGROUND, B.=BASEMENT, G.=GROUND, R.=ROOF, 12.=12TH FLOOR
- Status: open by default, resolved if in COMPLETE folder
- If no viewpoints found in this chunk return []

Return ONLY valid JSON array, no markdown:
[{"viewpoint":"C.123","description":"6 SAN IN CONFLICT WITH DUCT","holdUps":"","discipline":"PB","level":"CELLAR","assignedToName":"","resolutionNotes":null,"status":"open","dueDate":null}]

XML CHUNK:
${chunk}`
                }]
              });

              const extractText = extractMsg.content[0]?.type === "text" ? extractMsg.content[0].text : "[]";
              const chunkRecords = JSON.parse(extractText.replace(/```json\n?|```/g, "").trim()) as any[];
              const mapped = chunkRecords
                .filter((r: any) => r.description || r.viewpoint)
                .map((r: any) => ({
                  clashIdOriginal: String(r.viewpoint || ""),
                  description: String(r.description || ""),
                  holdUps: String(r.holdUps || ""),
                  discipline1: String(r.discipline || "COORD"),
                  level: String(r.level || ""),
                  assignedToName: String(r.assignedToName || ""),
                  resolutionNotes: r.resolutionNotes ? String(r.resolutionNotes) : null,
                  status: r.status === "complete" || r.status === "resolved" ? "resolved" : "open",
                  dueDate: r.dueDate ? new Date(r.dueDate) : null,
                }));
              parsed = [...parsed, ...mapped];
              console.log("[clash-upload] XML chunk extracted:", mapped.length, "viewpoints, total so far:", parsed.length);
            } catch (chunkErr) {
              console.error("[clash-upload] XML chunk failed:", chunkErr);
            }
          }

          // Deduplicate by viewpoint ID
          const seen = new Set<string>();
          parsed = parsed.filter(r => {
            if (seen.has(r.clashIdOriginal)) return false;
            seen.add(r.clashIdOriginal);
            return true;
          });

          console.log("[clash-upload] XML total after dedup:", parsed.length, "viewpoints");
        } catch (xmlErr) {
          console.error("[clash-upload] XML failed:", xmlErr);
          parsed = [];
        }
      }

      if (!isSpreadsheet && parsed.length === 0) {
        // Non-spreadsheet: use AI to extract directly (XML, HTML, BCF, TXT, etc.)
        try {
          const fileText = req.file.buffer.toString("utf-8").slice(0, 100000);
          const extractMsg = await anthropic.messages.create({
            model: "claude-sonnet-4-5",
            max_tokens: 4000,
            messages: [{
              role: "user",
              content: `You are analyzing a construction clash/coordination report from software like Navisworks, Revit, Solibri, BIM 360, or similar tool.
This may be XML, HTML, BCF, plain text, or any other format.

IMPORTANT: Only extract COORDINATION CLASH viewpoints. Ignore documentation views, camera views, saved perspectives.
For Navisworks: look for folders named COORD, coordination, clashes, or dated folders like COORD 05-20-26.

Document:
${fileText}

Return ONLY a JSON array, no markdown:
[{"viewpoint":"C.001","description":"clash description","holdUps":"blocking issue or null","discipline":"PB or FP or ELEC or HVAC","level":"CELLAR or UNDERGROUND or 1ST","assignedTo":"contractor or null","resolutionNotes":"response/direction or null","status":"open or complete","deadline":"date or null"}]`
            }]
          });
          const extractText = extractMsg.content[0]?.type === "text" ? extractMsg.content[0].text : "[]";
          const aiRecords = JSON.parse(extractText.replace(/```json\n?|```/g, "").trim()) as any[];
          parsed = aiRecords
            .filter((r: any) => r.description || r.viewpoint)
            .map((r: any) => ({
              clashIdOriginal: r.viewpoint || "",
              description: r.description || "",
              holdUps: r.holdUps || "",
              discipline1: r.discipline || "",
              level: r.level || "",
              assignedToName: r.assignedTo || "",
              resolutionNotes: r.resolutionNotes || null,
              status: r.status === "complete" ? "resolved" : "open",
              dueDate: r.deadline ? new Date(r.deadline) : null,
            }));
          console.log("[clash-upload] AI extracted from non-spreadsheet:", parsed.length, "clashes");
        } catch (e) {
          console.error("[clash-upload] AI extraction failed:", e);
          parsed = [];
        }
      } else {
        // Spreadsheet: use column mapping
        const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
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
              content: `Construction clash report headers (0-indexed): ${JSON.stringify(hdrs)}
Sample row: ${JSON.stringify(dataRows[0] ?? [])}
Map to column indices. Return ONLY valid JSON, no markdown:
{"clashId":<idx or -1>,"description":<idx>,"holdUps":<idx or -1>,"discipline":<idx or -1>,"level":<idx or -1>,"assignedTo":<idx or -1>,"status":<idx or -1>,"resolutionNotes":<idx or -1>,"deadline":<idx or -1>,"viewpoint":<idx or -1>}
Rules: viewpoint=viewpoint ID (UG.001 etc), holdUps=blocking issues, resolutionNotes=response/direction, level=floor/level, discipline=trade, assignedTo=responsible, clashId=sequence number`
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
        const getDate = (row: any[], idx: number) => {
          if (idx < 0 || !row[idx]) return null;
          try {
            const val = row[idx];
            if (typeof val === "number") {
              const excelEpoch = new Date(1899, 11, 30);
              const d = new Date(excelEpoch.getTime() + val * 86400000);
              return isNaN(d.getTime()) ? null : d;
            }
            const d = new Date(val);
            return isNaN(d.getTime()) ? null : d;
          } catch { return null; }
        };

        parsed = dataRows
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
      }

      const existingReports = await db.select({ reportNumber: clashReportsTable.reportNumber }).from(clashReportsTable).where(eq(clashReportsTable.projectId, projectId));
      const [project] = await db.select({ code: projectsTable.code }).from(projectsTable).where(eq(projectsTable.id, projectId));
      const usedNums = new Set(existingReports.map(r => r.reportNumber).filter(Boolean));
      let seqNum = existingReports.length + 1;
      let autoReportNumber = `${project?.code ?? "PRJ"}-CR-${String(seqNum).padStart(3, "0")}`;
      while (usedNums.has(autoReportNumber)) {
        seqNum++;
        autoReportNumber = `${project?.code ?? "PRJ"}-CR-${String(seqNum).padStart(3, "0")}`;
      }
      const [report] = await db.insert(clashReportsTable).values({
        projectId,
        uploadedById: req.user!.userId,
        fileName: req.file.originalname,
        format: isSpreadsheet ? "excel" : ext || "other",
        totalClashes: parsed.length,
        status: "processing",
        reportNumber: autoReportNumber,
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

      await db.insert(activityLogTable).values({
        projectId,
        userId: req.user!.userId,
        userFullName: req.user!.fullName ?? "",
        userCompanyName: req.user!.companyName ?? "",
        actionType: "upload",
        entityType: "clash_report",
        entityId: report.id,
        details: `Uploaded clash report: ${req.file.originalname} — ${parsed.length} clashes imported (${autoReportNumber})`,
      });
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

// BIMLog Lens viewpoint sync — receive viewpoints from the Navisworks plugin.
// Registered BEFORE the "/:reportId" routes so "lens-sync"/"lens-pull" are not
// captured by the :reportId path parameter.
router.post("/projects/:projectId/clash-reports/lens-sync",
  // The raw-body bypass in app.ts buffered the bytes and skipped express.json for
  // this path, so we parse here. Long Issue Notes arrive with raw line breaks /
  // tabs left unescaped inside string literals, which plain JSON.parse rejects;
  // escape those control chars (then fall back to the structural/decimal repair)
  // so a viewpoint with a long multi-line note still syncs.
  (req, _res, next) => {
    const raw = (req as unknown as { rawBody?: Buffer }).rawBody;
    try {
      const hasViewpoints = req.body && typeof req.body === "object" && Array.isArray((req.body as { viewpoints?: unknown }).viewpoints);
      if (!hasViewpoints && raw && raw.length) {
        const text = raw.toString("utf8").replace(/^\uFEFF/, "").trim();
        if (text.startsWith("{") || text.startsWith("[")) {
          try {
            req.body = JSON.parse(text);
          } catch (parseErr) {
            const { repaired: ctrlFixed, fixes: ctrlFixes } = escapeJsonStringControlChars(text);
            try {
              req.body = JSON.parse(ctrlFixed);
              if (ctrlFixes > 0) console.warn("[lens-sync] escaped", ctrlFixes, "raw control char(s) inside string literal(s) from plugin payload");
            } catch {
              const { repaired, fixes } = repairPluginJson(ctrlFixed);
              if (fixes > 0 || ctrlFixes > 0) {
                req.body = JSON.parse(repaired);
                console.warn("[lens-sync] repaired", fixes, "structural defect(s) +", ctrlFixes, "control char(s) from plugin payload");
              } else {
                throw parseErr;
              }
            }
          }
        }
      }
    } catch (e) {
      console.error("[lens-sync] body recovery failed:", e instanceof Error ? e.message : String(e));
    }
    next();
  },
  authMiddleware,
  requirePermission("admin", "write"),
  async (req, res) => {
    const projectId = Number(req.params.projectId);
    try {
      const viewpoints: any[] = Array.isArray(req.body?.viewpoints) ? req.body.viewpoints : [];
      if (viewpoints.length === 0) {
        res.status(400).json({ error: "no_viewpoints", message: "Request body must include a non-empty viewpoints array" });
        return;
      }
      const results: Array<{ viewpointId: string; id: number | null; status: string; created: boolean; tradeFloorSeq?: number | null; tradeFloorSeqCorrection?: number | null; skipped?: boolean; reason?: string }> = [];
      const now = new Date();
      const seen = new Set<string>();
      console.log(`[lens-sync] project=${projectId} received ${viewpoints.length} viewpoint(s)`);
      // Trim to a non-empty string or null so blank GUIDs ("") do not collapse
      // distinct viewpoints into one dedup key or diverge from the conflict target.
      const norm = (x: unknown): string | null => {
        const s = x != null ? String(x).trim() : "";
        return s.length > 0 ? s : null;
      };
      // The plugin sends an all-zeros GUID as a placeholder for viewpoints saved
      // in earlier sessions. It is NOT a real key — treating it as one would make
      // every such viewpoint collide on the (project_id, navisworks_guid) unique
      // constraint. Normalize it (and null/empty) to null so these route to the
      // viewpoint_id arbiter instead and never raise a unique-violation.
      const ZERO_GUID = "00000000-0000-0000-0000-000000000000";
      for (const v of viewpoints) {
        const viewpointId = norm(v?.viewpointId);
        if (!viewpointId) continue;
        const rawGuid = norm(v?.navisworksGuid);
        const navisworksGuid = rawGuid && rawGuid.toLowerCase() !== ZERO_GUID ? rawGuid : null;
        const displayId = norm(v?.displayId);
        console.log(`[lens-sync] viewpoint received: viewpointId="${viewpointId}" guid=${navisworksGuid ?? "(none)"} displayId=${displayId ?? "(none)"}`);
        // Dedup key prefers the Navisworks GUID (stable across re-captures);
        // falls back to the viewpoint name for legacy callers without a GUID.
        const dedupKey = navisworksGuid ?? viewpointId;
        if (seen.has(dedupKey)) continue;
        seen.add(dedupKey);
        const priorityNum = v?.priority != null && !Number.isNaN(Number(v.priority)) ? Number(v.priority) : 3;
        const capturedAt = v?.capturedAt ? new Date(v.capturedAt) : null;
        const tradeVal = v?.trade != null ? String(v.trade) : null;
        const floorVal = v?.floor != null ? String(v.floor) : null;
        // Part 5: only stored if the plugin sends it; never generated server-side.
        const issueGroupId = norm(v?.issueGroupId);
        // Optional sequence number the plugin optimistically assigned. Used only to
        // decide whether a correction ("R" number) is needed; absent today.
        const claimedSeq = v?.tradeFloorSeq != null && !Number.isNaN(Number(v.tradeFloorSeq)) ? Number(v.tradeFloorSeq) : null;
        // Atomic dedup: INSERT ... ON CONFLICT DO NOTHING on navisworks_guid when
        // provided (else viewpoint_id). A returned row means we created it; an empty
        // result means it already existed (incl. a concurrent insert), so we fetch
        // it and report created:false.
        const conflictTarget = navisworksGuid
          ? [lensViewpointsTable.projectId, lensViewpointsTable.navisworksGuid]
          : [lensViewpointsTable.projectId, lensViewpointsTable.viewpointId];
        const fetchExisting = async () => {
          const [row] = navisworksGuid
            ? await db.select().from(lensViewpointsTable)
                .where(and(eq(lensViewpointsTable.projectId, projectId), eq(lensViewpointsTable.navisworksGuid, navisworksGuid)))
            : await db.select().from(lensViewpointsTable)
                .where(and(eq(lensViewpointsTable.projectId, projectId), eq(lensViewpointsTable.viewpointId, viewpointId)));
          return row;
        };
        // display_id collision guard: dedup keys on guid/viewpoint_id, so a retried
        // or mis-tagged sync carrying a NEW viewpoint_id but a display_id that already
        // belongs to a DIFFERENT active chain slips past dedup and opens a stray
        // duplicate row (the id=24 pending-action incident). Refuse to create a second
        // active row for an existing display_id; the partial unique index
        // lens_viewpoints_project_display_active_unique is the DB-level backstop.
        if (displayId) {
          const [displayClash] = await db.select().from(lensViewpointsTable)
            .where(and(
              eq(lensViewpointsTable.projectId, projectId),
              eq(lensViewpointsTable.displayId, displayId),
              eq(lensViewpointsTable.lifecycleStatus, "active"),
            ));
          if (displayClash && displayClash.viewpointId !== viewpointId) {
            console.warn(`[lens-sync] SKIPPED display_id collision: displayId="${displayId}" already active on id=${displayClash.id} (viewpointId="${displayClash.viewpointId}"), incoming viewpointId="${viewpointId}"`);
            // id:null deliberately — the colliding row belongs to a DIFFERENT viewpoint
            // (matched by display_id, not the incoming viewpoint_id). Returning its real
            // id in an "already exists"-shaped body would let an unaware plugin mis-bind
            // its sync receipt to a row it never touched. skipped/reason carry the signal.
            results.push({ viewpointId, id: null, status: displayClash.status, created: false, skipped: true, reason: "display_id_collision" });
            continue;
          }
        }
        try {
          // All-or-nothing per viewpoint: the insert, the atomic sequence
          // increment, and the back-fill of the assigned sequence onto the new
          // row must commit together. Otherwise a failure after the insert would
          // leave a persisted row with a null sequence that the retry path (which
          // returns the existing row) could never repair.
          const txResult = await db.transaction(async (tx) => {
            const insertedRows = await tx.insert(lensViewpointsTable).values({
              projectId,
              viewpointId,
              navisworksGuid,
              displayId,
              note: v?.note != null ? String(v.note) : null,
              trade: tradeVal,
              reportType: v?.reportType != null ? String(v.reportType) : null,
              priority: priorityNum,
              floor: floorVal,
              openItems: v?.openItems != null ? String(v.openItems) : null,
              capturedAt: capturedAt && !Number.isNaN(capturedAt.getTime()) ? capturedAt : null,
              status: "open",
              issueGroupId,
              syncedAt: now,
              // Part 3: the partial unique indexes only cover active rows, so the
              // ON CONFLICT arbiter must carry the matching predicate or Postgres
              // raises 42P10 and the dedup safety net breaks.
            }).onConflictDoNothing({ target: conflictTarget, where: sql`lifecycle_status = 'active'` }).returning();
            if (insertedRows.length === 0) return null;
            const inserted = insertedRows[0];
            // Part 2: real Trade+Floor sequence authority. A single atomic
            // statement creates the counter row on first use and increments it
            // under concurrency — no read-then-write race.
            const r = await assignTradeFloorSeq(projectId, tradeVal, floorVal, claimedSeq, tx);
            await tx.update(lensViewpointsTable)
              .set({ tradeFloorSeq: r.seq, tradeFloorSeqCorrection: r.correction })
              .where(eq(lensViewpointsTable.id, inserted.id));
            return { inserted, assignedSeq: r.seq, correction: r.correction };
          });
          if (txResult) {
            const { inserted, assignedSeq, correction } = txResult;
            console.log(`[lens-sync] CREATED viewpointId="${viewpointId}" id=${inserted.id} seq=${assignedSeq}${correction != null ? ` R${correction}` : ""}`);
            results.push({ viewpointId, id: inserted.id, status: inserted.status, created: true, tradeFloorSeq: assignedSeq, tradeFloorSeqCorrection: correction });
            continue;
          }
          const existing = await fetchExisting();
          if (existing) {
            console.log(`[lens-sync] ALREADY EXISTS viewpointId="${viewpointId}" id=${existing.id}`);
            // Return the stored seq on the existing-row path too (not just created),
            // so a client that lost its local counter can recover it from a re-sync
            // instead of being forced to lens-pull.
            results.push({ viewpointId, id: existing.id, status: existing.status, created: false, tradeFloorSeq: existing.tradeFloorSeq ?? null, tradeFloorSeqCorrection: existing.tradeFloorSeqCorrection ?? null });
          } else {
            console.log(`[lens-sync] WARNING no row inserted or found for viewpointId="${viewpointId}"`);
          }
        } catch (err) {
          // Only a unique-violation (23505) is an expected transitional collision:
          // a legacy row shares this viewpoint_id but has a null GUID, so the GUID
          // arbiter does not catch it. Treat that as existing; surface anything else.
          if ((err as { code?: string })?.code !== "23505") throw err;
          const [legacy] = await db.select().from(lensViewpointsTable)
            .where(and(eq(lensViewpointsTable.projectId, projectId), eq(lensViewpointsTable.viewpointId, viewpointId)));
          if (legacy) {
            console.log(`[lens-sync] ALREADY EXISTS (legacy viewpoint_id) viewpointId="${viewpointId}" id=${legacy.id}`);
            results.push({ viewpointId, id: legacy.id, status: legacy.status, created: false, tradeFloorSeq: legacy.tradeFloorSeq ?? null, tradeFloorSeqCorrection: legacy.tradeFloorSeqCorrection ?? null });
          } else if (displayId) {
            // Race: another request opened the same display_id between our guard and
            // this insert, so the partial unique index rejected us. Treat as a skip.
            const [displayClash] = await db.select().from(lensViewpointsTable)
              .where(and(eq(lensViewpointsTable.projectId, projectId), eq(lensViewpointsTable.displayId, displayId), eq(lensViewpointsTable.lifecycleStatus, "active")));
            if (displayClash && displayClash.viewpointId !== viewpointId) {
              console.warn(`[lens-sync] SKIPPED display_id collision (race): displayId="${displayId}" active on id=${displayClash.id}, incoming viewpointId="${viewpointId}"`);
              // id:null deliberately — see the pre-insert guard above for the rationale.
              results.push({ viewpointId, id: null, status: displayClash.status, created: false, skipped: true, reason: "display_id_collision" });
            } else {
              throw err;
            }
          } else {
            throw err;
          }
        }
      }
      res.json({ success: true, results });
    } catch (err) {
      res.status(500).json({ error: "lens_sync_failed", message: err instanceof Error ? err.message : String(err) });
    }
  }
);

// BIMLog Lens viewpoint pull — all viewpoints for a project, newest capture first.
router.get("/projects/:projectId/clash-reports/lens-pull",
  authMiddleware,
  requireProjectMember(),
  async (req, res) => {
    const projectId = Number(req.params.projectId);
    try {
      const rows = await db.select().from(lensViewpointsTable)
        .where(eq(lensViewpointsTable.projectId, projectId))
        .orderBy(desc(lensViewpointsTable.capturedAt));
      // Resolve each row's predecessor (supersedesId) to its short code so the table can
      // show "supersedes FI-001" without a second round-trip.
      const codeOf = (row: { trade: string | null; tradeFloorSeq: number | null }): string | null => {
        if (row.tradeFloorSeq == null) return null;
        const tr = row.trade || "";
        const abbr = (tr.length > 2 ? tr.slice(0, 2) : tr).toUpperCase() || "??";
        return `${abbr}-${String(row.tradeFloorSeq).padStart(3, "0")}`;
      };
      const byId = new Map(rows.map(r => [r.id, r]));
      const viewpoints = rows.map(r => ({
        id: r.id,
        viewpointId: r.viewpointId,
        displayId: r.displayId,
        navisworksGuid: r.navisworksGuid,
        note: r.note,
        trade: r.trade,
        reportType: r.reportType,
        priority: r.priority,
        floor: r.floor,
        openItems: r.openItems,
        capturedAt: r.capturedAt,
        status: r.status,
        syncedAt: r.syncedAt,
        tradeFloorSeq: r.tradeFloorSeq,
        tradeFloorSeqCorrection: r.tradeFloorSeqCorrection,
        issueGroupId: r.issueGroupId,
        lifecycleStatus: r.lifecycleStatus,
        supersedesId: r.supersedesId,
        supersedesCode: r.supersedesId != null && byId.has(r.supersedesId) ? codeOf(byId.get(r.supersedesId)!) : null,
        revisionNumber: r.revisionNumber,
      }));
      res.json({ success: true, viewpoints });
    } catch (err) {
      res.status(500).json({ error: "lens_pull_failed", message: err instanceof Error ? err.message : String(err) });
    }
  }
);

// PATCH lens viewpoint status. Registered BEFORE the "/:reportId" routes so the
// literal "lens-viewpoints" segment is not captured by the :reportId param.
router.patch("/projects/:projectId/clash-reports/lens-viewpoints/:id",
  authMiddleware,
  requireProjectMember(),
  async (req, res) => {
    const projectId = Number(req.params.projectId);
    const id = Number(req.params.id);
    const { status } = req.body ?? {};
    const VALID = ["open", "follow_up", "waiting_design", "approved", "resolved"];
    if (!status || !VALID.includes(status)) {
      res.status(400).json({ error: "invalid_status", message: `status must be one of: ${VALID.join(", ")}` });
      return;
    }
    try {
      const [existing] = await db.select({ status: lensViewpointsTable.status })
        .from(lensViewpointsTable)
        .where(and(eq(lensViewpointsTable.id, id), eq(lensViewpointsTable.projectId, projectId)));
      const [updated] = await db.update(lensViewpointsTable)
        .set({ status, updatedAt: new Date() })
        .where(and(eq(lensViewpointsTable.id, id), eq(lensViewpointsTable.projectId, projectId)))
        .returning();
      if (!updated) {
        res.status(404).json({ error: "not_found", message: "Lens viewpoint not found" });
        return;
      }
      // Log a status_changed event whenever the status actually changes, so
      // Round 2/3 (health score, timeline, velocity) have real history.
      if (existing && existing.status !== updated.status) {
        try {
          await db.insert(lensViewpointEventsTable).values({
            projectId,
            viewpointId: id,
            eventType: "status_changed",
            fromStatus: existing.status,
            toStatus: updated.status,
            changedById: req.user?.userId ?? null,
          });
        } catch (evErr) {
          console.error("[lens-event] failed to log status change:", evErr);
        }
      }
      res.json({ success: true, viewpoint: { id: updated.id, status: updated.status, updatedAt: updated.updatedAt } });
    } catch (err) {
      res.status(500).json({ error: "lens_update_failed", message: err instanceof Error ? err.message : String(err) });
    }
  }
);

// ── Lifecycle actions (Part 6): Edit / Reassign / Void ──────────────────────
// All mutate viewpoint state, so they require write permission (authMiddleware +
// requirePermission("admin","write")) like the other write routes — membership
// alone is not enough. Registered BEFORE the "/:reportId" routes so the literal
// "lens-viewpoints" segment is not captured by the :reportId param.

// EDIT — supersede the OLD row and create a NEW active revision with the updated
// note. Every other field (trade, floor, reportType, priority, openItems,
// displayId, viewpointId, navisworksGuid, issueGroupId, and the Trade+Floor
// sequence) is copied unchanged, so the display code stays identical and only the
// revision_number advances. Mirrors the Reassign transactional pattern.
router.patch("/projects/:projectId/clash-reports/lens-viewpoints/:id/edit",
  authMiddleware,
  requirePermission("admin", "write"),
  async (req, res) => {
    const projectId = Number(req.params.projectId);
    const id = Number(req.params.id);
    const { note, reason } = req.body ?? {};
    if (note == null || String(note).trim() === "") {
      res.status(400).json({ error: "invalid_note", message: "note is required" });
      return;
    }
    const newNote = String(note);
    try {
      const [old] = await db.select().from(lensViewpointsTable)
        .where(and(eq(lensViewpointsTable.id, id), eq(lensViewpointsTable.projectId, projectId)));
      if (!old) {
        res.status(404).json({ error: "not_found", message: "Lens viewpoint not found" });
        return;
      }
      if (old.lifecycleStatus !== "active") {
        res.status(409).json({ error: "not_active", message: `Cannot edit a ${old.lifecycleStatus} viewpoint` });
        return;
      }
      // All-or-nothing: superseding the old row, inserting the new revision, and
      // logging the change must commit together. Supersede FIRST so the partial
      // unique index frees the (project, viewpoint_id) / (project, guid) slot for
      // the new active row. Guard on lifecycle_status='active' so a concurrent
      // double-submit cannot supersede the same row twice (rowCount 0 -> abort).
      const result = await db.transaction(async (tx) => {
        const sup = await tx.update(lensViewpointsTable)
          .set({ lifecycleStatus: "superseded", updatedAt: new Date() })
          .where(and(eq(lensViewpointsTable.id, old.id), eq(lensViewpointsTable.lifecycleStatus, "active")))
          .returning({ id: lensViewpointsTable.id });
        if (sup.length === 0) {
          throw new ReassignConflict();
        }
        const [created] = await tx.insert(lensViewpointsTable).values({
          projectId,
          viewpointId: old.viewpointId,
          navisworksGuid: old.navisworksGuid,
          displayId: old.displayId,
          note: newNote,
          trade: old.trade,
          reportType: old.reportType,
          priority: old.priority,
          floor: old.floor,
          openItems: old.openItems,
          capturedAt: old.capturedAt,
          status: old.status,
          screenshotUrl: old.screenshotUrl,
          issueGroupId: old.issueGroupId,
          tradeFloorSeq: old.tradeFloorSeq,
          tradeFloorSeqCorrection: old.tradeFloorSeqCorrection,
          lifecycleStatus: "active",
          supersedesId: old.id,
          revisionNumber: old.revisionNumber + 1,
          syncedAt: new Date(),
        }).returning();
        await tx.insert(activityLogTable).values({
          projectId,
          userId: req.user!.userId,
          userFullName: req.user!.fullName,
          userCompanyName: req.user!.companyName,
          actionType: "edit",
          entityType: "lens_viewpoint",
          entityId: old.id,
          fileNameBefore: old.note ?? null,
          fileNameAfter: newNote,
          details: reason != null && String(reason).trim() !== "" ? String(reason) : null,
        });
        return created;
      });
      res.json({ success: true, supersededId: old.id, viewpoint: result });
    } catch (err) {
      if (err instanceof ReassignConflict) {
        res.status(409).json({ error: "not_active", message: err.message });
        return;
      }
      res.status(500).json({ error: "lens_edit_failed", message: err instanceof Error ? err.message : String(err) });
    }
  }
);

// REASSIGN — supersede the OLD row and create a NEW active row under a new trade,
// with a real atomic Trade+Floor sequence and inherited issue_group_id.
router.post("/projects/:projectId/clash-reports/lens-viewpoints/:id/reassign",
  authMiddleware,
  requirePermission("admin", "write"),
  async (req, res) => {
    const projectId = Number(req.params.projectId);
    const id = Number(req.params.id);
    const { trade, reason } = req.body ?? {};
    if (trade == null || String(trade).trim() === "") {
      res.status(400).json({ error: "invalid_trade", message: "target trade is required" });
      return;
    }
    const newTrade = String(trade);
    try {
      const [old] = await db.select().from(lensViewpointsTable)
        .where(and(eq(lensViewpointsTable.id, id), eq(lensViewpointsTable.projectId, projectId)));
      if (!old) {
        res.status(404).json({ error: "not_found", message: "Lens viewpoint not found" });
        return;
      }
      if (old.lifecycleStatus !== "active") {
        res.status(409).json({ error: "not_active", message: `Cannot reassign a ${old.lifecycleStatus} viewpoint` });
        return;
      }
      // All-or-nothing: counter increment, supersede of the old row, creation of
      // the new active row, and the activity log entry must commit together or not
      // at all — otherwise a mid-sequence failure could leave the old row
      // superseded with no replacement, or burn a sequence number.
      const result = await db.transaction(async (tx) => {
        // The atomic counter for (project, NEW trade, floor) is the real authority.
        const { seq, correction } = await assignTradeFloorSeq(projectId, newTrade, old.floor, null, tx);
        // Supersede the old row FIRST so the partial unique index frees the
        // (project, viewpoint_id) / (project, guid) slot for the new active row.
        // Guard on lifecycle_status='active' so a concurrent double-submit cannot
        // supersede the same row twice (rowCount 0 -> abort).
        const sup = await tx.update(lensViewpointsTable)
          .set({ lifecycleStatus: "superseded", updatedAt: new Date() })
          .where(and(eq(lensViewpointsTable.id, old.id), eq(lensViewpointsTable.lifecycleStatus, "active")))
          .returning({ id: lensViewpointsTable.id });
        if (sup.length === 0) {
          throw new ReassignConflict();
        }
        const [created] = await tx.insert(lensViewpointsTable).values({
          projectId,
          viewpointId: old.viewpointId,
          navisworksGuid: old.navisworksGuid,
          displayId: old.displayId,
          note: old.note,
          trade: newTrade,
          reportType: old.reportType,
          priority: old.priority,
          floor: old.floor,
          openItems: old.openItems,
          capturedAt: old.capturedAt,
          status: old.status,
          screenshotUrl: old.screenshotUrl,
          issueGroupId: old.issueGroupId,
          tradeFloorSeq: seq,
          tradeFloorSeqCorrection: correction,
          lifecycleStatus: "active",
          supersedesId: old.id,
          revisionNumber: old.revisionNumber + 1,
          syncedAt: new Date(),
        }).returning();
        await tx.insert(activityLogTable).values({
          projectId,
          userId: req.user!.userId,
          userFullName: req.user!.fullName,
          userCompanyName: req.user!.companyName,
          actionType: "reassign",
          entityType: "lens_viewpoint",
          entityId: old.id,
          fileNameBefore: old.trade ?? null,
          fileNameAfter: newTrade,
          details: reason != null && String(reason).trim() !== "" ? String(reason) : null,
        });
        return created;
      });
      res.json({ success: true, supersededId: old.id, viewpoint: result });
    } catch (err) {
      if (err instanceof ReassignConflict) {
        res.status(409).json({ error: "not_active", message: err.message });
        return;
      }
      res.status(500).json({ error: "lens_reassign_failed", message: err instanceof Error ? err.message : String(err) });
    }
  }
);

// VOID — mark the row voided. No new row created; it stays visible everywhere.
router.post("/projects/:projectId/clash-reports/lens-viewpoints/:id/void",
  authMiddleware,
  requirePermission("admin", "write"),
  async (req, res) => {
    const projectId = Number(req.params.projectId);
    const id = Number(req.params.id);
    const { reason } = req.body ?? {};
    try {
      const [existing] = await db.select().from(lensViewpointsTable)
        .where(and(eq(lensViewpointsTable.id, id), eq(lensViewpointsTable.projectId, projectId)));
      if (!existing) {
        res.status(404).json({ error: "not_found", message: "Lens viewpoint not found" });
        return;
      }
      // Active-only guard, mirroring Edit/Reassign. Voiding a superseded row would
      // silently leave the real active head of the chain untouched (e.g. a queued
      // plugin void firing on an id the platform already reassigned); voiding an
      // already-voided row would duplicate the activity_log entry. Reject both.
      if (existing.lifecycleStatus !== "active") {
        res.status(409).json({ error: "not_active", message: `Cannot void a ${existing.lifecycleStatus} viewpoint` });
        return;
      }
      const updated = await db.transaction(async (tx) => {
        // Guard the UPDATE on active too, so a concurrent supersede/void that lands
        // between the SELECT above and here cannot double-void (rowCount 0 -> abort).
        const [row] = await tx.update(lensViewpointsTable)
          .set({ lifecycleStatus: "voided", updatedAt: new Date() })
          .where(and(eq(lensViewpointsTable.id, id), eq(lensViewpointsTable.projectId, projectId), eq(lensViewpointsTable.lifecycleStatus, "active")))
          .returning();
        if (!row) {
          throw new ReassignConflict();
        }
        await tx.insert(activityLogTable).values({
          projectId,
          userId: req.user!.userId,
          userFullName: req.user!.fullName,
          userCompanyName: req.user!.companyName,
          actionType: "voided",
          entityType: "lens_viewpoint",
          entityId: id,
          details: reason != null && String(reason).trim() !== "" ? String(reason) : null,
        });
        return row;
      });
      res.json({ success: true, viewpoint: updated });
    } catch (err) {
      if (err instanceof ReassignConflict) {
        res.status(409).json({ error: "not_active", message: "Cannot void a viewpoint that is no longer active" });
        return;
      }
      res.status(500).json({ error: "lens_void_failed", message: err instanceof Error ? err.message : String(err) });
    }
  }
);

// HISTORY — full revision chain for a viewpoint. Walks supersedes_id backward from
// the given row to the original, then attaches the activity_log events (edit /
// reassign / voided) keyed by each row id in the chain. Read-only; any project
// member may view. Registered BEFORE the "/:reportId" routes.
router.get("/projects/:projectId/clash-reports/lens-viewpoints/:id/history",
  authMiddleware,
  requireProjectMember(),
  async (req, res) => {
    const projectId = Number(req.params.projectId);
    const id = Number(req.params.id);
    try {
      const [start] = await db.select().from(lensViewpointsTable)
        .where(and(eq(lensViewpointsTable.id, id), eq(lensViewpointsTable.projectId, projectId)));
      if (!start) {
        res.status(404).json({ error: "not_found", message: "Lens viewpoint not found" });
        return;
      }
      // Walk backward through supersedes_id. Cap the loop to defend against any
      // accidental cycle in the self-reference chain.
      const chain: typeof start[] = [start];
      let cursor = start;
      for (let guard = 0; guard < 200 && cursor.supersedesId != null; guard++) {
        const [prev] = await db.select().from(lensViewpointsTable)
          .where(and(eq(lensViewpointsTable.id, cursor.supersedesId), eq(lensViewpointsTable.projectId, projectId)));
        if (!prev) break;
        chain.push(prev);
        cursor = prev;
      }
      const chainIds = chain.map(c => c.id);
      const events = await db.select().from(activityLogTable)
        .where(and(
          eq(activityLogTable.projectId, projectId),
          eq(activityLogTable.entityType, "lens_viewpoint"),
          inArray(activityLogTable.entityId, chainIds),
        ))
        .orderBy(desc(activityLogTable.createdAt));
      res.json({
        success: true,
        // Newest revision first.
        chain: chain.map(c => ({
          id: c.id,
          revisionNumber: c.revisionNumber,
          note: c.note,
          trade: c.trade,
          floor: c.floor,
          lifecycleStatus: c.lifecycleStatus,
          supersedesId: c.supersedesId,
          updatedAt: c.updatedAt,
          createdAt: c.createdAt,
        })),
        events: events.map(e => ({
          id: e.id,
          actionType: e.actionType,
          entityId: e.entityId,
          fileNameBefore: e.fileNameBefore,
          fileNameAfter: e.fileNameAfter,
          details: e.details,
          userFullName: e.userFullName,
          userCompanyName: e.userCompanyName,
          createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : e.createdAt,
        })),
      });
    } catch (err) {
      res.status(500).json({ error: "lens_history_failed", message: err instanceof Error ? err.message : String(err) });
    }
  }
);

// RESOLVE ACTIVE HEAD — given any row id in a supersede chain (typically an old,
// now-superseded id an external client still holds), walk supersedes_id FORWARD to
// the current tip of the same physical viewpoint. Lets a plugin re-target a queued
// action that would otherwise retry forever against a superseded id. Registered
// BEFORE the "/:reportId" routes so "lens-viewpoints" is not captured by :reportId.
router.get("/projects/:projectId/clash-reports/lens-viewpoints/:id/active",
  authMiddleware,
  requireProjectMember(),
  async (req, res) => {
    const projectId = Number(req.params.projectId);
    const id = Number(req.params.id);
    try {
      const [start] = await db.select().from(lensViewpointsTable)
        .where(and(eq(lensViewpointsTable.id, id), eq(lensViewpointsTable.projectId, projectId)));
      if (!start) {
        res.status(404).json({ error: "not_found", message: "Lens viewpoint not found" });
        return;
      }
      // Each supersede creates exactly one child whose supersedes_id points back to
      // its parent, so the forward walk is deterministic. Cap against cycles.
      let cursor = start;
      for (let guard = 0; guard < 200; guard++) {
        const [child] = await db.select().from(lensViewpointsTable)
          .where(and(eq(lensViewpointsTable.projectId, projectId), eq(lensViewpointsTable.supersedesId, cursor.id)));
        if (!child) break;
        cursor = child;
      }
      // cursor is the chain tip — the active head unless the whole chain was
      // voided/deleted. Report lifecycleStatus so the client decides what to do.
      res.json({
        success: true,
        requestedId: id,
        activeId: cursor.id,
        superseded: cursor.id !== id,
        lifecycleStatus: cursor.lifecycleStatus,
        viewpoint: {
          id: cursor.id,
          viewpointId: cursor.viewpointId,
          displayId: cursor.displayId,
          trade: cursor.trade,
          floor: cursor.floor,
          revisionNumber: cursor.revisionNumber,
          lifecycleStatus: cursor.lifecycleStatus,
          tradeFloorSeq: cursor.tradeFloorSeq,
          tradeFloorSeqCorrection: cursor.tradeFloorSeqCorrection,
        },
      });
    } catch (err) {
      res.status(500).json({ error: "lens_active_failed", message: err instanceof Error ? err.message : String(err) });
    }
  }
);

// DELETE a lens viewpoint (hard delete — row disappears from lens-pull).
// Registered BEFORE the "/:reportId" routes so the literal "lens-viewpoints"
// segment is not captured by the :reportId path parameter.
router.delete("/projects/:projectId/clash-reports/lens-viewpoints/:id",
  authMiddleware,
  requirePermission("admin", "write"),
  async (req, res) => {
    const projectId = Number(req.params.projectId);
    const id = Number(req.params.id);
    try {
      const [deleted] = await db.delete(lensViewpointsTable)
        .where(and(eq(lensViewpointsTable.id, id), eq(lensViewpointsTable.projectId, projectId)))
        .returning();
      if (!deleted) {
        res.status(404).json({ error: "not_found", message: "Lens viewpoint not found" });
        return;
      }
      console.log(`[lens-delete] project=${projectId} removed viewpoint id=${id}`);
      res.json({ success: true, id });
    } catch (err) {
      res.status(500).json({ error: "lens_delete_failed", message: err instanceof Error ? err.message : String(err) });
    }
  }
);

// Current Lens display-ID sequence for this project. The plugin now generates
// IDs locally (GUID-based naming); this endpoint is only used to initialize a
// new install's local counter from the count of viewpoints that already have a
// display_id. Registered BEFORE "/:reportId" so "lens-next-id" is not captured.
router.get("/projects/:projectId/clash-reports/lens-next-id",
  authMiddleware,
  requireProjectMember(),
  async (req, res) => {
    const projectId = Number(req.params.projectId);
    try {
      const [project] = await db.select({ code: projectsTable.code }).from(projectsTable)
        .where(eq(projectsTable.id, projectId));
      if (!project) {
        res.status(404).json({ error: "not_found", message: "Project not found" });
        return;
      }
      const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(lensViewpointsTable)
        .where(and(
          eq(lensViewpointsTable.projectId, projectId),
          isNotNull(lensViewpointsTable.displayId),
          ne(lensViewpointsTable.displayId, ""),
        ));
      res.json({ success: true, currentSequence: total ?? 0, projectCode: project.code });
    } catch (err) {
      res.status(500).json({ error: "lens_next_id_failed", message: err instanceof Error ? err.message : String(err) });
    }
  }
);

// ── LENS VIEWPOINTS — report history list ─────────────────────────────────────
// Registered BEFORE "/:reportId" so the literal "lens-viewpoints" segment is not
// captured by the :reportId path parameter.
router.get("/projects/:projectId/clash-reports/lens-viewpoints/reports",
  authMiddleware,
  requireProjectMember(),
  async (req, res) => {
    const projectId = Number(req.params.projectId);
    try {
      const rows = await db.select({
        id: lensViewpointReportsTable.id,
        reportNumber: lensViewpointReportsTable.reportNumber,
        generatedByName: lensViewpointReportsTable.generatedByName,
        generatedAt: lensViewpointReportsTable.generatedAt,
        reportDate: lensViewpointReportsTable.reportDate,
        viewpointCount: lensViewpointReportsTable.viewpointCount,
        healthScore: lensViewpointReportsTable.healthScore,
        watermarkType: lensViewpointReportsTable.watermarkType,
        isExecutiveOnePager: lensViewpointReportsTable.isExecutiveOnePager,
        contentHash: lensViewpointReportsTable.contentHash,
      }).from(lensViewpointReportsTable)
        .where(eq(lensViewpointReportsTable.projectId, projectId))
        .orderBy(desc(lensViewpointReportsTable.generatedAt));
      res.json({ reports: rows });
    } catch (err) {
      res.status(500).json({ error: "lens_reports_failed", message: err instanceof Error ? err.message : String(err) });
    }
  }
);

// Delete a single Lens report-history record (admin-write). Literal sub-path; the extra
// "/reports/" segment keeps it clear of the "lens-viewpoints/:id" delete route.
router.delete("/projects/:projectId/clash-reports/lens-viewpoints/reports/:reportRecordId",
  authMiddleware,
  requirePermission("admin", "write"),
  async (req, res) => {
    const projectId = Number(req.params.projectId);
    const reportRecordId = Number(req.params.reportRecordId);
    try {
      const [deleted] = await db.delete(lensViewpointReportsTable)
        .where(and(eq(lensViewpointReportsTable.id, reportRecordId), eq(lensViewpointReportsTable.projectId, projectId)))
        .returning({ id: lensViewpointReportsTable.id });
      if (!deleted) { res.status(404).json({ error: "not_found", message: "Report not found" }); return; }
      res.json({ success: true, id: deleted.id });
    } catch (err) {
      res.status(500).json({ error: "lens_report_delete_failed", message: err instanceof Error ? err.message : String(err) });
    }
  }
);

// ── LENS VIEWPOINTS — generate professional PDF report ─────────────────────────
// Registered BEFORE "/:reportId" so the literal "lens-viewpoints" segment is not
// captured by the :reportId path parameter. Accepts modal data as JSON, writes a
// history row with a snapshot, then streams the PDF back as an attachment.
router.post("/projects/:projectId/clash-reports/lens-viewpoints/report",
  authMiddleware,
  requireProjectMember(),
  async (req, res) => {
    const projectId = Number(req.params.projectId);
    const userId = req.user!.userId;
    try {
      const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
      if (!project) { res.status(404).json({ error: "not_found", message: "Project not found" }); return; }

      const [user] = await db.select({
        fullName: usersTable.fullName,
        email: usersTable.email,
        companyName: companiesTable.name,
      }).from(usersTable)
        .leftJoin(companiesTable, eq(companiesTable.id, usersTable.companyId))
        .where(eq(usersTable.id, userId));

      const body = req.body ?? {};
      const filters = {
        priority: typeof body.filters?.priority === "string" ? body.filters.priority : "all",
        status: typeof body.filters?.status === "string" ? body.filters.status : "all",
        floor: typeof body.filters?.floor === "string" ? body.filters.floor : "all",
        trade: typeof body.filters?.trade === "string" ? body.filters.trade : "all",
        reportType: typeof body.filters?.reportType === "string" ? body.filters.reportType : "all",
      };
      const watermarkType: string = ["draft", "issued", "superseded"].includes(body.watermarkType) ? body.watermarkType : "draft";
      const isOnePager = body.isExecutiveOnePager === true;
      const showHealthScore = body.showHealthScore !== false;
      // ID rendering on the register: "displayId" (raw plugin id, default) or
      // "code" (Trade-Floor-Seq, matching the on-screen viewpoint code).
      const idFormat: "displayId" | "code" = body.idFormat === "code" ? "code" : "displayId";
      // By default the register shows only ACTIVE revisions; this opt-in includes
      // superseded and voided rows for a full audit trail.
      const includeNonActive = body.includeNonActive === true;
      // The Revision History appendix can be omitted entirely (default: included).
      const includeRevisionHistory = body.includeRevisionHistory !== false;
      const companyName: string = (body.companyName?.trim?.() || user?.companyName || "Company");
      const preparedByName: string = (body.preparedByName?.trim?.() || user?.fullName || "");
      const preparedByTitle: string = (body.preparedByTitle?.trim?.() || "");
      const submittedTo: string = (body.submittedTo?.trim?.() || "");
      let reportDate = body.reportDate ? new Date(body.reportDate) : new Date();
      if (isNaN(reportDate.getTime())) reportDate = new Date();

      // Logo: prefer a per-report upload (data URL), else the saved company logo.
      let logoBase64: Buffer | null = null;
      let logoType: "png" | "jpeg" | null = null;
      if (typeof body.logoDataUrl === "string") {
        const m = body.logoDataUrl.match(/^data:image\/(png|jpe?g);base64,(.+)$/);
        if (m) { logoBase64 = Buffer.from(m[2], "base64"); logoType = m[1] === "png" ? "png" : "jpeg"; }
      }
      if (!logoBase64) { const cl = await getCompanyLogo(userId); logoBase64 = cl.logoBase64; logoType = cl.logoType; }

      // Pull all viewpoints, then apply the modal filters.
      let vps = await db.select().from(lensViewpointsTable)
        .where(eq(lensViewpointsTable.projectId, projectId));
      if (filters.trade !== "all") vps = vps.filter(v => v.trade === filters.trade);
      if (filters.floor !== "all") vps = vps.filter(v => v.floor === filters.floor);
      if (filters.status !== "all") vps = vps.filter(v => v.status === filters.status);
      if (filters.reportType !== "all") vps = vps.filter(v => v.reportType === filters.reportType);
      if (filters.priority !== "all") vps = vps.filter(v => String(v.priority ?? "") === String(filters.priority));
      // Lifecycle scope: active-only unless the user opted to include the full
      // superseded/voided history.
      if (!includeNonActive) vps = vps.filter(v => (v.lifecycleStatus ?? "active") === "active");

      const pOrder = (p: number | null | undefined) => p ?? 99;
      vps.sort((a, b) => pOrder(a.priority) - pOrder(b.priority));

      if (vps.length === 0) {
        res.status(400).json({ error: "no_viewpoints", message: "No viewpoints match the selected filters." });
        return;
      }

      // ── Coordination Health Score (Round 1 — three simplified metrics) ──
      const ids = vps.map(v => v.id);
      const linkedRfiVpIds = new Set<number>();
      if (ids.length) {
        const links = await db.select().from(linkedItemsTable)
          .where(and(
            eq(linkedItemsTable.projectId, projectId),
            or(
              and(eq(linkedItemsTable.fromType, "lens_viewpoint"), eq(linkedItemsTable.toType, "rfi")),
              and(eq(linkedItemsTable.toType, "lens_viewpoint"), eq(linkedItemsTable.fromType, "rfi")),
            ),
          ));
        for (const l of links) {
          if (l.fromType === "lens_viewpoint" && ids.includes(l.fromId)) linkedRfiVpIds.add(l.fromId);
          if (l.toType === "lens_viewpoint" && ids.includes(l.toId)) linkedRfiVpIds.add(l.toId);
        }
      }
      const total = vps.length;
      const p1Total = vps.filter(v => v.priority === 1).length;
      const p1Resolved = vps.filter(v => v.priority === 1 && v.status === "resolved").length;
      const allResolved = vps.filter(v => v.status === "resolved").length;
      const withLinkedRfis = linkedRfiVpIds.size;
      // Each metric is only included when its denominator is non-zero. A metric
      // with no applicable items (e.g. zero P1s) is EXCLUDED from the average
      // rather than counted as 100%, which would otherwise inflate the score.
      const pctP1Resolved = p1Total ? (p1Resolved / p1Total) * 100 : null;
      const pctAllResolved = total ? (allResolved / total) * 100 : null;
      const pctWithLinkedRfis = total ? (withLinkedRfis / total) * 100 : null;
      const healthMetrics = [pctP1Resolved, pctAllResolved, pctWithLinkedRfis].filter((m): m is number => m !== null);
      const healthScore = healthMetrics.length
        ? Math.round(healthMetrics.reduce((s, m) => s + m, 0) / healthMetrics.length)
        : 0;
      const healthBreakdown = {
        pctP1Resolved: pctP1Resolved === null ? null : Math.round(pctP1Resolved),
        pctAllResolved: pctAllResolved === null ? null : Math.round(pctAllResolved),
        pctWithLinkedRfis: pctWithLinkedRfis === null ? null : Math.round(pctWithLinkedRfis),
        p1Total, p1Resolved, total, allResolved, withLinkedRfis,
      };

      // ── Snapshot (basis for the SHA-256 fingerprint) ──
      const snapshot = vps.map(v => ({
        id: v.id, viewpointId: v.viewpointId, displayId: v.displayId,
        note: v.note, trade: v.trade, reportType: v.reportType, priority: v.priority,
        floor: v.floor, openItems: v.openItems, status: v.status,
        capturedAt: v.capturedAt, syncedAt: v.syncedAt,
        revisionNumber: v.revisionNumber, lifecycleStatus: v.lifecycleStatus,
        hasLinkedRfi: linkedRfiVpIds.has(v.id),
      }));

      // ── Sequential report number (<CODE>-LV-001) + persist, made
      // concurrency-safe by a UNIQUE(project_id, report_number) constraint and a
      // retry-on-unique-violation loop. The contentHash embeds the final number,
      // so both are computed inside the loop.
      const existingReports = await db.select({ reportNumber: lensViewpointReportsTable.reportNumber })
        .from(lensViewpointReportsTable).where(eq(lensViewpointReportsTable.projectId, projectId));
      const usedNums = new Set(existingReports.map(r => r.reportNumber).filter(Boolean));
      const code = project.code ?? "PRJ";
      let seq = existingReports.length + 1;
      let reportNumber = "";
      let contentHash = "";
      let inserted = false;
      for (let attempt = 0; attempt < 12 && !inserted; attempt++) {
        reportNumber = `${code}-LV-${String(seq).padStart(3, "0")}`;
        if (usedNums.has(reportNumber)) { seq++; continue; }
        contentHash = computeContentHash({ projectId, reportNumber, reportDate: reportDate.toISOString(), filters, watermarkType, isOnePager, idFormat, includeNonActive, includeRevisionHistory, healthScore, snapshot });
        try {
          await db.insert(lensViewpointReportsTable).values({
            projectId,
            reportNumber,
            generatedById: userId,
            generatedByName: preparedByName || user?.fullName || "",
            generatedByTitle: preparedByTitle,
            reportDate,
            viewpointCount: total,
            healthScore,
            healthBreakdown,
            filtersApplied: filters,
            watermarkType,
            submittedTo,
            isExecutiveOnePager: isOnePager,
            snapshot,
            contentHash,
          });
          inserted = true;
        } catch (insErr) {
          const codeStr = (insErr as any)?.code ?? (insErr as any)?.cause?.code;
          if (codeStr === "23505") { seq++; continue; }
          throw insErr;
        }
      }
      if (!inserted) {
        res.status(409).json({ error: "report_number_conflict", message: "Could not allocate a unique report number, please retry." });
        return;
      }

      // ── Build the PDF ──
      const PDFDocument = (await import("pdfkit")).default;
      const doc = new PDFDocument({ size: "LETTER", layout: "landscape", margin: 40, bufferPages: true, autoFirstPage: true, margins: { top: 40, bottom: 50, left: 40, right: 40 } });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${reportNumber}.pdf"`);
      doc.pipe(res);

      const W = doc.page.width;
      const M = 40;
      const CW = W - M * 2;

      // Formal engineering-deliverable palette comes from the shared pdf-kit
      // module. Navy header bars, white content, light-grey alternating rows,
      // black text. No priority/status colors.
      const NAVY = PALETTE.NAVY;
      const statusLabel = (s: string) => statusText(s);
      const watermarkText = watermarkType === "issued" ? "ISSUED FOR COORDINATION" : watermarkType === "superseded" ? "SUPERSEDED" : "DRAFT";
      const fmtShort = (v: Date | string | null | undefined) => {
        if (!v) return "—";
        const d = new Date(v);
        if (isNaN(d.getTime()) || String(v).startsWith("1970")) return "—";
        return d.toLocaleDateString();
      };
      // Server-side mirror of the frontend viewpointCode() helper, plus the
      // "(Rev N)" suffix once a viewpoint has been revised beyond its first version.
      const codeOf = (v: typeof vps[number]) => {
        if (v.tradeFloorSeq == null) return v.displayId || v.viewpointId || "—";
        const base = `${v.trade || "—"}-${v.floor || "—"}-${v.tradeFloorSeq}`;
        return v.tradeFloorSeqCorrection != null ? `${base}-R${v.tradeFloorSeqCorrection}` : base;
      };
      const idText = (v: typeof vps[number]) => {
        const base = idFormat === "code" ? codeOf(v) : (v.displayId || v.viewpointId || "—");
        return (v.revisionNumber ?? 1) > 1 ? `${base} (Rev ${v.revisionNumber})` : base;
      };

      // ── COVER PAGE (shared helper) ──
      const projectAddress = typeof project.location === "string" ? project.location.trim() : "";
      drawCoverPage(doc, {
        margin: M,
        logoBase64, logoType,
        companyName,
        reportTitle: "BIM COORDINATION REPORT",
        reportSubtitle: "BIMLog Lens Viewpoints",
        reportNumber,
        reportDate,
        preparedBy: `${preparedByName}${preparedByTitle ? ", " + preparedByTitle : ""}`,
        submittedTo: submittedTo || undefined,
        issuedTo: filters.trade !== "all" ? `Issued to: ${filters.trade}` : undefined,
        isoStamp: true,
        projectName: project.name,
        projectAddress,
        projectMeta: `Project Code: ${project.code}  |  Total Viewpoints: ${total}`,
      });

      // Health score block (monochrome; optional via the modal toggle)
      let cursorY = 198;
      if (showHealthScore) {
        const hsY = cursorY;
        doc.rect(M, hsY, 200, 80).fillAndStroke("#FFFFFF", "#D1D5DB");
        doc.fontSize(40).font("Helvetica-Bold").fillColor(NAVY).text(String(healthScore), M, hsY + 12, { width: 200, align: "center" });
        doc.fontSize(8).font("Helvetica-Bold").fillColor("#374151").text("COORDINATION HEALTH SCORE  (0–100)", M, hsY + 60, { width: 200, align: "center" });
        // health sub-metrics (a metric reads "n/a" when it has no applicable items)
        const hbX = M + 220;
        const pct = (v: number | null) => v === null ? "n/a" : `${v}%`;
        doc.fontSize(9).font("Helvetica").fillColor("#374151");
        doc.text(`P1s resolved: ${pct(healthBreakdown.pctP1Resolved)}  (${p1Resolved}/${p1Total})`, hbX, hsY + 8);
        doc.text(`All viewpoints resolved: ${pct(healthBreakdown.pctAllResolved)}  (${allResolved}/${total})`, hbX, hsY + 28);
        doc.text(`Viewpoints with linked RFIs: ${pct(healthBreakdown.pctWithLinkedRfis)}  (${withLinkedRfis}/${total})`, hbX, hsY + 48);
        cursorY = hsY + 95;
      }
      doc.y = cursorY;

      // Priority breakdown cards
      const pCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      vps.forEach(v => { const p = v.priority ?? 0; if (pCounts[p] !== undefined) pCounts[p]++; });
      const cardY = sectionBar(doc, "Executive Summary", doc.y, { margin: M });
      const pCards = [1, 2, 3, 4, 5].map((p) => ({ label: priorityText(p).toUpperCase(), value: pCounts[p] }));
      const pcW = (CW - 40) / 5;
      pCards.forEach((card, i) => {
        const x = M + i * (pcW + 10);
        doc.rect(x, cardY, pcW, 56).fillAndStroke("#FFFFFF", "#D1D5DB");
        doc.fontSize(24).font("Helvetica-Bold").fillColor("#111827").text(String(card.value), x, cardY + 8, { width: pcW, align: "center" });
        doc.fontSize(7).font("Helvetica-Bold").fillColor("#6B7280").text(card.label, x, cardY + 40, { width: pcW, align: "center" });
      });
      // Lifecycle breakdown line — counts the rows actually included in this report.
      const lcCounts: Record<string, number> = { active: 0, superseded: 0, voided: 0 };
      vps.forEach(v => { const s = v.lifecycleStatus ?? "active"; if (lcCounts[s] !== undefined) lcCounts[s]++; });
      doc.fontSize(8).font("Helvetica").fillColor("#6B7280")
        .text(`Lifecycle:  Active ${lcCounts.active}   |   Superseded ${lcCounts.superseded}   |   Voided ${lcCounts.voided}`, M, cardY + 60, { width: CW });
      doc.y = cardY + 78;

      // Breakdown columns: by trade / floor / status
      const tally = (key: "trade" | "floor" | "status") => {
        const m = new Map<string, number>();
        vps.forEach(v => {
          const raw = (v as any)[key];
          const k = key === "status" ? statusLabel(raw ?? "open") : (raw || "—");
          m.set(k, (m.get(k) ?? 0) + 1);
        });
        return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
      };
      const breakdowns: { title: string; rows: [string, number][] }[] = [
        { title: "By Trade", rows: tally("trade") },
        { title: "By Floor", rows: tally("floor") },
        { title: "By Status", rows: tally("status") },
      ];
      const bx0 = doc.y;
      const colW = (CW - 20) / 3;
      const maxRows = isOnePager ? 5 : 12;
      breakdowns.forEach((bd, i) => {
        const x = M + i * (colW + 10);
        doc.rect(x, bx0, colW, 18).fill(NAVY);
        doc.fontSize(9).font("Helvetica-Bold").fillColor("white").text(bd.title, x + 6, bx0 + 5, { width: colW - 12 });
        let yy = bx0 + 22;
        bd.rows.slice(0, maxRows).forEach(([k, n], ri) => {
          doc.rect(x, yy - 2, colW, 14).fill(ri % 2 === 0 ? "#FFFFFF" : "#F4F6F8");
          doc.fontSize(8).font("Helvetica").fillColor("#111827").text(k, x + 5, yy + 1, { width: colW - 34, ellipsis: true, lineBreak: false });
          doc.fontSize(8).font("Helvetica-Bold").fillColor("#111827").text(String(n), x + colW - 28, yy + 1, { width: 24, align: "right" });
          yy += 14;
        });
      });
      doc.y = bx0 + 22 + maxRows * 14 + 8;

      if (isOnePager) {
        // Executive one-pager: top 5 most critical unresolved issues, then stop.
        const critical = vps.filter(v => v.status !== "resolved").sort((a, b) => pOrder(a.priority) - pOrder(b.priority)).slice(0, 5);
        doc.y = sectionBar(doc, "Top Critical Unresolved Issues", doc.y, { margin: M });
        critical.forEach((v, ci) => {
          const yy = doc.y;
          doc.rect(M, yy, CW, 16).fill(ci % 2 === 0 ? "#FFFFFF" : "#F4F6F8");
          doc.fontSize(8).font("Helvetica-Bold").fillColor("#111827").text(v.priority ? `P${v.priority}` : "—", M + 5, yy + 4, { width: 28 });
          doc.fontSize(8).font("Helvetica").fillColor("#111827")
            .text(`[${idText(v)}] ${v.note ?? "—"}  (${v.trade || "—"} · ${v.floor || "—"} · ${statusLabel(v.status)})`, M + 36, yy + 4, { width: CW - 42, height: 12, ellipsis: true, lineBreak: false });
          doc.y = yy + 16;
        });

        // Compact sign-off so even the one-pager ends with an approval block.
        if (doc.y + 70 > 535) { doc.addPage(); doc.y = 45; }
        const oY = doc.y + 14;
        doc.fontSize(10).font("Helvetica-Bold").fillColor("#111827").text("Approval & Sign-off", M, oY);
        const oSigW = (CW - 60) / 2;
        ["BIM Coordinator", "GC Representative"].forEach((role, i) => {
          const x = M + i * (oSigW + 60);
          doc.moveTo(x, oY + 40).lineTo(x + oSigW, oY + 40).strokeColor("#9CA3AF").lineWidth(0.7).stroke();
          doc.fontSize(8).font("Helvetica").fillColor("#6B7280").text("Signature / Name / Date", x, oY + 44);
          doc.fontSize(9).font("Helvetica-Bold").fillColor("#1E3A5F").text(role, x, oY + 20);
        });
        doc.y = oY + 58;
      } else {
        // ── MAIN VIEWPOINTS TABLE (shared drawTable helper) ──
        if (doc.y + 60 > 530) { doc.addPage(); doc.y = 40; }
        doc.fontSize(13).font("Helvetica-Bold").fillColor("#111827").text("Viewpoints Register", M, doc.y);
        doc.moveDown(0.4);

        const endY = drawTable(doc, {
          x: M,
          startY: doc.y,
          rows: vps,
          pageBottom: 535,
          columns: [
            { label: "ID", width: 88, bold: true, format: (v) => idText(v) },
            { label: "P", width: 26, align: "center", bold: true, format: (v) => (v.priority ? `P${v.priority}` : "—") },
            { label: "Trade", width: 78, format: (v) => v.trade || "—" },
            { label: "Report Type", width: 84, format: (v) => v.reportType || "—" },
            { label: "Floor", width: 78, format: (v) => v.floor || "—" },
            { label: "Note", width: 226, wrap: true, format: (v) => v.note || "—" },
            { label: "Status", width: 74, format: (v) => statusLabel(v.status) },
            { label: "Captured", width: 58, color: PALETTE.MUTED, format: (v) => fmtShort(v.capturedAt) },
          ],
          onPageBreak: () => {
            doc.addPage();
            doc.rect(0, 0, W, 25).fill(PALETTE.NAVY);
            doc.fontSize(8).font("Helvetica-Bold").fillColor("white").text(`${companyName} | ${project.name} (${project.code}) — Lens Viewpoints Report`, M, 8, { width: CW });
            return 35;
          },
        });
        doc.y = endY;

        // ── SIGNATURE BLOCK (last page) ──
        if (doc.y + 110 > 535) { doc.addPage(); doc.y = 45; }
        doc.moveDown(1);
        const sgY = doc.y + 10;
        doc.fontSize(11).font("Helvetica-Bold").fillColor("#111827").text("Approval & Sign-off", M, sgY);
        const blockY = sgY + 26;
        const sigW = (CW - 60) / 2;
        const sigBlocks = [
          { role: "BIM Coordinator" },
          { role: "GC Representative" },
        ];
        sigBlocks.forEach((b, i) => {
          const x = M + i * (sigW + 60);
          doc.moveTo(x, blockY + 34).lineTo(x + sigW, blockY + 34).strokeColor("#9CA3AF").lineWidth(0.7).stroke();
          doc.fontSize(8).font("Helvetica").fillColor("#6B7280").text("Signature", x, blockY + 38);
          doc.moveTo(x, blockY + 70).lineTo(x + sigW * 0.6, blockY + 70).strokeColor("#9CA3AF").lineWidth(0.7).stroke();
          doc.fontSize(8).font("Helvetica").fillColor("#6B7280").text("Name", x, blockY + 74);
          doc.moveTo(x + sigW * 0.65, blockY + 70).lineTo(x + sigW, blockY + 70).strokeColor("#9CA3AF").lineWidth(0.7).stroke();
          doc.fontSize(8).font("Helvetica").fillColor("#6B7280").text("Date", x + sigW * 0.65, blockY + 74);
          doc.fontSize(9).font("Helvetica-Bold").fillColor("#1E3A5F").text(b.role, x, blockY + 12);
        });

        // ── REVISION HISTORY APPENDIX (full report only) ──
        // Scope the appendix to the revision chains of the viewpoints actually in
        // this report: each in-scope row plus its superseded ancestors. Without
        // this, a filtered or active-only report would surface unrelated
        // project-wide revisions in the appendix.
        const supRows = await db.select({ id: lensViewpointsTable.id, supersedesId: lensViewpointsTable.supersedesId })
          .from(lensViewpointsTable)
          .where(eq(lensViewpointsTable.projectId, projectId));
        const supMap = new Map<number, number | null>(supRows.map(r => [r.id, r.supersedesId ?? null]));
        const scopeIds = new Set<number>();
        for (const v of vps) {
          let cur: number | null = v.id;
          for (let guard = 0; guard < 200 && cur != null && !scopeIds.has(cur); guard++) {
            scopeIds.add(cur);
            cur = supMap.get(cur) ?? null;
          }
        }
        const revEvents = (!includeRevisionHistory || scopeIds.size === 0) ? [] : await db.select().from(activityLogTable)
          .where(and(
            eq(activityLogTable.projectId, projectId),
            eq(activityLogTable.entityType, "lens_viewpoint"),
            inArray(activityLogTable.actionType, ["edit", "reassign", "voided"]),
            inArray(activityLogTable.entityId, Array.from(scopeIds)),
          ))
          .orderBy(desc(activityLogTable.createdAt));
        if (revEvents.length) {
          doc.addPage();
          doc.y = 45;
          doc.y = sectionBar(doc, "Revision History", doc.y, { margin: M });
          const actionLabel: Record<string, string> = { edit: "Edited", reassign: "Reassigned", voided: "Voided" };
          drawTable(doc, {
            x: M,
            startY: doc.y,
            rows: revEvents,
            pageBottom: 535,
            columns: [
              { label: "Date", width: 66, format: (e) => fmtShort(e.createdAt) },
              { label: "Action", width: 64, bold: true, format: (e) => actionLabel[e.actionType] || e.actionType },
              { label: "From", width: 120, wrap: true, format: (e) => e.fileNameBefore || "—" },
              { label: "To", width: 120, wrap: true, format: (e) => e.fileNameAfter || "—" },
              { label: "Reason", width: 170, wrap: true, format: (e) => e.details || "—" },
              { label: "By", width: 122, wrap: true, color: PALETTE.MUTED, format: (e) => e.userCompanyName ? `${e.userFullName} (${e.userCompanyName})` : e.userFullName },
            ],
            onPageBreak: () => {
              doc.addPage();
              doc.rect(0, 0, W, 25).fill(PALETTE.NAVY);
              doc.fontSize(8).font("Helvetica-Bold").fillColor("white").text(`${companyName} | ${project.name} (${project.code}) — Revision History`, M, 8, { width: CW });
              return 35;
            },
          });
        }
      }

      // ── WATERMARK + SHA + FOOTER on every page (shared helper) ──
      const footerDate = reportDate.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
      addPageNumbers(doc, {
        margin: M,
        watermarkText,
        contentHash,
        companyName,
        projectName: project.name,
        reportNumber,
        timestamp: footerDate,
      });

      doc.end();
    } catch (err) {
      console.error("[lens-pdf] FAILED:", err);
      if (!res.headersSent) res.status(500).json({ error: "lens_pdf_failed", message: err instanceof Error ? err.message : String(err) });
    }
  }
);

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
    let clashes = await db.select().from(clashesTable).where(and(eq(clashesTable.clashReportId, reportId), isNull(clashesTable.deletedAt)));
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
        await db.insert(activityLogTable).values({
          projectId,
          userId: req.user!.userId,
          userFullName: req.user!.fullName ?? "",
          userCompanyName: req.user!.companyName ?? "",
          actionType: "rerank",
          entityType: "clash_report",
          entityId: reportId,
          details: `Re-ranked clash report ${reportId} — AI assigned priorities to ${clashes.length} clashes`,
        });
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

router.patch("/projects/:projectId/clash-reports/:reportId/rename", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const reportId = Number(req.params.reportId);
  try {
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (req.body.fileName !== undefined) updates.fileName = req.body.fileName;
    if (req.body.reportNumber !== undefined) updates.reportNumber = req.body.reportNumber;
    const [updated] = await db.update(clashReportsTable)
      .set(updates)
      .where(and(eq(clashReportsTable.id, reportId), eq(clashReportsTable.projectId, projectId)))
      .returning();
    if (!updated) { res.status(404).json({ error: "not_found" }); return; }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.delete("/projects/:projectId/clash-reports/:reportId", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const reportId = Number(req.params.reportId);
  try {
    const [report] = await db.select().from(clashReportsTable).where(and(eq(clashReportsTable.id, reportId), eq(clashReportsTable.projectId, projectId)));
    if (!report) { res.status(404).json({ error: "not_found" }); return; }
    await db.delete(clashesTable).where(eq(clashesTable.clashReportId, reportId));
    await db.delete(clashReportsTable).where(eq(clashReportsTable.id, reportId));
    await db.insert(activityLogTable).values({
      projectId,
      userId: req.user!.userId,
      userFullName: req.user!.fullName ?? "",
      userCompanyName: req.user!.companyName ?? "",
      actionType: "delete",
      entityType: "clash_report",
      entityId: reportId,
      details: `Deleted clash report: ${report.fileName}`,
    });
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

      const { logoBase64, logoType } = await getCompanyLogo(userId);

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
      const doc = new PDFDocument({ size: "LETTER", layout: "landscape", margin: 40, bufferPages: true, autoFirstPage: true, margins: { top: 40, bottom: 50, left: 40, right: 40 } });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="clash-report-${project.code}-${reportId}.pdf"`);
      doc.pipe(res);

      const W = doc.page.width;
      const M = 40;
      const CW = W - M * 2;

      // ── COVER PAGE ──────────────────────────────────────────────────────
      // Dark header bar
      doc.rect(0, 0, W, 135).fill("#1E3A5F");

      // Company logo if available
      if (logoBase64 && logoType) {
        try {
          doc.image(logoBase64, M, 15, { height: 50, fit: [120, 50] });
          doc.fontSize(18).font("Helvetica-Bold").fillColor("white")
            .text(user?.companyName ?? "Company", M + 130, 22);
        } catch {
          doc.fontSize(30).font("Helvetica-Bold").fillColor("white")
            .text(user?.companyName ?? "Company", M, 20);
        }
      } else {
        doc.fontSize(30).font("Helvetica-Bold").fillColor("white")
          .text(user?.companyName ?? "Company", M, 20);
      }

      // Report title top right
      doc.fontSize(12).font("Helvetica-Bold").fillColor("white")
        .text("CLASH COORDINATION REPORT", M, 20, { align: "right", width: CW });

      // Separator line
      doc.moveTo(M, 62).lineTo(W - M, 62).strokeColor("#4B7EC8").lineWidth(0.5).stroke();

      // Prepared by and date
      doc.fontSize(9).font("Helvetica").fillColor("#BFDBFE")
        .text(`Prepared by: ${user?.fullName ?? ""}`, M, 70);
      doc.fontSize(9).font("Helvetica").fillColor("#BFDBFE")
        .text(new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), M, 84);
      doc.fontSize(9).font("Helvetica").fillColor("#BFDBFE")
        .text(user?.email ?? "", M, 70, { align: "right", width: CW });

      // Powered by — very subtle bottom right
      doc.fontSize(7.5).font("Helvetica").fillColor("#7BA4C8")
        .text("Powered by BIMLog | IgniteSmart.ai", M, 112, { align: "right", width: CW });

      // Project info band
      doc.rect(0, 135, W, 45).fill("#F0F4F8");

      // Project info section
      doc.fontSize(18).font("Helvetica-Bold").fillColor("#1E3A5F")
        .text(project.name, M, 143);
      doc.fontSize(10).font("Helvetica").fillColor("#6B7280")
        .text(`Project Code: ${project.code}  |  Source: ${report.fileName}  |  Total Clashes: ${report.totalClashes}`, M, 165);

      doc.y = 198;

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
        .text(`Report prepared by ${user?.fullName ?? "Unknown"} on ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, M);
      doc.moveDown(0.3);
      doc.moveTo(M, doc.y).lineTo(W - M, doc.y).strokeColor("#E5E7EB").lineWidth(1).stroke();
      doc.moveDown(0.5);

      doc.fontSize(13).font("Helvetica-Bold").fillColor("#111827").text("Clash Register", M);
      doc.moveDown(0.5);

      const cols = [
        { label: "Priority", w: 48 },
        { label: "Viewpoint", w: 60 },
        { label: "Description", w: 170 },
        { label: "Hold Ups", w: 80 },
        { label: "Trade", w: 55 },
        { label: "Floor", w: 70 },
        { label: "Status", w: 65 },
        { label: "Responsible", w: 80 },
        { label: "Deadline", w: 65 },
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
        const rowH = 26;
        if (doc.y + rowH > 530) {
          doc.addPage();
          doc.rect(0, 0, W, 25).fill("#1E3A5F");
          const pageDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
          doc.fontSize(8).font("Helvetica-Bold").fillColor("white")
            .text(`${user?.companyName ?? ""} | ${project.name} (${project.code}) — Clash Coordination Report`, M, 8, { width: CW - 100 });
          doc.fontSize(8).font("Helvetica").fillColor("#93C5FD")
            .text(pageDate, M, 8, { align: "right", width: CW });
          doc.y = 35;
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
          c.discipline1 ?? "—",
          c.level ?? "—",
          c.status ?? "—",
          c.assignedToName ?? "—",
          c.dueDate && !String(c.dueDate).startsWith("1970") ? new Date(c.dueDate).toLocaleDateString() : "—",
        ];
        vals.forEach((val, i) => {
          const colW = cols[i + 1].w - 4;
          const text = String(val);
          doc.fontSize(7).font("Helvetica").fillColor("#111827")
            .text(text, x + 2, rY + 4, { width: colW, height: rowH - 6, ellipsis: true, lineBreak: false });
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

      console.log("[pdf-debug] page.width:", doc.page.width, "page.height:", doc.page.height, "margins:", doc.page.margins);
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
      console.error("[clash-pdf] FAILED:", err);
      res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
    }
  }
);

// ── DELETE individual clash (soft delete) ─────────────────────────────────────
router.delete("/projects/:projectId/clash-reports/:reportId/clashes/:clashId",
  authMiddleware, requirePermission("admin", "write"), async (req, res) => {
    const projectId = Number(req.params.projectId);
    const reportId = Number(req.params.reportId);
    const clashId = Number(req.params.clashId);
    const reason = (req.body?.reason as string | undefined) ?? null;
    try {
      const [report] = await db.select({ id: clashReportsTable.id, projectId: clashReportsTable.projectId })
        .from(clashReportsTable)
        .where(and(eq(clashReportsTable.id, reportId), eq(clashReportsTable.projectId, projectId)));
      if (!report) { res.status(404).json({ error: "report_not_found" }); return; }

      const [existing] = await db.select().from(clashesTable)
        .where(and(eq(clashesTable.id, clashId), eq(clashesTable.clashReportId, reportId)));
      if (!existing) { res.status(404).json({ error: "not_found" }); return; }

      await db.update(clashesTable)
        .set({ deletedAt: new Date(), deleteReason: reason })
        .where(and(eq(clashesTable.id, clashId), eq(clashesTable.clashReportId, reportId)));

      await db.delete(linkedItemsTable).where(and(
        eq(linkedItemsTable.projectId, projectId),
        or(
          and(eq(linkedItemsTable.fromType, "clash"), eq(linkedItemsTable.fromId, clashId)),
          and(eq(linkedItemsTable.toType, "clash"), eq(linkedItemsTable.toId, clashId)),
        ),
      ));

      await db.insert(activityLogTable).values({
        projectId, userId: req.user!.userId,
        userFullName: req.user!.fullName ?? "",
        userCompanyName: req.user!.companyName ?? "",
        actionType: "delete", entityType: "clash", entityId: clashId,
        details: JSON.stringify({ reason, clashIdOriginal: existing.clashIdOriginal, description: existing.description }),
      });

      await db.insert(agentInsightsTable).values({
        projectId, agentType: "clash", entityType: "clash", entityId: clashId,
        insightType: "delete_pattern",
        message: `Clash ${existing.clashIdOriginal ?? clashId} deleted: ${reason ?? "no reason"}`,
        recommendation: "Review delete reason for false-positive clashes or workflow issues.",
        severity: "info",
      });

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  }
);

router.post("/projects/:projectId/clash-reports/plugin-sync",
  (req, _res, next) => {
    const raw = (req as unknown as { rawBody?: Buffer }).rawBody;
    try {
      if (req.body && typeof req.body === "object" && !Array.isArray(req.body) && req.body.clashes === undefined) {
        const keys = Object.keys(req.body);
        if (keys.length === 1 && (req.body as Record<string, unknown>)[keys[0]] === "" && keys[0].trim().startsWith("{")) {
          req.body = JSON.parse(keys[0]);
          console.log("[plugin-sync] recovered body from urlencoded key");
        }
      }
      if (req.body?.clashes === undefined && raw && raw.length) {
        const text = raw.toString("utf8").replace(/^\uFEFF/, "").trim();
        if (text.startsWith("{") || text.startsWith("[")) {
          try {
            req.body = JSON.parse(text);
            console.log("[plugin-sync] recovered body from raw bytes");
          } catch (parseErr) {
            const pos = (() => {
              const m = /position (\d+)/.exec(parseErr instanceof Error ? parseErr.message : "");
              return m ? Number(m[1]) : -1;
            })();
            if (pos >= 0) {
              console.error("[plugin-sync] malformed JSON near position", pos, "snippet:",
                JSON.stringify(text.slice(Math.max(0, pos - 40), pos + 40)));
            }
            const { repaired, fixes } = repairPluginJson(text);
            if (fixes > 0) {
              req.body = JSON.parse(repaired);
              console.warn("[plugin-sync] repaired", fixes, "JSON syntax defect(s) (locale decimal commas / trailing / double commas) from plugin payload");
            } else {
              throw parseErr;
            }
          }
        }
      }
    } catch (e) {
      console.error("[plugin-sync] body recovery failed:", e instanceof Error ? e.message : String(e));
    }
    console.log("[plugin-sync] hit - auth:", req.headers.authorization ? "PRESENT" : "MISSING",
      "content-type:", req.headers["content-type"] ?? "(none)",
      "content-length:", req.headers["content-length"] ?? "(none)",
      "rawBody bytes:", raw?.length ?? 0,
      "body keys:", req.body && typeof req.body === "object" ? Object.keys(req.body).slice(0, 10) : typeof req.body,
      "clashes:", Array.isArray(req.body?.clashes) ? req.body.clashes.length : "undefined",
      "first fingerprint:", req.body?.clashes?.[0]?.fingerprint);
    next();
  },
  authMiddleware,
  requirePermission("admin", "write"),
  async (req, res) => {
    const projectId = Number(req.params.projectId);
    try {
      const clashes: any[] = Array.isArray(req.body?.clashes) ? req.body.clashes : [];
      if (clashes.length === 0) {
        res.status(400).json({ error: "no_clashes", message: "Request body must include a non-empty clashes array" });
        return;
      }

      const today = new Date().toISOString().slice(0, 10);
      const reportName = `Plugin Sync - ${today}`;

      let [report] = await db.select().from(clashReportsTable)
        .where(and(eq(clashReportsTable.projectId, projectId), eq(clashReportsTable.fileName, reportName)));

      if (!report) {
        const existingReports = await db.select({ reportNumber: clashReportsTable.reportNumber }).from(clashReportsTable).where(eq(clashReportsTable.projectId, projectId));
        const [project] = await db.select({ code: projectsTable.code }).from(projectsTable).where(eq(projectsTable.id, projectId));
        const usedNums = new Set(existingReports.map(r => r.reportNumber).filter(Boolean));
        let seqNum = existingReports.length + 1;
        let autoNum = `${project?.code ?? "PRJ"}-CR-${String(seqNum).padStart(3, "0")}`;
        while (usedNums.has(autoNum)) {
          seqNum++;
          autoNum = `${project?.code ?? "PRJ"}-CR-${String(seqNum).padStart(3, "0")}`;
        }
        [report] = await db.insert(clashReportsTable).values({
          projectId,
          uploadedById: req.user!.userId,
          fileName: reportName,
          format: "plugin",
          totalClashes: 0,
          status: "complete",
          reportNumber: autoNum,
        }).returning();
      }

      let created = 0;
      let updated = 0;
      let fingerprinted = 0;
      const now = new Date();

      for (const c of clashes) {
        const fingerprint = c.fingerprint ? String(c.fingerprint) : null;
        if (fingerprint) fingerprinted++;

        const toNum = (v: any) => (v === undefined || v === null || v === "" || isNaN(Number(v)) ? null : Number(v));

        let existing: typeof clashesTable.$inferSelect | undefined;
        if (fingerprint) {
          [existing] = await db.select().from(clashesTable)
            .where(and(eq(clashesTable.projectId, projectId), eq(clashesTable.fingerprint, fingerprint)));
        }

        if (existing) {
          await db.update(clashesTable)
            .set({ status: c.status ?? existing.status, lastPluginSyncAt: now, updatedAt: now, deletedAt: null, deleteReason: null })
            .where(eq(clashesTable.id, existing.id));
          updated++;
        } else {
          await db.insert(clashesTable).values({
            clashReportId: report.id,
            projectId,
            clashIdOriginal: c.clashId != null ? String(c.clashId) : null,
            name: c.name ?? null,
            description: c.description ?? null,
            status: c.status ?? "open",
            testName: c.testName ?? null,
            element1Layer: c.element1Layer ?? null,
            element2Layer: c.element2Layer ?? null,
            element1Id: c.element1Id != null ? String(c.element1Id) : null,
            element2Id: c.element2Id != null ? String(c.element2Id) : null,
            gridLocation: c.gridLocation ?? null,
            distance: toNum(c.distance),
            positionX: toNum(c.positionX),
            positionY: toNum(c.positionY),
            positionZ: toNum(c.positionZ),
            priority: c.priority ?? null,
            fingerprint,
            discipline1: c.trade1 ?? null,
            discipline2: c.trade2 ?? null,
            lastPluginSyncAt: now,
          });
          created++;
        }
      }

      const [{ count: total }] = await db.select({ count: sql<number>`count(*)::int` }).from(clashesTable)
        .where(and(eq(clashesTable.clashReportId, report.id), isNull(clashesTable.deletedAt)));
      await db.update(clashReportsTable).set({ totalClashes: total, updatedAt: now }).where(eq(clashReportsTable.id, report.id));

      await db.insert(activityLogTable).values({
        projectId,
        userId: req.user!.userId,
        userFullName: req.user!.fullName ?? "",
        userCompanyName: req.user!.companyName ?? "",
        actionType: "plugin_sync",
        entityType: "clash_report",
        entityId: report.id,
        details: `Plugin sync (${reportName}): ${created} created, ${updated} updated, ${fingerprinted} fingerprinted`,
      });

      const response = { created, updated, fingerprinted, syncToken: now.toISOString(), message: "Sync complete" };
      console.log("[plugin-sync] sending response:", JSON.stringify(response));
      res.json(response);
    } catch (err) {
      res.status(500).json({ error: "plugin_sync_failed", message: err instanceof Error ? err.message : String(err) });
    }
  }
);

router.get("/projects/:projectId/clash-reports/plugin-pull",
  authMiddleware,
  requireProjectMember(),
  async (req, res) => {
    const projectId = Number(req.params.projectId);
    try {
      const rows = await db.select().from(clashesTable)
        .where(and(
          eq(clashesTable.projectId, projectId),
          isNull(clashesTable.deletedAt),
          sql`${clashesTable.fingerprint} IS NOT NULL`,
          sql`${clashesTable.lastPluginSyncAt} IS NOT NULL`,
          sql`${clashesTable.updatedAt} > ${clashesTable.lastPluginSyncAt}`,
        ));

      // BIMLog clash statuses: open, follow_up, waiting_design, in_progress, approved, resolved, wont_fix.
      // Only resolved/approved are "done" in Navisworks; every still-open state maps to Active so it
      // keeps appearing in future Navisworks clash runs. "open" is BIMLog's Active state.
      const toNavisworksStatus = (s: string | null): string => {
        switch (s) {
          case "resolved": return "Resolved";
          case "approved": return "Approved";
          case "new": return "New";
          default: return "Active";
        }
      };

      const clashes = rows.map(r => ({
        clashId: r.clashIdOriginal,
        fingerprint: r.fingerprint,
        newStatus: toNavisworksStatus(r.status),
        resolvedBy: r.assignedToName,
        notes: r.resolutionNotes,
      }));

      res.json(clashes);
    } catch (err) {
      res.status(500).json({ error: "plugin_pull_failed", message: err instanceof Error ? err.message : String(err) });
    }
  }
);

export default router;
