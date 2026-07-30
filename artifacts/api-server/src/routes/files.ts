import { Router, type IRouter } from "express";
import { createHash } from "crypto";
import { singleFileUpload } from "../middlewares/multipart";
import { db } from "@workspace/db";
import { filesTable, namingConventionsTable, namingFieldsTable, namingConventionVersionsTable, activityLogTable, usersTable, companiesTable, rfisTable, projectsTable, projectMembersTable } from "@workspace/db/schema";
import { sendEmail, makeNamingViolationEmail, getUserLang, notifEnabled } from "../lib/email";
import { eq, and, or, gte, lte, isNull, count, inArray } from "drizzle-orm";
import { ListFilesParams, UpdateFileParams, UpdateFileBody, DeleteFileParams } from "@workspace/api-zod";
import { authMiddleware, requireProjectMember, requirePermission } from "../middlewares/auth";
import { getDefaultValue, validateConfigValue } from "../middlewares/config-validator";
import { storage } from "../lib/storage-adapter";
import { PDFParse as PDFParseClass } from "pdf-parse";
import {
  PALETTE,
  REPORT_THEMES,
  addPageNumbers,
  computeContentHash,
  createPdfDocument,
  drawBrandedHeader,
  drawTable,
  reportFileName,
  type TableColumn,
} from "../lib/pdf-kit";
import { AiUsageError, getAnthropicClientForUser, sendAiUsageError } from "../lib/ai-usage";

async function pdfParse(buffer: Buffer) {
  const parser = new PDFParseClass({ data: buffer, verbosity: 0 });
  const result = await parser.getText();
  await parser.destroy();
  return result;
}

const router: IRouter = Router();

const uploadMiddleware = singleFileUpload({
  fileSize: 500 * 1024 * 1024,
  files: 1,
  fields: 2,
  parts: 3,
  fieldSize: 4 * 1024,
});

type FileRow = typeof filesTable.$inferSelect;

function serializePublicFile<T extends FileRow, E extends Record<string, unknown> = Record<string, never>>(file: T, extra?: E) {
  const {
    storagePath: _storagePath,
    sourceLocation: _sourceLocation,
    fileMetadata: _fileMetadata,
    ...publicFile
  } = file;
  return { ...publicFile, ...(extra || {}) };
}

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
      const buffer = await storage.download(filePath);
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

    const anthropic = await getAnthropicClientForUser({
      userId: uploadedById,
      projectId,
      feature: "files.content_verification",
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

      const severity = result === "clear_mismatch" ? "CLEAR MISMATCH" : "Possible Mismatch";
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
          details: `Coordinator alert: ${details}`,
        });
      }
    }
  } catch (err) {
    if (err instanceof AiUsageError) {
      await db.update(filesTable)
        .set({ contentVerificationResult: "not_applicable", hashComparisonNote: err.message, updatedAt: new Date() })
        .where(eq(filesTable.id, fileId));
      return;
    }
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
        return serializePublicFile(f, {
          uploadedByName,
          uploadedByCompany,
          createdAt: f.createdAt.toISOString(),
          updatedAt: f.updatedAt.toISOString(),
          documentRelationshipDeclaredAt: f.documentRelationshipDeclaredAt?.toISOString() ?? null,
        });
      })
    );

    res.json(results);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

type FileExportColumn = "name" | "type" | "status" | "declaration" | "uploader" | "date" | "versions";
type ExportableFile = {
  id: number;
  fileName: string;
  fileType: string;
  version: number;
  parentFileId: number | null;
  status: string;
  uploadedById: number;
  documentRelationship: string | null;
  source: string | null;
  createdAt: Date;
  uploadedByName: string;
  uploadedByCompany: string;
};

const FILE_EXPORT_COLUMNS: readonly FileExportColumn[] = [
  "name",
  "type",
  "status",
  "declaration",
  "uploader",
  "date",
  "versions",
];

