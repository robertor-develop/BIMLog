import { Router, type IRouter } from "express";
import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import multer from "multer";
import { db } from "@workspace/db";
import { filesTable, namingConventionsTable, namingFieldsTable, activityLogTable, usersTable, companiesTable, rfisTable, projectsTable, projectMembersTable } from "@workspace/db/schema";
import { sendEmail, makeNamingViolationEmail, getUserLang, notifEnabled } from "../lib/email";
import { eq, and } from "drizzle-orm";
import { ListFilesParams, UpdateFileParams, UpdateFileBody, DeleteFileParams } from "@workspace/api-zod";
import { authMiddleware, requireProjectMember, requirePermission } from "../middlewares/auth";
import { getDefaultValue, validateConfigValue } from "../middlewares/config-validator";
import { PDFParse as PDFParseClass } from "pdf-parse";
import PDFDocument from "pdfkit";
import Anthropic from "@anthropic-ai/sdk";

async function pdfParse(buffer: Buffer) {
  const parser = new PDFParseClass({ data: buffer, verbosity: 0 });
  const result = await parser.getText();
  await parser.destroy();
  return result;
}

const router: IRouter = Router();

const uploadsRoot = path.resolve("uploads");
const uploadMiddleware = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const projectId = (req.params as { projectId: string }).projectId;
      const dir = path.join(uploadsRoot, "projects", projectId, "files");
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const ext = path.extname(file.originalname) || "";
      cb(null, `${unique}${ext}`);
    },
  }),
});

const BIM_EXTENSIONS = new Set(["rvt", "nwd", "dwg", "ifc", "dxf", "nwf", "nwc", "rfa", "rte"]);

// ── File type tier classification ────────────────────────────────────────────
const TIER_A = new Set(["rvt", "nwd", "dwg", "ifc", "nwf", "nwc", "rfa", "rte", "dxf"]);
const TIER_B = new Set(["pdf", "docx", "doc", "xlsx", "xls", "pptx", "ppt", "dwf", "skp"]);
function getFileTypeTier(fileName: string): string {
  const ext = (fileName.split(".").pop() || "").toLowerCase();
  if (TIER_A.has(ext)) return "A";
  if (TIER_B.has(ext)) return "B";
  return "C";
}

interface ValidationDetail {
  field: string;
  message: string;
  expected?: string[];
  received: string;
}

async function validateFileName(projectId: number, fileName: string): Promise<{ valid: boolean; details?: ValidationDetail[] }> {
  const conventions = await db
    .select()
    .from(namingConventionsTable)
    .where(and(eq(namingConventionsTable.projectId, projectId), eq(namingConventionsTable.isActive, true)))
    .limit(1);

  if (conventions.length === 0) {
    return { valid: true };
  }

  const convention = conventions[0];
  const fields = await db
    .select()
    .from(namingFieldsTable)
    .where(eq(namingFieldsTable.conventionId, convention.id))
    .orderBy(namingFieldsTable.fieldOrder);

  if (fields.length === 0) {
    return { valid: true };
  }

  const sep = convention.separator;
  const nameWithoutExt = fileName.includes(".") ? fileName.substring(0, fileName.lastIndexOf(".")) : fileName;
  const errors: ValidationDetail[] = [];
  let remaining = nameWithoutExt;

  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    const allowed = field.allowedValues as string[];
    const isLast = i === fields.length - 1;

    if (allowed.length > 0) {
      const sorted = [...allowed].sort((a, b) => b.length - a.length);
      let matched = false;

      for (const value of sorted) {
        if (isLast) {
          if (remaining === value) {
            remaining = "";
            matched = true;
            break;
          }
        } else {
          const prefix = value + sep;
          if (remaining.startsWith(prefix)) {
            remaining = remaining.slice(prefix.length);
            matched = true;
            break;
          }
        }
      }

      if (!matched) {
        const nextSep = remaining.indexOf(sep);
        const actualValue = nextSep >= 0 ? remaining.slice(0, nextSep) : remaining;
        errors.push({
          field: field.label,
          message: `Value "${actualValue}" is not allowed for field "${field.label}"`,
          expected: allowed,
          received: actualValue,
        });
        remaining = nextSep >= 0 ? remaining.slice(nextSep + sep.length) : "";
      }
    } else {
      const nextSep = remaining.indexOf(sep);
      if (isLast) {
        remaining = "";
      } else if (nextSep >= 0) {
        remaining = remaining.slice(nextSep + sep.length);
      } else {
        errors.push({
          field: field.label,
          message: `Missing value for field "${field.label}"`,
          expected: [],
          received: "",
        });
        remaining = "";
      }
    }
  }

  if (remaining.length > 0) {
    errors.push({
      field: "fileName",
      message: `Unexpected extra content "${remaining}" — too many segments`,
      expected: [],
      received: remaining,
    });
  }

  if (errors.length > 0) {
    return { valid: false, details: errors };
  }

  return { valid: true };
}

