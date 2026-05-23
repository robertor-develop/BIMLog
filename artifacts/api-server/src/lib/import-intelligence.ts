import Anthropic from "@anthropic-ai/sdk";
import { db } from "@workspace/db";
import { rfisTable, clashesTable, submittalItemsTable, transmittalsTable, changeOrdersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ?? "",
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL ?? undefined,
});

export interface DuplicateWarning {
  recordIndex: number;
  matchType: "duplicate" | "related" | "conflict";
  existingEntity: string;
  existingId: number;
  message: string;
  suggestedAction: "skip" | "link" | "update" | "create_anyway";
}

export interface IntelligenceResult {
  safeIndices: number[];
  warnings: DuplicateWarning[];
  crossLinks: { fromRef: string; toType: string; toRef: string; confidence: string }[];
}

export async function checkImportIntelligence(
  projectId: number,
  records: any[],
  entityType: string
): Promise<IntelligenceResult> {
  try {
    const [rfis, clashes, submittalItems, transmittals, changeOrders] = await Promise.all([
      db.select({ id: rfisTable.id, number: rfisTable.number, subject: rfisTable.subject, status: rfisTable.status }).from(rfisTable).where(eq(rfisTable.projectId, projectId)),
      db.select({ id: clashesTable.id, clashIdOriginal: clashesTable.clashIdOriginal, description: clashesTable.description, status: clashesTable.status }).from(clashesTable).where(eq(clashesTable.projectId, projectId)),
      db.select({ id: submittalItemsTable.id, fileName: submittalItemsTable.fileName, submittalStatus: submittalItemsTable.submittalStatus }).from(submittalItemsTable).where(eq(submittalItemsTable.projectId, projectId)),
      db.select({ id: transmittalsTable.id, number: transmittalsTable.number, title: transmittalsTable.title }).from(transmittalsTable).where(eq(transmittalsTable.projectId, projectId)),
      db.select({ id: changeOrdersTable.id, number: changeOrdersTable.number, title: changeOrdersTable.title }).from(changeOrdersTable).where(eq(changeOrdersTable.projectId, projectId)),
    ]);

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      messages: [{
        role: "user",
        content: `You are a construction document intelligence system.
Analyze these ${entityType} records being imported and check against existing project data.

RECORDS TO IMPORT (${records.length} total):
${JSON.stringify(records.slice(0, 15))}

EXISTING PROJECT DATA:
RFIs: ${JSON.stringify(rfis.slice(0, 20))}
Clashes: ${JSON.stringify(clashes.slice(0, 20))}
Submittal Items: ${JSON.stringify(submittalItems.slice(0, 20))}
Transmittals: ${JSON.stringify(transmittals.slice(0, 10))}
Change Orders: ${JSON.stringify(changeOrders.slice(0, 10))}

Check for:
1. DUPLICATES — same number or very similar subject already exists
2. RELATED — record references an existing item in another module
3. CONFLICTS — imported status contradicts existing status

Return ONLY valid JSON, no markdown:
{
  "safeIndices": [0,1,2],
  "warnings": [{"recordIndex":0,"matchType":"duplicate","existingEntity":"rfi","existingId":5,"message":"RFI-001 already exists with subject X","suggestedAction":"skip"}],
  "crossLinks": [{"fromRef":"RFI-001","toType":"clash","toRef":"C.013","confidence":"high"}]
}`
      }]
    });

    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "{}";
    const result = JSON.parse(text.replace(/```json\n?|```/g, "").trim());
    return {
      safeIndices: result.safeIndices ?? records.map((_: any, i: number) => i),
      warnings: result.warnings ?? [],
      crossLinks: result.crossLinks ?? [],
    };
  } catch (err) {
    console.error("[import-intelligence] failed:", err);
    return {
      safeIndices: records.map((_: any, i: number) => i),
      warnings: [],
      crossLinks: [],
    };
  }
}
