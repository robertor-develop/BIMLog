import { db } from "@workspace/db";
import { agentInsightsTable, clashesTable, rfisTable, submittalItemsTable, actionItemsTable } from "@workspace/db/schema";
import { eq, and, eq as eqOp } from "drizzle-orm";
import { anthropic, saveInsight } from "./base-agent";
import { runClashAgent } from "./clash-agent";
import { runRfiAgent } from "./rfi-agent";

export async function runBriefingAgent(projectId: number): Promise<string> {
  try {
    // Run all agents first
    await Promise.all([
      runClashAgent(projectId),
      runRfiAgent(projectId),
    ]);

    // Gather all unread insights
    const insights = await db.select().from(agentInsightsTable)
      .where(and(eq(agentInsightsTable.projectId, projectId), eq(agentInsightsTable.isRead, false)));

    // Get project summary
    const [clashes, rfis, submittals, actionItems] = await Promise.all([
      db.select({ id: clashesTable.id, priority: clashesTable.priority, status: clashesTable.status })
        .from(clashesTable).where(eq(clashesTable.projectId, projectId)),
      db.select({ id: rfisTable.id, status: rfisTable.status, dueDate: rfisTable.dueDate })
        .from(rfisTable).where(eq(rfisTable.projectId, projectId)),
      db.select({ id: submittalItemsTable.id, submittalStatus: submittalItemsTable.submittalStatus })
        .from(submittalItemsTable).where(eq(submittalItemsTable.projectId, projectId)),
      db.select({ id: actionItemsTable.id, status: actionItemsTable.status, dueDate: actionItemsTable.dueDate })
        .from(actionItemsTable).where(eq(actionItemsTable.projectId, projectId)),
    ]);

    const now = new Date();
    const p1Clashes = clashes.filter(c => c.priority === "P1" && c.status !== "resolved");
    const openRfis = rfis.filter(r => r.status !== "closed");
    const overdueRfis = openRfis.filter(r => r.dueDate && new Date(r.dueDate) < now);
    const openSubmittals = submittals.filter(s => s.submittalStatus === "open");
    const overdueActions = actionItems.filter(a => a.status !== "complete" && a.dueDate && new Date(a.dueDate) < now);
    const criticalInsights = insights.filter(i => i.severity === "critical");
    const warningInsights = insights.filter(i => i.severity === "warning");

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1000,
      system: `You are the BIMLog Morning Briefing Agent. You generate concise, actionable daily briefings for construction project coordinators. Be direct, professional, and specific. No fluff. ISO 9001 compliant documentation style.`,
      messages: [{
        role: "user",
        content: `Generate a morning briefing for the project coordinator.

PROJECT STATUS:
- P1 Critical Clashes (open): ${p1Clashes.length}
- Open RFIs: ${openRfis.length} (${overdueRfis.length} overdue)
- Open Submittals: ${openSubmittals.length}
- Overdue Action Items: ${overdueActions.length}

AGENT INSIGHTS (${insights.length} total):
Critical: ${criticalInsights.map(i => i.message).join("; ")}
Warnings: ${warningInsights.slice(0,5).map(i => i.message).join("; ")}

Generate a briefing with:
1. Overall project health (1 sentence)
2. Items needing immediate attention today (bullet points)
3. Recommended actions (bullet points)
4. Items to monitor this week

Keep it under 300 words. Be specific with numbers and names.`
      }]
    });

    const briefing = msg.content[0]?.type === "text" ? msg.content[0].text : "Briefing unavailable.";

    // Mark insights as read
    for (const insight of insights) {
      await db.update(agentInsightsTable)
        .set({ isRead: true })
        .where(eq(agentInsightsTable.id, insight.id));
    }

    return briefing;
  } catch (err) {
    console.error("[briefing-agent] FAILED:", err);
    return "Morning briefing temporarily unavailable.";
  }
}
