import { db } from "@workspace/db";
import { agentInsightsTable, clashesTable, rfisTable, submittalItemsTable, actionItemsTable, lensViewpointsTable, linkedItemsTable } from "@workspace/db/schema";
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
    const [clashes, rfis, submittals, actionItems, lensViewpoints, allLinks] = await Promise.all([
      db.select({ id: clashesTable.id, priority: clashesTable.priority, status: clashesTable.status })
        .from(clashesTable).where(eq(clashesTable.projectId, projectId)),
      db.select({ id: rfisTable.id, status: rfisTable.status, dueDate: rfisTable.dueDate })
        .from(rfisTable).where(eq(rfisTable.projectId, projectId)),
      db.select({ id: submittalItemsTable.id, submittalStatus: submittalItemsTable.submittalStatus })
        .from(submittalItemsTable).where(eq(submittalItemsTable.projectId, projectId)),
      db.select({ id: actionItemsTable.id, status: actionItemsTable.status, dueDate: actionItemsTable.dueDate })
        .from(actionItemsTable).where(eq(actionItemsTable.projectId, projectId)),
      db.select().from(lensViewpointsTable).where(eq(lensViewpointsTable.projectId, projectId)),
      db.select().from(linkedItemsTable).where(eq(linkedItemsTable.projectId, projectId)),
    ]);

    const now = new Date();
    const p1Clashes = clashes.filter(c => c.priority === "P1" && c.status !== "resolved");
    const openRfis = rfis.filter(r => r.status !== "closed");
    const overdueRfis = openRfis.filter(r => r.dueDate && new Date(r.dueDate) < now);
    const openSubmittals = submittals.filter(s => s.submittalStatus === "open");
    const overdueActions = actionItems.filter(a => a.status !== "complete" && a.dueDate && new Date(a.dueDate) < now);
    const criticalInsights = insights.filter(i => i.severity === "critical");
    const warningInsights = insights.filter(i => i.severity === "warning");

    // Lens viewpoints: open counts by floor and trade, and P1/P2 with no linked RFI
    const openLens = lensViewpoints.filter(v => v.status !== "resolved" && v.status !== "approved");
    const groupCount = (rows: typeof openLens, key: "floor" | "trade") => {
      const m = new Map<string, number>();
      for (const v of rows) {
        const k = (v[key] || "Unassigned").toString();
        m.set(k, (m.get(k) ?? 0) + 1);
      }
      return Array.from(m.entries()).map(([k, n]) => `${k}: ${n}`).join(", ") || "none";
    };
    const lensByFloor = groupCount(openLens, "floor");
    const lensByTrade = groupCount(openLens, "trade");
    const lensWithRfiIds = new Set(
      allLinks
        .filter(l =>
          (l.fromType === "lens_viewpoint" && l.toType === "rfi") ||
          (l.toType === "lens_viewpoint" && l.fromType === "rfi"))
        .map(l => (l.fromType === "lens_viewpoint" ? l.fromId : l.toId))
    );
    const lensP1P2NoRfi = openLens.filter(v => (v.priority === 1 || v.priority === 2) && !lensWithRfiIds.has(v.id));

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

LENS VIEWPOINTS (field-captured from Navisworks):
- Open viewpoints: ${openLens.length}
- Open by floor: ${lensByFloor}
- Open by trade: ${lensByTrade}
- P1/P2 viewpoints with NO linked RFI (${lensP1P2NoRfi.length}): ${lensP1P2NoRfi.map(v => `P${v.priority} ${v.trade || "?"}/${v.floor || "?"} — ${(v.note || "").slice(0, 60)}`).join("; ") || "none"}

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