// Parse file name against the active naming convention and return field→value map
async function parseFileNameMetadata(projectId: number, fileName: string): Promise<Record<string, unknown> | null> {
  const conventions = await db
    .select()
    .from(namingConventionsTable)
    .where(and(eq(namingConventionsTable.projectId, projectId), eq(namingConventionsTable.isActive, true)))
    .limit(1);

  if (conventions.length === 0) return null;

  const convention = conventions[0];
  const fields = await db
    .select()
    .from(namingFieldsTable)
    .where(eq(namingFieldsTable.conventionId, convention.id))
    .orderBy(namingFieldsTable.fieldOrder);

  if (fields.length === 0) return null;

  const sep = convention.separator;
  const ext = fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase() : "";
  const nameWithoutExt = fileName.includes(".") ? fileName.substring(0, fileName.lastIndexOf(".")) : fileName;

  const parsedFields: Record<string, string> = {};
  let remaining = nameWithoutExt;

  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    const allowed = field.allowedValues as string[];
    const isLast = i === fields.length - 1;

    if (allowed.length > 0) {
      const sorted = [...allowed].sort((a, b) => b.length - a.length);
      let matched = false;
      for (const value of sorted) {
        if (isLast) {
          if (remaining === value) {
            parsedFields[field.label] = value;
            remaining = "";
            matched = true;
            break;
          }
        } else {
          const prefix = value + sep;
          if (remaining.startsWith(prefix)) {
            parsedFields[field.label] = value;
            remaining = remaining.slice(prefix.length);
            matched = true;
            break;
          }
        }
      }
      if (!matched) {
        const nextSep = remaining.indexOf(sep);
        const actualValue = nextSep >= 0 ? remaining.slice(0, nextSep) : remaining;
        parsedFields[field.label] = actualValue;
        remaining = nextSep >= 0 ? remaining.slice(nextSep + sep.length) : "";
      }
    } else {
      const nextSep = remaining.indexOf(sep);
      if (isLast) {
        parsedFields[field.label] = remaining;
        remaining = "";
      } else if (nextSep >= 0) {
        parsedFields[field.label] = remaining.slice(0, nextSep);
        remaining = remaining.slice(nextSep + sep.length);
      }
    }
  }

  return {
    fields: parsedFields,
    fileExtension: ext,
    separator: sep,
    conventionId: convention.id,
    parsedAt: new Date().toISOString(),
  };
}

// Synchronous processing — runs inside the request cycle, guarantees CVR is non-null on exit
async function processFileFromDisk(fileId: number, filePath: string, fileName: string, projectId: number, uploadedById: number): Promise<void> {
  const ext = (fileName.split(".").pop() || "").toLowerCase();
  try {
    if (ext === "pdf") {
      const buffer = fs.readFileSync(filePath);
      let extractedText: string | null = null;
      try {
        const result = await pdfParse(buffer);
        extractedText = result.text?.trim() || null;
      } catch (err) {
        console.error(`[files] extraction failed fileId=${fileId}`, err);
        await db.update(filesTable).set({
          contentVerificationResult: "not_applicable",
          hashComparisonNote: "Extraction failed",
          updatedAt: new Date(),
        }).where(eq(filesTable.id, fileId));
        return;
      }
      if (extractedText && extractedText.length > 50) {
        await db.update(filesTable).set({ extractedText, updatedAt: new Date() }).where(eq(filesTable.id, fileId));
        await runContentVerification(fileId, projectId, fileName, extractedText, uploadedById);
      } else {
        await db.update(filesTable).set({
          contentVerificationResult: "not_applicable",
          hashComparisonNote: "PDF parsed but no usable text",
          updatedAt: new Date(),
        }).where(eq(filesTable.id, fileId));
      }
    } else {
      await runBimFallbackCvr(fileId, fileName, projectId);
    }
  } catch (err) {
    console.error(`[files] extraction failed fileId=${fileId}`, err);
    await db.update(filesTable).set({
      contentVerificationResult: "not_applicable",
      hashComparisonNote: "Extraction failed",
      updatedAt: new Date(),
    }).where(eq(filesTable.id, fileId));
  }
}

