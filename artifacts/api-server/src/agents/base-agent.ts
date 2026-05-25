import Anthropic from "@anthropic-ai/sdk";
import { db } from "@workspace/db";
import { agentInsightsTable, linkedItemsTable, activityLogTable } from "@workspace/db/schema";
import { eq, and, or } from "drizzle-orm";

export const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ?? "",
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL ?? undefined,
});

export interface AgentContext {
  projectId: number;
  entityType?: string;
  entityId?: number;
  triggerEvent?: string;
}

export async function saveInsight(
  projectId: number,
  agentType: string,
  entityType: string,
  entityId: number,
  insightType: string,
  message: string,
  recommendation: string,
  severity: "info" | "warning" | "critical" = "info"
) {
  await db.insert(agentInsightsTable).values({
    projectId,
    agentType,
    entityType,
    entityId,
    insightType,
    message,
    recommendation,
    severity,
  });
}

export async function getLinkedItems(projectId: number, entityType: string, entityId: number) {
  return db.select().from(linkedItemsTable).where(
    and(
      eq(linkedItemsTable.projectId, projectId),
      or(
        and(eq(linkedItemsTable.fromType, entityType), eq(linkedItemsTable.fromId, entityId)),
        and(eq(linkedItemsTable.toType, entityType), eq(linkedItemsTable.toId, entityId))
      )
    )
  );
}
