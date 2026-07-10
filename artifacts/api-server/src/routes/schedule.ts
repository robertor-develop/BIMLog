import { Router } from "express";
import { db } from "@workspace/db";
import {
  activityLogTable,
  meetingMinutesTable,
  projectsTable,
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
import { getCompanyLogo } from "../lib/pdf-logo";
import {
  addPageNumbers,
  computeContentHash,
  createPdfDocument,
  drawBrandedHeader,
  drawCoverPage,
  drawTable,
  PALETTE,
  sectionBar,
  type TableColumn,
} from "../lib/pdf-kit";

const router: Router = Router();

const DEFAULT_BUCKETS = [
  { name: "This Week", bucketType: "system", sortOrder: 10 },
  { name: "Next Week", bucketType: "system", sortOrder: 20 },
  { name: "Later", bucketType: "system", sortOrder: 30 },
  { name: "Completed", bucketType: "system", sortOrder: 900 },
];

type SourceType = "milestone" | "rfi" | "submittal" | "meeting";

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

async function buildLiveSchedule(projectId: number) {
  const [milestones, rfis, submittals, meetings, placements, users, buckets] = await Promise.all([
    db.select().from(projectMilestonesTable)
      .where(eq(projectMilestonesTable.projectId, projectId))
      .orderBy(asc(projectMilestonesTable.dueDate)),
    db.select().from(rfisTable)
      .where(and(eq(rfisTable.projectId, projectId), isNull(rfisTable.deletedAt))),
    db.select().from(submittalsTable)
      .where(and(eq(submittalsTable.projectId, projectId), isNull(submittalsTable.deletedAt))),
    db.select().from(meetingMinutesTable)
      .where(and(eq(meetingMinutesTable.projectId, projectId), isNull(meetingMinutesTable.deletedAt))),
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
  const manuallyScheduledMeetingIds = new Set(
    milestones
      .filter(m => m.linkedModule === "meeting" && m.linkedId)
      .map(m => m.linkedId as number),
  );

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

  for (const meeting of meetings) {
    if (manuallyScheduledMeetingIds.has(meeting.id)) continue;
    const meetingDate = meeting.meetingDate;
    if (!meetingDate) continue;
    const now = new Date();
    const meetingStatus = new Date(meetingDate).getTime() < now.getTime() ? "completed" : "scheduled";
    events.push(attachPlanner({
      id: meeting.id,
      source: "meeting",
      label: "Meeting",
      title: meeting.title || "Untitled meeting",
      dueDate: toIso(meetingDate),
      status: meetingStatus,
      priority: null,
      company: null,
      responsibleCompany: null,
      assignedUserId: meeting.createdById || null,
      assignedUserName: meeting.createdById ? userById.get(meeting.createdById) || null : null,
      trade: null,
      buildingLevel: meeting.location || null,
      notes: meeting.notes || null,
      route: `/projects/${projectId}/meetings`,
      linkedModule: "meeting",
      linkedId: meeting.id,
      isOverdue: false,
      daysOverdue: 0,
      createdAt: meeting.createdAt ? toIso(meeting.createdAt) : null,
      updatedAt: meeting.updatedAt ? toIso(meeting.updatedAt) : null,
    }));
  }

  events.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  return { events, buckets };
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
    await db.insert(activityLogTable).values({
      projectId,
      userId: req.user!.userId,
      userFullName: req.user!.fullName,
      userCompanyName: req.user!.companyName,
      actionType: "create",
      entityType: "schedule_bucket",
      entityId: bucket.id,
      fileNameBefore: null,
      fileNameAfter: null,
      details: `Created schedule bucket: ${bucket.name}`,
    });
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
    await db.insert(activityLogTable).values({
      projectId,
      userId: req.user!.userId,
      userFullName: req.user!.fullName,
      userCompanyName: req.user!.companyName,
      actionType: "update",
      entityType: "schedule_bucket",
      entityId: bucket.id,
      fileNameBefore: null,
      fileNameAfter: null,
      details: `Updated schedule bucket: ${bucket.name}`,
    });
    res.json(bucket);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

router.get("/projects/:projectId/schedule/live", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  try {
    const { events } = await buildLiveSchedule(projectId);
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

type ExportView = "calendar" | "board" | "list";

function boolQuery(value: unknown, fallback: boolean) {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value) === "true";
}

function displayStatus(status: string | null | undefined, overdue?: boolean) {
  if (overdue && !isDone(status)) return "Overdue";
  return (status || "pending").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function scheduleTypeKey(item: LiveScheduleEvent) {
  if (item.source === "rfi" || item.label.includes("RFI")) return "rfi";
  if (item.source === "submittal" || item.label.includes("Submittal")) return "submittal";
  if (item.source === "meeting" || item.label === "Meeting") return "meeting";
  if (item.label === "Change Order") return "change_order";
  if (item.label === "3D Model") return "3d_model";
  return "milestone";
}

function nextAction(item: LiveScheduleEvent) {
  if (isDone(item.status)) return "No action - closed/completed";
  if (item.isOverdue) return "Escalate overdue item";
  if (["pending", "open", "scheduled"].includes((item.status || "").toLowerCase())) return "Review in coordination";
  if ((item.status || "").toLowerCase() === "in_progress") return "Follow up assigned owner";
  return "Monitor";
}

function sourceProof(item: LiveScheduleEvent) {
  if (item.route) return `${item.linkedModule || item.source} #${item.linkedId || item.id}`;
  return "Manual schedule item";
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-US");
}

function sameDayKey(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addReportPage(doc: PDFKit.PDFDocument, opts: {
  companyName: string;
  title: string;
  projectName: string;
  projectCode?: string;
  reportNumber: string;
  reportDate: Date;
}) {
  doc.addPage();
  return drawBrandedHeader(doc, {
    margin: 40,
    companyName: opts.companyName,
    title: opts.title,
    projectName: opts.projectName,
    projectCode: opts.projectCode,
    reportNumber: opts.reportNumber,
    reportDate: opts.reportDate,
  });
}

function drawSummaryCards(doc: PDFKit.PDFDocument, y: number, cards: Array<[string, string]>) {
  const M = 40;
  const boxW = 124;
  const gap = 8;
  cards.forEach(([label, value], index) => {
    const x = M + index * (boxW + gap);
    doc.rect(x, y, boxW, 42).stroke(PALETTE.LINE);
    doc.fontSize(7).font(PALETTE.FONT_BOLD).fillColor(PALETTE.MUTED)
      .text(label.toUpperCase(), x + 7, y + 8, { width: boxW - 14, lineBreak: false });
    doc.fontSize(15).font(PALETTE.FONT_BOLD).fillColor(PALETTE.TEXT)
      .text(value, x + 7, y + 22, { width: boxW - 14, lineBreak: false });
  });
  return y + 54;
}

function drawScheduleTable(doc: PDFKit.PDFDocument, rows: LiveScheduleEvent[], startY: number, columns: TableColumn[], header: () => number) {
  return drawTable(doc, {
    x: 40,
    startY,
    columns,
    rows,
    fontSize: 6.5,
    headerFontSize: 6.5,
    rowMinHeight: 28,
    pageBottom: 540,
    onPageBreak: header,
  });
}

router.get("/projects/:projectId/schedule/export-pdf", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const reportDate = new Date();
  try {
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }

    const view = ["calendar", "board", "list"].includes(String(req.query.view)) ? String(req.query.view) as ExportView : "list";
    const statusFilter = String(req.query.status || "all");
    const typeFilter = String(req.query.item_type || "all");
    const bucketFilter = req.query.bucket_id ? Number(req.query.bucket_id) : null;
    const startDate = req.query.start_date ? new Date(String(req.query.start_date)) : null;
    const endDate = req.query.end_date ? new Date(String(req.query.end_date)) : null;
    if (startDate && Number.isNaN(startDate.getTime())) { res.status(400).json({ error: "Invalid start_date" }); return; }
    if (endDate && Number.isNaN(endDate.getTime())) { res.status(400).json({ error: "Invalid end_date" }); return; }

    const options = {
      includeProgress: boolQuery(req.query.include_progress, true),
      includeKpis: boolQuery(req.query.include_kpis, true),
      includeActionNeeded: boolQuery(req.query.include_action_needed, true),
      includeCompleted: boolQuery(req.query.include_completed, true),
      includeOverdue: boolQuery(req.query.include_overdue, true),
      includeRolloverHistory: boolQuery(req.query.include_rollover_history, false),
      includeOwnershipColumns: boolQuery(req.query.include_ownership_columns, true),
    };

    const { events, buckets } = await buildLiveSchedule(projectId);
    let filtered = events.filter(item => {
      const due = new Date(item.dueDate);
      if (startDate && due < startDate) return false;
      if (endDate) {
        const endInclusive = new Date(endDate);
        endInclusive.setHours(23, 59, 59, 999);
        if (due > endInclusive) return false;
      }
      if (typeFilter !== "all" && scheduleTypeKey(item) !== typeFilter) return false;
      if (view === "board" && bucketFilter && item.bucketId !== bucketFilter) return false;
      if (statusFilter === "overdue" && !(item.isOverdue && !isDone(item.status))) return false;
      if (statusFilter === "action" && !(item.status === "pending" || item.status === "open" || (item.isOverdue && !isDone(item.status)))) return false;
      if (!["all", "overdue", "action"].includes(statusFilter) && item.status !== statusFilter) return false;
      if (!options.includeCompleted && isDone(item.status)) return false;
      if (!options.includeOverdue && item.isOverdue && !isDone(item.status)) return false;
      if (!options.includeActionNeeded && (item.status === "pending" || item.status === "open" || (item.isOverdue && !isDone(item.status)))) return false;
      return true;
    });

    filtered = filtered.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    const completed = filtered.filter(i => isDone(i.status)).length;
    const overdue = filtered.filter(i => i.isOverdue && !isDone(i.status)).length;
    const actionNeeded = filtered.filter(i => i.status === "pending" || i.status === "open" || (i.isOverdue && !isDone(i.status))).length;
    const pct = filtered.length ? Math.round((completed / filtered.length) * 100) : 0;
    const reportNumber = `SCH-${project.code}-${reportDate.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14)}`;

    const histories = options.includeRolloverHistory
      ? await db.select().from(scheduleRolloverHistoryTable).where(eq(scheduleRolloverHistoryTable.projectId, projectId)).orderBy(asc(scheduleRolloverHistoryTable.movedAt))
      : [];
    const itemKeys = new Set(filtered.map(i => `${i.source}:${i.id}`));
    const filteredHistories = histories.filter(h => itemKeys.has(`${h.sourceType}:${h.sourceId}`));

    const snapshot = {
      projectId,
      reportNumber,
      generatedAt: reportDate.toISOString(),
      filters: { view, statusFilter, typeFilter, bucketFilter, startDate, endDate, options },
      items: filtered,
      rolloverHistory: filteredHistories,
    };
    const contentHash = computeContentHash(snapshot);
    const { logoBase64, logoType } = await getCompanyLogo(req.user!.userId);
    const companyName = req.user!.companyName || "BIMLog";
    const reportTitle = view === "calendar" ? "Schedule Calendar Export" : view === "board" ? "Coordination Board Export" : "Schedule Register Export";

    const doc = createPdfDocument({ size: "LETTER", layout: "landscape", margin: 40, bufferPages: true, autoFirstPage: true });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="schedule-${view}-${project.code}.pdf"`);
    doc.pipe(res);

    drawCoverPage(doc, {
      margin: 40,
      logoBase64,
      logoType,
      companyName,
      reportTitle: "Schedule - Coordination Planner",
      reportNumber,
      reportDate,
      preparedBy: req.user!.fullName,
      projectName: project.name,
      projectAddress: project.location || undefined,
      projectMeta: `Project Code: ${project.code} | Items: ${filtered.length} | View: ${view.toUpperCase()}`,
      isoStamp: false,
    });

    let y = addReportPage(doc, {
      companyName,
      title: reportTitle,
      projectName: project.name,
      projectCode: project.code,
      reportNumber,
      reportDate,
    }) + 10;

    const filterLines = [
      `Date Range: ${startDate ? formatDate(startDate) : "All"} to ${endDate ? formatDate(endDate) : "All"}`,
      `Status: ${statusFilter.replace(/_/g, " ")}`,
      `Item Type: ${typeFilter.replace(/_/g, " ")}`,
      view === "board" && bucketFilter ? `Bucket/Sprint: ${buckets.find(b => b.id === bucketFilter)?.name || bucketFilter}` : "",
    ].filter(Boolean);
    doc.fontSize(10).font(PALETTE.FONT).fillColor(PALETTE.TEXT).text(filterLines.join(" | "), 40, y, { width: 712 });
    y = doc.y + 14;

    if (options.includeKpis) {
      y = sectionBar(doc, "KPI Summary", y);
      y = drawSummaryCards(doc, y, [
        ["Total Items", String(filtered.length)],
        ["Action Needed", String(actionNeeded)],
        ["Overdue", String(overdue)],
        ["Completed", `${completed}/${filtered.length}`],
        ["Progress", `${pct}%`],
      ]);
    }

    if (options.includeProgress) {
      y = sectionBar(doc, "Overall Progress", y);
      doc.rect(40, y, 712, 10).stroke(PALETTE.LINE);
      doc.rect(40, y, Math.max(0, Math.min(712, 712 * pct / 100)), 10).fill(PALETTE.TEXT);
      doc.fontSize(8).font(PALETTE.FONT).fillColor(PALETTE.TEXT).text(`${pct}% complete`, 40, y + 16, { width: 712 });
      y += 36;
    }

    const baseColumns: TableColumn[] = [
      { label: "Type", width: 50, format: r => r.label },
      { label: "Item / Record", width: 145, wrap: true, bold: true, format: r => r.title },
      { label: "Due Date", width: 46, format: r => formatDate(r.dueDate) },
      { label: "State", width: 52, format: r => displayStatus(r.status, r.isOverdue) },
      { label: "Days Late", width: 36, align: "right", format: r => String(r.daysOverdue || 0) },
      { label: "Source / Proof", width: 78, format: r => sourceProof(r) },
      { label: "Next Action", width: 70, wrap: true, format: r => nextAction(r) },
    ];
    const ownershipColumns: TableColumn[] = [
      { label: "Company", width: 58, format: r => r.responsibleCompany || r.company || "-" },
      { label: "Assigned", width: 54, format: r => r.assignedUserName || "-" },
      { label: "Trade/Level", width: 50, format: r => [r.trade, r.buildingLevel].filter(Boolean).join(" / ") || "-" },
    ];
    const tableColumns = options.includeOwnershipColumns
      ? [baseColumns[0], baseColumns[1], baseColumns[2], ...ownershipColumns, baseColumns[3], baseColumns[4], baseColumns[5], baseColumns[6]]
      : baseColumns;

    if (view === "calendar") {
      y = sectionBar(doc, "Calendar View", y);
      const byMonth = new Map<string, LiveScheduleEvent[]>();
      filtered.forEach(item => {
        const d = new Date(item.dueDate);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        byMonth.set(key, [...(byMonth.get(key) || []), item]);
      });
      if (byMonth.size === 0) byMonth.set("empty", []);
      for (const [monthKey, rows] of byMonth) {
        if (y > 420) y = addReportPage(doc, { companyName, title: "Schedule Calendar", projectName: project.name, projectCode: project.code, reportNumber, reportDate });
        const monthDate = monthKey === "empty" ? reportDate : new Date(`${monthKey}-01T00:00:00`);
        doc.fontSize(11).font(PALETTE.FONT_BOLD).fillColor(PALETTE.TEXT)
          .text(monthDate.toLocaleDateString("en-US", { month: "long", year: "numeric" }), 40, y);
        y += 18;
        const cellW = 101.7;
        const cellH = 66;
        ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((day, idx) => {
          doc.rect(40 + idx * cellW, y, cellW, 16).fill(PALETTE.NAVY);
          doc.fontSize(7).font(PALETTE.FONT_BOLD).fillColor("white").text(day, 43 + idx * cellW, y + 5, { width: cellW - 6 });
        });
        y += 16;
        const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
        start.setDate(start.getDate() - start.getDay());
        const rowsByDay = rows.reduce<Record<string, LiveScheduleEvent[]>>((acc, item) => {
          (acc[sameDayKey(new Date(item.dueDate))] ||= []).push(item);
          return acc;
        }, {});
        for (let week = 0; week < 6; week++) {
          if (y + cellH > 540) y = addReportPage(doc, { companyName, title: "Schedule Calendar", projectName: project.name, projectCode: project.code, reportNumber, reportDate });
          for (let day = 0; day < 7; day++) {
            const d = new Date(start);
            d.setDate(start.getDate() + week * 7 + day);
            const x = 40 + day * cellW;
            const inMonth = d.getMonth() === monthDate.getMonth();
            doc.rect(x, y, cellW, cellH).stroke(PALETTE.LINE);
            doc.fontSize(7).font(PALETTE.FONT_BOLD).fillColor(inMonth ? PALETTE.TEXT : PALETTE.MUTED)
              .text(String(d.getDate()), x + 4, y + 4, { width: cellW - 8 });
            const dayItems = rowsByDay[sameDayKey(d)] || [];
            dayItems.slice(0, 4).forEach((item, idx) => {
              doc.fontSize(5.8).font(PALETTE.FONT).fillColor(PALETTE.TEXT)
                .text(`${item.label}: ${item.title}`, x + 4, y + 15 + idx * 11, { width: cellW - 8, height: 9, ellipsis: true, lineBreak: false });
            });
            if (dayItems.length > 4) {
              doc.fontSize(5.8).font(PALETTE.FONT_BOLD).fillColor(PALETTE.TEXT).text(`+${dayItems.length - 4} more`, x + 4, y + 59, { width: cellW - 8 });
            }
          }
          y += cellH;
        }
        y += 18;
      }
    } else if (view === "board") {
      y = sectionBar(doc, "Board / Sprint View", y);
      const grouped = new Map<string, LiveScheduleEvent[]>();
      filtered.forEach(item => grouped.set(item.bucketName || "Unassigned", [...(grouped.get(item.bucketName || "Unassigned") || []), item]));
      for (const [bucket, rows] of grouped) {
        if (y > 500) y = addReportPage(doc, { companyName, title: "Coordination Board", projectName: project.name, projectCode: project.code, reportNumber, reportDate });
        doc.fontSize(10).font(PALETTE.FONT_BOLD).fillColor(PALETTE.TEXT).text(`${bucket} (${rows.length})`, 40, y);
        y += 14;
        y = drawScheduleTable(doc, rows, y, tableColumns, () => addReportPage(doc, { companyName, title: `Coordination Board - ${bucket}`, projectName: project.name, projectCode: project.code, reportNumber, reportDate }));
        y += 14;
      }
      if (grouped.size === 0) doc.fontSize(10).font(PALETTE.FONT).fillColor(PALETTE.MUTED).text("No schedule items match the selected filters.", 40, y);
    } else {
      y = sectionBar(doc, "List / Register View", y);
      y = drawScheduleTable(doc, filtered, y, tableColumns, () => addReportPage(doc, { companyName, title: "Schedule Register", projectName: project.name, projectCode: project.code, reportNumber, reportDate }));
      if (filtered.length === 0) doc.fontSize(10).font(PALETTE.FONT).fillColor(PALETTE.MUTED).text("No schedule items match the selected filters.", 40, y);
    }

    if (options.includeRolloverHistory) {
      if (doc.y > 470) y = addReportPage(doc, { companyName, title: "Rollover History", projectName: project.name, projectCode: project.code, reportNumber, reportDate });
      y = sectionBar(doc, "Rollover History", Math.max(doc.y + 14, y + 14));
      const historyColumns: TableColumn[] = [
        { label: "Item", width: 130, format: r => `${r.sourceType} #${r.sourceId}` },
        { label: "From", width: 120, format: r => r.fromBucketName },
        { label: "To", width: 120, format: r => r.toBucketName },
        { label: "Moved By", width: 120, format: r => r.movedByName || "-" },
        { label: "When", width: 100, format: r => new Date(r.movedAt).toLocaleString("en-US") },
      ];
      y = drawTable(doc, {
        x: 40,
        startY: y,
        columns: historyColumns,
        rows: filteredHistories,
        fontSize: 7,
        rowMinHeight: 24,
        pageBottom: 540,
        onPageBreak: () => addReportPage(doc, { companyName, title: "Rollover History", projectName: project.name, projectCode: project.code, reportNumber, reportDate }),
      });
      if (filteredHistories.length === 0) doc.fontSize(10).font(PALETTE.FONT).fillColor(PALETTE.MUTED).text("No rollover history for selected items.", 40, y + 6);
    }

    await db.insert(activityLogTable).values({
      projectId,
      userId: req.user!.userId,
      userFullName: req.user!.fullName,
      userCompanyName: req.user!.companyName,
      actionType: "export",
      entityType: "schedule_pdf",
      entityId: projectId,
      fileNameBefore: null,
      fileNameAfter: `schedule-${view}-${project.code}.pdf`,
      details: `Exported Schedule PDF ${reportNumber} (${view}, ${filtered.length} item(s))`,
    });

    addPageNumbers(doc, {
      margin: 40,
      footerY: 575,
      fingerprintY: 560,
      contentHash,
      companyName,
      projectName: project.name,
      reportNumber,
      timestamp: reportDate.toLocaleString("en-US"),
    });
    doc.end();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: err instanceof Error ? err.message : "Schedule PDF export failed" });
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
    const meetingIds = placements.filter(p => p.sourceType === "meeting").map(p => p.sourceId);
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
    const placedMeetings = meetingIds.length
      ? await db.select({ id: meetingMinutesTable.id, meetingDate: meetingMinutesTable.meetingDate }).from(meetingMinutesTable)
        .where(inArray(meetingMinutesTable.id, meetingIds))
      : [];
    const completedMilestoneIds = new Set(completedMilestones.filter(m => isDone(m.status)).map(m => m.id));
    const completedRfiIds = new Set(completedRfis.filter(r => isDone(r.status)).map(r => r.id));
    const completedSubmittalIds = new Set(completedSubmittals.filter(s => isDone(s.reviewDecision || s.status)).map(s => s.id));
    const completedMeetingIds = new Set(placedMeetings.filter(m => new Date(m.meetingDate).getTime() < Date.now()).map(m => m.id));
    const toMove = placements.filter(p => {
      if (p.sourceType === "milestone") return !completedMilestoneIds.has(p.sourceId);
      if (p.sourceType === "rfi") return !completedRfiIds.has(p.sourceId);
      if (p.sourceType === "submittal") return !completedSubmittalIds.has(p.sourceId);
      if (p.sourceType === "meeting") return !completedMeetingIds.has(p.sourceId);
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

    await db.insert(activityLogTable).values({
      projectId,
      userId: req.user!.userId,
      userFullName: req.user!.fullName,
      userCompanyName: req.user!.companyName,
      actionType: "rollover",
      entityType: "schedule_bucket",
      entityId: fromBucket[0].id,
      fileNameBefore: null,
      fileNameAfter: null,
      details: `Rolled over ${toMove.length} unfinished schedule item(s) from ${fromBucket[0].name} to ${toBucket[0].name}`,
    });

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
