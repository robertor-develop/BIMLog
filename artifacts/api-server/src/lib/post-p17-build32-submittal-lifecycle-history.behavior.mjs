import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const api = await readFile(new URL("../routes/submittals.ts", import.meta.url), "utf8");
const ui = await readFile(new URL("../../../bimlog/src/pages/project/SubmittalsTab.tsx", import.meta.url), "utf8");

const checks = [
  ["creation persists parent lineage", api, /parentSubmittalId: \(body\.parentSubmittalId as number\) \|\| null/],
  ["creation persists revision number", api, /revisionNumber: \(body\.revisionNumber as number\) \|\| 0/],
  ["revision is visible in the register", ui, /R\{\(s as any\)\.revisionNumber \?\? 0\}/],
  ["detail exposes version history and parent", ui, /Version History[\s\S]*submittal\.revisionNumber[\s\S]*submittal\.parentSubmittalId/],
  ["updates first bind item to route project", api, /const \[existing\] = await db\.select\(\)\.from\(submittalsTable\)[\s\S]*eq\(submittalsTable\.id, submittalId\), eq\(submittalsTable\.projectId, projectId\)/],
  ["lifecycle status and review fields are explicitly mutable", api, /"title", "description", "status"[\s\S]*"reviewDecision", "complianceNotes", "rejectionReason", "reviewerName"/],
  ["ball-in-court history is persisted", api, /body\.ballInCourtHistory !== undefined\) updates\.ballInCourtHistory = body\.ballInCourtHistory/],
  ["review action is audited", api, /actionType: "review",[\s\S]*entityType: "submittal"/],
  ["ordinary update is audited", api, /actionType: "update",[\s\S]*entityType: "submittal"/],
  ["delete is soft and retains its reason", api, /set\(\{ deletedAt: new Date\(\), deleteReason: reason \}\)/],
  ["delete audit retains reason and identity", api, /actionType: "delete", entityType: "submittal"[\s\S]*JSON\.stringify\(\{ reason, number: existing\.number, title: existing\.title \}\)/],
  ["delete removes only project-scoped item links", api, /db\.delete\(linkedItemsTable\)\.where\(and\([\s\S]*eq\(linkedItemsTable\.projectId, projectId\)[\s\S]*eq\(linkedItemsTable\.fromType, "submittal"\)[\s\S]*eq\(linkedItemsTable\.toType, "submittal"\)/],
];

for (const [label, source, pattern] of checks) assert.match(source, pattern, label);
console.log(`PASS post-P17 Build 32 Submittal lifecycle and immutable history (${checks.length} checks)`);
