import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { filesTable, namingConventionsTable, namingFieldsTable, activityLogTable, usersTable, companiesTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { UploadFileBody, ListFilesParams, UpdateFileParams, UpdateFileBody, DeleteFileParams } from "@workspace/api-zod";
import { authMiddleware, requireProjectMember, requirePermission } from "../middlewares/auth";
import { getDefaultValue, validateConfigValue } from "../middlewares/config-validator";

const router: IRouter = Router();

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

  // Greedy matching: supports allowed values that contain the separator character.
  // For each field we try to consume a matching prefix from the remaining string.
  let remaining = nameWithoutExt;

  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    const allowed = field.allowedValues as string[];
    const isLast = i === fields.length - 1;

    if (allowed.length > 0) {
      // Try each allowed value (longest first to prefer more-specific matches).
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
        // Record what was actually at this position (up to the next separator).
        const nextSep = remaining.indexOf(sep);
        const actualValue = nextSep >= 0 ? remaining.slice(0, nextSep) : remaining;
        errors.push({
          field: field.label,
          message: `Value "${actualValue}" is not allowed for field "${field.label}"`,
          expected: allowed,
          received: actualValue,
        });
        // Advance past the bad segment for error recovery.
        remaining = nextSep >= 0 ? remaining.slice(nextSep + sep.length) : "";
      }
    } else {
      // Free field: consume up to the next separator (or to the end if last field).
      const nextSep = remaining.indexOf(sep);
      if (isLast) {
        remaining = "";
      } else if (nextSep >= 0) {
        remaining = remaining.slice(nextSep + sep.length);
      } else {
        // Not enough segments — will be caught by the trailing-content check.
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

  // Any leftover text means too many segments.
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

    res.status(201).json({
      ...file,
      uploadedByName: req.user!.fullName,
      uploadedByCompany: req.user!.companyName,
      createdAt: file.createdAt.toISOString(),
      updatedAt: file.updatedAt.toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bad request";
    res.status(400).json({ error: message });
  }
});

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
