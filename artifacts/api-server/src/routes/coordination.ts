import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  coordinationIntakeEventsTable,
  namingConventionsTable,
  namingFieldsTable,
  projectsTable,
  usersTable,
  companiesTable,
} from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { authMiddleware, requireProjectMember } from "../middlewares/auth";
import Anthropic from "@anthropic-ai/sdk";
import multer from "multer";
import { PDFParse } from "pdf-parse";
import * as XLSX from "xlsx";
import { randomUUID } from "crypto";

const router: IRouter = Router();

// In-memory buffer cache. Key = UUID returned to client from /intake.
// Entry expires after 30 minutes to bound memory growth.
type CachedFile = {
  buffer: Buffer;
  originalFilename: string;
  fileType: string;
  fileSize: number;
  expiresAt: number;
};
const fileCache = new Map<string, CachedFile>();
const CACHE_TTL_MS = 30 * 60 * 1000;

function pruneCache() {
  const now = Date.now();
  for (const [k, v] of fileCache) {
    if (v.expiresAt < now) fileCache.delete(k);
  }
}

const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
}).single("file");

function detectFileType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (ext === "pdf") return "pdf";
  if (ext === "docx" || ext === "doc") return "docx";
  if (ext === "xlsx" || ext === "xls") return "xlsx";
  if (ext === "dwg") return "dwg";
  return "other";
}

async function extractText(buffer: Buffer, fileType: string): Promise<string> {
  if (fileType === "pdf") {
    try {
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const result = await parser.getText();
      return ((result as { text?: string }).text ?? "").trim();
    } catch { return ""; }
  }
  if (fileType === "xlsx") {
    try {
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const rows: string[] = [];
      for (const sheetName of workbook.SheetNames.slice(0, 3)) {
        const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName], { blankrows: false });
        const nonEmpty = csv.split("\n").filter((r: string) => r.replace(/,/g, "").trim()).slice(0, 100).join("\n");
        if (nonEmpty) rows.push(`[Sheet: ${sheetName}]\n${nonEmpty}`);
      }
      return rows.join("\n");
    } catch { return ""; }
  }
  return "";
}

// ── GET /projects/:projectId/coordination/events ─────────────────────────────
router.get(
  "/projects/:projectId/coordination/events",
  authMiddleware,
  requireProjectMember(),
  async (req, res) => {
    try {
      const projectId = parseInt(String(req.params.projectId), 10);
      if (isNaN(projectId)) { res.status(400).json({ error: "Invalid projectId" }); return; }

      const events = await db
        .select({
          id: coordinationIntakeEventsTable.id,
          originalFilename: coordinationIntakeEventsTable.originalFilename,
          finalFilename: coordinationIntakeEventsTable.finalFilename,
          proposedFilename: coordinationIntakeEventsTable.proposedFilename,
          fileType: coordinationIntakeEventsTable.fileType,
          aiConfidence: coordinationIntakeEventsTable.aiConfidence,
          warningsTriggered: coordinationIntakeEventsTable.warningsTriggered,
          userAction: coordinationIntakeEventsTable.userAction,
          destinationAction: coordinationIntakeEventsTable.destinationAction,
          uploaderCompany: coordinationIntakeEventsTable.uploaderCompany,
          uploaderId: coordinationIntakeEventsTable.uploaderId,
          uploaderName: usersTable.fullName,
          createdAt: coordinationIntakeEventsTable.createdAt,
        })
        .from(coordinationIntakeEventsTable)
        .leftJoin(usersTable, eq(usersTable.id, coordinationIntakeEventsTable.uploaderId))
        .where(eq(coordinationIntakeEventsTable.projectId, projectId))
        .orderBy(desc(coordinationIntakeEventsTable.createdAt))
        .limit(50);

      res.json(events.map(e => ({
        ...e,
        createdAt: e.createdAt.toISOString(),
      })));
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
    }
  }
);

