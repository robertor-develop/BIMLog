import assert from "node:assert/strict";
import { reconcileRecords, type RecordReconciliationSnapshot } from "./ux-record-reconciliation";

const before: RecordReconciliationSnapshot = {
  recordIds: ["r1", "r2"],
  relationships: { attachments: ["r1:file-a"], assignments: ["r2:user-7"], historical_links: ["r1:revision-1"] },
};
const after: RecordReconciliationSnapshot = {
  recordIds: ["r1", "r2-next"],
  relationships: { attachments: ["r1:file-a"], assignments: ["r2-next:user-7"], historical_links: ["r1:revision-1"] },
};

const failed = reconcileRecords(before, after, []);
assert.equal(failed.status, "unexplained_delta");
assert.equal(failed.unexplained.length, 4);

const passed = reconcileRecords(before, after, [
  { kind: "record", sourceId: "r2", targetId: "r2-next", disposition: "explicitly_mapped", reason: "Reviewed stable external identity" },
  { kind: "assignments", sourceId: "r2:user-7", targetId: "r2-next:user-7", disposition: "explicitly_mapped", reason: "Assignment follows reviewed record mapping" },
]);
assert.equal(passed.status, "pass");
assert.deepEqual(passed.counts, {
  records: { before: 2, after: 2 },
  attachments: { before: 1, after: 1 },
  assignments: { before: 1, after: 1 },
  historical_links: { before: 1, after: 1 },
});
assert.throws(() => reconcileRecords({ ...before, recordIds: ["r1", "r1"] }, after, []), /INVALID_BEFORE_RECORD/);
console.log("UX092 record and relationship reconciliation: PASS");
