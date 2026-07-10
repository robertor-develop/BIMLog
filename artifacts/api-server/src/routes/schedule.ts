import { Router } from "express";
import { db } from "@workspace/db";
import {
  activityLogTable,
  projectMilestonesTable,
  rfisTable,
  scheduleBucketsTable,
  scheduleItemPlacementsTable,
  scheduleRolloverHistoryTable,
  submittalsTable,
  usersTable,
} from "@workspace/db/schema";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { authMiddleware, requirePermission, requireProjectMember } from "../middlewares/auth";

const router: Router = Router();

const DEFAULT_BUCKETS = [
  { name: "This Week", bucketType: "system", sortOrder: 10 },
  { name: "Next Week", bucketType: "system", sortOrder: 20 },
  { name: "Later", bucketType: "system", sortOrder: 30 },
  { name: "Completed", bucketType: "system", sortOrder: 900 },
];

type SourceType = "milestone" | "rfi" | "submittal";

type LiveScheduleEvent = {
  id: number;
  source: SourceType;
  label: string;
  title: string;
  dueDate: string;
  status: string;
  priority: string | null;
  company: string | null;
  responsibleCompany: string | null;
  assignedUserId: number | null;
  assignedUserName: string | null;
  trade: string | null;
  buildingLevel: string | null;
  notes: string | null;
  route: string | null;
  linkedModule: string | null;
  linkedId: number | null;
  bucketId: number | null;
  bucketName: string | null;
  rolloverCount: number;
  daysOverdue: number;
  isOverdue: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

function isDone(status: string | null | undefined) {
  const s = (status || "").toLowerCase();
  return ["completed", "closed", "resolved", "approved", "approved_as_noted"].includes(s);
}

function daysOverdue(dueDate: Date | string, status: string | null | undefined) {
  if (isDone(status)) return 0;
  const due = new Date(dueDate);
  const today = new Date();
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((today.getTime() - due.getTime()) / 86400000));
}

async function ensureDefaultBuckets(projectId: number, userId?: number) {
  for (const bucket of DEFAULT_BUCKETS) {
    const existing = await db.select({ id: scheduleBucketsTable.id })
      .from(scheduleBucketsTable)
      .where(and(eq(scheduleBucketsTable.projectId, projectId), eq(scheduleBucketsTable.name, bucket.name)))
      .limit(1);
    if (existing.length > 0) continue;
    await db.insert(scheduleBucketsTable).values({
      projectId,
      name: bucket.name,
      bucketType: bucket.bucketType,
      sortOrder: bucket.sortOrder,
      createdById: userId ?? null,
    });
  }
}

async function getBuckets(projectId: number) {
  await ensureDefaultBuckets(projectId);
  return db.select().from(scheduleBucketsTable)
    .where(eq(scheduleBucketsTable.projectId, projectId))
    .orderBy(asc(scheduleBucketsTable.sortOrder), asc(scheduleBucketsTable.name));
}

function defaultBucketName(event: { status: string; dueDate: string; isOverdue: boolean }) {
  if (isDone(event.status)) return "Completed";
  const due = new Date(event.dueDate);
  const today = new Date();
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((due.getTime() - today.getTime()) / 86400000);
  if (diff <= 7) return "This Week";
  if (diff <= 14) return "Next Week";
  return "Later";
}

