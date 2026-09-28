import assert from "node:assert/strict";
import { addDailyRecordRevision, createDailyFieldRecord, dailyRecordsForProject } from "./daily-field-record";

const record = createDailyFieldRecord({ recordId: "DR-8-1", projectId: 8, recordDate: "2026-09-28", locationId: "LEVEL-02", authorId: "user-4", existing: [], duplicatePolicy: "reject", recordedAt: "2026-09-28T12:00:00Z" });
assert.equal(record.revisions[0]?.state, "draft");
const reviewed = addDailyRecordRevision(record, { revisionId: "DR-8-1:r2", authorId: "reviewer-2", state: "in_review", recordedAt: "2026-09-28T13:00:00Z" });
assert.deepEqual(reviewed.revisions.map(revision => revision.state), ["draft", "in_review"], "draft and review history remains append-only");
assert.throws(() => createDailyFieldRecord({ recordId: "DR-8-2", projectId: 8, recordDate: "2026-09-28", locationId: "LEVEL-02", authorId: "user-4", existing: [record], duplicatePolicy: "reject", recordedAt: "2026-09-28T14:00:00Z" }), /already exists/);
const separate = createDailyFieldRecord({ recordId: "DR-8-2", projectId: 8, recordDate: "2026-09-28", locationId: "LEVEL-02", authorId: "user-4", existing: [record], duplicatePolicy: "allow_separate_record", recordedAt: "2026-09-28T14:00:00Z" });
assert.equal(dailyRecordsForProject([record, separate, { ...record, recordId: "foreign", projectId: 9 }], 8).length, 2, "company/project access cannot leak foreign records");
console.log("C071 dated daily record and immutable review history: PASS");
