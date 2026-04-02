import { Router } from "express";
import { db } from "@workspace/db";
import { projectMilestonesTable, activityLogTable } from "@workspace/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { authMiddleware, requireProjectMember, requirePermission } from "../middlewares/auth";

const router: Router = Router();

// ── GET /projects/:projectId/milestones ───────────────────────────────────────
router.get("/projects/:projectId/milestones", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  try {
    const rows = await db.select().from(projectMilestonesTable)
      .where(eq(projectMilestonesTable.projectId, projectId))
      .orderBy(asc(projectMilestonesTable.dueDate));
    const now = new Date();
    const withOverdue = rows.map(r => ({
      ...r,
      isOverdue: r.status !== "completed" && new Date(r.dueDate) < now,
    }));
    res.json(withOverdue);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── POST /projects/:projectId/milestones ──────────────────────────────────────
router.post("/projects/:projectId/milestones", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const body = req.body as { title: string; due_date: string; linked_module?: string; linked_id?: number };
  if (!body.title || !body.due_date) { res.status(400).json({ error: "title and due_date required" }); return; }
  try {
    const [ms] = await db.insert(projectMilestonesTable).values({
      projectId, title: body.title,
      dueDate: new Date(body.due_date),
      linkedModule: body.linked_module ?? null,
      linkedId: body.linked_id ?? null,
      createdById: req.user!.userId,
      status: "pending",
    }).returning();
    await db.insert(activityLogTable).values({
      projectId, userId: req.user!.userId,
      userFullName: req.user!.fullName, userCompanyName: req.user!.companyName,
      actionType: "create", entityType: "milestone", entityId: ms.id,
      fileNameBefore: null, fileNameAfter: null,
      details: `Created milestone: ${body.title}`,
    });
    res.status(201).json(ms);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── PATCH /projects/:projectId/milestones/:milestoneId ────────────────────────
router.patch("/projects/:projectId/milestones/:milestoneId", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const msId = Number(req.params.milestoneId);
  const body = req.body as Partial<{ title: string; due_date: string; status: string }>;
  try {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.title !== undefined)    updates.title   = body.title;
    if (body.due_date !== undefined) updates.dueDate = body.due_date ? new Date(body.due_date) : null;
    if (body.status !== undefined)   updates.status  = body.status;
    const [updated] = await db.update(projectMilestonesTable).set(updates as any)
      .where(and(eq(projectMilestonesTable.id, msId), eq(projectMilestonesTable.projectId, projectId))).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── POST /projects/:projectId/milestones/import ───────────────────────────────
router.post("/projects/:projectId/milestones/import", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const body = req.body as { rows: { title: string; due_date: string }[] };
  if (!body.rows?.length) { res.status(400).json({ error: "rows required" }); return; }
  try {
    let imported = 0; let skipped = 0;
    const errors: string[] = [];
    for (const row of body.rows) {
      if (!row.title || !row.due_date) { skipped++; continue; }
      const d = new Date(row.due_date);
      if (isNaN(d.getTime())) { errors.push(`Invalid date for "${row.title}"`); skipped++; continue; }
      await db.insert(projectMilestonesTable).values({
        projectId, title: row.title, dueDate: d,
        createdById: req.user!.userId, status: "pending",
      });
      imported++;
    }
    res.json({ imported_count: imported, skipped_count: skipped, errors });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

export default router;
