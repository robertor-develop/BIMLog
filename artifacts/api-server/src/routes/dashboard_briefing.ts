import { Router } from "express";
import { db } from "@workspace/db";
import {
  rfisTable, submittalsTable, filesTable, projectMembersTable, projectsTable,
  clashReportsTable, clashesTable, submittalReportsTable, submittalItemsTable,
} from "@workspace/db/schema";
import { eq, and, inArray, ne, or } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";
import Anthropic from "@anthropic-ai/sdk";

const router: Router = Router();
const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? "",
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL ?? undefined,
});

// In-memory cache: userId → { result, expiresAt }
const cache = new Map<number, { result: object; expiresAt: number }>();

// ── GET /dashboard/stats ──────────────────────────────────────────────────────
router.get("/dashboard/stats", authMiddleware, async (req, res) => {
  const userId = req.user!.userId;

  const memberships = await db
    .select({ projectId: projectMembersTable.projectId })
    .from(projectMembersTable)
    .where(eq(projectMembersTable.userId, userId));

  const projectIds = memberships.map(m => m.projectId);

  if (projectIds.length === 0) {
    res.json({
      activeProjects: 0,
      filesProcessed: 0,
      openRfis: 0,
      pendingSubmittals: 0,
      complianceRate: null,
      filesNeedingAttention: 0,
    });
    return;
  }

  const [
    activeProjectsRes,
    allFilesRes,
    compliantFilesRes,
    attentionFilesRes,
    openRfisRes,
    pendingSubmittalsRes,
    clashReportsRes,
    openClashesRes,
    submittalTrackersRes,
    openSubmittalItemsRes,
  ] = await Promise.all([
    db.select({ id: projectsTable.id }).from(projectsTable)
      .where(and(
        inArray(projectsTable.id, projectIds),
        ne(projectsTable.status, "archived"),
      )),
    db.select({ id: filesTable.id }).from(filesTable)
      .where(inArray(filesTable.projectId, projectIds)),
    db.select({ id: filesTable.id }).from(filesTable)
      .where(and(
        inArray(filesTable.projectId, projectIds),
        eq(filesTable.isCompliant, true),
      )),
    db.select({ id: filesTable.id }).from(filesTable)
      .where(and(
        inArray(filesTable.projectId, projectIds),
        eq(filesTable.isCompliant, false),
      )),
    db.select({ id: rfisTable.id }).from(rfisTable)
      .where(and(
        inArray(rfisTable.projectId, projectIds),
        ne(rfisTable.status, "closed"),
      )),
    db.select({ id: submittalsTable.id }).from(submittalsTable)
      .where(and(
        inArray(submittalsTable.projectId, projectIds),
        inArray(submittalsTable.status, ["pending", "under_review"]),
      )),
    db.select({ id: clashReportsTable.id, totalClashes: clashReportsTable.totalClashes, p1Count: clashReportsTable.p1Count })
      .from(clashReportsTable)
      .where(inArray(clashReportsTable.projectId, projectIds)),
    db.select({ id: clashesTable.id }).from(clashesTable)
      .where(and(
        inArray(clashesTable.projectId, projectIds),
        eq(clashesTable.status, "open"),
      )),
    db.select({ id: submittalReportsTable.id })
      .from(submittalReportsTable)
      .where(inArray(submittalReportsTable.projectId, projectIds)),
    db.select({ id: submittalItemsTable.id }).from(submittalItemsTable)
      .where(and(
        inArray(submittalItemsTable.projectId, projectIds),
        eq(submittalItemsTable.submittalStatus, "open"),
      )),
  ]);

  const totalFiles = allFilesRes.length;
  const complianceRate = totalFiles > 0
    ? Math.round((compliantFilesRes.length / totalFiles) * 100)
    : null;

  const totalClashes = clashReportsRes.reduce((sum, r) => sum + (r.totalClashes ?? 0), 0);
  const p1Clashes = clashReportsRes.reduce((sum, r) => sum + (r.p1Count ?? 0), 0);
  res.json({
    activeProjects: activeProjectsRes.length,
    filesProcessed: totalFiles,
    openRfis: openRfisRes.length,
    pendingSubmittals: pendingSubmittalsRes.length,
    complianceRate,
    filesNeedingAttention: attentionFilesRes.length,
    totalClashes,
    openClashes: openClashesRes.length,
    p1Clashes,
    clashReports: clashReportsRes.length,
    submittalTrackers: submittalTrackersRes.length,
    openSubmittalItems: openSubmittalItemsRes.length,
  });
});

