import assert from "node:assert/strict";
import { buildAuthorizedReportPivot, reconcilePivot } from "./report-view-pivots";

const rows = [
  { dataset: "rfi" as const, recordId: "11", version: 2, status: "open", company: "BIMTECH", reviewerStepId: "a" },
  { dataset: "rfi" as const, recordId: "11", version: 2, status: "open", company: "BIMTECH", reviewerStepId: "b" },
  { dataset: "submittal" as const, recordId: "11", version: 1, status: "open", company: null },
];
const pivot = buildAuthorizedReportPivot(rows, "status");
assert.equal(pivot.groups[0].rowCount, 3);
assert.equal(pivot.groups[0].distinctRecordCount, 2, "parallel reviewers must not inflate distinct record counts");
assert.deepEqual(reconcilePivot(pivot, rows), { rowCount: 3, distinctRecordCount: 2, rowsReconcile: true, distinctRecordsReconcile: true });
console.log("C038 authorized RFI/Submittal pivots: PASS");
