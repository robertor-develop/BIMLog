import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { submittalsTable, usersTable, activityLogTable } from "@workspace/db/schema";
import { eq, and, count } from "drizzle-orm";
import { CreateSubmittalBody, ListSubmittalsParams, UpdateSubmittalParams, UpdateSubmittalBody } from "@workspace/api-zod";
import { authMiddleware, requireProjectMember, requirePermission } from "../middlewares/auth";
import { validateConfigValue } from "../middlewares/config-validator";

const router: IRouter = Router();

router.get("/projects/:projectId/submittals", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const { projectId } = ListSubmittalsParams.parse({ projectId: req.params.projectId });

    const submittals = await db.query.submittalsTable.findMany({
      where: eq(submittalsTable.projectId, projectId),
      orderBy: (s, { desc }) => [desc(s.createdAt)],
    });

    const results = await Promise.all(
      submittals.map(async (s) => {
        const submitter = await db.select().from(usersTable).where(eq(usersTable.id, s.submittedById)).limit(1);
        let assignedToName: string | undefined;
        if (s.assignedToId) {
          const assignee = await db.select().from(usersTable).where(eq(usersTable.id, s.assignedToId)).limit(1);
          assignedToName = assignee[0]?.fullName;
        }
        return {
          ...s,
          submittedByName: submitter[0]?.fullName || "",
          assignedToName,
          dueDate: s.dueDate?.toISOString(),
          createdAt: s.createdAt.toISOString(),
          updatedAt: s.updatedAt.toISOString(),
        };
      })
    );

    res.json(results);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

router.post("/projects/:projectId/submittals", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  try {
    const { projectId } = ListSubmittalsParams.parse({ projectId: req.params.projectId });
    const body = CreateSubmittalBody.parse(req.body);

    if (body.submittalType && !(await validateConfigValue("submittal_type", body.submittalType))) {
      res.status(422).json({ error: `Invalid submittal type: ${body.submittalType}` });
      return;
    }

    const [submittalCount] = await db.select({ count: count() }).from(submittalsTable).where(eq(submittalsTable.projectId, projectId));
    const number = `SUB-${String((submittalCount.count as number) + 1).padStart(4, "0")}`;

    const [submittal] = await db.insert(submittalsTable).values({
      projectId,
      number,
      title: body.title,
      description: body.description || null,
      submittalType: body.submittalType,
      specSection: body.specSection || null,
      submittedById: req.user!.userId,
      assignedToId: body.assignedToId || null,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
    }).returning();

    await db.insert(activityLogTable).values({
      projectId,
      userId: req.user!.userId,
      userFullName: req.user!.fullName,
      userCompanyName: req.user!.companyName,
      actionType: "create",
      entityType: "submittal",
      entityId: submittal.id,
      details: `Created submittal ${number}: ${body.title}`,
    });

    res.status(201).json({
      ...submittal,
      submittedByName: req.user!.fullName,
      dueDate: submittal.dueDate?.toISOString(),
      createdAt: submittal.createdAt.toISOString(),
      updatedAt: submittal.updatedAt.toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bad request";
    res.status(400).json({ error: message });
  }
});

router.patch("/projects/:projectId/submittals/:submittalId", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  try {
    const { projectId, submittalId } = UpdateSubmittalParams.parse({ projectId: req.params.projectId, submittalId: req.params.submittalId });
    const body = UpdateSubmittalBody.parse(req.body);

    const existing = await db.select().from(submittalsTable).where(and(eq(submittalsTable.id, submittalId), eq(submittalsTable.projectId, projectId))).limit(1);
    if (existing.length === 0) {
      res.status(404).json({ error: "Submittal not found" });
      return;
    }

    if (body.status && !(await validateConfigValue("submittal_status", body.status))) {
      res.status(422).json({ error: `Invalid status value: ${body.status}` });
      return;
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.title) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.status) updates.status = body.status;
    if (body.specSection !== undefined) updates.specSection = body.specSection;
    if (body.assignedToId !== undefined) updates.assignedToId = body.assignedToId;
    if (body.dueDate !== undefined) updates.dueDate = body.dueDate ? new Date(body.dueDate) : null;

    const [updated] = await db.update(submittalsTable).set(updates).where(eq(submittalsTable.id, submittalId)).returning();

    await db.insert(activityLogTable).values({
      projectId,
      userId: req.user!.userId,
      userFullName: req.user!.fullName,
      userCompanyName: req.user!.companyName,
      actionType: "update",
      entityType: "submittal",
      entityId: submittalId,
      details: `Updated submittal ${updated.number}`,
    });

    res.json({
      ...updated,
      submittedByName: req.user!.fullName,
      dueDate: updated.dueDate?.toISOString(),
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bad request";
    res.status(400).json({ error: message });
  }
});

export default router;