async function runContentVerification(fileId: number, projectId: number, fileName: string, extractedText: string, uploadedById: number): Promise<void> {
  try {
    // First 500 words
    const words = extractedText.split(/\s+/).filter(Boolean);
    const snippet = words.slice(0, 500).join(" ");

    const anthropic = new Anthropic({
      apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY!,
      baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
    });

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: `You are a BIM document integrity checker. Your ONLY job is to compare a file name against extracted document content and return one of exactly three results.

File name: ${fileName}
Extracted content (first 500 words):
${snippet}

You MUST return exactly one of these three results:
- "match" — the content clearly matches what the filename describes
- "possible_mismatch" — there is some doubt, partial match, or insufficient content to confirm
- "clear_mismatch" — the content is clearly unrelated to the filename

CRITICAL RULES:
- ALWAYS return valid JSON. Never return markdown, never wrap in backticks, never add text outside the JSON.
- NEVER return "not_applicable". That value does not exist. Use "possible_mismatch" if unsure.
- Return ONLY this exact JSON object, nothing else before or after it:
{"result": "match" | "possible_mismatch" | "clear_mismatch", "reason": "one sentence explanation"}`,
        },
      ],
    });

    const rawText = message.content[0].type === "text" ? message.content[0].text.trim() : "";

    let cleaned = rawText.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```json/, "").replace(/^```/, "").replace(/```$/, "").trim();
    }

    let parsedRaw: { result: string; reason: string } | undefined;
    try {
      parsedRaw = JSON.parse(cleaned) as { result: string; reason: string };
    } catch (err) {
      console.error("[files] JSON parse failed after cleaning:", cleaned);
      await db.update(filesTable)
        .set({ contentVerificationResult: "not_applicable", hashComparisonNote: "AI returned invalid JSON", updatedAt: new Date() })
        .where(eq(filesTable.id, fileId));
      return;
    }

    if (!parsedRaw || !parsedRaw.result) {
      await db.update(filesTable)
        .set({ contentVerificationResult: "not_applicable", hashComparisonNote: "AI response missing result field", updatedAt: new Date() })
        .where(eq(filesTable.id, fileId));
      return;
    }

    const validResults = ["match", "possible_mismatch", "clear_mismatch"];
    if (!validResults.includes(parsedRaw.result)) {
      parsedRaw.result = "possible_mismatch";
      parsedRaw.reason = "Result normalized — AI returned unexpected value: " + parsedRaw.result;
    }

    await db.update(filesTable)
      .set({ contentVerificationResult: parsedRaw.result as "match" | "possible_mismatch" | "clear_mismatch" | "not_applicable", hashComparisonNote: parsedRaw.reason || null, updatedAt: new Date() })
      .where(eq(filesTable.id, fileId));

    const result = (["match", "possible_mismatch", "clear_mismatch"].includes(parsedRaw.result)
      ? parsedRaw.result
      : "not_applicable") as "match" | "possible_mismatch" | "clear_mismatch" | "not_applicable";
    const reason = parsedRaw.reason || "";
    console.log(`[files] AI content verification for file ${fileId} (${fileName}): ${result}`);

    // ── Flag mismatch: insert activity log + notify project admins ───────────
    if (result === "possible_mismatch" || result === "clear_mismatch") {
      // Get uploader info for activity log
      const [uploader] = await db.select().from(usersTable).where(eq(usersTable.id, uploadedById)).limit(1);
      const uploaderName = uploader?.fullName || "Unknown User";
      let uploaderCompany = "";
      if (uploader) {
        const [uploaderCo] = await db.select().from(companiesTable).where(eq(companiesTable.id, uploader.companyId)).limit(1);
        uploaderCompany = uploaderCo?.name || "";
      }

      const severity = result === "clear_mismatch" ? "⚠️ CLEAR MISMATCH" : "⚠️ Possible Mismatch";
      const details = `AI content verification flagged file "${fileName}" — ${severity}. ${reason} File has been marked for coordinator review.`;

      // Activity log entry — flagging event
      await db.insert(activityLogTable).values({
        projectId,
        userId: uploadedById,
        userFullName: uploaderName,
        userCompanyName: uploaderCompany,
        actionType: "content_verification_flag",
        entityType: "file",
        entityId: fileId,
        fileNameAfter: fileName,
        details,
      });

      // Notify all project admins via activity log
      const adminMembers = await db
        .select({ userId: projectMembersTable.userId })
        .from(projectMembersTable)
        .where(and(eq(projectMembersTable.projectId, projectId), eq(projectMembersTable.role, "admin")));

      for (const adminMember of adminMembers) {
        if (adminMember.userId === uploadedById) continue; // skip if uploader is admin
        const [adminUser] = await db.select().from(usersTable).where(eq(usersTable.id, adminMember.userId)).limit(1);
        if (!adminUser) continue;
        const [adminCo] = await db.select().from(companiesTable).where(eq(companiesTable.id, adminUser.companyId)).limit(1);
        await db.insert(activityLogTable).values({
          projectId,
          userId: adminMember.userId,
          userFullName: adminUser.fullName,
          userCompanyName: adminCo?.name || "",
          actionType: "content_verification_notification",
          entityType: "file",
          entityId: fileId,
          fileNameAfter: fileName,
          details: `📢 Coordinator alert: ${details}`,
        });
      }
    }
  } catch (err) {
    console.error(`[files] AI content verification failed for file ${fileId}:`, err instanceof Error ? err.message : err);
    await db.update(filesTable).set({ contentVerificationResult: "not_applicable", updatedAt: new Date() }).where(eq(filesTable.id, fileId));
  }
}

// BIM file CVR fallback — re-validates naming convention and maps violation count to CVR
async function runBimFallbackCvr(fileId: number, fileName: string, projectId: number): Promise<void> {
  const validation = await validateFileName(projectId, fileName);
  let cvr: "match" | "possible_mismatch" | "clear_mismatch" | "not_applicable";
  if (validation.valid) {
    cvr = "match";
  } else {
    const violationCount = validation.details?.length ?? 0;
    if (violationCount === 0) {
      cvr = "not_applicable";
    } else if (violationCount <= 2) {
      cvr = "possible_mismatch";
    } else {
      cvr = "clear_mismatch";
    }
  }
  await db.update(filesTable)
    .set({ contentVerificationResult: cvr, updatedAt: new Date() })
    .where(eq(filesTable.id, fileId));
  console.log(`[files] BIM fallback CVR for file ${fileId}: ${cvr}`);
}

// ─── GET /projects/:projectId/files ─────────────────────────────────────────
router.get("/projects/:projectId/files", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const { projectId } = ListFilesParams.parse({ projectId: req.params.projectId });

    const files = await db.query.filesTable.findMany({
      where: eq(filesTable.projectId, projectId),
      orderBy: (files, { desc }) => [desc(files.createdAt)],
    });

    const results = await Promise.all(
      files.map(async (f) => {
        const users = await db.select().from(usersTable).where(eq(usersTable.id, f.uploadedById)).limit(1);
        let uploadedByName = "";
        let uploadedByCompany = "";
        if (users.length > 0) {
          uploadedByName = users[0].fullName;
          const companies = await db.select().from(companiesTable).where(eq(companiesTable.id, users[0].companyId)).limit(1);
          uploadedByCompany = companies[0]?.name || "";
        }
        return {
          ...f,
          uploadedByName,
          uploadedByCompany,
          createdAt: f.createdAt.toISOString(),
          updatedAt: f.updatedAt.toISOString(),
          documentRelationshipDeclaredAt: f.documentRelationshipDeclaredAt?.toISOString() ?? null,
        };
      })
    );

    res.json(results);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

// Helper: extract base name (without extension, lower-cased for comparison)
function getBaseName(fileName: string): string {
  return (fileName.includes(".") ? fileName.substring(0, fileName.lastIndexOf(".")) : fileName).toLowerCase();
}

// ─── GET /projects/:projectId/files/:fileId/download ─────────────────────────
router.get("/projects/:projectId/files/:fileId/download", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    const fileId = parseInt(String(req.params.fileId), 10);

    const [file] = await db.select().from(filesTable)
      .where(and(eq(filesTable.id, fileId), eq(filesTable.projectId, projectId)))
      .limit(1);

    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    // Only system-generated response docs can be downloaded — generate on the fly
    if (file.source !== "system-generated" || !file.linkedRfiId) {
      res.status(501).json({ error: "Binary download not available — only system-generated documents can be downloaded directly." });
      return;
    }

    // Load the linked RFI and project, then stream the response PDF
    const [rfi] = await db.select().from(rfisTable).where(eq(rfisTable.id, file.linkedRfiId)).limit(1);
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);

    if (!rfi) {
      res.status(404).json({ error: "Linked RFI not found" });
      return;
    }

    const MARGIN = 50;
    const LETTER_WIDTH = 612;
    const LETTER_HEIGHT = 792;

    const fmtD = (d: Date | string | null | undefined) =>
      d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—";

    const doc = new PDFDocument({ margin: MARGIN, size: "LETTER", autoFirstPage: true });
    doc.page.margins.bottom = 0;
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => {
      const pdfBuffer = Buffer.concat(chunks);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${file.fileName}"`);
      res.setHeader("Content-Length", pdfBuffer.length);
      res.send(pdfBuffer);
    });

    let y = MARGIN;
    const contentW = LETTER_WIDTH - MARGIN * 2;

    // Header bar
    doc.rect(MARGIN, y, contentW, 36).fill("#0F4C75");
    doc.fillColor("white").fontSize(14).font("Helvetica-Bold")
      .text("OFFICIAL RESPONSE DOCUMENT", MARGIN + 10, y + 6, { lineBreak: false });
    doc.fontSize(9).font("Helvetica")
      .text(`${rfi.number}  |  ${project?.name || ""}`, MARGIN + 10, y + 23, { lineBreak: false });
    doc.fillColor("black");
    y += 44;

    // Info rows
    const half = contentW / 2 - 2;
    const drawInfoRow = (l1: string, v1: string, l2: string, v2: string) => {
      const lw = half * 0.38;
      doc.rect(MARGIN, y, lw, 16).fill("#F1F5F9");
      doc.fillColor("#64748B").fontSize(7).font("Helvetica-Bold").text(l1.toUpperCase(), MARGIN + 3, y + 4.5, { width: lw - 4, lineBreak: false });
      doc.fillColor("#1E293B").fontSize(8).font("Helvetica").text(v1, MARGIN + lw + 3, y + 4.5, { width: half - lw - 6, lineBreak: false });
      const col2x = MARGIN + half + 4;
      doc.rect(col2x, y, lw, 16).fill("#F1F5F9");
      doc.fillColor("#64748B").fontSize(7).font("Helvetica-Bold").text(l2.toUpperCase(), col2x + 3, y + 4.5, { width: lw - 4, lineBreak: false });
      doc.fillColor("#1E293B").fontSize(8).font("Helvetica").text(v2, col2x + lw + 3, y + 4.5, { width: half - lw - 6, lineBreak: false });
      y += 16;
    };
    drawInfoRow("RFI #", rfi.number, "Subject", rfi.subject);
    drawInfoRow("Submitted By", `${rfi.submittedByCompany || "—"} / ${rfi.submittedByContact || "—"}`, "Submitted To", `${rfi.submittedToCompany || "—"} / ${rfi.submittedToPerson || "—"}`);
    y += 6;

    // Question
    doc.rect(MARGIN, y, contentW, 14).fill("#E2E8F0");
    doc.fillColor("#1E3A5F").fontSize(7.5).font("Helvetica-Bold").text("DESCRIPTION OF QUESTION", MARGIN + 6, y + 3.5);
    y += 14;
    const questionText = rfi.question || rfi.description || "No description provided.";
    const questionH = Math.min(doc.heightOfString(questionText, { width: contentW - 12 }) + 12, 120);
    doc.rect(MARGIN, y, contentW, questionH).stroke("#E2E8F0");
    doc.fillColor("#1E293B").fontSize(9).font("Helvetica").text(questionText, MARGIN + 6, y + 6, { width: contentW - 12 });
    y += questionH + 8;

    // Response
    doc.rect(MARGIN, y, contentW, 14).fill("#0F4C75");
    doc.fillColor("white").fontSize(7.5).font("Helvetica-Bold").text("OFFICIAL RESPONSE", MARGIN + 6, y + 3.5);
    y += 14;
    const respText = rfi.answer || rfi.response || "";
    if (respText) {
      const respH = Math.min(doc.heightOfString(respText, { width: contentW - 12 }) + 12, 160);
      doc.rect(MARGIN, y, contentW, respH).fillAndStroke("#F0FDF4", "#86EFAC");
      doc.fillColor("#14532D").fontSize(9).font("Helvetica").text(respText, MARGIN + 6, y + 6, { width: contentW - 12 });
      y += respH + 6;
    } else {
      doc.rect(MARGIN, y, contentW, 80).stroke("#E2E8F0");
      y += 84;
    }

    // Signature row
    const segW = contentW / 4;
    const sigLabels = ["ANSWERED BY", "DATE OF RESPONSE", "COST IMPACT", "SCHEDULE IMPACT"];
    const sigVals = [
      rfi.answeredBy || "—",
      fmtD(rfi.dateAnswered || rfi.respondedAt),
      rfi.costImpact || "—",
      rfi.scheduleImpact ? `${rfi.scheduleImpact}${rfi.scheduleImpactDays != null ? ` (${rfi.scheduleImpactDays}d)` : ""}` : "—",
    ];
    doc.rect(MARGIN, y, contentW, 14).fill("#F1F5F9");
    sigLabels.forEach((lbl, i) => {
      doc.fillColor("#64748B").fontSize(6.5).font("Helvetica-Bold")
        .text(lbl, MARGIN + i * segW + 4, y + 3.5, { width: segW - 6, lineBreak: false });
    });
    y += 14;
    doc.rect(MARGIN, y, contentW, 20).stroke("#E2E8F0");
    sigVals.forEach((val, i) => {
      if (val) doc.fillColor("#1E293B").fontSize(8.5).font("Helvetica").text(val, MARGIN + i * segW + 4, y + 5, { width: segW - 8, lineBreak: false });
      if (i < 3) doc.moveTo(MARGIN + (i + 1) * segW, y).lineTo(MARGIN + (i + 1) * segW, y + 20).stroke("#E2E8F0");
    });

    doc.fillColor("#94A3B8").fontSize(7).font("Helvetica")
      .text(`Generated by BIMLog by IgniteSmart  |  ${rfi.number} — Official Response  |  ${new Date().toLocaleDateString()}`,
        MARGIN, LETTER_HEIGHT - 30, { width: contentW, align: "center", lineBreak: false });
    doc.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

