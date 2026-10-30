import { Router } from "express";
import { db } from "@workspace/db";
import { agentInsightsTable, clashesTable, rfisTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { authMiddleware, requireProjectMember } from "../middlewares/auth";
import { runBriefingAgent } from "../agents/briefing-agent";
import { runClashAgent } from "../agents/clash-agent";
import { runRfiAgent } from "../agents/rfi-agent";
import { sendAiUsageError } from "../lib/ai-usage";
import { BIMLOG_ASSISTANT_MAX_QUESTION, cleanAssistantList, cleanAssistantText } from "../lib/page-assistant-agent-contract";
import { getPageAgentTurn, listPageAgentTurns, refreshPageAgentTurn, reservePageAgentTurn, startPageAgentTurn } from "../lib/page-agent-conversation-store";
import { assertConversationLane, parseIntakeEnvelope, intakeEnvelopeDigest, BIMLOG_AGENT_LANES } from "../lib/agent-lane-contract";

const router: Router = Router();

type AssistantContext = { route?: unknown; page?: unknown; section?: unknown; language?: unknown; focusedControl?: unknown; controls?: unknown; pageText?: unknown };

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function pageAgentContext(req:any) {
  const context = (req.body?.context || {}) as AssistantContext;
  return { route: cleanAssistantText(context.route, 300), page: cleanAssistantText(context.page, 160), section: cleanAssistantText(context.section, 160), language: context.language === "es" ? "es" as const : "en" as const, focusedControl: cleanAssistantText(context.focusedControl, 120), controls: cleanAssistantList(context.controls, 80, 240), pageText: cleanAssistantList(context.pageText, 120, 240), history: [] };
}
async function answerPageQuestion(req: any, res: any, projectId: number | null) {
  try {
    assertConversationLane((req.body||{}) as Record<string,unknown>);
    const question = cleanAssistantText(req.body?.question, BIMLOG_ASSISTANT_MAX_QUESTION);
    if (!question) return res.status(400).json({ error: "A question is required." });
    const requestId=String(req.body?.requestId||"");const conversationId=String(req.body?.conversationId||"");
    if(!UUID.test(requestId)||!UUID.test(conversationId))return res.status(400).json({error:"Valid requestId and conversationId are required."});
    const input={requestId,conversationId,question,userId:req.user.userId,companyId:req.user.companyId,projectId,context:pageAgentContext(req)};
    const turn=await reservePageAgentTurn(input);startPageAgentTurn(input);
    res.status(turn.state==="complete"?200:202).set("Cache-Control","private, no-store, max-age=0").json({turn,transport:"main04",laneTransport:BIMLOG_AGENT_LANES.conversation.transport,contextual:true});
  } catch (err) {
    if (sendAiUsageError(res, err)) return;
    console.error(JSON.stringify({ event: "main04_assistant_error", code: err instanceof Error ? err.message : "UNKNOWN" }));
    const code=err instanceof Error?err.message:"ASSISTANT_PROVIDER_UNAVAILABLE";
    res.status(code==="PAGE_AGENT_CONVERSATION_BUSY"?409:502).json({ error: code==="PAGE_AGENT_CONVERSATION_BUSY"?"This conversation already has a question in progress.":"BIMLog's hosted assistant is temporarily unavailable.", code });
  }
}

router.post("/projects/:projectId/intake-agent/preview",authMiddleware,requireProjectMember(),(req,res)=>{
  try{const envelope=parseIntakeEnvelope(req.body);if(envelope.projectId!==Number(req.params.projectId)||envelope.companyId!==req.user!.companyId){res.status(403).json({code:"INTAKE_AUTHORITY_MISMATCH"});return;}res.status(202).set("Cache-Control","private, no-store, max-age=0").json({transport:BIMLOG_AGENT_LANES.intake.transport,threadId:BIMLOG_AGENT_LANES.intake.threadId,reviewProposal:{state:"preview",digest:intakeEnvelopeDigest(envelope),recordCount:envelope.records.length,canonicalMutation:false}});}catch(error){const code=error instanceof Error?error.message:"INTAKE_ENVELOPE_INVALID";res.status(code.includes("CROSSOVER")?409:400).json({code});}
});

router.post("/assistant/ask", authMiddleware, (req, res) => answerPageQuestion(req, res, null));
router.post("/projects/:projectId/assistant/ask", authMiddleware, requireProjectMember(), (req, res) => answerPageQuestion(req, res, Number(req.params.projectId)));
router.get("/assistant/conversations/:conversationId",authMiddleware,async(req,res):Promise<void>=>{const id=String(req.params.conversationId||"");if(!UUID.test(id)){res.status(400).json({error:"Invalid conversationId."});return;}res.set("Cache-Control","private, no-store, max-age=0").json({turns:await listPageAgentTurns(id,req.user!.companyId,req.user!.userId)});});
router.get("/assistant/requests/:requestId",authMiddleware,async(req,res):Promise<void>=>{const id=String(req.params.requestId||"");if(!UUID.test(id)){res.status(400).json({error:"Invalid requestId."});return;}const turn=await refreshPageAgentTurn(id,req.user!.companyId,req.user!.userId);if(!turn){res.status(404).json({error:"Question not found."});return;}res.set("Cache-Control","private, no-store, max-age=0").json({turn});});

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
    if (!Number.isSafeInteger(clashId) || clashId <= 0) { res.status(400).json({error:"Valid clash ID required"}); return; }
    const [record] = await db.select({id:clashesTable.id}).from(clashesTable).where(and(eq(clashesTable.id,clashId),eq(clashesTable.projectId,projectId))).limit(1);
    if (!record) { res.status(404).json({error:"Clash not found in this project"}); return; }
    await runClashAgent(projectId, req.user!.userId, clashId, true);
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
    if (!Number.isSafeInteger(rfiId) || rfiId <= 0) { res.status(400).json({error:"Valid RFI ID required"}); return; }
    const [record] = await db.select({id:rfisTable.id}).from(rfisTable).where(and(eq(rfisTable.id,rfiId),eq(rfisTable.projectId,projectId))).limit(1);
    if (!record) { res.status(404).json({error:"RFI not found in this project"}); return; }
    await runRfiAgent(projectId, req.user!.userId, rfiId, true);
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