function singleQuery(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function selectedFileColumns(raw: unknown): FileExportColumn[] {
  const requested = singleQuery(raw).split(",").map((value) => value.trim()).filter(Boolean);
  const columns = FILE_EXPORT_COLUMNS.filter((column) => requested.includes(column));
  return columns.length > 0 ? columns : [...FILE_EXPORT_COLUMNS];
}

function exportDate(raw: unknown): Date | null {
  const value = singleQuery(raw);
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

router.get("/projects/:projectId/files/current-view.pdf", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    if (!Number.isSafeInteger(projectId) || projectId <= 0) {
      res.status(400).json({ error: "Invalid project id" });
      return;
    }
    const [project] = await db.select({
      name: projectsTable.name,
      code: projectsTable.code,
    }).from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const lang = singleQuery(req.query.lang) === "es" ? "es" : "en";
    const tr = (en: string, es: string) => lang === "es" ? es : en;
    const qRaw = singleQuery(req.query.q).slice(0, 100);
    const q = qRaw.toLocaleLowerCase();
    const type = /^[a-z0-9]{1,12}$/.test(singleQuery(req.query.type).toLocaleLowerCase())
      ? singleQuery(req.query.type).toLocaleLowerCase()
      : "all";
    const status = ["valid", "rejected"].includes(singleQuery(req.query.status))
      ? singleQuery(req.query.status)
      : "all";
    const declaration = ["created", "modified", "reference", "supporting"].includes(singleQuery(req.query.declaration))
      ? singleQuery(req.query.declaration)
      : "all";
    const uploader = singleQuery(req.query.uploader).slice(0, 120);
    const dateFrom = exportDate(req.query.dateFrom);
    const dateTo = exportDate(req.query.dateTo);
    if ((req.query.dateFrom && !dateFrom) || (req.query.dateTo && !dateTo) || (dateFrom && dateTo && dateFrom > dateTo)) {
      res.status(400).json({ error: "Invalid date range" });
      return;
    }
    const selectedColumns = selectedFileColumns(req.query.columns);

    const databaseFiles = await db.select({
      id: filesTable.id,
      fileName: filesTable.fileName,
      fileType: filesTable.fileType,
      version: filesTable.version,
      parentFileId: filesTable.parentFileId,
      status: filesTable.status,
      uploadedById: filesTable.uploadedById,
      documentRelationship: filesTable.documentRelationship,
      source: filesTable.source,
      createdAt: filesTable.createdAt,
    }).from(filesTable).where(eq(filesTable.projectId, projectId));
    const uploaderIds = Array.from(new Set(databaseFiles.map((file) => file.uploadedById)));
    const uploaderRows = uploaderIds.length > 0
      ? await db.select({
        id: usersTable.id,
        fullName: usersTable.fullName,
        companyId: usersTable.companyId,
      }).from(usersTable).where(inArray(usersTable.id, uploaderIds))
      : [];
    const companyIds = Array.from(new Set(uploaderRows.map((user) => user.companyId)));
    const companyRows = companyIds.length > 0
      ? await db.select({ id: companiesTable.id, name: companiesTable.name })
        .from(companiesTable).where(inArray(companiesTable.id, companyIds))
      : [];
    const companyNameById = new Map(companyRows.map((company) => [company.id, company.name]));
    const uploaderById = new Map(uploaderRows.map((user) => [user.id, {
      name: user.fullName,
      company: companyNameById.get(user.companyId) || "",
    }]));
    const exportableFiles: ExportableFile[] = databaseFiles.map((file) => ({
      ...file,
      uploadedByName: uploaderById.get(file.uploadedById)?.name || "",
      uploadedByCompany: uploaderById.get(file.uploadedById)?.company || "",
    }));
    const roots = exportableFiles.filter((file) => file.parentFileId === null);
    const childrenByRoot = new Map<number, ExportableFile[]>();
    exportableFiles.filter((file) => file.parentFileId !== null).forEach((file) => {
      const rootId = file.parentFileId!;
      const children = childrenByRoot.get(rootId) || [];
      children.push(file);
      childrenByRoot.set(rootId, children);
    });
    const families = roots.map((root) => ({
      root,
      versions: [root, ...(childrenByRoot.get(root.id) || [])].sort((a, b) => a.version - b.version),
    })).sort((a, b) =>
      b.versions[b.versions.length - 1].createdAt.getTime() - a.versions[a.versions.length - 1].createdAt.getTime());

    const filteredFamilies = families.filter(({ root, versions }) => {
      const latest = versions[versions.length - 1];
      const extension = (latest.fileName.split(".").pop() || "file").toLocaleLowerCase();
      return (!q || root.fileName.toLocaleLowerCase().includes(q) || latest.fileName.toLocaleLowerCase().includes(q))
        && (type === "all" || extension === type)
        && (status === "all" || (status === "rejected" ? latest.status === "rejected" : latest.status !== "rejected"))
        && (declaration === "all" || (latest.documentRelationship || "created") === declaration)
        && (!uploader || latest.uploadedByName === uploader)
        && (!dateFrom || latest.createdAt >= dateFrom)
        && (!dateTo || latest.createdAt <= dateTo);
    });
    const statusLabels = {
      valid: tr("Valid", "Válido"),
      rejected: tr("Rejected", "Rechazado"),
    } as const;
    const declarationLabels = {
      created: tr("Created", "Creado"),
      modified: tr("Modified", "Modificado"),
      reference: tr("Reference", "Referencia"),
      supporting: tr("Supporting", "Soporte"),
    } as const;
    const rows = filteredFamilies.map(({ root, versions }) => {
      const latest = versions[versions.length - 1];
      const latestStatus = latest.status === "rejected" ? "rejected" : "valid";
      const latestDeclaration = latest.documentRelationship || "created";
      return {
        name: root.fileName,
        type: (latest.fileName.split(".").pop() || latest.fileType || "file").toUpperCase(),
        status: statusLabels[latestStatus],
        declaration: declarationLabels[latestDeclaration as keyof typeof declarationLabels] || tr("Unknown declaration", "Declaración desconocida"),
        uploader: latest.source === "system-generated"
          ? "BIMLog Auto"
          : [latest.uploadedByName, latest.uploadedByCompany].filter(Boolean).join(" — "),
        date: latest.createdAt.toLocaleString(lang === "es" ? "es-ES" : "en-US"),
        versions: String(versions.length),
      };
    });

    const timestamp = new Date();
    const labels: Record<FileExportColumn, string> = {
      name: tr("Name", "Nombre"),
      type: tr("Type", "Tipo"),
      status: tr("Status", "Estado"),
      declaration: tr("Declaration", "Declaración"),
      uploader: tr("Uploader", "Cargado por"),
      date: tr("Date", "Fecha"),
      versions: tr("Versions", "Versiones"),
    };
    const activeFilters = [
      q ? `${labels.name}: ${qRaw}` : "",
      type !== "all" ? `${labels.type}: ${type.toUpperCase()}` : "",
      status !== "all" ? `${labels.status}: ${statusLabels[status as keyof typeof statusLabels]}` : "",
      declaration !== "all" ? `${labels.declaration}: ${declarationLabels[declaration as keyof typeof declarationLabels]}` : "",
      uploader ? `${labels.uploader}: ${uploader}` : "",
      dateFrom ? `${tr("From", "Desde")}: ${dateFrom.toLocaleDateString(lang === "es" ? "es-ES" : "en-US")}` : "",
      dateTo ? `${tr("To", "Hasta")}: ${dateTo.toLocaleDateString(lang === "es" ? "es-ES" : "en-US")}` : "",
    ].filter(Boolean);
    const weights: Record<FileExportColumn, number> = {
      name: 2.7,
      type: 0.65,
      status: 0.85,
      declaration: 1.05,
      uploader: 1.55,
      date: 1.35,
      versions: 0.75,
    };
    const contentWidth = 712;
    const weightTotal = selectedColumns.reduce((sum, column) => sum + weights[column], 0);
    const widths = selectedColumns.map((column) => Math.round(contentWidth * weights[column] / weightTotal));
    widths[widths.length - 1] += contentWidth - widths.reduce((sum, width) => sum + width, 0);
    const tableColumns: TableColumn[] = selectedColumns.map((column, index) => ({
      key: column,
      label: labels[column],
      width: widths[index],
      wrap: column === "name" || column === "uploader",
      bold: column === "name",
      align: column === "versions" ? "center" : "left",
    }));
    const snapshot = {
      projectId,
      companyId: req.user!.companyId,
      userId: req.user!.userId,
      lang,
      filters: { q, type, status, declaration, uploader, dateFrom: dateFrom?.toISOString(), dateTo: dateTo?.toISOString() },
      columns: selectedColumns,
      rows,
      generatedAt: timestamp.toISOString(),
    };
    const contentHash = computeContentHash(snapshot);
    const reportNumber = `FILES-${project.code}-${timestamp.toISOString().slice(0, 10).replace(/-/g, "")}`;
    const doc = createPdfDocument({
      size: "LETTER",
      layout: "landscape",
      margin: PALETTE.MARGIN,
      bufferPages: true,
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    const complete = new Promise<void>((resolve, reject) => {
      doc.on("end", resolve);
      doc.on("error", reject);
    });
    const header = () => drawBrandedHeader(doc, {
      companyName: req.user!.companyName,
      title: tr("Files — Current View", "Archivos — Vista actual"),
      subtitle: tr("Visible document-family register", "Registro visible de familias de documentos"),
      projectName: project.name,
      projectCode: project.code,
      reportNumber,
      reportDate: timestamp,
      theme: REPORT_THEMES.files.register,
    });
    let y = header();
    doc.font(PALETTE.FONT).fontSize(8).fillColor(PALETTE.TEXT)
      .text(`${tr("Generated", "Generado")}: ${timestamp.toLocaleString(lang === "es" ? "es-ES" : "en-US")}  |  ${tr("Prepared by", "Preparado por")}: ${req.user!.fullName}`, PALETTE.MARGIN, y, { width: contentWidth });
    y += 14;
    doc.text(`${tr("Results", "Resultados")}: ${rows.length}  |  ${tr("Selected columns", "Columnas seleccionadas")}: ${selectedColumns.map((column) => labels[column]).join(", ")}`, PALETTE.MARGIN, y, { width: contentWidth });
    y += 14;
    doc.text(`${tr("Active filters", "Filtros activos")}: ${activeFilters.length > 0 ? activeFilters.join(" | ") : tr("None", "Ninguno")}`, PALETTE.MARGIN, y, { width: contentWidth });
    y += 18;
    if (rows.length === 0) {
      doc.rect(PALETTE.MARGIN, y, contentWidth, 46).fill(PALETTE.ROW_ALT);
      doc.font(PALETTE.FONT_BOLD).fontSize(10).fillColor(PALETTE.MUTED)
        .text(tr("No files match the current filters.", "Ningún archivo coincide con los filtros actuales."), PALETTE.MARGIN + 12, y + 17, { width: contentWidth - 24, align: "center" });
    } else {
      drawTable(doc, {
        x: PALETTE.MARGIN,
        startY: y,
        columns: tableColumns,
        rows,
        fontSize: 7,
        rowMinHeight: 25,
        pageBottom: 540,
        headerFill: REPORT_THEMES.files.register.dark,
        onPageBreak: () => {
          doc.addPage({ size: "LETTER", layout: "landscape", margin: PALETTE.MARGIN });
          return header();
        },
      });
    }
    addPageNumbers(doc, {
      companyName: req.user!.companyName,
      projectName: project.name,
      reportNumber,
      timestamp: timestamp.toISOString(),
      contentHash,
      footerY: 570,
      fingerprintY: 558,
    });
    doc.end();
    await complete;
    res.type("application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${reportFileName(tr("Files Current View", "Archivos Vista Actual"))}"`);
    res.send(Buffer.concat(chunks));
  } catch (error) {
    console.error("[files-current-view-pdf] generation failed", error instanceof Error ? error.message : "unknown error");
    res.status(500).json({
      error: "The files PDF could not be generated.",
      errorEs: "No se pudo generar el PDF de archivos.",
    });
  }
});

// Helper: extract base name (without extension, lower-cased for comparison)
function getBaseName(fileName: string): string {
  return (fileName.includes(".") ? fileName.substring(0, fileName.lastIndexOf(".")) : fileName).toLowerCase();
}

function safeDownloadDisposition(fileName: string, disposition: "inline" | "attachment" = "attachment"): string {
  const clean = fileName.replace(/[\u0000-\u001f\u007f"\\]/g, "").trim() || "download";
  const ascii = clean.replace(/[^\x20-\x7e]/g, "_");
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(clean)}`;
}

function storedFileContentType(fileType: string, fileName: string): string {
  const ext = (fileName.split(".").pop() || fileType || "").toLowerCase();
  const types: Record<string, string> = {
    pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    csv: "text/csv", txt: "text/plain", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
    tif: "image/tiff", tiff: "image/tiff", bmp: "image/bmp", gif: "image/gif", webp: "image/webp",
    msg: "application/vnd.ms-outlook",
  };
  return types[ext] || (fileType.includes("/") ? fileType : "application/octet-stream");
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

    // Stored binary (e.g. the Lens viewpoint screenshot) — serve the persisted file directly.
    if (file.storagePath) {
      try {
        const buffer = await storage.download(file.storagePath);
        res.setHeader("Content-Type", storedFileContentType(file.fileType, file.fileName));
        res.setHeader("Content-Disposition", safeDownloadDisposition(file.fileName, "inline"));
        res.send(buffer);
      } catch {
        res.status(404).json({ error: "Stored file not found" });
      }
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
    const fmtD = (d: Date | string | null | undefined) =>
      d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—";

    const doc = createPdfDocument({ margin: MARGIN, size: "LETTER", autoFirstPage: true, bufferPages: true });
    doc.page.margins.bottom = 0;
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => {
      const pdfBuffer = Buffer.concat(chunks);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", safeDownloadDisposition(file.fileName));
      res.setHeader("Content-Length", pdfBuffer.length);
      res.send(pdfBuffer);
    });

    const contentW = LETTER_WIDTH - MARGIN * 2;
    const generatedAt = new Date(file.createdAt || rfi.respondedAt || rfi.dateAnswered || Date.now());
    const contentHash = computeContentHash({ file, project, rfi });
    const reportNumber = `RFI-RESP-${contentHash.slice(0, 10).toUpperCase()}`;
    const companyName = req.user!.companyName || rfi.submittedByCompany || "Company";
    let y = drawBrandedHeader(doc, {
      margin: MARGIN,
      companyName,
      projectName: project?.name || "Project",
      projectCode: project?.code || undefined,
      title: "RFI Response Document",
      subtitle: rfi.number,
      reportNumber,
      reportDate: generatedAt,
      theme: REPORT_THEMES.files.response,
    }) + 12;

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
    doc.rect(MARGIN, y, contentW, 14).fill(REPORT_THEMES.files.response.primary);
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

    addPageNumbers(doc, {
      margin: MARGIN,
      companyName,
      projectName: project?.name || "Project",
      reportNumber,
      timestamp: generatedAt.toISOString(),
      contentHash,
    });
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
        const result = await pdfParse(buf);
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

    const anthropic = await getAnthropicClientForUser({
      userId: req.user!.userId,
      projectId,
      feature: "files.naming_suggestion",
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
        const cleanText = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
        let parsed: { isRelevant: boolean; reason: string; suggestedName: string | null };
        try {
          parsed = JSON.parse(cleanText) as { isRelevant: boolean; reason: string; suggestedName: string | null };
        } catch {
          res.json({ isRelevant: false, suggestedName: null, reason: "AI parsing failed" });
          return;
        }
        res.json({ isRelevant: parsed.isRelevant ?? true, suggestedName: parsed.suggestedName ?? null, reason: parsed.reason ?? "" });
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
      const cleanTextB = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      let parsed: { isRelevant: boolean; reason: string; suggestedName: string | null };
      try {
        parsed = JSON.parse(cleanTextB) as { isRelevant: boolean; reason: string; suggestedName: string | null };
      } catch {
        // AI response unparseable — use convention fallback
        res.json({ isRelevant: true, suggestedName: buildFallbackName(fileName), reason: "Built by matching your file name against allowed convention values." });
        return;
      }
      res.json({ isRelevant: parsed.isRelevant ?? true, suggestedName: parsed.suggestedName ?? null, reason: parsed.reason ?? "" });
    } catch {
      // AI unavailable — use convention fallback
      const suggested = conventionFields.length > 0 ? buildFallbackName(fileName) : fileName;
      res.json({ isRelevant: true, suggestedName: suggested, reason: "Built by matching your file name against allowed convention values." });
    }
  } catch (error) {
    if (sendAiUsageError(res, error)) return;
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
  }
});

// ─── POST /projects/:projectId/files ─────────────────────────────────────────
router.post(
  "/projects/:projectId/files",
  authMiddleware,
  requirePermission("admin", "write"),
  uploadMiddleware,
  async (req, res) => {
    let pendingStoragePath: string | null = null;
    try {
      const { projectId } = ListFilesParams.parse({ projectId: req.params.projectId });
      const fileName: string = (req.body.fileName as string) || req.file?.originalname || "";
      const documentRelationship: string = (req.body.documentRelationship as string) || "";

      if (!req.file) {
        res.status(400).json({ error: "No file uploaded. Send a multipart/form-data request with a 'file' field." });
        return;
      }

      let filePath: string;
      try {
        filePath = await storage.upload(req.file.buffer, projectId, req.file.originalname);
        pendingStoragePath = filePath;
      } catch (err) {
        res.status(500).json({
          code: "FILE_UPLOAD_STORAGE_FAILED",
          error: {
            en: "The file could not be stored.",
            es: "No se pudo almacenar el archivo.",
          },
        });
        return;
      }

      if (!documentRelationship) {
        await storage.delete(filePath);
        pendingStoragePath = null;
        res.status(400).json({
          error: "document_relationship is required. Declare whether this document is 'created', 'modified', 'reference', or 'supporting'.",
        });
        return;
      }

      const actualFileSize = req.file.size;
      const fileType = req.file.mimetype || "application/octet-stream";
      const ext = (fileName.split(".").pop() || "").toLowerCase();
      const isBimFile = BIM_EXTENSIONS.has(ext);

      // Compute real SHA-256 from the uploaded file bytes
      const fileHash = createHash("sha256").update(req.file.buffer).digest("hex");

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
          isCompliant: false,
          uploadedById: req.user!.userId,
          fileHash,
          fileSizeBytes: actualFileSize,
          documentRelationship: documentRelationship as "created" | "modified" | "reference" | "supporting",
          documentRelationshipDeclaredAt: new Date(),
          fileTypeTier: rejectedTier,
          source: "user-uploaded",
          rejectionDetails: validation.details ?? [],
        }).returning();
        pendingStoragePath = null;

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
          } catch (notificationError) {
            console.error("[files] Failed to send naming violation notifications:", notificationError instanceof Error ? notificationError.message : notificationError);
          }
        });

        return;
      }

      // ── Duplicate detection (content-based) ─────────────────────────────────
      const duplicates = await db.select({ id: filesTable.id, fileName: filesTable.fileName })
        .from(filesTable)
        .where(and(eq(filesTable.projectId, projectId), eq(filesTable.fileHash, fileHash)))
        .limit(1);
      if (duplicates.length > 0) {
        await storage.delete(filePath);
        pendingStoragePath = null;
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
        isCompliant: defaultFileStatus !== "rejected",
        uploadedById: req.user!.userId,
        fileHash,
        fileSizeBytes: actualFileSize,
        documentRelationship: documentRelationship as "created" | "modified" | "reference" | "supporting",
        documentRelationshipDeclaredAt: new Date(),
        fileTypeTier,
        source: "user-uploaded",
      }).returning();
      pendingStoragePath = null;

      await processFileFromDisk(file.id, filePath, fileName, projectId, req.user!.userId);

      // ── Auto-supersede all previous versions in the same document family ────
      if (newVersion > 1) {
        await db.update(filesTable)
          .set({ isSuperseded: true, supersededByFileId: file.id, updatedAt: new Date() })
          .where(and(
            eq(filesTable.projectId, projectId),
            eq(filesTable.parentFileId, parentFileId!),
          ));
        if (parentFileId) {
          await db.update(filesTable)
            .set({ isSuperseded: true, supersededByFileId: file.id, updatedAt: new Date() })
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

      res.status(201).json(serializePublicFile(file, {
        uploadedByName: req.user!.fullName,
        uploadedByCompany: req.user!.companyName,
        createdAt: file.createdAt.toISOString(),
        updatedAt: file.updatedAt.toISOString(),
        documentRelationshipDeclaredAt: file.documentRelationshipDeclaredAt?.toISOString() ?? null,
      }));
    } catch (error) {
      if (pendingStoragePath) {
        await storage.delete(pendingStoragePath).catch(() => {
          console.error("[files] failed to compensate an incomplete upload");
        });
      }
      console.error("[files] upload request failed");
      res.status(400).json({
        code: "FILE_UPLOAD_FAILED",
        error: {
          en: "The file upload could not be completed.",
          es: "No se pudo completar la carga del archivo.",
        },
      });
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

    res.json(serializePublicFile(updated, {
      uploadedByName: req.user!.fullName,
      uploadedByCompany: req.user!.companyName,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      documentRelationshipDeclaredAt: updated.documentRelationshipDeclaredAt?.toISOString() ?? null,
    }));
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

// ─── POST /projects/:projectId/files/:fileId/cvr-proceed ──────────────────────
router.post("/projects/:projectId/files/:fileId/cvr-proceed", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId as string);
    const fileId = parseInt(req.params.fileId as string);
    const { reason } = req.body as { reason?: string };

    const [file] = await db.select().from(filesTable)
      .where(and(eq(filesTable.id, fileId), eq(filesTable.projectId, projectId))).limit(1);
    if (!file) { res.status(404).json({ error: "File not found" }); return; }

    if (file.contentVerificationResult === "clear_mismatch" && (!reason || reason.trim().length === 0)) {
      res.status(400).json({ error: "A reason is required when content clearly does not match." });
      return;
    }

    const [updated] = await db.update(filesTable)
      .set({ cvrWorkflowStatus: "pending_admin_review", cvrUserReason: reason?.trim() || null, updatedAt: new Date() })
      .where(eq(filesTable.id, fileId)).returning();

    await db.insert(activityLogTable).values({
      projectId,
      userId: req.user!.userId,
      userFullName: req.user!.fullName,
      userCompanyName: req.user!.companyName,
      actionType: "cvr_user_proceeded",
      entityType: "file",
      entityId: fileId,
      fileNameAfter: file.fileName,
      details: `User proceeded despite ${file.contentVerificationResult} warning. Reason: ${reason?.trim() || "(none provided)"}`,
    });

    res.json(serializePublicFile(updated));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ─── POST /projects/:projectId/files/:fileId/cvr-approve ──────────────────────
router.post("/projects/:projectId/files/:fileId/cvr-approve", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId as string);
    const fileId = parseInt(req.params.fileId as string);
    const { reason } = req.body as { reason?: string };

    const member = await db.select().from(projectMembersTable)
      .where(and(eq(projectMembersTable.projectId, projectId), eq(projectMembersTable.userId, req.user!.userId))).limit(1);
    const role = member[0]?.role || "";
    if (!req.user!.isSuperAdmin && !["admin", "project_admin"].includes(role)) {
      res.status(403).json({ error: "Admin access required." }); return;
    }

    const [file] = await db.select().from(filesTable)
      .where(and(eq(filesTable.id, fileId), eq(filesTable.projectId, projectId))).limit(1);
    if (!file) { res.status(404).json({ error: "File not found" }); return; }
    if (file.cvrWorkflowStatus !== "pending_admin_review") {
      res.status(400).json({ error: "File is not pending review." }); return;
    }

    const now = new Date();
    const [updated] = await db.update(filesTable)
      .set({ cvrWorkflowStatus: "admin_approved", cvrAdminAction: reason?.trim() || "Approved", cvrAdminActionAt: now, cvrAdminActionBy: req.user!.userId, updatedAt: now })
      .where(eq(filesTable.id, fileId)).returning();

    await db.insert(activityLogTable).values({
      projectId,
      userId: req.user!.userId,
      userFullName: req.user!.fullName,
      userCompanyName: req.user!.companyName,
      actionType: "cvr_admin_approved",
      entityType: "file",
      entityId: fileId,
      fileNameAfter: file.fileName,
      details: `Admin approved file "${file.fileName}". Reason: ${reason?.trim() || "Approved"}. Approved by ${req.user!.fullName} at ${now.toISOString()}.`,
    });

    res.json(serializePublicFile(updated));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ─── POST /projects/:projectId/files/:fileId/cvr-reject ───────────────────────
router.post("/projects/:projectId/files/:fileId/cvr-reject", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId as string);
    const fileId = parseInt(req.params.fileId as string);
    const { reason } = req.body as { reason?: string };

    const member = await db.select().from(projectMembersTable)
      .where(and(eq(projectMembersTable.projectId, projectId), eq(projectMembersTable.userId, req.user!.userId))).limit(1);
    const role = member[0]?.role || "";
    if (!req.user!.isSuperAdmin && !["admin", "project_admin"].includes(role)) {
      res.status(403).json({ error: "Admin access required." }); return;
    }

    if (!reason || reason.trim().length === 0) {
      res.status(400).json({ error: "A reason is required to reject a file." }); return;
    }

    const [file] = await db.select().from(filesTable)
      .where(and(eq(filesTable.id, fileId), eq(filesTable.projectId, projectId))).limit(1);
    if (!file) { res.status(404).json({ error: "File not found" }); return; }

    const now = new Date();
    const [updated] = await db.update(filesTable)
      .set({ cvrWorkflowStatus: "admin_rejected", status: "rejected", cvrAdminAction: reason.trim(), cvrAdminActionAt: now, cvrAdminActionBy: req.user!.userId, updatedAt: now })
      .where(eq(filesTable.id, fileId)).returning();

    await db.insert(activityLogTable).values({
      projectId,
      userId: req.user!.userId,
      userFullName: req.user!.fullName,
      userCompanyName: req.user!.companyName,
      actionType: "cvr_admin_rejected",
      entityType: "file",
      entityId: fileId,
      fileNameAfter: file.fileName,
      details: `Admin rejected file "${file.fileName}". Reason: ${reason.trim()}. Rejected by ${req.user!.fullName} at ${now.toISOString()}.`,
    });

    res.json(serializePublicFile(updated));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ─── GET /projects/:projectId/cvr-report ──────────────────────────────────────
router.get("/projects/:projectId/cvr-report", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId as string);
    const { from, to } = req.query as { from?: string; to?: string };

    const [allFiles, conventions, versions] = await Promise.all([
      db.select().from(filesTable).where(eq(filesTable.projectId, projectId)),
      db.select().from(namingConventionsTable).where(eq(namingConventionsTable.projectId, projectId)).limit(1),
      db.select().from(namingConventionVersionsTable)
        .where(eq(namingConventionVersionsTable.projectId, projectId))
        .orderBy(namingConventionVersionsTable.conventionVersion),
    ]);

    const convention = conventions[0] || null;
    const latestVersion = versions.length > 0 ? versions[versions.length - 1] : null;

    const totalFilesProcessed = allFiles.length;
    const totalFlagged = allFiles.filter(f => f.contentVerificationResult === "possible_mismatch" || f.contentVerificationResult === "clear_mismatch").length;
    const totalPendingReview = allFiles.filter(f => f.cvrWorkflowStatus === "pending_admin_review").length;
    const totalAdminApproved = allFiles.filter(f => f.cvrWorkflowStatus === "admin_approved").length;
    const totalAdminRejected = allFiles.filter(f => f.cvrWorkflowStatus === "admin_rejected").length;

    let issues = allFiles.filter(f => f.contentVerificationResult === "possible_mismatch" || f.contentVerificationResult === "clear_mismatch");

    if (from || to) {
      const fromDate = from ? new Date(from) : null;
      const toDate = to ? new Date(to) : null;
      issues = issues.filter(f => {
        const created = new Date(f.createdAt);
        if (fromDate && created < fromDate) return false;
        if (toDate && created > toDate) return false;
        return true;
      });
    } else {
      issues = issues.filter(f => f.cvrWorkflowStatus === "pending_admin_review");
    }

    const issuesWithUploader = await Promise.all(
      issues.map(async (f) => {
        const users = await db.select().from(usersTable).where(eq(usersTable.id, f.uploadedById)).limit(1);
        return serializePublicFile(f, { uploadedByName: users[0]?.fullName || null });
      })
    );

    res.json({
      projectId,
      generatedAt: new Date().toISOString(),
      totalFilesProcessed,
      totalFlagged,
      totalPendingReview,
      totalAdminApproved,
      totalAdminRejected,
      issues: issuesWithUploader,
      conventionIntelligence: convention ? {
        separator: convention.separator,
        companyCodes: convention.companyCode || "",
        enforceUppercase: convention.enforceUppercase,
        isActive: convention.isActive,
        conventionVersion: latestVersion?.conventionVersion ?? convention.conventionVersion ?? 1,
        totalVersions: versions.length,
        userGuidance: convention.userGuidance || null,
        acceptedDisciplines: latestVersion?.acceptedDisciplines ?? [],
        acceptedDocTypes: latestVersion?.acceptedDocTypes ?? [],
        acceptedSystems: latestVersion?.acceptedSystems ?? [],
        latestChangeSummary: latestVersion?.changeSummary ?? null,
        latestAnalysisSummary: latestVersion?.analysisSummary ?? null,
      } : null,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ─── PATCH /:projectId/files/:fileId/confirm-violation ───────────────────────
// Called when user clicks "Continue Anyway" on the naming warning modal.
// Sets user_confirmed_non_compliant = true so the file counts as a real violation.
router.patch("/:projectId/files/:fileId/confirm-violation", authMiddleware, async (req, res) => {
  const projectId = Number(req.params.projectId);
  const fileId    = Number(req.params.fileId);
  if (isNaN(projectId) || isNaN(fileId)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    await db.update(filesTable)
      .set({ userConfirmedNonCompliant: true, updatedAt: new Date() })
      .where(and(eq(filesTable.id, fileId), eq(filesTable.projectId, projectId)));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ─── GET /cvr-health ──────────────────────────────────────────────────────────
router.get("/cvr-health", authMiddleware, async (req, res) => {
  try {
    const userProjects = await db.select({ projectId: projectMembersTable.projectId })
      .from(projectMembersTable).where(eq(projectMembersTable.userId, req.user!.userId));
    const projectIds = userProjects.map(p => p.projectId);

    if (projectIds.length === 0) {
      res.json({ totalFilesProcessed: 0, totalFlagged: 0, totalPendingReview: 0, totalAdminApproved: 0, totalAdminRejected: 0, healthStatus: "green" });
      return;
    }

    const allFiles = await db.select().from(filesTable).where(inArray(filesTable.projectId, projectIds));

    const totalFilesProcessed = allFiles.length;
    const totalFlagged = allFiles.filter(f => f.contentVerificationResult === "possible_mismatch" || f.contentVerificationResult === "clear_mismatch").length;
    const totalPendingReview = allFiles.filter(f => f.cvrWorkflowStatus === "pending_admin_review").length;
    const totalAdminApproved = allFiles.filter(f => f.cvrWorkflowStatus === "admin_approved").length;
    const totalAdminRejected = allFiles.filter(f => f.cvrWorkflowStatus === "admin_rejected").length;

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const hasOverdue = allFiles.some(f => f.cvrWorkflowStatus === "pending_admin_review" && new Date(f.createdAt) < oneDayAgo);

    let healthStatus: "green" | "amber" | "red" = "green";
    if (hasOverdue) healthStatus = "red";
    else if (totalPendingReview > 0) healthStatus = "amber";
    else if (totalFlagged > 0) healthStatus = "amber";

    res.json({ totalFilesProcessed, totalFlagged, totalPendingReview, totalAdminApproved, totalAdminRejected, healthStatus });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ─── POST /:projectId/files/:fileId/supersede ─────────────────────────────────
router.post("/:projectId/files/:fileId/supersede", authMiddleware, async (req, res) => {
  const projectId = Number(req.params.projectId);
  const fileId    = Number(req.params.fileId);
  const { new_file_id } = req.body as { new_file_id: number };
  if (isNaN(projectId) || isNaN(fileId) || !new_file_id) {
    res.status(400).json({ error: "projectId, fileId, and new_file_id required" }); return;
  }
  try {
    const [updated] = await db.update(filesTable)
      .set({ isSuperseded: true, supersededByFileId: new_file_id, updatedAt: new Date() })
      .where(and(eq(filesTable.id, fileId), eq(filesTable.projectId, projectId)))
      .returning();
    if (!updated) { res.status(404).json({ error: "File not found" }); return; }
    await db.insert(activityLogTable).values({
      projectId, userId: req.user!.userId,
      userFullName: req.user!.fullName, userCompanyName: req.user!.companyName,
      actionType: "supersede", entityType: "file", entityId: fileId,
      fileNameBefore: updated.fileName, fileNameAfter: null,
      details: `File manually superseded by file ID ${new_file_id}`,
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

export default router;


