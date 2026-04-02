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

// In-memory cache: userId → { briefing, expiresAt }
const cache = new Map<number, { briefing: string; expiresAt: number }>();

// ── GET /dashboard/briefing ───────────────────────────────────────────────────
router.get("/dashboard/briefing", authMiddleware, async (req, res) => {
  const userId = req.user!.userId;
  const now = Date.now();
  const cached = cache.get(userId);
  if (cached && cached.expiresAt > now) {
    res.json({ briefing: cached.briefing });
    return;
  }
  try {
    const memberships = await db.select({ projectId: projectMembersTable.projectId })
      .from(projectMembersTable).where(eq(projectMembersTable.userId, userId));
    const projectIds = memberships.map(m => m.projectId);
    if (!projectIds.length) {
      res.json({ briefing: "Welcome to BIMLog. Create or join a project to get started." });
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

    const prompt = `You are BIMLog's intelligence engine. Given this user's project data, write ONE sentence that tells them the most important thing they need to know right now. Be specific with numbers. Be direct. No more than 25 words.
Data: ${JSON.stringify(stats)}`;

    const msg = await anthropic.messages.create({
      model: "claude-opus-4-5", max_tokens: 60,
      messages: [{ role: "user", content: prompt }],
    });
    const briefing = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "Your projects are active — check open items below.";
    cache.set(userId, { briefing, expiresAt: now + 60 * 60 * 1000 }); // 1 hour cache
    res.json({ briefing });
  } catch (err) {
    res.json({ briefing: "Your projects are active — review open items below." });
  }
});

export default router;
