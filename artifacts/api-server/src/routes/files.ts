import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { filesTable, namingConventionsTable, namingFieldsTable, activityLogTable, usersTable, companiesTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { UploadFileBody, ListFilesParams, UpdateFileParams, UpdateFileBody, DeleteFileParams } from "@workspace/api-zod";
import { authMiddleware, requireProjectMember, requirePermission } from "../middlewares/auth";
import { getDefaultValue } from "../middlewares/config-validator";

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

  const nameWithoutExt = fileName.includes(".") ? fileName.substring(0, fileName.lastIndexOf(".")) : fileName;
  const parts = nameWithoutExt.split(convention.separator);

  if (parts.length !== fields.length) {
    return {
      valid: false,
      details: [{
        field: "fileName",
        message: `Expected ${fields.length} segments separated by "${convention.separator}", got ${parts.length}`,
        expected: fields.map(f => f.label),
        received: nameWithoutExt,
      }],
    };
  }

  const errors: ValidationDetail[] = [];
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    const value = parts[i];
    const allowed = field.allowedValues as string[];

    if (allowed.length > 0 && !allowed.includes(value)) {
      errors.push({
        field: field.label,
        message: `Value "${value}" is not allowed for field "${field.label}"`,
        expected: allowed,
        received: value,
      });
    }
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