// ─── POST /projects/:projectId/files/suggest-name ────────────────────────────
router.post("/projects/:projectId/files/suggest-name", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const { projectId } = ListFilesParams.parse({ projectId: req.params.projectId });
    const { fileName, fileContent, validationDetails, extractedText: bodyExtractedText, contentVerificationResult: bodyContentVerification, manualExplanation } = req.body as {
      fileName?: string;
      fileContent?: string;
      validationDetails?: Array<{ field: string; message: string; expected?: string[]; received: string }>;
      extractedText?: string;
      contentVerificationResult?: string;
      manualExplanation?: string;
    };
    if (!fileName || typeof fileName !== "string") {
      res.status(400).json({ error: "fileName is required" });
      return;
    }

    // Resolve extractedText — prefer body-provided value (existing file), fall back to PDF parsing (new upload)
    let extractedText = "";
    if (bodyExtractedText && bodyExtractedText.trim()) {
      extractedText = bodyExtractedText.trim().slice(0, 2000);
    } else if (fileContent && fileName.toLowerCase().endsWith(".pdf")) {
      try {
        const buf = Buffer.from(fileContent, "base64");
        const parser = new PDFParse({ data: buf, verbosity: 0 });
        const result = await parser.getText();
        await parser.destroy();
        extractedText = (result.text || "").trim().slice(0, 2000);
      } catch {
        extractedText = "";
      }
    }

    // Load active convention fields
    const conventions = await db.select().from(namingConventionsTable)
      .where(and(eq(namingConventionsTable.projectId, projectId), eq(namingConventionsTable.isActive, true)))
      .limit(1);

    const convention = conventions[0] ?? null;
    let conventionSummary = "No active naming convention found for this project.";
    let conventionFields: Array<{ allowedValues: string[] | null; fieldOrder: number }> = [];
    let conventionSep = "-";
    if (convention) {
      const fields = await db.select().from(namingFieldsTable)
        .where(eq(namingFieldsTable.conventionId, convention.id))
        .orderBy(namingFieldsTable.fieldOrder);
      conventionFields = fields;
      conventionSep = convention.separator || "-";
      const fieldDescriptions = fields.map((f: any) => {
        const allowed = f.allowedValues && f.allowedValues.length > 0
          ? `allowed values: [${f.allowedValues.join(", ")}]`
          : "free text";
        return `${f.fieldName} (${allowed})`;
      });
      conventionSummary = `Separator: "${conventionSep}". Fields in order: ${fieldDescriptions.join(` ${conventionSep} `)}`;
    }

    // Helper: build a smart fallback name from convention fields (filename-based, no AI)
    const buildFallbackName = (fName: string): string => {
      const extMatch = fName.match(/\.[^.]+$/);
      const ext = extMatch ? extMatch[0] : "";
      const namePart = fName.replace(/\.[^.]+$/, "").toLowerCase();
      const sorted = [...conventionFields].sort((a, b) => a.fieldOrder - b.fieldOrder);
      const parts = sorted.map(field => {
        const allowed = field.allowedValues && field.allowedValues.length > 0 ? field.allowedValues : null;
        if (!allowed) return namePart.split(/[-_.]/)[0] || "val";
        const match = allowed.find(v => namePart.includes(v.toLowerCase()));
        return match || allowed[0];
      });
      return parts.join(conventionSep) + ext;
    };

    const anthropic = new Anthropic({
      apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY!,
      baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
    });

    // ── PATH A: extractedText available — content-first analysis ─────────────
    if (extractedText) {
      const manualNote = manualExplanation
        ? `\n\nUser explanation: ${manualExplanation}`
        : "";

      const promptContent = `You are analyzing a BIM document. Based on the document content below, determine if this document belongs to the current project and generate a correct BIM file name.

Return ONLY JSON in this format:
{
  "isRelevant": boolean,
  "reason": string,
  "suggestedName": string | null
}

If the content is clearly from a different project, set isRelevant to false, suggestedName to null, and explain why.

If it belongs to the project, set isRelevant to true and generate the correct BIM name based on the detected document type and content.

Reference file name (secondary): ${fileName}
Project naming convention: ${conventionSummary}${manualNote}

Document content:
${extractedText}`;

      try {
        const message = await anthropic.messages.create({
          model: "claude-haiku-4-5",
          max_tokens: 8192,
          messages: [{ role: "user", content: promptContent }],
        });
        const rawText = message.content[0].type === "text" ? message.content[0].text.trim() : "";
        let parsed: { isRelevant: boolean; reason: string; suggestedName: string | null };
        try {
          parsed = JSON.parse(rawText) as { isRelevant: boolean; reason: string; suggestedName: string | null };
        } catch {
          res.json({ isRelevant: false, suggestedName: null, reason: "AI parsing failed" });
          return;
        }
        res.json({ isRelevant: parsed.isRelevant, suggestedName: parsed.suggestedName ?? null, reason: parsed.reason });
      } catch {
        res.json({ isRelevant: false, suggestedName: null, reason: "AI parsing failed" });
      }
      return;
    }

    // ── PATH B: no extractedText — filename-based naming suggestion ───────────
    const violationSection = validationDetails && validationDetails.length > 0
      ? `\n\nKnown naming violations:\n${validationDetails.map(d => `- ${d.field}: ${d.message}${d.expected && d.expected.length > 0 ? ` (allowed: ${d.expected.join(", ")})` : ""} — received: "${d.received}"`).join("\n")}`
      : "";

    const mismatchNote = (bodyContentVerification === "possible_mismatch" || bodyContentVerification === "clear_mismatch")
      ? `\n\nNote: A prior content verification check flagged this document as a "${bodyContentVerification}".`
      : "";

    try {
      const promptContent = `You are a BIM document naming assistant. A user is trying to upload a file that does not comply with the project naming convention.

Original file name: ${fileName}

Project naming convention: ${conventionSummary}${violationSection}${mismatchNote}

Your task: Suggest a single corrected file name that strictly complies with the naming convention.

Return ONLY JSON in this format:
{
  "isRelevant": boolean,
  "reason": string,
  "suggestedName": string | null
}`;

      const message = await anthropic.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 8192,
        messages: [{ role: "user", content: promptContent }],
      });
      const rawText = message.content[0].type === "text" ? message.content[0].text.trim() : "";
      let parsed: { isRelevant: boolean; reason: string; suggestedName: string | null };
      try {
        parsed = JSON.parse(rawText) as { isRelevant: boolean; reason: string; suggestedName: string | null };
      } catch {
        // AI response unparseable — use convention fallback
        res.json({ isRelevant: true, suggestedName: buildFallbackName(fileName), reason: "Built by matching your file name against allowed convention values." });
        return;
      }
      res.json({ isRelevant: parsed.isRelevant, suggestedName: parsed.suggestedName ?? null, reason: parsed.reason });
    } catch {
      // AI unavailable — use convention fallback
      const suggested = conventionFields.length > 0 ? buildFallbackName(fileName) : fileName;
      res.json({ isRelevant: true, suggestedName: suggested, reason: "Built by matching your file name against allowed convention values." });
    }
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
  }
});