// ── POST /projects/:projectId/coordination/intake ────────────────────────────
router.post(
  "/projects/:projectId/coordination/intake",
  authMiddleware,
  requireProjectMember(),
  (req, res, next) => {
    uploadMiddleware(req, res, (err) => {
      if (err) { res.status(400).json({ error: `File upload error: ${err instanceof Error ? err.message : String(err)}` }); return; }
      next();
    });
  },
  async (req, res) => {
    try {
      pruneCache();
      const projectId = parseInt(String(req.params.projectId), 10);
      if (isNaN(projectId)) { res.status(400).json({ error: "Invalid projectId" }); return; }

      const file = req.file;
      if (!file) { res.status(400).json({ error: "No file uploaded" }); return; }

      const fileType = detectFileType(file.originalname);

      // Load active convention
      const conventions = await db.select().from(namingConventionsTable)
        .where(eq(namingConventionsTable.projectId, projectId)).limit(1);
      if (conventions.length === 0 || !conventions[0].isActive) {
        res.status(400).json({ error: "No active convention for this project" });
        return;
      }
      const convention = conventions[0];
      const fields = await db.select().from(namingFieldsTable)
        .where(eq(namingFieldsTable.conventionId, convention.id))
        .orderBy(namingFieldsTable.fieldOrder);

      if (fields.length === 0) {
        res.status(400).json({ error: "Convention has no fields configured" });
        return;
      }

      // Load project context
      const projects = await db.select({ id: projectsTable.id, name: projectsTable.name, code: projectsTable.code })
        .from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
      if (projects.length === 0) { res.status(404).json({ error: "Project not found" }); return; }
      const project = projects[0];

      // Extract text
      const extracted = await extractText(file.buffer, fileType);
      const textSnippet = extracted ? extracted.slice(0, 3000) : "";

      // Cache the file buffer
      const cacheKey = randomUUID();
      fileCache.set(cacheKey, {
        buffer: file.buffer,
        originalFilename: file.originalname,
        fileType,
        fileSize: file.size,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });

      // Build prompt
      const fieldsBlock = fields.map(f =>
        `- ${f.label}: allowedValues = [${(f.allowedValues || []).map(v => JSON.stringify(v)).join(", ")}]`
      ).join("\n");

      const systemPrompt = `You are BIMLog's coordination intelligence engine. Your job is to analyze an uploaded construction document and propose a corrected compliant filename based on the project's active naming convention. You must use all available signals together: the original filename, the extracted document text, the project context, and the convention rules. Never guess randomly — reason from evidence. Return only valid JSON.`;

      const userPrompt = `PROJECT CONTEXT:
- Name: ${project.name}
- Code: ${project.code}

CONVENTION:
- Separator: "${convention.separator}"
- Fields (in order):
${fieldsBlock}

ORIGINAL FILENAME: ${file.originalname}

EXTRACTED DOCUMENT TEXT (first 3000 chars):
${textSnippet || "(no extractable text — base inference on filename + project context only)"}

TASK:
Propose the corrected compliant filename, field-by-field. For each field, pick a value from its allowedValues whenever possible. If the evidence does not clearly map to one allowed value, mark that field as "low" confidence and pick the closest match. If two or more allowed values are equally plausible OR if the evidence contradicts the project context (e.g. wrong project code, wrong discipline), set "severe": true and explain in "severeReason".

Return ONLY this JSON shape (no markdown, no code block):
{
  "proposedFields": [
    { "fieldLabel": "string", "proposedValue": "string", "confidence": "high|medium|low", "reasoning": "string" }
  ],
  "proposedFilename": "string",
  "overallConfidence": "high|medium|low",
  "severe": true,
  "severeReason": "string or null",
  "aiSummary": "2-3 sentence summary of document content",
  "detectedDiscipline": "string or null",
  "detectedDocType": "string or null",
  "detectedLevel": "string or null",
  "detectedOriginator": "string or null",
  "keywords": ["array", "of", "strings"]
}`;

      const anthropic = new Anthropic({
        apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || "dummy",
        baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
      });

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });

      const block = message.content[0];
      if (block.type !== "text") {
        res.status(500).json({ error: "No text response from AI" });
        return;
      }

      let parsed: Record<string, unknown>;
      try { parsed = JSON.parse(block.text.trim()); }
      catch {
        res.status(422).json({ error: "AI returned non-JSON response", raw: block.text.slice(0, 500) });
        return;
      }

      res.json({
        cacheKey,
        originalFilename: file.originalname,
        fileType,
        fileSize: file.size,
        conventionId: convention.id,
        conventionSnapshot: {
          separator: convention.separator,
          fields: fields.map(f => ({ label: f.label, fieldOrder: f.fieldOrder, allowedValues: f.allowedValues })),
        },
        analysis: parsed,
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Intake failed" });
    }
  }
);