// ── GET /dashboard/briefing ───────────────────────────────────────────────────
router.get("/dashboard/briefing", authMiddleware, async (req, res) => {
  const userId = req.user!.userId;
  const now = Date.now();
  const cached = cache.get(userId);
  if (cached && cached.expiresAt > now) {
    res.json(cached.result);
    return;
  }

  const fallback = {
    summary: "Your projects are active — review open items.",
    criticalItems: [] as string[],
    todaysDate: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
  };

  try {
    const memberships = await db.select({ projectId: projectMembersTable.projectId })
      .from(projectMembersTable).where(eq(projectMembersTable.userId, userId));
    const projectIds = memberships.map(m => m.projectId);

    if (!projectIds.length) {
      res.json({
        summary: "Welcome to BIMLog. Create or join a project to get started.",
        criticalItems: [],
        todaysDate: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
      });
      return;
    }

    const [openRfis, pendingSubs, rejectedFiles, projects] = await Promise.all([
      db.select({ id: rfisTable.id, dueDate: rfisTable.dueDate }).from(rfisTable)
        .where(and(inArray(rfisTable.projectId, projectIds), ne(rfisTable.status, "closed"))),
      db.select({ id: submittalsTable.id }).from(submittalsTable)
        .where(and(inArray(submittalsTable.projectId, projectIds), eq(submittalsTable.status, "pending"))),
      db.select({ id: filesTable.id }).from(filesTable)
        .where(and(inArray(filesTable.projectId, projectIds), eq(filesTable.status, "rejected"))),
      db.select({ name: projectsTable.name }).from(projectsTable)
        .where(inArray(projectsTable.id, projectIds)),
    ]);

    const overdueRfis = openRfis.filter(r => r.dueDate && new Date(r.dueDate).getTime() < now);
    const stats = {
      projects: projects.length,
      openRfis: openRfis.length,
      overdueRfis: overdueRfis.length,
      pendingSubmittals: pendingSubs.length,
      namingIssues: rejectedFiles.length,
      projectNames: projects.slice(0, 3).map(p => p.name).join(", "),
    };

    const todaysDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 200,
      system: "You are BIMLog's intelligence engine. Return ONLY valid JSON. No markdown. No explanation.",
      messages: [{
        role: "user",
        content: `Project data: ${JSON.stringify(stats)}
Return exactly:
{"summary":"one sentence, most important thing today with specific numbers","criticalItems":["up to 3 short urgent strings"],"todaysDate":"${todaysDate}"}`,
      }],
    });

    const raw = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";
    // Strip markdown fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

    let result: object;
    try {
      result = JSON.parse(cleaned);
    } catch {
      result = { ...fallback, todaysDate };
    }

    cache.set(userId, { result, expiresAt: now + 60 * 60 * 1000 });
    res.json(result);
  } catch {
    res.json(fallback);
  }
});

// ── GET /dashboard/pending/rfis ───────────────────────────────────────────────
router.get("/dashboard/pending/rfis", authMiddleware, async (req, res) => {
  const userId = req.user!.userId;
  try {
    const memberships = await db.select({ projectId: projectMembersTable.projectId })
      .from(projectMembersTable).where(eq(projectMembersTable.userId, userId));
    const projectIds = memberships.map(m => m.projectId);
    if (!projectIds.length) { res.json([]); return; }

    const rows = await db.select({
      id: rfisTable.id,
      rfi_number: rfisTable.number,
      title: rfisTable.subject,
      status: rfisTable.status,
      due_date: rfisTable.dueDate,
      project_id: projectsTable.id,
      project_name: projectsTable.name,
      project_code: projectsTable.code,
    })
      .from(rfisTable)
      .innerJoin(projectsTable, eq(rfisTable.projectId, projectsTable.id))
      .where(and(inArray(rfisTable.projectId, projectIds), ne(rfisTable.status, "closed")));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── GET /dashboard/pending/submittals ─────────────────────────────────────────
router.get("/dashboard/pending/submittals", authMiddleware, async (req, res) => {
  const userId = req.user!.userId;
  try {
    const memberships = await db.select({ projectId: projectMembersTable.projectId })
      .from(projectMembersTable).where(eq(projectMembersTable.userId, userId));
    const projectIds = memberships.map(m => m.projectId);
    if (!projectIds.length) { res.json([]); return; }

    const rows = await db.select({
      id: submittalsTable.id,
      submittal_number: submittalsTable.number,
      title: submittalsTable.title,
      status: submittalsTable.status,
      due_date: submittalsTable.dueDate,
      project_id: projectsTable.id,
      project_name: projectsTable.name,
      project_code: projectsTable.code,
    })
      .from(submittalsTable)
      .innerJoin(projectsTable, eq(submittalsTable.projectId, projectsTable.id))
      .where(and(
        inArray(submittalsTable.projectId, projectIds),
        inArray(submittalsTable.status, ["pending", "awaiting_review", "under_review"]),
      ));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── GET /dashboard/pending/files ──────────────────────────────────────────────
router.get("/dashboard/pending/files", authMiddleware, async (req, res) => {
  const userId = req.user!.userId;
  try {
    const memberships = await db.select({ projectId: projectMembersTable.projectId })
      .from(projectMembersTable).where(eq(projectMembersTable.userId, userId));
    const projectIds = memberships.map(m => m.projectId);
    if (!projectIds.length) { res.json([]); return; }

    const rows = await db.select({
      id: filesTable.id,
      file_name: filesTable.fileName,
      compliance_status: filesTable.isCompliant,
      cvr_workflow_status: filesTable.cvrWorkflowStatus,
      project_id: projectsTable.id,
      project_name: projectsTable.name,
      project_code: projectsTable.code,
    })
      .from(filesTable)
      .innerJoin(projectsTable, eq(filesTable.projectId, projectsTable.id))
      .where(and(
        inArray(filesTable.projectId, projectIds),
        or(
          eq(filesTable.cvrWorkflowStatus, "pending_review"),
          eq(filesTable.isCompliant, false),
        ),
      ));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

export default router;