router.get("/projects/:projectId/schedule/buckets", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  try {
    res.json(await getBuckets(projectId));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

router.post("/projects/:projectId/schedule/buckets", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const body = req.body as { name?: string; bucket_type?: string; sort_order?: number };
  const name = body.name?.trim();
  if (!name) { res.status(400).json({ error: "Bucket name is required" }); return; }
  try {
    const existing = await db.select({ id: scheduleBucketsTable.id })
      .from(scheduleBucketsTable)
      .where(and(eq(scheduleBucketsTable.projectId, projectId), eq(scheduleBucketsTable.name, name)))
      .limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "A bucket with this name already exists" });
      return;
    }
    const [bucket] = await db.insert(scheduleBucketsTable).values({
      projectId,
      name,
      bucketType: body.bucket_type || "custom",
      sortOrder: body.sort_order ?? 100,
      createdById: req.user!.userId,
    }).returning();
    res.status(201).json(bucket);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

router.patch("/projects/:projectId/schedule/buckets/:bucketId", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const bucketId = Number(req.params.bucketId);
  const body = req.body as { name?: string; sort_order?: number };
  try {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.sort_order !== undefined) updates.sortOrder = body.sort_order;
    const [bucket] = await db.update(scheduleBucketsTable).set(updates as any)
      .where(and(eq(scheduleBucketsTable.id, bucketId), eq(scheduleBucketsTable.projectId, projectId)))
      .returning();
    if (!bucket) { res.status(404).json({ error: "Bucket not found" }); return; }
    res.json(bucket);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

router.get("/projects/:projectId/schedule/live", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  try {
    const [milestones, rfis, submittals, placements, users, buckets] = await Promise.all([
      db.select().from(projectMilestonesTable)
        .where(eq(projectMilestonesTable.projectId, projectId))
        .orderBy(asc(projectMilestonesTable.dueDate)),
      db.select().from(rfisTable)
        .where(and(eq(rfisTable.projectId, projectId), isNull(rfisTable.deletedAt))),
      db.select().from(submittalsTable)
        .where(and(eq(submittalsTable.projectId, projectId), isNull(submittalsTable.deletedAt))),
      db.select().from(scheduleItemPlacementsTable)
        .where(eq(scheduleItemPlacementsTable.projectId, projectId)),
      db.select({ id: usersTable.id, fullName: usersTable.fullName })
        .from(usersTable),
      getBuckets(projectId),
    ]);

    const toIso = (d: Date | string) => new Date(d).toISOString();
    const userById = new Map(users.map(u => [u.id, u.fullName]));
    const placementByItem = new Map(placements.map(p => [`${p.sourceType}:${p.sourceId}`, p]));
    const bucketById = new Map(buckets.map(b => [b.id, b]));
    const bucketByName = new Map(buckets.map(b => [b.name, b]));
    const attachPlanner = (event: Omit<LiveScheduleEvent, "bucketId" | "bucketName" | "rolloverCount">): LiveScheduleEvent => {
      const placement = placementByItem.get(`${event.source}:${event.id}`);
      const defaultBucket = bucketByName.get(defaultBucketName(event));
      const bucket = placement?.bucketId ? bucketById.get(placement.bucketId) : defaultBucket;
      return {
        ...event,
        bucketId: bucket?.id ?? null,
        bucketName: bucket?.name ?? null,
        rolloverCount: placement?.rolloverCount ?? 0,
      };
    };

    const events: LiveScheduleEvent[] = [];

    const milestoneRoute = (linkedModule: string | null, linkedId: number | null) => {
      if (linkedModule === "rfi" && linkedId) return `/projects/${projectId}/rfis?rfi=${linkedId}`;
      if (linkedModule === "submittal" && linkedId) return `/projects/${projectId}/submittals`;
      if (linkedModule === "change_order" && linkedId) return `/projects/${projectId}/change-orders`;
      if (linkedModule === "meeting" && linkedId) return `/projects/${projectId}/meetings`;
      return null;
    };

    events.push(...milestones.map((m) => {
      const sourceLabel =
        m.itemType === "3d_model" || m.linkedModule === "3d_model" ? "3D Model" :
        m.itemType === "change_order" || m.linkedModule === "change_order" ? "Change Order" :
        m.itemType === "meeting" || m.linkedModule === "meeting" ? "Meeting" :
        m.itemType === "rfi" || m.linkedModule === "rfi" ? "RFI Milestone" :
        m.itemType === "submittal" || m.linkedModule === "submittal" ? "Submittal Milestone" :
        "Milestone";
      const overdueDays = daysOverdue(m.dueDate, m.status);
      return attachPlanner({
        id: m.id,
        source: "milestone",
        label: sourceLabel,
        title: m.title || "Untitled milestone",
        dueDate: toIso(m.dueDate),
        status: m.status || "pending",
        priority: null,
        company: m.responsibleCompany || null,
        responsibleCompany: m.responsibleCompany || null,
        assignedUserId: m.assignedUserId || null,
        assignedUserName: m.assignedUserId ? userById.get(m.assignedUserId) || null : null,
        trade: m.trade || null,
        buildingLevel: m.buildingLevel || null,
        notes: m.notes || null,
        route: milestoneRoute(m.linkedModule, m.linkedId),
        linkedModule: m.linkedModule,
        linkedId: m.linkedId,
        isOverdue: overdueDays > 0,
        daysOverdue: overdueDays,
        createdAt: toIso(m.createdAt),
        updatedAt: toIso(m.updatedAt),
      });
    }));

    for (const r of rfis) {
      const due = r.dateRequired || r.dueDate;
      if (!due) continue;
      const overdueDays = daysOverdue(due, r.status);
      events.push(attachPlanner({
        id: r.id,
        source: "rfi",
        label: "RFI",
        title: `${r.number || `RFI-${r.id}`}: ${r.subject || "Untitled RFI"}`,
        dueDate: toIso(due),
        status: r.status || "open",
        priority: r.priority || null,
        company: r.submittedToCompany || r.ballInCourt || null,
        responsibleCompany: r.submittedToCompany || r.ballInCourt || null,
        assignedUserId: null,
        assignedUserName: r.submittedToPerson || null,
        trade: r.rfiType || null,
        buildingLevel: r.locationDescription || null,
        notes: null,
        route: `/projects/${projectId}/rfis?rfi=${r.id}`,
        linkedModule: "rfi",
        linkedId: r.id,
        isOverdue: overdueDays > 0,
        daysOverdue: overdueDays,
        createdAt: r.createdAt ? toIso(r.createdAt) : null,
        updatedAt: r.updatedAt ? toIso(r.updatedAt) : null,
      }));
    }

    for (const s of submittals) {
      const due = s.dateRequired || s.dueDate;
      if (!due) continue;
      const status = s.reviewDecision || s.status || "pending";
      const overdueDays = daysOverdue(due, status);
      events.push(attachPlanner({
        id: s.id,
        source: "submittal",
        label: "Submittal",
        title: `${s.number || `SUB-${s.id}`}: ${s.title || "Untitled submittal"}`,
        dueDate: toIso(due),
        status,
        priority: null,
        company: s.responsibleCompany || s.submittedByCompany || null,
        responsibleCompany: s.responsibleCompany || s.submittedByCompany || null,
        assignedUserId: null,
        assignedUserName: s.submittedToPerson || null,
        trade: s.trade || s.submittalCategory || s.submittalType || null,
        buildingLevel: s.floor || null,
        notes: null,
        route: `/projects/${projectId}/submittals`,
        linkedModule: "submittal",
        linkedId: s.id,
        isOverdue: overdueDays > 0,
        daysOverdue: overdueDays,
        createdAt: s.createdAt ? toIso(s.createdAt) : null,
        updatedAt: s.updatedAt ? toIso(s.updatedAt) : null,
      }));
    }

    events.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

router.post("/projects/:projectId/schedule/items/move", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const body = req.body as { source_type?: SourceType; source_id?: number; bucket_id?: number; rollover?: boolean };
  if (!body.source_type || !body.source_id || !body.bucket_id) {
    res.status(400).json({ error: "source_type, source_id, and bucket_id are required" });
    return;
  }
  try {
    const [bucket] = await db.select().from(scheduleBucketsTable)
      .where(and(eq(scheduleBucketsTable.id, body.bucket_id), eq(scheduleBucketsTable.projectId, projectId)))
      .limit(1);
    if (!bucket) { res.status(404).json({ error: "Bucket not found" }); return; }

    const [existing] = await db.select().from(scheduleItemPlacementsTable)
      .where(and(
        eq(scheduleItemPlacementsTable.projectId, projectId),
        eq(scheduleItemPlacementsTable.sourceType, body.source_type),
        eq(scheduleItemPlacementsTable.sourceId, body.source_id),
      ))
      .limit(1);

    const fromBucket = existing?.bucketId
      ? (await db.select().from(scheduleBucketsTable).where(eq(scheduleBucketsTable.id, existing.bucketId)).limit(1))[0]
      : null;
    const rolloverCount = (existing?.rolloverCount ?? 0) + (body.rollover ? 1 : 0);

    let placement;
    if (existing) {
      [placement] = await db.update(scheduleItemPlacementsTable)
        .set({ bucketId: bucket.id, rolloverCount, updatedById: req.user!.userId, updatedAt: new Date() })
        .where(eq(scheduleItemPlacementsTable.id, existing.id))
        .returning();
    } else {
      [placement] = await db.insert(scheduleItemPlacementsTable).values({
        projectId,
        sourceType: body.source_type,
        sourceId: body.source_id,
        bucketId: bucket.id,
        rolloverCount,
        updatedById: req.user!.userId,
      }).returning();
    }

    if (body.rollover || (fromBucket && fromBucket.id !== bucket.id)) {
      await db.insert(scheduleRolloverHistoryTable).values({
        projectId,
        sourceType: body.source_type,
        sourceId: body.source_id,
        fromBucketId: fromBucket?.id ?? null,
        fromBucketName: fromBucket?.name ?? "Unassigned",
        toBucketId: bucket.id,
        toBucketName: bucket.name,
        movedById: req.user!.userId,
        movedByName: req.user!.fullName,
      });
    }

    await db.insert(activityLogTable).values({
      projectId,
      userId: req.user!.userId,
      userFullName: req.user!.fullName,
      userCompanyName: req.user!.companyName,
      actionType: body.rollover ? "rollover" : "move",
      entityType: "schedule_item",
      entityId: body.source_id,
      fileNameBefore: null,
      fileNameAfter: null,
      details: `${body.rollover ? "Rolled over" : "Moved"} ${body.source_type} ${body.source_id} to ${bucket.name}`,
    });

    res.json(placement);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

router.post("/projects/:projectId/schedule/buckets/:fromBucketId/rollover", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const fromBucketId = Number(req.params.fromBucketId);
  const body = req.body as { to_bucket_id?: number };
  if (!body.to_bucket_id) { res.status(400).json({ error: "to_bucket_id is required" }); return; }
  try {
    const [fromBucket, toBucket] = await Promise.all([
      db.select().from(scheduleBucketsTable).where(and(eq(scheduleBucketsTable.id, fromBucketId), eq(scheduleBucketsTable.projectId, projectId))).limit(1),
      db.select().from(scheduleBucketsTable).where(and(eq(scheduleBucketsTable.id, body.to_bucket_id), eq(scheduleBucketsTable.projectId, projectId))).limit(1),
    ]);
    if (!fromBucket[0] || !toBucket[0]) { res.status(404).json({ error: "Bucket not found" }); return; }

    const placements = await db.select().from(scheduleItemPlacementsTable)
      .where(and(eq(scheduleItemPlacementsTable.projectId, projectId), eq(scheduleItemPlacementsTable.bucketId, fromBucketId)));
    const milestoneIds = placements.filter(p => p.sourceType === "milestone").map(p => p.sourceId);
    const rfiIds = placements.filter(p => p.sourceType === "rfi").map(p => p.sourceId);
    const submittalIds = placements.filter(p => p.sourceType === "submittal").map(p => p.sourceId);
    const completedMilestones = milestoneIds.length
      ? await db.select({ id: projectMilestonesTable.id, status: projectMilestonesTable.status }).from(projectMilestonesTable)
        .where(inArray(projectMilestonesTable.id, milestoneIds))
      : [];
    const completedRfis = rfiIds.length
      ? await db.select({ id: rfisTable.id, status: rfisTable.status }).from(rfisTable)
        .where(inArray(rfisTable.id, rfiIds))
      : [];
    const completedSubmittals = submittalIds.length
      ? await db.select({ id: submittalsTable.id, status: submittalsTable.status, reviewDecision: submittalsTable.reviewDecision }).from(submittalsTable)
        .where(inArray(submittalsTable.id, submittalIds))
      : [];
    const completedMilestoneIds = new Set(completedMilestones.filter(m => isDone(m.status)).map(m => m.id));
    const completedRfiIds = new Set(completedRfis.filter(r => isDone(r.status)).map(r => r.id));
    const completedSubmittalIds = new Set(completedSubmittals.filter(s => isDone(s.reviewDecision || s.status)).map(s => s.id));
    const toMove = placements.filter(p => {
      if (p.sourceType === "milestone") return !completedMilestoneIds.has(p.sourceId);
      if (p.sourceType === "rfi") return !completedRfiIds.has(p.sourceId);
      if (p.sourceType === "submittal") return !completedSubmittalIds.has(p.sourceId);
      return true;
    });

    for (const placement of toMove) {
      await db.update(scheduleItemPlacementsTable)
        .set({
          bucketId: toBucket[0].id,
          rolloverCount: placement.rolloverCount + 1,
          updatedById: req.user!.userId,
          updatedAt: new Date(),
        })
        .where(eq(scheduleItemPlacementsTable.id, placement.id));
      await db.insert(scheduleRolloverHistoryTable).values({
        projectId,
        sourceType: placement.sourceType,
        sourceId: placement.sourceId,
        fromBucketId: fromBucket[0].id,
        fromBucketName: fromBucket[0].name,
        toBucketId: toBucket[0].id,
        toBucketName: toBucket[0].name,
        movedById: req.user!.userId,
        movedByName: req.user!.fullName,
      });
    }

    res.json({ moved: toMove.length });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

router.get("/projects/:projectId/schedule/items/:sourceType/:sourceId/history", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const sourceType = String(req.params.sourceType);
  const sourceId = Number(req.params.sourceId);
  try {
    const rows = await db.select().from(scheduleRolloverHistoryTable)
      .where(and(
        eq(scheduleRolloverHistoryTable.projectId, projectId),
        eq(scheduleRolloverHistoryTable.sourceType, sourceType),
        eq(scheduleRolloverHistoryTable.sourceId, sourceId),
      ))
      .orderBy(asc(scheduleRolloverHistoryTable.movedAt));
    res.json(rows);
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
    const withOverdue = rows.map(r => ({
      ...r,
      isOverdue: r.status !== "completed" && new Date(r.dueDate) < new Date(),
    }));
    res.json(withOverdue);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

router.post("/projects/:projectId/milestones", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const body = req.body as {
    title?: string;
    due_date?: string;
    item_type?: string;
    linked_module?: string;
    linked_id?: number;
    building_level?: string;
    trade?: string;
    responsible_company?: string;
    assigned_user_id?: number;
    notes?: string;
    status?: string;
    bucket_id?: number;
  };
  if (!body.title || !body.due_date) { res.status(400).json({ error: "title and due_date required" }); return; }
  try {
    const [ms] = await db.insert(projectMilestonesTable).values({
      projectId,
      title: body.title,
      dueDate: new Date(body.due_date),
      itemType: body.item_type || (body.linked_module === "3d_model" ? "3d_model" : "milestone"),
      buildingLevel: body.building_level || null,
      trade: body.trade || null,
      responsibleCompany: body.responsible_company || null,
      assignedUserId: body.assigned_user_id ?? null,
      notes: body.notes || null,
      linkedModule: body.linked_module ?? null,
      linkedId: body.linked_id ?? null,
      createdById: req.user!.userId,
      status: body.status || "pending",
    }).returning();

    if (body.bucket_id) {
      await db.insert(scheduleItemPlacementsTable).values({
        projectId,
        sourceType: "milestone",
        sourceId: ms.id,
        bucketId: body.bucket_id,
        updatedById: req.user!.userId,
      });
    }

    await db.insert(activityLogTable).values({
      projectId,
      userId: req.user!.userId,
      userFullName: req.user!.fullName,
      userCompanyName: req.user!.companyName,
      actionType: "create",
      entityType: "milestone",
      entityId: ms.id,
      fileNameBefore: null,
      fileNameAfter: null,
      details: `Created schedule item: ${body.title}`,
    });
    res.status(201).json(ms);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

router.patch("/projects/:projectId/milestones/:milestoneId", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const msId = Number(req.params.milestoneId);
  const body = req.body as Partial<{
    title: string;
    due_date: string;
    status: string;
    building_level: string;
    trade: string;
    responsible_company: string;
    assigned_user_id: number | null;
    notes: string;
  }>;
  try {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.title !== undefined) updates.title = body.title;
    if (body.due_date !== undefined) updates.dueDate = body.due_date ? new Date(body.due_date) : null;
    if (body.status !== undefined) updates.status = body.status;
    if (body.building_level !== undefined) updates.buildingLevel = body.building_level || null;
    if (body.trade !== undefined) updates.trade = body.trade || null;
    if (body.responsible_company !== undefined) updates.responsibleCompany = body.responsible_company || null;
    if (body.assigned_user_id !== undefined) updates.assignedUserId = body.assigned_user_id || null;
    if (body.notes !== undefined) updates.notes = body.notes || null;
    const [updated] = await db.update(projectMilestonesTable).set(updates as any)
      .where(and(eq(projectMilestonesTable.id, msId), eq(projectMilestonesTable.projectId, projectId))).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    await db.insert(activityLogTable).values({
      projectId,
      userId: req.user!.userId,
      userFullName: req.user!.fullName,
      userCompanyName: req.user!.companyName,
      actionType: "update",
      entityType: "milestone",
      entityId: msId,
      fileNameBefore: null,
      fileNameAfter: null,
      details: `Updated schedule item ${updated.title}: ${Object.keys(updates).filter(k => k !== "updatedAt").join(", ") || "metadata"}`,
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

router.delete("/projects/:projectId/milestones/:milestoneId", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const msId = Number(req.params.milestoneId);
  try {
    const [deleted] = await db.delete(projectMilestonesTable)
      .where(and(eq(projectMilestonesTable.id, msId), eq(projectMilestonesTable.projectId, projectId)))
      .returning();
    if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
    await db.insert(activityLogTable).values({
      projectId,
      userId: req.user!.userId,
      userFullName: req.user!.fullName,
      userCompanyName: req.user!.companyName,
      actionType: "delete",
      entityType: "milestone",
      entityId: msId,
      fileNameBefore: null,
      fileNameAfter: null,
      details: `Deleted milestone: ${deleted.title}`,
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

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
