import { Router } from "express";
import { db } from "@workspace/db";
import {
  rfisTable, submittalsTable, filesTable, projectMembersTable, projectsTable,
} from "@workspace/db/schema";
import { eq, and, inArray, ne } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";
import Anthropic from "@anthropic-ai/sdk";

const router: Router = Router();
const anthropic = new Anthropic();

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
  ]);

  const totalFiles = allFilesRes.length;
  const complianceRate = totalFiles > 0
    ? Math.round((compliantFilesRes.length / totalFiles) * 100)
    : null;

  res.json({
    activeProjects: activeProjectsRes.length,
    filesProcessed: totalFiles,
    openRfis: openRfisRes.length,
    pendingSubmittals: pendingSubmittalsRes.length,
    complianceRate,
    filesNeedingAttention: attentionFilesRes.length,
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
      model: "claude-opus-4-5",
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

export default router;
