import { db } from "@workspace/db";
import { rfisTable, clashesTable, submittalsTable } from "@workspace/db/schema";
import { eq, and, ne, lt } from "drizzle-orm";
import { anthropic, saveInsight, getLinkedItems } from "./base-agent";

export async function runRfiAgent(projectId: number, rfiId?: number) {
  try {
    const now = new Date();
    const rfis = rfiId
      ? await db.select().from(rfisTable).where(and(eq(rfisTable.id, rfiId), eq(rfisTable.projectId, projectId)))
      : await db.select().from(rfisTable).where(and(eq(rfisTable.projectId, projectId), ne(rfisTable.status, "closed")));

    for (const rfi of rfis.slice(0, 10)) {
      const links = await getLinkedItems(projectId, "rfi", rfi.id);
      const isOverdue = rfi.dueDate && new Date(rfi.dueDate) < now;

      const msg = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 400,
        system: `You are the RFI Agent for a construction project. Analyze RFIs for issues and recommend actions. ISO 9001 compliant. Respond with valid JSON only.`,
        messages: [{
          role: "user",
          content: `Analyze this RFI:
${JSON.stringify({ ...rfi, isOverdue })}
Links: ${JSON.stringify(links)}

Return JSON:
{
  "hasIssue": true/false,
  "issueType": "overdue|no_response|no_linked_clash|stale|null",
  "severity": "critical|warning|info",
  "message": "clear message",
  "recommendation": "specific action"
}`
        }]
      });

      const text = msg.content[0]?.type === "text" ? msg.content[0].text : "{}";
      const result = JSON.parse(text.replace(/```json\n?|```/g, "").trim());

      if (result.hasIssue) {
        await saveInsight(projectId, "rfi_agent", "rfi", rfi.id, result.issueType, result.message, result.recommendation, result.severity);
      }
    }
    console.log(`[rfi-agent] Analyzed ${rfis.length} RFIs for project ${projectId}`);
  } catch (err) {
    console.error("[rfi-agent] FAILED:", err);
  }
}
