import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { rfisTable, usersTable, activityLogTable } from "@workspace/db/schema";
import { eq, and, count } from "drizzle-orm";
import { CreateRfiBody, ListRfisParams, UpdateRfiParams, UpdateRfiBody } from "@workspace/api-zod";
import { authMiddleware, requireProjectMember, requirePermission } from "../middlewares/auth";
import { validateConfigValue, getDefaultValue, getConfigOptionMeta } from "../middlewares/config-validator";

const router: IRouter = Router();

router.get("/projects/:projectId/rfis", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const { projectId } = ListRfisParams.parse({ projectId: req.params.projectId });

    const rfis = await db.query.rfisTable.findMany({
      where: eq(rfisTable.projectId, projectId),
      orderBy: (rfis, { desc }) => [desc(rfis.createdAt)],
    });

    const results = await Promise.all(
      rfis.map(async (r) => {
        const creator = await db.select().from(usersTable).where(eq(usersTable.id, r.createdById)).limit(1);
        let assignedToName: string | undefined;
        if (r.assignedToId) {
          const assignee = await db.select().from(usersTable).where(eq(usersTable.id, r.assignedToId)).limit(1);
          assignedToName = assignee[0]?.fullName;
        }
        return {
          ...r,
          createdByName: creator[0]?.fullName || "",
          assignedToName,
          dueDate: r.dueDate?.toISOString(),
          respondedAt: r.respondedAt?.toISOString(),
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        };
      })
    );

    res.json(results);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

router.post("/projects/:projectId/rfis", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  try {
    const { projectId } = ListRfisParams.parse({ projectId: req.params.projectId });
    const body = CreateRfiBody.parse(req.body);

    if (body.priority && !(await validateConfigValue("rfi_priority", body.priority))) {
      res.status(422).json({ error: `Invalid priority value: ${body.priority}` });
      return;
    }

    const [rfiCount] = await db.select({ count: count() }).from(rfisTable).where(eq(rfisTable.projectId, projectId));
    const number = `RFI-${String((rfiCount.count as number) + 1).padStart(4, "0")}`;

    const defaultRfiStatus = await getDefaultValue("rfi_status");
    const [rfi] = await db.insert(rfisTable).values({
      projectId,
      number,
      subject: body.subject,
      description: body.description || null,
      status: defaultRfiStatus,
      priority: body.priority,
      assignedToId: body.assignedToId || null,
      createdById: req.user!.userId,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
    }).returning();

    await db.insert(activityLogTable).values({
      projectId,
      userId: req.user!.userId,
      userFullName: req.user!.fullName,
      userCompanyName: req.user!.companyName,
      actionType: "create",
      entityType: "rfi",
      entityId: rfi.id,
      details: `Created RFI ${number}: ${body.subject}`,
    });

    res.status(201).json({
      ...rfi,
      createdByName: req.user!.fullName,
      dueDate: rfi.dueDate?.toISOString(),
      respondedAt: rfi.respondedAt?.toISOString(),
      createdAt: rfi.createdAt.toISOString(),
      updatedAt: rfi.updatedAt.toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bad request";
    res.status(400).json({ error: message });
  }
});

router.patch("/projects/:projectId/rfis/:rfiId", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  try {
    const { projectId, rfiId } = UpdateRfiParams.parse({ projectId: req.params.projectId, rfiId: req.params.rfiId });
    const body = UpdateRfiBody.parse(req.body);

    const existing = await db.select().from(rfisTable).where(and(eq(rfisTable.id, rfiId), eq(rfisTable.projectId, projectId))).limit(1);
    if (existing.length === 0) {
      res.status(404).json({ error: "RFI not found" });
      return;
    }

    if (body.status && !(await validateConfigValue("rfi_status", body.status))) {
      res.status(422).json({ error: `Invalid status value: ${body.status}` });
      return;
    }
    if (body.priority && !(await validateConfigValue("rfi_priority", body.priority))) {
      res.status(422).json({ error: `Invalid priority value: ${body.priority}` });
      return;
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.subject) updates.subject = body.subject;
    if (body.description !== undefined) updates.description = body.description;
    if (body.status) {
      updates.status = body.status;
      const statusMeta = await getConfigOptionMeta("rfi_status", body.status);
      if (String(statusMeta?.setsRespondedAt) === "true") {
        updates.respondedAt = new Date();
      }
    }
    if (body.priority) updates.priority = body.priority;
    if (body.assignedToId !== undefined) updates.assignedToId = body.assignedToId;
    if (body.response !== undefined) updates.response = body.response;
    if (body.dueDate !== undefined) updates.dueDate = body.dueDate ? new Date(body.dueDate) : null;

    const [updated] = await db.update(rfisTable).set(updates).where(eq(rfisTable.id, rfiId)).returning();

    await db.insert(activityLogTable).values({
      projectId,
      userId: req.user!.userId,
      userFullName: req.user!.fullName,
      userCompanyName: req.user!.companyName,
      actionType: "update",
      entityType: "rfi",
      entityId: rfiId,
      details: `Updated RFI ${updated.number}`,
    });

    res.json({
      ...updated,
      createdByName: req.user!.fullName,
      dueDate: updated.dueDate?.toISOString(),
      respondedAt: updated.respondedAt?.toISOString(),
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bad request";
    res.status(400).json({ error: message });
  }
});

export default router;
