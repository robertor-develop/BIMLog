import { Router } from "express";
import { db } from "@workspace/db";
import { projectMilestonesTable, activityLogTable, rfisTable, submittalsTable } from "@workspace/db/schema";
import { eq, and, asc, isNull } from "drizzle-orm";
import { authMiddleware, requireProjectMember, requirePermission } from "../middlewares/auth";

const router: Router = Router();

type LiveScheduleEvent = {
  id: number;
  source: "milestone" | "rfi" | "submittal";
  label: string;
  title: string;
  dueDate: string;
  status: string;
  priority: string | null;
  company: string | null;
  route: string | null;
  isOverdue: boolean;
};

// ── GET /projects/:projectId/milestones ───────────────────────────────────────
router.get("/projects/:projectId/schedule/live", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  try {
    const [milestones, rfis, submittals] = await Promise.all([
      db.select().from(projectMilestonesTable)
        .where(eq(projectMilestonesTable.projectId, projectId))
        .orderBy(asc(projectMilestonesTable.dueDate)),
      db.select().from(rfisTable)
        .where(and(eq(rfisTable.projectId, projectId), isNull(rfisTable.deletedAt))),
      db.select().from(submittalsTable)
        .where(and(eq(submittalsTable.projectId, projectId), isNull(submittalsTable.deletedAt))),
    ]);

    const now = new Date();
    const toIso = (d: Date | string) => new Date(d).toISOString();
    const isDone = (status: string | null | undefined) => {
      const s = (status || "").toLowerCase();
      return ["completed", "closed", "resolved", "approved", "approved_as_noted"].includes(s);
    };

    const events: LiveScheduleEvent[] = [];

    events.push(...milestones.map((m) => ({
      id: m.id,
      source: "milestone" as const,
      label: "Milestone",
      title: m.title || "Untitled milestone",
      dueDate: toIso(m.dueDate),
      status: m.status || "pending",
      priority: null,
      company: null,
      route: null,
      isOverdue: !isDone(m.status) && new Date(m.dueDate) < now,
    })));

    for (const r of rfis) {
      const due = r.dateRequired || r.dueDate;
      if (!due) continue;
      events.push({
        id: r.id,
        source: "rfi" as const,
        label: "RFI",
        title: `${r.number || `RFI-${r.id}`}: ${r.subject || "Untitled RFI"}`,
        dueDate: toIso(due),
        status: r.status || "open",
        priority: r.priority || null,
        company: r.submittedToCompany || r.ballInCourt || null,
        route: `/projects/${projectId}/rfis?rfi=${r.id}`,
        isOverdue: !isDone(r.status) && new Date(due) < now,
      });
    }

    for (const s of submittals) {
      const due = s.dateRequired || s.dueDate;
      if (!due) continue;
      events.push({
        id: s.id,
        source: "submittal" as const,
        label: "Submittal",
        title: `${s.number || `SUB-${s.id}`}: ${s.title || "Untitled submittal"}`,
        dueDate: toIso(due),
        status: s.reviewDecision || s.status || "pending",
        priority: null,
        company: s.responsibleCompany || s.submittedByCompany || null,
        route: `/projects/${projectId}/submittals`,
        isOverdue: !isDone(s.reviewDecision || s.status) && new Date(due) < now,
      });
    }

    events.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

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
