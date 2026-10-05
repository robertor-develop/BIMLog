import { Router } from "express";
import { db } from "@workspace/db";
import { agentInsightsTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { authMiddleware, requireProjectMember } from "../middlewares/auth";
import { runBriefingAgent } from "../agents/briefing-agent";
import { runClashAgent } from "../agents/clash-agent";
import { runRfiAgent } from "../agents/rfi-agent";
import { getAnthropicClientForUser, sendAiUsageError } from "../lib/ai-usage";
import { randomUUID } from "node:crypto";
import { BIMLOG_ASSISTANT_MAX_QUESTION, cleanAssistantList, cleanAssistantText, parseAssistantAnswer } from "../lib/page-assistant-agent-contract";
import { resolveBimlogDedicatedAgent } from "../lib/page-assistant-agent-registry";

const router: Router = Router();

type AssistantContext = { route?: unknown; page?: unknown; section?: unknown; language?: unknown; focusedControl?: unknown; controls?: unknown; pageText?: unknown };

async function answerPageQuestion(req: any, res: any, projectId: number | null) {
  try {
    const question = cleanAssistantText(req.body?.question, BIMLOG_ASSISTANT_MAX_QUESTION);
    if (!question) return res.status(400).json({ error: "A question is required." });
    const context = (req.body?.context || {}) as AssistantContext;
    const language = context.language === "es" ? "Spanish" : "English";
    const controls = cleanAssistantList(context.controls, 60, 120);
    const pageText = cleanAssistantList(context.pageText, 120, 240);
    const history = Array.isArray(req.body?.history) ? req.body.history.slice(-8).map((item: any) => ({
      role: item?.role === "assistant" ? "assistant" : "user",
      content: cleanAssistantText(item?.text, 2000),
    })).filter((item: any) => item.content) : [];
    const agent = resolveBimlogDedicatedAgent();
    const anthropic = await getAnthropicClientForUser({ userId: req.user.userId, projectId, feature: "page_assistant" });
    const message = await anthropic.messages.create({
      model: agent.model,
      max_tokens: 900,
      system: `${agent.instructions}\nAnswer language: ${language}.`,
      messages: [...history, { role: "user", content: JSON.stringify({ question, page: cleanAssistantText(context.page, 160), section: cleanAssistantText(context.section, 160), route: cleanAssistantText(context.route, 300), visibleControls: controls, visiblePageText: pageText }) }],
    });
    const block = message.content.find((item: any) => item.type === "text") as any;
    if (!block?.text) return res.status(502).json({ error: "BIMLog could not produce an answer." });
    const parsed = parseAssistantAnswer(block.text, controls);
    res.json({ ...parsed, transport: "hosted", contextual: true, receipt: { runId: randomUUID(), agentId: agent.agentId, agentVersion: agent.version, contractVersion: agent.contractVersion, instructionDigest: agent.instructionDigest } });
  } catch (err) {
    if (sendAiUsageError(res, err)) return;
    res.status(502).json({ error: "BIMLog's hosted assistant is temporarily unavailable.", code: "ASSISTANT_PROVIDER_UNAVAILABLE" });
  }
}

router.post("/assistant/ask", authMiddleware, (req, res) => answerPageQuestion(req, res, null));
router.post("/projects/:projectId/assistant/ask", authMiddleware, requireProjectMember(), (req, res) => answerPageQuestion(req, res, Number(req.params.projectId)));

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
    const briefing = await runBriefingAgent(projectId, req.user!.userId);
    res.json({ briefing });
  } catch (err) {
    if (sendAiUsageError(res, err)) return;
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// POST run clash agent for specific clash
router.post("/projects/:projectId/agents/clash/:clashId", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const clashId = Number(req.params.clashId);
  try {
    await runClashAgent(projectId, req.user!.userId, clashId);
    const insights = await db.select().from(agentInsightsTable)
      .where(and(eq(agentInsightsTable.projectId, projectId), eq(agentInsightsTable.entityId, clashId), eq(agentInsightsTable.entityType, "clash")))
      .orderBy(desc(agentInsightsTable.createdAt))
      .limit(5);
    res.json({ insights });
  } catch (err) {
    if (sendAiUsageError(res, err)) return;
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// POST run RFI agent for specific RFI
router.post("/projects/:projectId/agents/rfi/:rfiId", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const rfiId = Number(req.params.rfiId);
  try {
    await runRfiAgent(projectId, req.user!.userId, rfiId);
    const insights = await db.select().from(agentInsightsTable)
      .where(and(eq(agentInsightsTable.projectId, projectId), eq(agentInsightsTable.entityId, rfiId), eq(agentInsightsTable.entityType, "rfi")))
      .orderBy(desc(agentInsightsTable.createdAt))
      .limit(5);
    res.json({ insights });
  } catch (err) {
    if (sendAiUsageError(res, err)) return;
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