// ── POST /projects/:projectId/coordination/confirm ───────────────────────────
router.post(
  "/projects/:projectId/coordination/confirm",
  authMiddleware,
  requireProjectMember(),
  async (req, res) => {
    try {
      pruneCache();
      const projectId = parseInt(String(req.params.projectId), 10);
      if (isNaN(projectId)) { res.status(400).json({ error: "Invalid projectId" }); return; }

      const {
        cacheKey,
        userAction,
        finalFilename,
        manualFieldsChanged,
        destinationAction,
        proposedFilename,
        analysis,
        conventionId,
        conventionSnapshot,
        warningAcknowledged,
      } = req.body as {
        cacheKey: string;
        userAction: "accepted" | "manually_corrected" | "rejected";
        finalFilename: string;
        manualFieldsChanged?: Record<string, string>;
        destinationAction: "downloaded" | "queued_sync" | "pending";
        proposedFilename?: string;
        analysis?: Record<string, unknown>;
        conventionId?: number;
        conventionSnapshot?: unknown;
        warningAcknowledged?: boolean;
      };

      if (!cacheKey) { res.status(400).json({ error: "cacheKey is required" }); return; }
      if (!userAction || !["accepted", "manually_corrected", "rejected"].includes(userAction)) {
        res.status(400).json({ error: "userAction must be accepted, manually_corrected, or rejected" });
        return;
      }

      const cached = fileCache.get(cacheKey);
      if (!cached) { res.status(410).json({ error: "Upload session expired — please re-upload the file" }); return; }

      // Lookup uploader's company
      const userRows = await db.select({ id: usersTable.id, companyId: usersTable.companyId })
        .from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
      let uploaderCompany: string | null = null;
      if (userRows[0]?.companyId) {
        const companyRows = await db.select({ name: companiesTable.name })
          .from(companiesTable).where(eq(companiesTable.id, userRows[0].companyId)).limit(1);
        uploaderCompany = companyRows[0]?.name ?? null;
      }

      const sev = analysis && typeof analysis.severe === "boolean" ? analysis.severe : false;
      const conf = analysis && typeof analysis.overallConfidence === "string" ? analysis.overallConfidence : null;
      const sevReason = analysis && typeof analysis.severeReason === "string" ? analysis.severeReason : null;
      const detected = analysis as Record<string, unknown> | undefined;

      const warningDetailParts: string[] = [];
      if (sev && sevReason) warningDetailParts.push(`severe: ${sevReason}`);
      if (warningAcknowledged) warningDetailParts.push("user_acknowledged_severe_warning");

      const inserted = await db.insert(coordinationIntakeEventsTable).values({
        projectId,
        uploaderId: req.user!.userId,
        uploaderCompany,
        originalFilename: cached.originalFilename,
        proposedFilename: proposedFilename ?? null,
        finalFilename: userAction === "rejected" ? null : finalFilename,
        fileType: cached.fileType,
        fileSizeBytes: cached.fileSize,
        detectedDiscipline: detected?.detectedDiscipline as string | null ?? null,
        detectedDocType: detected?.detectedDocType as string | null ?? null,
        detectedLevel: detected?.detectedLevel as string | null ?? null,
        detectedOriginator: detected?.detectedOriginator as string | null ?? null,
        aiConfidence: conf,
        aiSummary: detected?.aiSummary as string | null ?? null,
        aiExtractedKeywords: detected?.keywords ? JSON.stringify(detected.keywords) : null,
        warningsTriggered: sev,
        warningDetail: warningDetailParts.length ? warningDetailParts.join(" | ") : null,
        userAction,
        manualFieldsChanged: manualFieldsChanged ? JSON.stringify(manualFieldsChanged) : null,
        destinationAction: userAction === "rejected" ? "pending" : destinationAction,
        conventionId: conventionId ?? null,
        conventionSnapshot: conventionSnapshot ? JSON.stringify(conventionSnapshot) : null,
      }).returning({ id: coordinationIntakeEventsTable.id });

      const eventId = inserted[0].id;

      // Download path: serve the file inline
      if (userAction !== "rejected" && destinationAction === "downloaded" && finalFilename) {
        const buf = cached.buffer;
        // Free the cache slot now that download is being served
        fileCache.delete(cacheKey);
        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader("Content-Disposition", `attachment; filename="${finalFilename.replace(/"/g, "")}"`);
        res.setHeader("X-Coordination-Event-Id", String(eventId));
        res.send(buf);
        return;
      }

      // Otherwise just confirm the log was written
      fileCache.delete(cacheKey);
      res.json({ ok: true, eventId });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Confirm failed" });
    }
  }
);

export default router;
