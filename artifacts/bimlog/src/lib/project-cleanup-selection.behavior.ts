import assert from "node:assert/strict";
import { classifyCleanupRow, reconcileCleanupSelection, retirementReviewQueue, selectableCleanupRows, summarizeCleanupSelection, testingCleanupCandidateIds, toggleCleanupSelection, toWorkspaceStateBatchItems, type ProjectCleanupRow } from "./project-cleanup-selection";

const rows: ProjectCleanupRow[] = [
  { id: 1, name: "521", code: "PRO-521-TEST", status: "active", workspaceGroup: "active", canManageLifecycle: true, updatedAt: "2026-10-08T10:00:00.000Z", memberCount: 2, fileCount: 3 },
  { id: 2, name: "QA", code: "QA", status: "testing", workspaceGroup: "testing", canManageLifecycle: true, updatedAt: "2026-10-08T11:00:00.000Z", memberCount: 1, fileCount: 4 },
  { id: 3, name: "Read only", code: "RO", status: "active", workspaceGroup: "active", canManageLifecycle: false, updatedAt: "2026-10-08T12:00:00.000Z" },
];

assert.deepEqual(selectableCleanupRows(rows).map(row => row.id), [1, 2]);
assert.deepEqual([...reconcileCleanupSelection(new Set([1, 3, 99]), rows)], [1]);
assert.deepEqual([...toggleCleanupSelection(new Set([1]), 2)], [1, 2]);
assert.deepEqual([...toggleCleanupSelection(new Set([1, 2]), 1)], [2]);
assert.deepEqual(summarizeCleanupSelection(rows, new Set([1, 2])), { selectedCount: 2, activeCount: 1, testingCount: 1, retiredCount: 0, memberCount: 3, fileCount: 7 });
assert.deepEqual(toWorkspaceStateBatchItems(rows, new Set([2])), [{ projectId: 2, expectedUpdatedAt: "2026-10-08T11:00:00.000Z" }]);
assert.equal(classifyCleanupRow(rows[0], null), "protected-working");
assert.equal(classifyCleanupRow(rows[1], 2), "preferred-testing");
assert.equal(classifyCleanupRow(rows[1], null), "testing-review");
assert.deepEqual(testingCleanupCandidateIds(rows, null), [2]);
assert.deepEqual(testingCleanupCandidateIds(rows, 2), []);
assert.deepEqual(retirementReviewQueue(rows, new Set([1, 2]), null), [2]);

console.log("Headquarters cleanup selection behavior: PASS");
