import { db } from "@workspace/db";
import { clashesTable, clashReportsTable, rfisTable, submittalItemsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { anthropic, saveInsight, getLinkedItems } from "./base-agent";

export async function runClashAgent(projectId: number, clashId?: number) {
  try {
    // Get clashes to analyze
    const clashes = clashId
      ? await db.select().from(clashesTable).where(and(eq(clashesTable.id, clashId), eq(clashesTable.projectId, projectId)))
      : await db.select().from(clashesTable).where(and(eq(clashesTable.projectId, projectId), eq(clashesTable.status, "open")));

    if (clashes.length === 0) return;

    // Get existing RFIs and submittals for context
    const rfis = await db.select({ id: rfisTable.id, number: rfisTable.number, subject: rfisTable.subject, status: rfisTable.status })
      .from(rfisTable).where(eq(rfisTable.projectId, projectId));
    const submittals = await db.select({ id: submittalItemsTable.id, fileName: submittalItemsTable.fileName, submittalStatus: submittalItemsTable.submittalStatus })
      .from(submittalItemsTable).where(eq(submittalItemsTable.projectId, projectId));

    for (const clash of clashes.slice(0, 10)) {
      const links = await getLinkedItems(projectId, "clash", clash.id);

      const msg = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 500,
        system: `You are the Clash Coordination Agent for a construction project. 
You analyze clashes and identify issues, resolution paths, and recommend actions.
You follow ISO 9001 documentation standards.
Always respond with valid JSON only.`,
        messages: [{
          role: "user",
          content: `Analyze this clash:
${JSON.stringify(clash)}

Existing links: ${JSON.stringify(links)}
Available RFIs: ${JSON.stringify(rfis.slice(0, 10))}
Available Submittals: ${JSON.stringify(submittals.slice(0, 10))}

Return JSON:
{
  "hasIssue": true/false,
  "issueType": "no_rfi|no_submittal|overdue|conflicting_status|resolved_by_submittal|null",
  "severity": "critical|warning|info",
  "message": "clear message for coordinator",
  "recommendation": "specific action to take"
}`
        }]
      });

      const text = msg.content[0]?.type === "text" ? msg.content[0].text : "{}";
      const result = JSON.parse(text.replace(/```json\n?|```/g, "").trim());

      if (result.hasIssue) {
        await saveInsight(
          projectId,
          "clash_agent",
          "clash",
          clash.id,
          result.issueType,
          result.message,
          result.recommendation,
          result.severity
        );
      }
    }
    console.log(`[clash-agent] Analyzed ${clashes.length} clashes for project ${projectId}`);
  } catch (err) {
    console.error("[clash-agent] FAILED:", err);
  }
}
