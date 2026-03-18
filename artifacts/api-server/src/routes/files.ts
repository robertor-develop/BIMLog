import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { filesTable, namingConventionsTable, namingFieldsTable, activityLogTable, usersTable, companiesTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { UploadFileBody, ListFilesParams, UpdateFileParams, UpdateFileBody, DeleteFileParams } from "@workspace/api-zod";
import { authMiddleware, requireProjectMember, requirePermission } from "../middlewares/auth";
import { getDefaultValue, validateConfigValue } from "../middlewares/config-validator";
import { PDFParse } from "pdf-parse";

const router: IRouter = Router();

const BIM_EXTENSIONS = new Set(["rvt", "nwd", "dwg", "ifc", "dxf", "nwf", "nwc", "rfa", "rte"]);

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

// Async background extraction — called after upload response is sent
async function extractAndStoreContent(fileId: number, projectId: number, fileName: string, fileContent: string | undefined): Promise<void> {
  try {
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    let extractedText: string | null = null;
    let fileMetadata: Record<string, unknown> | null = null;

    if (ext === "pdf" && fileContent) {
      try {
        const buffer = Buffer.from(fileContent, "base64");
        const parser = new PDFParse({ data: buffer, verbosity: 0 });
        const result = await parser.getText();
        await parser.destroy();
        extractedText = result.text?.trim() || null;
      } catch (err) {
        console.error(`[files] pdf-parse failed for file ${fileId}:`, err instanceof Error ? err.message : err);
      }
    }

    if (BIM_EXTENSIONS.has(ext)) {
      fileMetadata = await parseFileNameMetadata(projectId, fileName);
    }

    if (extractedText !== null || fileMetadata !== null) {
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (extractedText !== null) updates.extractedText = extractedText;
      if (fileMetadata !== null) updates.fileMetadata = fileMetadata;
      await db.update(filesTable).set(updates).where(eq(filesTable.id, fileId));
      console.log(`[files] content indexed for file ${fileId} (${fileName}): pdf=${extractedText !== null}, bim=${fileMetadata !== null}`);
    }
  } catch (err) {
    console.error(`[files] background extraction failed for file ${fileId}:`, err instanceof Error ? err.message : err);
  }
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
        };
      })
    );

    res.json(results);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

// ─── POST /projects/:projectId/files ─────────────────────────────────────────
router.post("/projects/:projectId/files", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  try {
    const { projectId } = ListFilesParams.parse({ projectId: req.params.projectId });
    const body = UploadFileBody.parse(req.body);

    const validation = await validateFileName(projectId, body.fileName);
    if (!validation.valid) {
      res.status(422).json({
        error: "File name does not match the active naming convention",
        details: validation.details,
      });
      return;
    }

    const defaultFileStatus = await getDefaultValue("file_status");
    const [file] = await db.insert(filesTable).values({
      projectId,
      fileName: body.fileName,
      fileSize: body.fileSize,
      fileType: body.fileType,
      status: defaultFileStatus,
      uploadedById: req.user!.userId,
    }).returning();

    await db.insert(activityLogTable).values({
      projectId,
      userId: req.user!.userId,
      userFullName: req.user!.fullName,
      userCompanyName: req.user!.companyName,
      actionType: "upload",
      entityType: "file",
      entityId: file.id,
      fileNameBefore: null,
      fileNameAfter: body.fileName,
      details: `Uploaded file: ${body.fileName}`,
    });

    // Respond immediately — extraction runs in background
    res.status(201).json({
      ...file,
      uploadedByName: req.user!.fullName,
      uploadedByCompany: req.user!.companyName,
      createdAt: file.createdAt.toISOString(),
      updatedAt: file.updatedAt.toISOString(),
    });

    // Fire-and-forget background extraction (does not affect response)
    setImmediate(() => {
      extractAndStoreContent(file.id, projectId, body.fileName, body.fileContent).catch(() => {});
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bad request";
    res.status(400).json({ error: message });
  }
});

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

    // If renamed to a BIM file, re-parse metadata in background
    if (body.fileName) {
      const newExt = body.fileName.split(".").pop()?.toLowerCase() || "";
      if (BIM_EXTENSIONS.has(newExt)) {
        setImmediate(() => {
          extractAndStoreContent(fileId, projectId, body.fileName!, undefined).catch(() => {});
        });
      }
    }

    res.json({
      ...updated,
      uploadedByName: req.user!.fullName,
      uploadedByCompany: req.user!.companyName,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
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
