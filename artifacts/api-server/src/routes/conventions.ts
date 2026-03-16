import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { namingConventionsTable, namingFieldsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { UpsertConventionBody } from "@workspace/api-zod";
import { authMiddleware } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/projects/:projectId/conventions", authMiddleware, async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);

    const conventions = await db
      .select()
      .from(namingConventionsTable)
      .where(eq(namingConventionsTable.projectId, projectId))
      .limit(1);

    if (conventions.length === 0) {
      res.json({
        id: 0,
        projectId,
        separator: "-",
        isActive: false,
        fields: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    const convention = conventions[0];
    const fields = await db
      .select()
      .from(namingFieldsTable)
      .where(eq(namingFieldsTable.conventionId, convention.id))
      .orderBy(namingFieldsTable.fieldOrder);

    res.json({
      id: convention.id,
      projectId: convention.projectId,
      separator: convention.separator,
      isActive: convention.isActive,
      fields: fields.map((f) => ({
        id: f.id,
        label: f.label,
        fieldOrder: f.fieldOrder,
        allowedValues: f.allowedValues,
      })),
      createdAt: convention.createdAt.toISOString(),
      updatedAt: convention.updatedAt.toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/projects/:projectId/conventions", authMiddleware, async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    const body = UpsertConventionBody.parse(req.body);

    const existing = await db
      .select()
      .from(namingConventionsTable)
      .where(eq(namingConventionsTable.projectId, projectId))
      .limit(1);

    let conventionId: number;

    if (existing.length > 0) {
      const [updated] = await db
        .update(namingConventionsTable)
        .set({
          separator: body.separator,
          isActive: body.isActive,
          updatedAt: new Date(),
        })
        .where(eq(namingConventionsTable.id, existing[0].id))
        .returning();

      conventionId = updated.id;

      await db.delete(namingFieldsTable).where(eq(namingFieldsTable.conventionId, conventionId));
    } else {
      const [created] = await db
        .insert(namingConventionsTable)
        .values({
          projectId,
          separator: body.separator,
          isActive: body.isActive,
        })
        .returning();

      conventionId = created.id;
    }

    if (body.fields && body.fields.length > 0) {
      await db.insert(namingFieldsTable).values(
        body.fields.map((f: any) => ({
          conventionId,
          label: f.label,
          fieldOrder: f.fieldOrder,
          allowedValues: f.allowedValues,
        }))
      );
    }

    const convention = await db
      .select()
      .from(namingConventionsTable)
      .where(eq(namingConventionsTable.id, conventionId))
      .limit(1);

    const fields = await db
      .select()
      .from(namingFieldsTable)
      .where(eq(namingFieldsTable.conventionId, conventionId))
      .orderBy(namingFieldsTable.fieldOrder);

    res.json({
      id: convention[0].id,
      projectId: convention[0].projectId,
      separator: convention[0].separator,
      isActive: convention[0].isActive,
      fields: fields.map((f) => ({
        id: f.id,
        label: f.label,
        fieldOrder: f.fieldOrder,
        allowedValues: f.allowedValues,
      })),
      createdAt: convention[0].createdAt.toISOString(),
      updatedAt: convention[0].updatedAt.toISOString(),
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
