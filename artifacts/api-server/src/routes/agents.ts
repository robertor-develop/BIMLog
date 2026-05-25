import { Router } from "express";
import { db } from "@workspace/db";
import { agentInsightsTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { authMiddleware, requireProjectMember } from "../middlewares/auth";
import { runBriefingAgent } from "../agents/briefing-agent";
import { runClashAgent } from "../agents/clash-agent";
import { runRfiAgent } from "../agents/rfi-agent";

const router: Router = Router();

// GET insights for a project
router.get("/projects/:projectId/insights", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  try {
    const insights = await db.select().from(agentInsightsTable)
      .where(eq(agentInsightsTable.projectId, projectId))
      .orderBy(desc(agentInsightsTable.createdAt))
      .limit(50);
    res.json(insights);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// POST run morning briefing
router.post("/projects/:projectId/briefing", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  try {
    const briefing = await runBriefingAgent(projectId);
    res.json({ briefing });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// POST run clash agent for specific clash
router.post("/projects/:projectId/agents/clash/:clashId", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const clashId = Number(req.params.clashId);
  try {
    await runClashAgent(projectId, clashId);
    const insights = await db.select().from(agentInsightsTable)
      .where(and(eq(agentInsightsTable.projectId, projectId), eq(agentInsightsTable.entityId, clashId), eq(agentInsightsTable.entityType, "clash")))
      .orderBy(desc(agentInsightsTable.createdAt))
      .limit(5);
    res.json({ insights });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// POST run RFI agent for specific RFI
router.post("/projects/:projectId/agents/rfi/:rfiId", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const rfiId = Number(req.params.rfiId);
  try {
    await runRfiAgent(projectId, rfiId);
    const insights = await db.select().from(agentInsightsTable)
      .where(and(eq(agentInsightsTable.projectId, projectId), eq(agentInsightsTable.entityId, rfiId), eq(agentInsightsTable.entityType, "rfi")))
      .orderBy(desc(agentInsightsTable.createdAt))
      .limit(5);
    res.json({ insights });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
