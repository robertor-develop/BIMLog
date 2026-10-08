import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { classifyCleanupRow, retirementReviewQueue, testingCleanupCandidateIds, type ProjectCleanupRow } from "../lib/project-cleanup-selection";
import { advanceCleanupReviewQueue, beginCleanupReviewQueue } from "../lib/project-cleanup-review-queue";

const rows: ProjectCleanupRow[] = [
  { id: 1, name: "521 E TREMONT TEST PROJECT", code: "PRO-521-TEST", status: "active", workspaceGroup: "active", canManageLifecycle: true, updatedAt: "a" },
  { id: 2, name: "ELARA EAST", code: "ELA01", status: "active", workspaceGroup: "active", canManageLifecycle: true, updatedAt: "b" },
  { id: 3, name: "IBQ Lithium Extraction Plant", code: "IBQ-LIT", status: "active", workspaceGroup: "active", canManageLifecycle: true, updatedAt: "c" },
  { id: 4, name: "Reusable QA", code: "QA-1", status: "testing", workspaceGroup: "testing", canManageLifecycle: true, updatedAt: "d" },
  { id: 5, name: "Old test", code: "OLD-1", status: "testing", workspaceGroup: "testing", canManageLifecycle: true, updatedAt: "e" },
];
assert.deepEqual(rows.slice(0, 3).map(row => classifyCleanupRow(row, 4)), ["protected-working", "protected-working", "protected-working"]);
assert.equal(classifyCleanupRow(rows[3], 4), "preferred-testing");
assert.deepEqual(testingCleanupCandidateIds(rows, 4), [5]);
assert.deepEqual(retirementReviewQueue(rows, new Set([1, 4, 5]), 4), [5]);
assert.equal(advanceCleanupReviewQueue(beginCleanupReviewQueue([5]), 5).currentProjectId, null);

const [dialog, dashboard] = await Promise.all([
  readFile(new URL("../components/ProjectCleanupDialog.tsx", import.meta.url), "utf8"),
  readFile(new URL("./Dashboard.tsx", import.meta.url), "utf8"),
]);
for (const contract of ["Protected working project", "Preferred reusable QA workspace", "Select testing candidates", "onReviewRetirementQueue"]) assert.match(dialog, new RegExp(contract));
assert.match(dashboard, /advanceCleanupReviewQueue/);
assert.match(dashboard, /Every record was preserved/);

console.log("Headquarters lifecycle Block 5 acceptance: PASS");