// ─── POST /projects/:projectId/files ─────────────────────────────────────────
router.post(
  "/projects/:projectId/files",
  authMiddleware,
  requirePermission("admin", "write"),
  (req, res, next) => uploadMiddleware.single("file")(req, res, next),
  async (req, res) => {
    try {
      const { projectId } = ListFilesParams.parse({ projectId: req.params.projectId });
      const fileName: string = (req.body.fileName as string) || req.file?.originalname || "";
      const documentRelationship: string = (req.body.documentRelationship as string) || "";

      if (!req.file) {
        res.status(400).json({ error: "No file uploaded. Send a multipart/form-data request with a 'file' field." });
        return;
      }
      if (!documentRelationship) {
        fs.unlink(req.file.path, () => {});
        res.status(400).json({
          error: "document_relationship is required. Declare whether this document is 'created', 'modified', 'reference', or 'supporting'.",
        });
        return;
      }

      const filePath = req.file.path;
      const actualFileSize = req.file.size;
      const fileType = req.file.mimetype || "application/octet-stream";
      const ext = (fileName.split(".").pop() || "").toLowerCase();
      const isBimFile = BIM_EXTENSIONS.has(ext);

      // Compute real SHA-256 from the actual file bytes on disk
      const fileBytes = fs.readFileSync(filePath);
      const fileHash = createHash("sha256").update(fileBytes).digest("hex");

      const validation = await validateFileName(projectId, fileName);

      if (!validation.valid) {
        const rejectedTier = getFileTypeTier(fileName);
        const [rejectedFile] = await db.insert(filesTable).values({
          projectId,
          fileName,
          fileSize: actualFileSize,
          fileType,
          version: 1,
          parentFileId: null,
          status: "rejected",
          uploadedById: req.user!.userId,
          fileHash,
          fileSizeBytes: actualFileSize,
          documentRelationship: documentRelationship as "created" | "modified" | "reference" | "supporting",
          documentRelationshipDeclaredAt: new Date(),
          fileTypeTier: rejectedTier,
          source: "user-uploaded",
          rejectionDetails: validation.details ?? [],
        }).returning();

        await db.insert(activityLogTable).values({
          projectId,
          userId: req.user!.userId,
          userFullName: req.user!.fullName,
          userCompanyName: req.user!.companyName,
          actionType: "upload",
          entityType: "file",
          entityId: rejectedFile.id,
          fileNameBefore: null,
          fileNameAfter: fileName,
          details: `Naming violation — file rejected: ${fileName}`,
        });

        await processFileFromDisk(rejectedFile.id, filePath, fileName, projectId, req.user!.userId);

        res.status(422).json({
          error: "File name does not match the active naming convention",
          details: validation.details,
        });

        // ── T6: Naming Violation email ──────────────────────────────────────
        setImmediate(async () => {
          try {
            const project = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
            const projectName = project[0]?.name || "Unknown Project";
            const failedFields = (validation.details || []).map((d: { field: string }) => d.field);
            const uploaderUser = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
            const uploaderPrefs = uploaderUser[0]?.notificationPreferences;
            if (notifEnabled(uploaderPrefs, "file_violation")) {
              const lang = getUserLang(uploaderPrefs);
              await sendEmail({
                to: req.user!.email,
                subject: lang === "es"
                  ? `Violación de Convención de Nombres: ${fileName} — ${projectName}`
                  : `Naming Violation Detected: ${fileName} — ${projectName}`,
                html: makeNamingViolationEmail({ lang, fileName, projectName, failedFields, projectId, recipientName: req.user!.fullName }),
              });
            }
            const admins = await db.select().from(projectMembersTable)
              .where(and(eq(projectMembersTable.projectId, projectId), eq(projectMembersTable.role, "admin")));
            for (const admin of admins) {
              if (admin.userId === req.user!.userId) continue;
              const adminUser = await db.select().from(usersTable).where(eq(usersTable.id, admin.userId)).limit(1);
              if (!adminUser[0]?.email) continue;
              const prefs = adminUser[0].notificationPreferences;
              if (!notifEnabled(prefs, "file_violation")) continue;
              const lang = getUserLang(prefs);
              await sendEmail({
                to: adminUser[0].email,
                subject: lang === "es"
                  ? `Violación de Convención de Nombres: ${fileName} — ${projectName}`
                  : `Naming Violation Detected: ${fileName} — ${projectName}`,
                html: makeNamingViolationEmail({ lang, fileName, projectName, failedFields, projectId, recipientName: adminUser[0].fullName }),
              });
            }
          } catch (_) {}
        });

        return;
      }

      // ── Duplicate detection (content-based) ─────────────────────────────────
      const duplicates = await db.select({ id: filesTable.id, fileName: filesTable.fileName })
        .from(filesTable)
        .where(and(eq(filesTable.projectId, projectId), eq(filesTable.fileHash, fileHash)))
        .limit(1);
      if (duplicates.length > 0) {
        fs.unlink(filePath, () => {});
        res.status(409).json({
          error: "Duplicate file detected",
          details: `An identical file already exists in this project: "${duplicates[0].fileName}" (file ID ${duplicates[0].id}). The uploaded content matches an existing document.`,
        });
        return;
      }

      // ── Version detection ────────────────────────────────────────────────────
      const incomingBase = getBaseName(fileName);
      const existingFiles = await db.select().from(filesTable).where(eq(filesTable.projectId, projectId));
      const family = existingFiles.filter(f => getBaseName(f.fileName) === incomingBase);

      let newVersion = 1;
      let parentFileId: number | null = null;

      if (family.length > 0) {
        const root = family.find(f => f.parentFileId === null) ?? family[0];
        parentFileId = root.id;
        newVersion = Math.max(...family.map(f => f.version)) + 1;
      }

      const fileTypeTier = getFileTypeTier(fileName);
      const defaultFileStatus = await getDefaultValue("file_status");
      const [file] = await db.insert(filesTable).values({
        projectId,
        fileName,
        fileSize: actualFileSize,
        fileType,
        version: newVersion,
        parentFileId,
        status: defaultFileStatus,
        uploadedById: req.user!.userId,
        fileHash,
        fileSizeBytes: actualFileSize,
        documentRelationship: documentRelationship as "created" | "modified" | "reference" | "supporting",
        documentRelationshipDeclaredAt: new Date(),
        fileTypeTier,
        source: "user-uploaded",
      }).returning();

      await processFileFromDisk(file.id, filePath, fileName, projectId, req.user!.userId);

      // ── Auto-supersede all previous versions in the same document family ────
      if (newVersion > 1) {
        await db.update(filesTable)
          .set({ isSuperseded: true, updatedAt: new Date() })
          .where(and(
            eq(filesTable.projectId, projectId),
            eq(filesTable.parentFileId, parentFileId!),
          ));
        if (parentFileId) {
          await db.update(filesTable)
            .set({ isSuperseded: true, updatedAt: new Date() })
            .where(and(
              eq(filesTable.projectId, projectId),
              eq(filesTable.id, parentFileId),
            ));
        }
      }

      const isNewVersion = newVersion > 1;
      await db.insert(activityLogTable).values({
        projectId,
        userId: req.user!.userId,
        userFullName: req.user!.fullName,
        userCompanyName: req.user!.companyName,
        actionType: "upload",
        entityType: "file",
        entityId: file.id,
        fileNameBefore: null,
        fileNameAfter: fileName,
        details: isNewVersion
          ? `Uploaded Version ${newVersion} of document: ${fileName}`
          : `Uploaded file: ${fileName} [${documentRelationship}]`,
      });

      res.status(201).json({
        ...file,
        uploadedByName: req.user!.fullName,
        uploadedByCompany: req.user!.companyName,
        createdAt: file.createdAt.toISOString(),
        updatedAt: file.updatedAt.toISOString(),
        documentRelationshipDeclaredAt: file.documentRelationshipDeclaredAt?.toISOString() ?? null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bad request";
      res.status(400).json({ error: message });
    }
  },
);

// ─── PATCH /projects/:projectId/files/:fileId ─────────────────────────────────
router.patch("/projects/:projectId/files/:fileId", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  try {
    const { projectId, fileId } = UpdateFileParams.parse({ projectId: req.params.projectId, fileId: req.params.fileId });
    const body = UpdateFileBody.parse(req.body);

    const existing = await db.select().from(filesTable).where(and(eq(filesTable.id, fileId), eq(filesTable.projectId, projectId))).limit(1);
    if (existing.length === 0) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const oldFile = existing[0];
    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (body.fileName) {
      const validation = await validateFileName(projectId, body.fileName);
      if (!validation.valid) {
        res.status(422).json({
          error: "File name does not match the active naming convention",
          details: validation.details,
        });
        return;
      }
      updates.fileName = body.fileName;
    }
    if (body.status) {
      const validStatus = await validateConfigValue("file_status", body.status);
      if (!validStatus) {
        res.status(422).json({ error: `Invalid file status: '${body.status}'` });
        return;
      }
      updates.status = body.status;
    }

    const [updated] = await db.update(filesTable).set(updates).where(eq(filesTable.id, fileId)).returning();

    const actionType = body.fileName ? "rename" : "status_change";
    await db.insert(activityLogTable).values({
      projectId,
      userId: req.user!.userId,
      userFullName: req.user!.fullName,
      userCompanyName: req.user!.companyName,
      actionType,
      entityType: "file",
      entityId: fileId,
      fileNameBefore: oldFile.fileName,
      fileNameAfter: updated.fileName,
      details: body.fileName
        ? `Renamed file from "${oldFile.fileName}" to "${updated.fileName}"`
        : `Changed status to "${body.status}"`,
    });

    if (body.fileName) {
      await runBimFallbackCvr(fileId, body.fileName, projectId);
    }

    res.json({
      ...updated,
      uploadedByName: req.user!.fullName,
      uploadedByCompany: req.user!.companyName,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      documentRelationshipDeclaredAt: updated.documentRelationshipDeclaredAt?.toISOString() ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bad request";
    res.status(400).json({ error: message });
  }
});

// ─── DELETE /projects/:projectId/files/:fileId ─────────────────────────────────
router.delete("/projects/:projectId/files/:fileId", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  try {
    const { projectId, fileId } = DeleteFileParams.parse({ projectId: req.params.projectId, fileId: req.params.fileId });

    const existing = await db.select().from(filesTable).where(and(eq(filesTable.id, fileId), eq(filesTable.projectId, projectId))).limit(1);
    if (existing.length === 0) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    await db.delete(filesTable).where(eq(filesTable.id, fileId));

    await db.insert(activityLogTable).values({
      projectId,
      userId: req.user!.userId,
      userFullName: req.user!.fullName,
      userCompanyName: req.user!.companyName,
      actionType: "delete",
      entityType: "file",
      entityId: fileId,
      fileNameBefore: existing[0].fileName,
      fileNameAfter: null,
      details: `Deleted file: ${existing[0].fileName}`,
    });

    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

export default router;
